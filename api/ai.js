/* Server-side AI proxy.
   The provider key stays HERE, never in a player's browser, so it cannot be
   copied and the free quota cannot be drained. This is also the only place a
   rate limit is real - a limit in the browser can simply be deleted. */

import { redisConfig, pipeline, today, clientIp } from './_store.js';

const DEFAULTS = {
  baseUrl: 'https://integrate.api.nvidia.com/v1',
  model: 'meta/llama-3.2-90b-vision-instruct',
  perUserPerDay: 10,
  totalPerDay: 200,
  perMinute: 3,
};

function num(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function limits() {
  return {
    perUserPerDay: num(process.env.AI_DAILY_PER_USER, DEFAULTS.perUserPerDay),
    totalPerDay: num(process.env.AI_DAILY_TOTAL, DEFAULTS.totalPerDay),
    perMinute: num(process.env.AI_PER_MINUTE, DEFAULTS.perMinute),
  };
}

/* Who is asking. The IP comes from the platform and is far harder to fake
   than anything the page sends, so it is the main key. Anonymous "nodev"
   visitors all share one device bucket, so dropping the id buys nobody headroom. */
function callerKeys(req, body) {
  const ip = clientIp(req);
  const device = String(body.visitor || '').slice(0, 64) || 'nodev';
  return { ip, device };
}

/* Returns null when allowed, or a message when the caller must wait. */
async function checkLimits(cfg, keys) {
  const L = limits();
  const day = today();
  const minute = new Date().toISOString().slice(0, 16); // YYYY-MM-DDTHH:MM
  const ipDay = `ai:ip:${keys.ip}:${day}`;
  const devDay = `ai:dev:${keys.device}:${day}`;
  const burst = `ai:burst:${keys.ip}:${minute}`;
  const total = `ai:total:${day}`;

  const out = await pipeline(cfg, [
    ['INCR', burst], ['EXPIRE', burst, 120],
    ['INCR', ipDay], ['EXPIRE', ipDay, 172800],
    ['INCR', devDay], ['EXPIRE', devDay, 172800],
    ['INCR', total], ['EXPIRE', total, 172800],
  ]);
  const burstCount = Number(out[0].result) || 0;
  const ipCount = Number(out[2].result) || 0;
  const devCount = Number(out[4].result) || 0;
  const totalCount = Number(out[6].result) || 0;

  if (burstCount > L.perMinute) {
    return { status: 429, error: 'Slow down a moment - that is ' + L.perMinute + ' analyses in a minute. Try again shortly.' };
  }
  if (ipCount > L.perUserPerDay || devCount > L.perUserPerDay) {
    return { status: 429, error: 'You have used your ' + L.perUserPerDay + ' free analyses for today. Come back tomorrow.' };
  }
  if (totalCount > L.totalPerDay) {
    return { status: 429, error: 'The team has used all ' + L.totalPerDay + ' free analyses for today. Try again tomorrow.' };
  }
  return { ok: true, remaining: Math.max(0, L.perUserPerDay - Math.max(ipCount, devCount)) };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') { res.status(405).json({ ok: false, error: 'Use POST' }); return; }

  // Either provider can hold the shared key. Gemini is checked first: its
  // free tier is the most generous and the coach likely has a key already.
  const geminiKey = process.env.GEMINI_API_KEY || '';
  const openaiKey = process.env.NVIDIA_API_KEY || process.env.AI_PROXY_KEY || '';
  const mode = geminiKey ? 'gemini' : (openaiKey ? 'openai' : null);
  if (!mode) { res.status(503).json({ ok: false, error: 'The shared team model is not set up yet.' }); return; }

  const store = redisConfig();
  if (!store) {
    // Without a store there is no way to count usage, and an uncounted free
    // key is a key that gets drained. Refuse rather than leave it open.
    res.status(503).json({ ok: false, error: 'The free server model needs its usage store connected first.' });
    return;
  }

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  } catch {
    res.status(400).json({ ok: false, error: 'Bad request body.' });
    return;
  }

  const parts = Array.isArray(body.parts) ? body.parts : null;
  if (!parts || !parts.length) { res.status(400).json({ ok: false, error: 'Nothing to analyse.' }); return; }
  if (parts.length > 24) { res.status(400).json({ ok: false, error: 'Too many images in one request.' }); return; }
  if (parts.some(p => p.videoB64)) {
    res.status(400).json({ ok: false, error: 'This model reads still frames, not video. Use Gemini for full video.' });
    return;
  }

  let gate;
  try {
    gate = await checkLimits(store, callerKeys(req, body));
  } catch {
    res.status(503).json({ ok: false, error: 'Could not check the usage limit. Try again shortly.' });
    return;
  }
  if (!gate.ok) { res.status(gate.status).json({ ok: false, error: gate.error }); return; }

  const maxTokens = Math.min(num(body.maxTokens, 3000), 4000);

  try {
    let payload, text, model;

    if (mode === 'gemini') {
      // lite by default: roughly 500 free requests a day instead of 20
      model = process.env.AI_PROXY_MODEL || 'gemini-flash-lite-latest';
      const gParts = parts.map(p => (p.text != null
        ? { text: String(p.text).slice(0, 20000) }
        : { inline_data: { mime_type: 'image/jpeg', data: p.imageB64 } }));
      const url = 'https://generativelanguage.googleapis.com/v1beta/models/'
        + encodeURIComponent(model) + ':generateContent';
      const upstream = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': geminiKey },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: gParts }],
          generationConfig: { maxOutputTokens: Math.max(maxTokens * 2, 8192) },
        }),
      });
      payload = await upstream.json().catch(() => ({}));
      if (!upstream.ok) {
        const m = (payload && payload.error && payload.error.message) || ('The model returned ' + upstream.status);
        res.status(502).json({ ok: false, error: String(m).slice(0, 300) });
        return;
      }
      const cand = payload.candidates && payload.candidates[0];
      text = ((cand && cand.content && cand.content.parts) || []).map(p => p.text || '').join('');
    } else {
      const baseUrl = (process.env.AI_PROXY_BASE_URL || DEFAULTS.baseUrl).replace(/[/]+$/, '');
      model = process.env.AI_PROXY_MODEL || DEFAULTS.model;
      const content = parts.map(p => (p.text != null
        ? { type: 'text', text: String(p.text).slice(0, 20000) }
        : { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,' + p.imageB64 } }));
      const upstream = await fetch(baseUrl + '/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + openaiKey },
        body: JSON.stringify({ model, max_tokens: maxTokens, messages: [{ role: 'user', content }] }),
      });
      payload = await upstream.json().catch(() => ({}));
      if (!upstream.ok) {
        const m = (payload && payload.error && payload.error.message) || payload.detail || ('The model returned ' + upstream.status);
        res.status(502).json({ ok: false, error: String(m).slice(0, 300) });
        return;
      }
      const msg = payload.choices && payload.choices[0] && payload.choices[0].message && payload.choices[0].message.content;
      text = typeof msg === 'string' ? msg : (msg || []).map(c => c.text || '').join('');
    }

    if (!text) { res.status(502).json({ ok: false, error: 'The model sent an empty reply.' }); return; }
    res.status(200).json({ ok: true, text, remaining: gate.remaining, model });
  } catch (err) {
    res.status(502).json({ ok: false, error: 'Could not reach the model.' });
  }
}

/* ShuttleIQ v6 — AI layer: frame extraction + multi-provider vision calls.
   Everything else in the app works without a key; add one in Settings to
   unlock analysis, comparison, and AI coach notes.

   A "parts" list is provider-neutral: [{text: '...'} | {imageB64: '...'}].
   Each provider adapter reshapes it into that API's request format. */

const AI_PROVIDERS = {
  anthropic: {
    label: 'Anthropic (Claude)',
    defaultModel: 'claude-sonnet-5',
    models: ['claude-sonnet-5', 'claude-opus-4-8', 'claude-haiku-4-5-20251001'],
    help: 'Get a key at console.anthropic.com. Calls go straight from this browser to api.anthropic.com.',
  },
  gemini: {
    label: 'Google (Gemini)',
    defaultModel: 'gemini-2.5-flash',
    models: ['gemini-2.5-flash', 'gemini-2.5-pro'],
    help: 'Get a key at aistudio.google.com (free tier available). Calls go straight to generativelanguage.googleapis.com.',
  },
  openai: {
    label: 'OpenAI-compatible',
    defaultModel: 'gpt-4o-mini',
    models: ['gpt-4o-mini', 'gpt-4o'],
    needsBaseUrl: true,
    defaultBaseUrl: 'https://api.openai.com/v1',
    help: 'Any endpoint that speaks the OpenAI chat/completions format and allows browser requests (OpenRouter, Groq, Together, a local server). Note: api.openai.com itself may block direct browser calls.',
  },
};

function aiConfig() {
  const s = state.settings;
  const provider = AI_PROVIDERS[s.provider] ? s.provider : 'anthropic';
  const def = AI_PROVIDERS[provider];
  let model = s.model.trim() || def.defaultModel;
  if (provider === 'gemini') model = model.replace(/^models\//, ''); // tolerate the "models/…" form from Google docs
  const baseUrl = (s.baseUrl.trim() || def.defaultBaseUrl || '')
    .replace(/\/+$/, '')
    .replace(/\/chat\/completions$/, ''); // tolerate pasting the full endpoint path
  return { provider, apiKey: s.apiKey.trim(), model, baseUrl };
}

function hasApiKey() {
  return Boolean(state.settings.apiKey);
}

/* ---------- video frame sampling ---------- */

/* Recorded webm blobs report Infinity duration until forced to resolve.
   Waits for metadata, applies the seek-to-end trick if needed, bails at 3s. */
function ensureDuration(videoEl) {
  return new Promise(resolve => {
    const finish = () => resolve(videoEl.duration);
    const fix = () => {
      if (isFinite(videoEl.duration) && videoEl.duration > 0) { finish(); return; }
      const onDur = () => {
        if (!isFinite(videoEl.duration)) return;
        videoEl.removeEventListener('durationchange', onDur);
        clearTimeout(bail);
        videoEl.currentTime = 0;
        finish();
      };
      const bail = setTimeout(() => { videoEl.removeEventListener('durationchange', onDur); finish(); }, 3000);
      videoEl.addEventListener('durationchange', onDur);
      videoEl.currentTime = 1e10;
    };
    if (videoEl.readyState >= 1) fix();
    else videoEl.addEventListener('loadedmetadata', fix, { once: true });
  });
}

/* Sample evenly-spaced JPEG frames from a loaded <video>. */
async function extractFrames(videoEl, frameCount = 8) {
  const duration = await ensureDuration(videoEl);
  if (!duration || !isFinite(duration)) throw new Error('Could not read the video duration — reload the clip and try again.');
  const canvas = document.createElement('canvas');
  const scale = Math.min(1, 768 / videoEl.videoWidth);
  canvas.width = Math.round(videoEl.videoWidth * scale);
  canvas.height = Math.round(videoEl.videoHeight * scale);
  const ctx = canvas.getContext('2d');
  const frames = [];
  for (let i = 0; i < frameCount; i++) {
    const time = (duration * (i + 0.5)) / frameCount;
    await seekTo(videoEl, time);
    ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
    frames.push({ time, b64: canvas.toDataURL('image/jpeg', 0.7).split(',')[1] });
  }
  return frames;
}

function seekTo(videoEl, time) {
  return new Promise((resolve, reject) => {
    const onSeeked = () => { cleanup(); resolve(); };
    const onError = () => { cleanup(); reject(new Error('Could not seek video.')); };
    const cleanup = () => {
      videoEl.removeEventListener('seeked', onSeeked);
      videoEl.removeEventListener('error', onError);
    };
    videoEl.addEventListener('seeked', onSeeked);
    videoEl.addEventListener('error', onError);
    videoEl.currentTime = time;
  });
}

function fmtTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

/* ---------- provider adapters ---------- */

async function callAI(parts, maxTokens = 3000) {
  const cfg = aiConfig();
  if (!cfg.apiKey) throw new Error('No API key set. Add one in Settings.');
  if (cfg.provider === 'anthropic') return callAnthropic(cfg, parts, maxTokens);
  if (cfg.provider === 'gemini') return callGemini(cfg, parts, maxTokens);
  return callOpenAI(cfg, parts, maxTokens);
}

async function readJsonResponse(response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const msg = payload?.error?.message || payload?.error?.status || `Request failed (${response.status})`;
    throw new Error(msg);
  }
  return payload;
}

async function callAnthropic(cfg, parts, maxTokens) {
  const content = parts.map(p => p.text != null
    ? { type: 'text', text: p.text }
    : { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: p.imageB64 } });
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': cfg.apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({ model: cfg.model, max_tokens: maxTokens, messages: [{ role: 'user', content }] }),
  });
  const payload = await readJsonResponse(response);
  const text = payload.content?.find(b => b.type === 'text')?.text || '';
  if (!text) throw new Error('The AI returned an empty reply.');
  return text;
}

async function callGemini(cfg, parts, maxTokens) {
  const gParts = parts.map(p => p.text != null
    ? { text: p.text }
    : { inline_data: { mime_type: 'image/jpeg', data: p.imageB64 } });
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(cfg.model)}:generateContent`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': cfg.apiKey },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: gParts }],
      // generous cap: Gemini 2.5 models spend part of this budget on internal reasoning
      generationConfig: { maxOutputTokens: Math.max(maxTokens * 2, 8192) },
    }),
  });
  const payload = await readJsonResponse(response);
  const text = (payload.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('');
  if (!text) throw new Error('The AI returned an empty reply' + (payload.candidates?.[0]?.finishReason ? ` (${payload.candidates[0].finishReason})` : '') + '.');
  return text;
}

async function callOpenAI(cfg, parts, maxTokens) {
  const content = parts.map(p => p.text != null
    ? { type: 'text', text: p.text }
    : { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${p.imageB64}` } });
  const send = body => fetch(`${cfg.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${cfg.apiKey}` },
    body: JSON.stringify(body),
  });
  const base = { model: cfg.model, messages: [{ role: 'user', content }] };
  let response = await send({ ...base, max_tokens: maxTokens });
  if (!response.ok) {
    // newer OpenAI models renamed the parameter; retry once before giving up
    const errText = await response.clone().text().catch(() => '');
    if (errText.includes('max_completion_tokens')) {
      response = await send({ ...base, max_completion_tokens: maxTokens });
    }
  }
  const payload = await readJsonResponse(response);
  const msg = payload.choices?.[0]?.message?.content;
  const text = typeof msg === 'string' ? msg : (msg || []).map(p => p.text || '').join('');
  if (!text) throw new Error('The AI returned an empty reply.');
  return text;
}

/* Cheap end-to-end check that the key/model/endpoint actually work. */
async function testAIKey() {
  return callAI([{ text: 'Reply with exactly: OK' }], 500);
}

function parseJsonReply(text) {
  // Model is asked for raw JSON, but strip a markdown fence if one sneaks in.
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  const start = cleaned.search(/[[{]/);
  if (start === -1) throw new Error('AI reply contained no JSON.');
  const body = cleaned.slice(start);
  try {
    return JSON.parse(body);
  } catch {
    // trailing prose after the JSON — cut at the last closing bracket and retry
    const end = Math.max(body.lastIndexOf('}'), body.lastIndexOf(']'));
    if (end > 0) {
      try { return JSON.parse(body.slice(0, end + 1)); } catch { /* fall through */ }
    }
    throw new Error('AI reply was not valid JSON — try again.');
  }
}

/* ---------- coaching calls ---------- */

const FOCUS_MAP = {
  all: 'Analyze all aspects of play.',
  footwork: 'Focus primarily on footwork, court coverage, and movement between shots.',
  smash: 'Focus primarily on smash technique, power generation, and attacking shots.',
  serve: 'Focus primarily on serve technique, placement, and consistency.',
  net: 'Focus primarily on net play: net kills, tight net shots, and front-court control.',
  defense: 'Focus primarily on defensive positioning, lifts, and blocks under attack.',
};

function frameParts(frames) {
  return frames.map(f => ({ imageB64: f.b64 }));
}

/* Full gameplay analysis — returns {feedback: [...], scores: {...}} */
async function analyzeGameplay(frames, focus) {
  const prompt = `You are an expert badminton coach reviewing gameplay footage. The images are chronological frames sampled from a short clip.
Frame timestamps:
${frames.map((f, i) => `Frame ${i + 1}: ${fmtTime(f.time)}`).join('\n')}
${FOCUS_MAP[focus] || FOCUS_MAP.all}

Return ONLY a JSON object, no markdown fences, with this shape:
{
  "feedback": [
    {"timestamp": "M:SS", "type": "critical|suggestion|positive", "title": "max 6 words", "body": "2-3 sentences of specific coaching", "tip": "one concrete drill or fix"}
  ],
  "scores": {"footwork": 0-100, "smash": 0-100, "serve": 0-100, "defense": 0-100, "net": 0-100, "consistency": 0-100}
}
Rules: 5-9 feedback items, include at least one positive, timestamps must match the provided frames, scores must be honest (a school player rarely exceeds 75).`;
  const text = await callAI([...frameParts(frames), { text: prompt }]);
  const parsed = parseJsonReply(text);
  if (!parsed.feedback || !parsed.scores) throw new Error('AI reply missing expected fields.');
  return parsed;
}

/* Side-by-side comparison: player frames vs pro frames.
   proNotes: optional style/watch-for context when the pro was picked from the reference list. */
async function compareWithPro(playerFrames, proFrames, proNotes) {
  const prompt = `You are an expert badminton coach. The first ${playerFrames.length} images are chronological frames of a student player. The next ${proFrames.length} images are chronological frames of a professional player performing similar play.
${proNotes ? `Context about the professional: ${proNotes}` : ''}
Compare the student to the professional.
Return ONLY a JSON object, no markdown fences:
{
  "summary": "3-4 sentence overall comparison",
  "differences": [
    {"area": "short label e.g. Smash preparation", "student": "what the student does", "pro": "what the pro does differently", "fix": "one concrete adjustment or drill"}
  ]
}
Rules: 4-6 differences, focus on technique visible in the frames, be specific and encouraging.`;
  const text = await callAI([...frameParts(playerFrames), ...frameParts(proFrames), { text: prompt }], 2500);
  const parsed = parseJsonReply(text);
  if (!parsed.summary || !parsed.differences) throw new Error('AI reply missing expected fields.');
  return parsed;
}

/* Text-only coach note for a player from their stats. */
async function aiCoachNote(player) {
  const matches = playerMatches(player.id).slice(0, 12);
  const profile = skillProfile(player.id);
  const form = recentForm(player.id);
  const pos = positionScores(player.id);
  const summary = {
    name: player.name, year: player.year, hand: player.hand,
    skillAverages: profile,
    recentForm: form,
    positionFit: pos,
    recentMatches: matches.map(m => ({
      date: m.date, result: m.result, discipline: m.discipline,
      opponent: m.opponent, score: m.score, ratings: m.ratings,
    })),
  };
  const prompt = `You are a varsity badminton coach. Here is a player's data as JSON:
${JSON.stringify(summary, null, 1)}
Write a short coaching note (120-180 words, plain prose, no headings or bullets) covering: current form, best position and why, top strength, the single most important thing to improve with a concrete drill, and one tactical tip for their next match.`;
  return callAI([{ text: prompt }], 600);
}

/* ---------- demo analysis (no key) ----------
   Lets anyone see what the feedback UI looks like. Clearly labeled and never
   saved to a player's profile, so fake numbers can't pollute real stats. */

function demoAnalysis(focus) {
  const scores = { footwork: 58, smash: 64, serve: 52, defense: 60, net: 47, consistency: 62 };
  if (scores[focus] != null) scores[focus] += 6;
  return {
    demo: true,
    scores,
    feedback: [
      { timestamp: '0:07', type: 'positive', title: 'Good ready posture', body: 'Knees bent and racket up between shots. This is a sample card — add an API key in Settings and the feedback will describe your actual clip.', tip: 'Keep the racket head above wrist height while waiting.' },
      { timestamp: '0:19', type: 'critical', title: 'Late split step', body: 'In a real analysis this card would point at the exact moment your timing slipped, with the video jumping there when you click.', tip: 'Partner claps, you split — 3 rounds of 30 seconds.' },
      { timestamp: '0:33', type: 'suggestion', title: 'Vary serve placement', body: 'Sample suggestion: mixing low serves to the T with occasional flicks keeps receivers honest.', tip: 'Serve 20 low, then randomly mix 1-in-4 flick serves.' },
      { timestamp: '0:41', type: 'suggestion', title: 'Recover through base', body: 'Sample suggestion: after each shot, push back to your base position before the opponent hits.', tip: 'Shadow 10 rallies focusing only on recovery steps.' },
      { timestamp: '0:52', type: 'positive', title: 'Committed follow-through', body: 'Sample positive: full swings rather than tentative pushes — real analysis will confirm which shots this applies to.', tip: 'Keep swinging through contact on clears and smashes.' },
    ],
  };
}

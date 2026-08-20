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

/* Grab full-resolution JPEG frames at specific timestamps. */
async function extractFramesAt(videoEl, times) {
  const canvas = document.createElement('canvas');
  const scale = Math.min(1, 768 / videoEl.videoWidth);
  canvas.width = Math.round(videoEl.videoWidth * scale);
  canvas.height = Math.round(videoEl.videoHeight * scale);
  const ctx = canvas.getContext('2d');
  const frames = [];
  for (const time of times) {
    await seekTo(videoEl, time);
    ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
    frames.push({ time, b64: canvas.toDataURL('image/jpeg', 0.7).split(',')[1] });
  }
  return frames;
}

/* Sample evenly-spaced JPEG frames from a loaded <video>. */
async function extractFrames(videoEl, frameCount = 8) {
  const duration = await ensureDuration(videoEl);
  if (!duration || !isFinite(duration)) throw new Error('Could not read the video duration — reload the clip and try again.');
  const times = [];
  for (let i = 0; i < frameCount; i++) times.push((duration * (i + 0.5)) / frameCount);
  return extractFramesAt(videoEl, times);
}

/* ---------- motion-aware sampling ----------
   Evenly-spaced frames across a minute mostly catch players standing between
   rallies. This does a fast low-res pass to find where movement actually
   happens, then pulls the real frames from those moments instead. */

async function motionProfile(videoEl, maxSamples, onProgress) {
  const duration = await ensureDuration(videoEl);
  if (!duration || !isFinite(duration)) throw new Error('Could not read the video duration — reload the clip and try again.');
  const w = 64, h = 36;
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const samples = [];
  let prev = null;
  for (let i = 0; i < maxSamples; i++) {
    const time = (duration * (i + 0.5)) / maxSamples;
    await seekTo(videoEl, time);
    ctx.drawImage(videoEl, 0, 0, w, h);
    const data = ctx.getImageData(0, 0, w, h).data;
    let score = 0;
    if (prev) {
      for (let p = 0; p < data.length; p += 4) {
        score += Math.abs(data[p] - prev[p]) + Math.abs(data[p + 1] - prev[p + 1]) + Math.abs(data[p + 2] - prev[p + 2]);
      }
    }
    samples.push({ time, score });
    prev = data;
    if (onProgress && i % 6 === 0) onProgress(Math.round((i / maxSamples) * 100));
  }
  return { samples, duration };
}

/* Highest-motion moments, kept apart so we don't return one rally eight times. */
function pickPeaks(samples, count, minGap) {
  const chosen = [];
  for (const s of [...samples].sort((a, b) => b.score - a.score)) {
    if (chosen.length >= count) break;
    if (chosen.every(c => Math.abs(c.time - s.time) >= minGap)) chosen.push(s);
  }
  return chosen.sort((a, b) => a.time - b.time);
}

async function extractKeyFrames(videoEl, frameCount = 8, onProgress) {
  const maxSamples = Math.max(16, Math.min(48, Math.round((videoEl.duration || 60) * 1.5)));
  const { samples, duration } = await motionProfile(videoEl, maxSamples, onProgress);
  // Ignore near-zero jitter, but keep genuinely quiet clips workable.
  const peakScore = Math.max(0, ...samples.map(s => s.score));
  const active = samples.filter(s => s.score > peakScore * 0.15);

  // Nothing moved at all (static clip, or a browser that won't hand over pixels).
  if (peakScore === 0 || active.length < 2) {
    return { frames: await extractFrames(videoEl, frameCount), mode: 'even' };
  }

  const minGap = Math.max(0.4, duration / (frameCount * 2.5));
  const times = pickPeaks(active, frameCount, minGap).map(p => p.time);

  // Fewer bursts than frames requested — fill the rest with evenly spaced
  // moments so the coach still sees the whole clip, not just its busiest second.
  if (times.length < frameCount) {
    for (let i = 0; i < frameCount && times.length < frameCount; i++) {
      const t = (duration * (i + 0.5)) / frameCount;
      if (times.every(x => Math.abs(x - t) >= minGap)) times.push(t);
    }
  }
  times.sort((a, b) => a - b);
  const frames = await extractFramesAt(videoEl, times.slice(0, frameCount));
  return { frames, mode: 'motion' };
}

/* ---------- native video (Gemini) ----------
   Gemini reads actual video, not stills — it sees the swing, not a pose. This
   is by far the best analysis this app can produce, so it's used whenever the
   provider is Gemini and the clip is small enough to inline. */

const INLINE_VIDEO_LIMIT = 12 * 1024 * 1024; // ~16MB once base64-encoded

function canSendNativeVideo(blob) {
  return aiConfig().provider === 'gemini' && blob && blob.size > 0 && blob.size <= INLINE_VIDEO_LIMIT;
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = () => reject(new Error('Could not read the video file.'));
    reader.readAsDataURL(blob);
  });
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
  const gParts = parts.map(p => {
    if (p.text != null) return { text: p.text };
    if (p.videoB64) return { inline_data: { mime_type: p.mimeType || 'video/webm', data: p.videoB64 } };
    return { inline_data: { mime_type: 'image/jpeg', data: p.imageB64 } };
  });
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

const OUTPUT_SHAPE = `Return ONLY a JSON object, no markdown fences, with this shape:
{
  "feedback": [
    {"timestamp": "M:SS", "type": "critical|suggestion|positive", "title": "max 6 words", "body": "2-3 sentences of specific coaching", "tip": "one concrete drill or fix"}
  ],
  "scores": {"footwork": 0-100, "smash": 0-100, "serve": 0-100, "defense": 0-100, "net": 0-100, "consistency": 0-100},
  "confidence": "high|medium|low",
  "notSeen": ["skills you could not actually assess from this footage"]
}`;

/* Honesty rules matter more than polish here: a confident-sounding note about
   something the model cannot see teaches a student the wrong lesson. */
const HONESTY_RULES = `Rules:
- 5-9 feedback items, at least one positive.
- Only describe what is genuinely visible. Never invent a specific error you cannot see.
- Score a skill only if you actually observed it; if a skill barely appears, give it a mid-range score and list it in "notSeen".
- Be honest about the footage: set "confidence" to low if the angle, distance or quality make real assessment hard.
- Scores must be realistic for a school player — rarely above 75.
- Write for a high-school player: concrete, encouraging, no jargon without explanation.`;

/* Analysis from still frames (any provider). */
async function analyzeGameplay(frames, focus) {
  const prompt = `You are an expert badminton coach reviewing gameplay footage. The images are chronological still frames sampled from a short clip — they were chosen at moments of high movement, so they should show shots and rallies.

Frame timestamps:
${frames.map((f, i) => `Frame ${i + 1}: ${fmtTime(f.time)}`).join('\n')}
${FOCUS_MAP[focus] || FOCUS_MAP.all}

IMPORTANT: these are still images, so you cannot see timing, speed, or shuttle flight. Comment on what a still can show — body position, racket preparation, contact point, stance, court position, balance — and do not claim to judge timing or rhythm.

${OUTPUT_SHAPE}
${HONESTY_RULES}
- Every timestamp must be one of the frame timestamps listed above.`;
  const text = await callAI([...frameParts(frames), { text: prompt }]);
  const parsed = parseJsonReply(text);
  if (!parsed.feedback || !parsed.scores) throw new Error('AI reply missing expected fields.');
  return { ...parsed, method: 'frames' };
}

/* Analysis from the actual video (Gemini) — the model sees motion, so it can
   judge timing, footwork sequences and shot preparation properly. */
async function analyzeGameplayVideo(blob, focus, durationSec) {
  const videoB64 = await blobToBase64(blob);
  const prompt = `You are an expert badminton coach reviewing a player's gameplay video (${durationSec ? Math.round(durationSec) + ' seconds' : 'about a minute'} long).
${FOCUS_MAP[focus] || FOCUS_MAP.all}

Because you can see the video move, assess what stills cannot show: footwork sequence and recovery to base, split-step timing, swing mechanics through contact, shot selection during rallies, and how the player moves between shots.

${OUTPUT_SHAPE}
${HONESTY_RULES}
- Timestamps must be real moments in the video, formatted M:SS, and within its duration.`;
  const text = await callAI([{ videoB64, mimeType: blob.type || 'video/webm' }, { text: prompt }], 3000);
  const parsed = parseJsonReply(text);
  if (!parsed.feedback || !parsed.scores) throw new Error('AI reply missing expected fields.');
  return { ...parsed, method: 'video' };
}

/* Single entry point: use the best analysis this provider and clip allow. */
async function runGameplayAnalysis({ videoEl, blob, focus, onStatus = () => {} }) {
  if (canSendNativeVideo(blob)) {
    onStatus('Uploading the video for full-motion analysis…');
    try {
      return await analyzeGameplayVideo(blob, focus, videoEl?.duration);
    } catch (err) {
      // payload rejected / too large / model can't take video — fall back cleanly
      onStatus('Video analysis unavailable, falling back to key frames…');
      console.warn('Native video analysis failed, using frames instead:', err);
    }
  }
  onStatus('Finding the moments with the most action…');
  const { frames, mode } = await extractKeyFrames(videoEl, 8, pct => onStatus(`Scanning the clip for action… ${pct}%`));
  onStatus(`Sending ${frames.length} key moments to the AI coach…`);
  const result = await analyzeGameplay(frames, focus);
  return { ...result, sampling: mode };
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

/* Pre-match tactical brief for the coach, from real history against this opponent. */
async function aiMatchBrief(opponent, lineup) {
  const past = state.matches.filter(m => (m.opponent || '').toLowerCase() === opponent.toLowerCase());
  const wins = past.filter(m => m.result === 'W').length;
  const summary = {
    opponent,
    ourRecordVsThem: `${wins}-${past.length - wins}`,
    pastMeetings: past.slice(0, 12).map(m => ({
      date: m.date, discipline: m.discipline, result: m.result, score: m.score,
      player: playerName(m.playerId), partner: m.partnerId ? playerName(m.partnerId) : null, notes: m.notes || undefined,
    })),
    plannedLineup: lineup.map(l => ({
      slot: l.slot,
      players: l.players.map(id => ({
        name: playerName(id),
        skills: skillProfile(id),
        recentForm: recentForm(id),
        bestPosition: positionScores(id)?.best,
      })),
    })),
  };
  const prompt = `You are a varsity badminton coach preparing your team for a match. Here is the data as JSON:
${JSON.stringify(summary, null, 1)}

Write a tactical brief for the coaching staff. Return ONLY a JSON object, no markdown fences:
{
  "headline": "one sentence on how this matchup looks",
  "keyPoints": ["3-5 short tactical points grounded in the data above"],
  "perSlot": [{"slot": "slot code", "advice": "one or two sentences of specific guidance for the players in that slot"}],
  "watchOut": "the single biggest risk in this match"
}
Base everything on the data provided — if history is thin, say so rather than inventing detail.`;
  const text = await callAI([{ text: prompt }], 1200);
  const parsed = parseJsonReply(text);
  if (!parsed.headline || !parsed.keyPoints) throw new Error('AI reply missing expected fields.');
  return parsed;
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

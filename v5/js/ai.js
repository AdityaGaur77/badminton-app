/* ShuttleIQ v5 — AI layer: frame extraction + Claude vision calls.
   Works once an API key is saved in Settings; everything else in the app runs without it. */

const FOCUS_MAP = {
  all: 'Analyze all aspects of play.',
  footwork: 'Focus primarily on footwork, court coverage, and movement between shots.',
  smash: 'Focus primarily on smash technique, power generation, and attacking shots.',
  serve: 'Focus primarily on serve technique, placement, and consistency.',
  net: 'Focus primarily on net play: net kills, tight net shots, and front-court control.',
  defense: 'Focus primarily on defensive positioning, lifts, and blocks under attack.',
};

function hasApiKey() {
  return Boolean(state.settings.apiKey);
}

/* Sample evenly-spaced JPEG frames from a loaded <video>. */
async function extractFrames(videoEl, frameCount = 8) {
  const duration = videoEl.duration;
  if (!duration || !isFinite(duration)) throw new Error('Video has no readable duration.');
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

async function callClaude(content, maxTokens = 3000) {
  const { apiKey, model } = state.settings;
  if (!apiKey) throw new Error('No API key set. Add one in Settings.');
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages: [{ role: 'user', content }],
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error?.message || `Request failed (${response.status})`);
  }
  const text = payload.content?.find(b => b.type === 'text')?.text || '';
  return text;
}

function parseJsonReply(text) {
  // Model is asked for raw JSON, but strip a markdown fence if one sneaks in.
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  const start = cleaned.search(/[[{]/);
  if (start === -1) throw new Error('AI reply contained no JSON.');
  return JSON.parse(cleaned.slice(start));
}

function fmtTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function frameBlocks(frames) {
  return frames.map(f => ({
    type: 'image',
    source: { type: 'base64', media_type: 'image/jpeg', data: f.b64 },
  }));
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
  const text = await callClaude([...frameBlocks(frames), { type: 'text', text: prompt }]);
  const parsed = parseJsonReply(text);
  if (!parsed.feedback || !parsed.scores) throw new Error('AI reply missing expected fields.');
  return parsed;
}

/* Side-by-side comparison: player frames vs pro frames. */
async function compareWithPro(playerFrames, proFrames) {
  const prompt = `You are an expert badminton coach. The first ${playerFrames.length} images are chronological frames of a student player. The next ${proFrames.length} images are chronological frames of a professional player performing similar play.
Compare the student to the professional.
Return ONLY a JSON object, no markdown fences:
{
  "summary": "3-4 sentence overall comparison",
  "differences": [
    {"area": "short label e.g. Smash preparation", "student": "what the student does", "pro": "what the pro does differently", "fix": "one concrete adjustment or drill"}
  ]
}
Rules: 4-6 differences, focus on technique visible in the frames, be specific and encouraging.`;
  const text = await callClaude(
    [...frameBlocks(playerFrames), ...frameBlocks(proFrames), { type: 'text', text: prompt }],
    2500
  );
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
  return callClaude([{ type: 'text', text: prompt }], 600);
}

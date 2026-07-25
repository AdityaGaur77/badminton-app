/* ShuttleIQ v6 — persistence: localStorage state + IndexedDB video clips */

const APP_VERSION = '6.3';
const STORE_KEY = 'shuttleiq_v6';
const LEGACY_KEY = 'shuttleiq_v5';

const DEFAULT_STATE = {
  settings: {
    provider: 'anthropic', // 'anthropic' | 'gemini' | 'openai'
    apiKey: '',
    model: '',             // '' = use the provider's default model
    baseUrl: '',           // OpenAI-compatible endpoints only
    teamName: 'ShuttleIQ',
    coachPass: '',         // hash of the coach passcode; '' means not set up yet
    recoveryHash: '',      // hash of the one-time recovery code (resets a forgotten passcode)
    theme: 'midnight',     // 'midnight' | 'court' | 'clean'
    lastBackup: '',        // ISO date of the last exported backup, for the reminder
  },
  players: [],   // {id, name, year, hand, status:'roster'|'tryout'|'cut', availability, tryoutScores, aiNote, notes, createdAt}
  matches: [],   // {id, playerId, partnerId, date, opponent, discipline, result, score, ratings, notes, context}
  sessions: [],  // {id, playerId, date, label, focus, scores, feedback[], clipId}
  rosters: [],   // {id, name, date, slots:[{code, label, type:'singles'|'doubles', playerIds:[]}]}
  ladder: [],    // playerIds in rank order — the team's internal challenge ladder
};

const AVAILABILITY = {
  available: { label: 'Available', chip: 'chip-w' },
  injured: { label: 'Injured', chip: 'chip-l' },
  absent: { label: 'Away', chip: 'chip-neutral' },
};

function playerAvailability(p) {
  return AVAILABILITY[p?.availability] ? p.availability : 'available';
}

function isAvailable(p) {
  return playerAvailability(p) === 'available';
}

let state = loadState();

/* ---------- theme ----------
   Applied as early as possible (this file loads first) to avoid a flash. */

const THEME_META_COLORS = { midnight: '#0e1210', court: '#0d3b26', clean: '#ffffff' };

function applyTheme(name) {
  const t = THEME_META_COLORS[name] ? name : 'midnight';
  state.settings.theme = t;
  document.documentElement.dataset.theme = t;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_META_COLORS[t]);
}

applyTheme(state.settings.theme);

/* Build a valid state from untrusted parsed JSON (imports, old versions):
   only known keys are picked, and each must have the right shape. */
function mergeState(parsed) {
  const base = structuredClone(DEFAULT_STATE);
  const s = parsed.settings || {};
  const str = (v, fallback = '') => (typeof v === 'string' ? v : fallback);
  return {
    settings: {
      provider: str(s.provider, base.settings.provider),
      apiKey: str(s.apiKey),
      model: str(s.model),
      baseUrl: str(s.baseUrl),
      teamName: str(s.teamName) || base.settings.teamName,
      coachPass: str(s.coachPass),
      recoveryHash: str(s.recoveryHash),
      theme: ['midnight', 'court', 'clean'].includes(s.theme) ? s.theme : base.settings.theme,
      lastBackup: str(s.lastBackup),
    },
    players: Array.isArray(parsed.players) ? parsed.players : [],
    matches: Array.isArray(parsed.matches) ? parsed.matches : [],
    sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
    rosters: Array.isArray(parsed.rosters) ? parsed.rosters : [],
    ladder: Array.isArray(parsed.ladder) ? parsed.ladder.filter(id => typeof id === 'string') : [],
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return mergeState(JSON.parse(raw));
    // First run of v6: adopt v5 data if present (the v5 key is left untouched
    // so the archived copy in /v5 keeps working).
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const migrated = mergeState(JSON.parse(legacy));
      migrated.settings.provider = 'anthropic'; // v5 was Claude-only
      return migrated;
    }
    return structuredClone(DEFAULT_STATE);
  } catch {
    return structuredClone(DEFAULT_STATE);
  }
}

function saveState() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
  } catch (err) {
    console.warn('Could not save state:', err);
    if (typeof toast === 'function') toast('Warning: could not save — browser storage may be full.');
  }
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/* ---------- auth / roles ----------
   Role lives per-tab in sessionStorage so closing the tab logs the coach out.
   The passcode is hashed (not stored in plain text) — this is a soft gate for a
   shared team device, not hardened security. */

function hashPass(code) {
  let h = 0x811c9dc5;
  const salt = 'shuttleiq-v5';
  for (const ch of String(code) + salt) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16);
}

function coachPassIsSet() {
  return Boolean(state.settings.coachPass);
}

function setCoachPass(code) {
  state.settings.coachPass = hashPass(code);
  saveState();
}

function checkCoachPass(code) {
  return coachPassIsSet() && hashPass(code) === state.settings.coachPass;
}

/* ---------- recovery code ----------
   Shown once when the passcode is created so a forgotten passcode doesn't
   mean wiping the season. Same soft-gate threat model as the passcode
   itself: it protects against forgetting, not against someone with devtools. */

function makeRecoveryCode() {
  // no 0/O/1/I — these get written on paper and misread
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  const chars = [...bytes].map(b => alphabet[b % alphabet.length]);
  return [chars.slice(0, 4), chars.slice(4, 8), chars.slice(8, 12)].map(g => g.join('')).join('-');
}

function normalizeRecovery(code) {
  return String(code).toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function setRecoveryCode(code) {
  state.settings.recoveryHash = hashPass(normalizeRecovery(code));
  saveState();
}

function checkRecoveryCode(code) {
  return Boolean(state.settings.recoveryHash) && hashPass(normalizeRecovery(code)) === state.settings.recoveryHash;
}

function recoveryIsSet() {
  return Boolean(state.settings.recoveryHash);
}

/* ---------- challenge ladder ----------
   How school teams actually settle lineup order: you play the person above
   you, and if you win you take their spot. Everyone below the loser holds. */

function ladderIds() {
  const roster = state.players.filter(p => p.status === 'roster');
  const rosterIds = new Set(roster.map(p => p.id));
  // keep stored order, drop anyone no longer on the roster
  const ordered = state.ladder.filter(id => rosterIds.has(id));
  // seed newcomers at the bottom, strongest first so a fresh ladder is sensible
  const missing = roster
    .filter(p => !ordered.includes(p.id))
    .sort((a, b) => (winRate(b.id) ?? 0.4) - (winRate(a.id) ?? 0.4))
    .map(p => p.id);
  const full = [...ordered, ...missing];
  if (full.length !== state.ladder.length || full.some((id, i) => state.ladder[i] !== id)) {
    state.ladder = full;
    saveState();
  }
  return full;
}

function ladderRank(playerId) {
  const i = ladderIds().indexOf(playerId);
  return i === -1 ? null : i + 1;
}

/* Challenger beat the defender: challenger takes the defender's rank and
   everyone between shifts down one. Returns the new rank, or null if the
   challenge didn't move anyone (challenger already ranked higher). */
function applyChallengeResult(challengerId, defenderId) {
  const ids = ladderIds();
  const from = ids.indexOf(challengerId);
  const to = ids.indexOf(defenderId);
  if (from === -1 || to === -1 || from <= to) return null;
  ids.splice(from, 1);
  ids.splice(to, 0, challengerId);
  state.ladder = ids;
  saveState();
  return to + 1;
}

function moveOnLadder(playerId, delta) {
  const ids = ladderIds();
  const i = ids.indexOf(playerId);
  const j = i + delta;
  if (i === -1 || j < 0 || j >= ids.length) return false;
  [ids[i], ids[j]] = [ids[j], ids[i]];
  state.ladder = ids;
  saveState();
  return true;
}

/* ---------- backup freshness ----------
   Browsers can evict local data (iOS clears storage for sites left unused),
   so a coach with a season logged should be nudged to keep a backup file. */

function daysSinceBackup() {
  if (!state.settings.lastBackup) return null;
  const then = new Date(state.settings.lastBackup);
  if (isNaN(then)) return null;
  return Math.floor((Date.now() - then.getTime()) / 86400000);
}

function backupIsStale() {
  if (state.matches.length < 5 && state.players.length < 5) return false; // nothing worth protecting yet
  const days = daysSinceBackup();
  return days === null || days >= 14;
}

/* Some managed school devices and private-browsing modes block Storage
   entirely — reads/writes throw. Fall back to in-memory session state so
   logging in still works instead of silently doing nothing. */
const memorySession = {};

function sessionGet(key) {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return memorySession[key] ?? null;
  }
}

function sessionSet(key, value) {
  memorySession[key] = value;
  try { sessionStorage.setItem(key, value); } catch { /* memory-only for this tab */ }
}

function sessionRemove(key) {
  delete memorySession[key];
  try { sessionStorage.removeItem(key); } catch { /* already memory-only */ }
}

function getRole() {
  return sessionGet('shuttleiq_role') || null; // 'coach' | 'student' | null
}

function setRole(role) {
  if (role) {
    sessionSet('shuttleiq_role', role);
  } else {
    sessionRemove('shuttleiq_role');
    sessionRemove('shuttleiq_student');
  }
}

function isCoach() {
  return getRole() === 'coach';
}

/* Which roster player a logged-in student is — lets their dashboard show
   their own stats. Null = signed in as a guest. */
function getStudentId() {
  return sessionGet('shuttleiq_student') || null;
}

function setStudentId(id) {
  if (id) sessionSet('shuttleiq_student', id);
  else sessionRemove('shuttleiq_student');
}

function currentStudent() {
  const id = getStudentId();
  return id ? getPlayer(id) : null;
}

/* ---------- lookups ---------- */

function getPlayer(id) {
  return state.players.find(p => p.id === id) || null;
}

function playerName(id) {
  const p = getPlayer(id);
  return p ? p.name : 'Unknown';
}

function playerMatches(playerId) {
  return state.matches
    .filter(m => m.playerId === playerId || m.partnerId === playerId)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

function playerSessions(playerId) {
  return state.sessions
    .filter(s => s.playerId === playerId)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

/* ---------- video clip library (IndexedDB — blobs don't fit localStorage) ---------- */

let clipDbPromise = null;

function clipDB() {
  if (!('indexedDB' in window)) return Promise.reject(new Error('This browser has no IndexedDB — clips cannot be saved.'));
  if (!clipDbPromise) {
    clipDbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open('shuttleiq-clips', 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains('clips')) {
          req.result.createObjectStore('clips', { keyPath: 'id' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error('Could not open the clip library.'));
    });
  }
  return clipDbPromise;
}

function clipRequest(mode, run) {
  return clipDB().then(db => new Promise((resolve, reject) => {
    const req = run(db.transaction('clips', mode).objectStore('clips'));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }));
}

/* clip = {id, playerId, label, date, duration, blob} */
function saveClip(clip) {
  return clipRequest('readwrite', store => store.put(clip));
}

function listClips() {
  return clipRequest('readonly', store => store.getAll())
    .then(rows => rows.sort((a, b) => (a.date < b.date ? 1 : -1)))
    .catch(() => []);
}

function getClip(id) {
  return clipRequest('readonly', store => store.get(id)).catch(() => null);
}

function deleteClip(id) {
  return clipRequest('readwrite', store => store.delete(id)).catch(() => {});
}

async function deletePlayerClips(playerId) {
  const clips = await listClips();
  for (const c of clips.filter(c => c.playerId === playerId)) await deleteClip(c.id);
}

/* ---------- backup / restore ---------- */

function exportData() {
  // Redact secrets so a shared backup file can't leak the API key or the
  // (device-local) coach passcode. Video clips are not included — they live
  // in IndexedDB and would make the file enormous.
  const safe = {
    app: 'shuttleiq',
    version: 6,
    exportedAt: new Date().toISOString(),
    ...state,
    settings: { ...state.settings, apiKey: '', coachPass: '', recoveryHash: '' },
  };
  const blob = new Blob([JSON.stringify(safe, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `shuttleiq-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  state.settings.lastBackup = new Date().toISOString();
  saveState();
}

function importData(file, done) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      if (!parsed.players || !parsed.matches) throw new Error('Not a ShuttleIQ backup file.');
      // Keep the device's own secrets — backups are redacted and importing a
      // roster shouldn't erase the API key or log the coach out.
      const keepKey = state.settings.apiKey;
      const keepPass = state.settings.coachPass;
      const keepRecovery = state.settings.recoveryHash;
      const keepTheme = state.settings.theme;
      state = mergeState(parsed);
      state.settings.apiKey = parsed.settings?.apiKey || keepKey;
      state.settings.coachPass = keepPass;
      state.settings.recoveryHash = keepRecovery;
      state.settings.theme = keepTheme;
      applyTheme(keepTheme);
      saveState();
      done(null);
    } catch (err) {
      done(err);
    }
  };
  reader.readAsText(file);
}

function resetData() {
  state = structuredClone(DEFAULT_STATE);
  saveState();
}

/* ---------- sample data so every screen can be explored before the season ---------- */

function loadSampleData() {
  const names = [
    ['Aarav Patel', 12], ['Ben Liu', 11], ['Chris Okafor', 12], ['Daniel Kim', 10],
    ['Ethan Nguyen', 11], ['Felix Marsh', 9], ['Gabriel Santos', 12], ['Hiro Tanaka', 10],
  ];
  const players = names.map(([name, year], i) => ({
    id: 'p' + i, name, year, hand: i % 3 === 0 ? 'Left' : 'Right', status: 'roster',
    availability: i === 5 ? 'injured' : i === 7 ? 'absent' : 'available',
    tryoutScores: null, aiNote: null, notes: '', createdAt: new Date().toISOString(),
  }));
  players.push(
    { id: 'p8', name: 'Ivan Petrov', year: 9, hand: 'Right', status: 'tryout', tryoutScores: { serve: 4, footwork: 3, smash: 4, net: 2, rally: 3, sense: 4, athleticism: 4 }, aiNote: null, createdAt: new Date().toISOString() },
    { id: 'p9', name: 'Jay Sharma', year: 10, hand: 'Right', status: 'tryout', tryoutScores: { serve: 3, footwork: 4, smash: 2, net: 4, rally: 4, sense: 3, athleticism: 3 }, aiNote: null, createdAt: new Date().toISOString() },
  );

  const matches = [];
  const opponents = ['Westfield HS', 'Lakeside Prep', 'Northgate', 'St. Andrews', 'Riverview'];
  let day = 0;
  for (let i = 0; i < 36; i++) {
    const p = players[i % 8];
    const doubles = i % 3 === 0;
    const partner = doubles ? players[(i + 1) % 8] : null;
    const skill = (base) => Math.max(1, Math.min(5, base + Math.floor(Math.random() * 3) - 1));
    const base = 2 + ((i % 8) % 4);
    day += 1;
    const date = new Date(Date.now() - (40 - day) * 86400000).toISOString().slice(0, 10);
    matches.push({
      id: 'm' + i, playerId: p.id, partnerId: partner ? partner.id : null,
      date, opponent: opponents[i % 5],
      discipline: doubles ? 'MD' : 'MS',
      result: Math.random() < (0.3 + ((i % 8) / 16)) ? 'W' : 'L',
      score: '21-' + (10 + Math.floor(Math.random() * 9)) + ', 21-' + (12 + Math.floor(Math.random() * 8)),
      ratings: { footwork: skill(base), smash: skill(base), serve: skill(base), defense: skill(base), net: skill(base), consistency: skill(base) },
      notes: '', context: 'season',
    });
  }
  // a few tryout matches for the two prospects
  matches.push(
    { id: 'mt0', playerId: 'p8', partnerId: null, date: new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10), opponent: 'Tryout court 1', discipline: 'MS', result: 'W', score: '21-14, 21-17', ratings: { footwork: 3, smash: 4, serve: 4, defense: 3, net: 2, consistency: 3 }, notes: '', context: 'tryout' },
    { id: 'mt1', playerId: 'p8', partnerId: null, date: new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10), opponent: 'Tryout court 1', discipline: 'MS', result: 'W', score: '21-18, 22-20', ratings: { footwork: 3, smash: 4, serve: 3, defense: 3, net: 3, consistency: 3 }, notes: '', context: 'tryout' },
    { id: 'mt2', playerId: 'p9', partnerId: null, date: new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10), opponent: 'Tryout court 2', discipline: 'MS', result: 'L', score: '18-21, 21-16, 19-21', ratings: { footwork: 4, smash: 2, serve: 3, defense: 4, net: 4, consistency: 4 }, notes: 'Great hands at the net', context: 'tryout' },
  );

  // a couple of AI-style sessions so player profiles and feedback UI have content
  const sessions = [
    {
      id: 's0', playerId: 'p0', date: new Date(Date.now() - 5 * 86400000).toISOString(), label: 'Practice clip', focus: 'all', clipId: null,
      scores: { footwork: 62, smash: 71, serve: 55, defense: 58, net: 49, consistency: 64 },
      feedback: [
        { timestamp: '0:12', type: 'positive', title: 'Strong smash preparation', body: 'Full sideways turn and early racket preparation before the jump smash. The contact point is consistently in front of the body.', tip: 'Keep it — add 20 half-court smashes per practice to lock it in.' },
        { timestamp: '0:31', type: 'critical', title: 'Late split step', body: 'The split step lands after the opponent has already hit, so the first movement is a beat late, especially to the backhand corner.', tip: 'Shadow drill: partner claps, you split — 3 sets of 30 seconds.' },
        { timestamp: '0:48', type: 'suggestion', title: 'Lift serves higher', body: 'Backcourt lifts are landing mid-court under pressure, inviting the smash. More height buys recovery time.', tip: 'Target drill: 20 lifts that land behind the doubles service line.' },
      ],
    },
    {
      id: 's1', playerId: 'p1', date: new Date(Date.now() - 8 * 86400000).toISOString(), label: 'Match warm-up', focus: 'net', clipId: null,
      scores: { footwork: 55, smash: 48, serve: 61, defense: 52, net: 68, consistency: 57 },
      feedback: [
        { timestamp: '0:09', type: 'positive', title: 'Tight spinning net shots', body: 'Net shots consistently tumble close to the tape, forcing weak lifts.', tip: 'Add net-kill follow-ups so the point ends on the next shot.' },
        { timestamp: '0:40', type: 'suggestion', title: 'Vary the serve', body: 'Nearly every serve is the same low serve to the T. Better opponents will start attacking it.', tip: 'Mix in flick serves — 1 in 4 — aimed at the backhand shoulder.' },
      ],
    },
  ];

  // one example lineup so the Rosters page shows a filled card
  const rosters = [{
    id: 'r0', name: 'vs Westfield (sample)', date: new Date(Date.now() + 6 * 86400000).toISOString().slice(0, 10),
    slots: [
      { code: 'S1', label: 'Singles 1', type: 'singles', playerIds: ['p0'] },
      { code: 'S2', label: 'Singles 2', type: 'singles', playerIds: ['p2'] },
      { code: 'S3', label: 'Singles 3', type: 'singles', playerIds: ['p4'] },
      { code: 'D1', label: 'Doubles 1', type: 'doubles', playerIds: ['p1', 'p3'] },
      { code: 'D2', label: 'Doubles 2', type: 'doubles', playerIds: ['p5', 'p6'] },
      { code: 'XD', label: 'Mixed doubles', type: 'doubles', playerIds: ['p7', 'p0'] },
    ],
  }];

  state.players = players;
  state.matches = matches;
  state.sessions = sessions;
  state.rosters = rosters;
  state.ladder = [];   // rebuilt from form the first time the ladder is opened
  saveState();
}

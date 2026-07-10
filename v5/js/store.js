/* ShuttleIQ v5 — persistence layer (localStorage) */

const STORE_KEY = 'shuttleiq_v5';

const DEFAULT_STATE = {
  settings: {
    apiKey: '',
    model: 'claude-opus-4-8',
    teamName: 'SHUTTLEIQ',
    coachPass: '',   // hash of the coach passcode; '' means not set up yet
  },
  players: [],   // {id, name, year, hand, status:'roster'|'tryout'|'cut', tryoutScores, createdAt}
  matches: [],   // {id, playerId, partnerId, date, opponent, discipline, result, score, ratings, notes}
  sessions: [],  // {id, playerId, date, label, focus, scores, feedback[]}
  rosters: [],   // {id, name, slots:[{code, type:'singles'|'doubles', playerIds:[]}]}
};

let state = loadState();

function loadState() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return structuredClone(DEFAULT_STATE);
    const parsed = JSON.parse(raw);
    return { ...structuredClone(DEFAULT_STATE), ...parsed, settings: { ...DEFAULT_STATE.settings, ...(parsed.settings || {}) } };
  } catch {
    return structuredClone(DEFAULT_STATE);
  }
}

function saveState() {
  localStorage.setItem(STORE_KEY, JSON.stringify(state));
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

function clearCoachPass() {
  state.settings.coachPass = '';
  saveState();
}

function getRole() {
  return sessionStorage.getItem('shuttleiq_role') || null; // 'coach' | 'student' | null
}

function setRole(role) {
  if (role) {
    sessionStorage.setItem('shuttleiq_role', role);
  } else {
    sessionStorage.removeItem('shuttleiq_role');
    sessionStorage.removeItem('shuttleiq_student');
  }
}

function isCoach() {
  return getRole() === 'coach';
}

/* Which roster player a logged-in student is — lets their dashboard show
   their own stats. Null = signed in as a guest. */
function getStudentId() {
  return sessionStorage.getItem('shuttleiq_student') || null;
}

function setStudentId(id) {
  if (id) sessionStorage.setItem('shuttleiq_student', id);
  else sessionStorage.removeItem('shuttleiq_student');
}

function currentStudent() {
  const id = getStudentId();
  return id ? getPlayer(id) : null;
}

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

function exportData() {
  // Redact secrets so a shared backup file can't leak the API key or the
  // (device-local) coach passcode.
  const safe = {
    ...state,
    settings: { ...state.settings, apiKey: '', coachPass: '' },
  };
  const blob = new Blob([JSON.stringify(safe, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `shuttleiq-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
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
      state = { ...structuredClone(DEFAULT_STATE), ...parsed, settings: { ...DEFAULT_STATE.settings, ...(parsed.settings || {}) } };
      state.settings.apiKey = parsed.settings?.apiKey || keepKey;
      state.settings.coachPass = keepPass;
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

/* Sample data so the coach can see every screen working before the season starts. */
function loadSampleData() {
  const names = [
    ['Aarav Patel', 12], ['Ben Liu', 11], ['Chris Okafor', 12], ['Daniel Kim', 10],
    ['Ethan Nguyen', 11], ['Felix Marsh', 9], ['Gabriel Santos', 12], ['Hiro Tanaka', 10],
  ];
  const players = names.map(([name, year], i) => ({
    id: 'p' + i, name, year, hand: i % 3 === 0 ? 'Left' : 'Right', status: 'roster',
    tryoutScores: null, createdAt: new Date().toISOString(),
  }));
  players.push(
    { id: 'p8', name: 'Ivan Petrov', year: 9, hand: 'Right', status: 'tryout', tryoutScores: { serve: 4, footwork: 3, smash: 4, net: 2, rally: 3, sense: 4, athleticism: 4 }, createdAt: new Date().toISOString() },
    { id: 'p9', name: 'Jay Sharma', year: 10, hand: 'Right', status: 'tryout', tryoutScores: { serve: 3, footwork: 4, smash: 2, net: 4, rally: 4, sense: 3, athleticism: 3 }, createdAt: new Date().toISOString() },
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
      notes: '',
    });
  }
  state.players = players;
  state.matches = matches;
  state.rosters = [];
  state.sessions = [];
  saveState();
}

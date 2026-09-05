/* ShuttleIQ v6 — views, routing, role gating */

const VIEW = document.getElementById('view');
const NAV = document.getElementById('topnav');
const TABBAR = document.getElementById('tabbar');

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

let toastTimer = null;
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

function fmtDate(iso) {
  if (!iso) return '';
  // date-only strings must be parsed as LOCAL dates — new Date('2026-07-12')
  // is UTC midnight, which renders as the previous day in western timezones
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  const d = m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(iso);
  return isNaN(d) ? String(iso) : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function todayISO() {
  const d = new Date(); // local, not UTC — an evening match shouldn't log as tomorrow
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/* object URLs created for video playback, revoked on navigation */
let liveUrls = [];
function trackUrl(url) { liveUrls.push(url); return url; }
function revokeUrls() { liveUrls.forEach(u => URL.revokeObjectURL(u)); liveUrls = []; }

/* ---------- router ---------- */

const ROUTES = {
  '': renderRoot,
  home: renderRoot,
  login: renderLogin,
  coach: renderGate,
  team: renderTeam,
  players: renderPlayers,
  player: renderPlayerDetail,
  matches: renderMatches,
  tryouts: renderTryouts,
  rosters: renderRosters,
  insights: renderInsights,
  analyze: renderAnalyze,
  compare: renderCompare,
  drills: renderDrills,
  guide: renderGuide,
  recovery: renderRecovery,
  score: renderScore,
  ladder: renderLadder,
  vs: renderVersus,
  settings: renderSettings,
};

const COACH_ONLY = new Set(['players', 'matches', 'tryouts', 'rosters', 'insights', 'settings', 'recovery', 'score', 'vs']);
const NEEDS_ROLE = new Set([...COACH_ONLY, 'analyze', 'compare', 'team', 'drills', 'player', 'ladder']);

function parseHash() {
  const hash = location.hash.replace(/^#\/?/, '');
  const [path, query] = hash.split('?');
  const [name, arg] = path.split('/');
  return { name: name || '', arg, params: new URLSearchParams(query || '') };
}

function route() {
  stopCamera();
  revokeUrls();

  const { name, arg, params } = parseHash();
  const role = getRole();

  if (NEEDS_ROLE.has(name) && !role) { location.hash = '#/'; return; }
  if (COACH_ONLY.has(name) && !isCoach()) { location.hash = '#/'; return; }
  // players may open their own profile, nobody else's
  if (name === 'player' && !isCoach() && getStudentId() !== arg) { location.hash = '#/'; return; }

  buildNav();
  VIEW.innerHTML = '';
  (ROUTES[name] || renderRoot)(arg, params);
  markNav(name || 'home');
  renderTourChrome();
  window.scrollTo(0, 0);
}

function renderRoot() {
  const role = getRole();
  if (role === 'coach') return renderDashboard();
  if (role === 'student') return renderStudentDashboard();
  return renderLanding();
}

/* ---------- navigation bar ---------- */

function navIcon(name) {
  const P = {
    home: '<path d="M3 10.5L12 3l9 7.5"/><path d="M5 9.5V21h5v-6h4v6h5V9.5"/>',
    players: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.4 3.4-5 6.5-5s5.7 1.6 6.5 5"/><circle cx="17.5" cy="9.5" r="2.5"/><path d="M16 15.2c2.6.3 4.6 1.7 5.5 4.8"/>',
    matches: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M8 2.5v3M16 2.5v3M3 9.5h18M7.5 14l2.5 2.5 5-5"/>',
    tryouts: '<path d="M12 3l2.6 5.6 6.4.8-4.7 4.3 1.2 6.3-5.5-3.1-5.5 3.1 1.2-6.3L3 9.4l6.4-.8z"/>',
    rosters: '<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="4" cy="6" r="1.3"/><circle cx="4" cy="12" r="1.3"/><circle cx="4" cy="18" r="1.3"/>',
    insights: '<path d="M4 20V10M9 20V4M14 20v-7M19 20V8"/>',
    team: '<path d="M12 3l8 3v6c0 5-3.5 7.8-8 9-4.5-1.2-8-4-8-9V6z"/>',
    analyze: '<path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2"/>',
    compare: '<path d="M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h5M14 3h5a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-5M12 1v22"/>',
    drills: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1"/>',
    more: '<circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/>',
    theme: '<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 0 0 18c-2.5-2-4-5.4-4-9s1.5-7 4-9z" fill="currentColor" stroke="none"/>',
    guide: '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.6a2.5 2.5 0 1 1 3.3 2.4c-.6.2-.9.8-.9 1.4v.5"/><circle cx="12" cy="16.8" r="0.9" fill="currentColor" stroke="none"/>',
    score: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M12 5v14M7 10.5h1.5M6.25 9.25v2.5M15.5 10.5H17"/>',
    ladder: '<path d="M7 3v18M17 3v18M7 7h10M7 12h10M7 17h10"/>',
    vs: '<path d="M4 6l3 6-3 6M20 6l-3 6 3 6"/><path d="M12 4v16"/>',
  };
  return `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ''}</svg>`;
}

function buildNav() {
  const role = getRole();
  const link = (k, label) => `<a data-nav="${k}" href="#/${k === 'home' ? '' : k}">${label}</a>`;
  const tab = (k, label, ic) => `<a class="tab" data-nav="${k}" href="#/${k === 'home' ? '' : k}">${navIcon(ic)}<span>${label}</span></a>`;
  const sheetRow = (k, label, ic) => `<a class="sheet-row" data-nav="${k}" href="#/${k}">${navIcon(ic)}${label}</a>`;
  let links = '', right = '', tabs = '';
  if (role === 'coach') {
    links = [
      link('home', 'Dashboard'), link('score', 'Score'), link('players', 'Players'),
      link('matches', 'Matches'), link('ladder', 'Ladder'), link('tryouts', 'Tryouts'),
      link('rosters', 'Rosters'), link('insights', 'Insights'), link('vs', 'Head to head'),
      link('analyze', 'Analyze'), link('compare', 'Compare'), link('guide', 'Guide'), link('settings', 'Settings'),
    ].join('');
    right = `<button class="nav-role" data-logout>Log out</button>`;
    tabs = tab('home', 'Home', 'home') + tab('score', 'Score', 'score')
      + tab('players', 'Players', 'players') + tab('matches', 'Matches', 'matches')
      + `<button class="tab" id="tab-more" aria-expanded="false">${navIcon('more')}<span>More</span></button>`
      + `<div class="more-sheet" id="more-sheet" hidden>`
      + sheetRow('ladder', 'Ladder', 'ladder') + sheetRow('tryouts', 'Tryouts', 'tryouts')
      + sheetRow('rosters', 'Rosters', 'rosters') + sheetRow('insights', 'Insights', 'insights')
      + sheetRow('vs', 'Head to head', 'vs') + sheetRow('analyze', 'Analyze', 'analyze')
      + sheetRow('compare', 'Compare', 'compare') + sheetRow('guide', 'Guide', 'guide')
      + sheetRow('settings', 'Settings', 'settings')
      + `</div>`;
  } else if (role === 'student') {
    links = [link('home', 'Home'), link('team', 'Team'), link('ladder', 'Ladder'), link('analyze', 'Analyze'), link('compare', 'Compare'), link('drills', 'Drills'), link('guide', 'Guide')].join('');
    const me = currentStudent();
    right = `<button class="nav-role" data-logout>${me ? esc(me.name.split(' ')[0]) + ' · ' : ''}Sign out</button>`;
    tabs = tab('home', 'Home', 'home') + tab('team', 'Team', 'team') + tab('analyze', 'Analyze', 'analyze')
      + tab('drills', 'Drills', 'drills')
      + `<button class="tab" id="tab-more" aria-expanded="false">${navIcon('more')}<span>More</span></button>`
      + `<div class="more-sheet" id="more-sheet" hidden>`
      + sheetRow('ladder', 'Ladder', 'ladder') + sheetRow('compare', 'Compare', 'compare')
      + sheetRow('guide', 'Guide', 'guide')
      + `</div>`;
  } else {
    right = `<a class="nav-role" style="text-decoration:none" href="#/login">Log in</a>`;
  }
  const mark = `<svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="8" fill="var(--accent)"/><path d="M16 5.5l5 13.5H11z" fill="none" stroke="var(--on-accent)" stroke-width="1.8" stroke-linejoin="round"/><circle cx="16" cy="23" r="3.2" fill="none" stroke="var(--on-accent)" stroke-width="1.8"/></svg>`;
  NAV.innerHTML = `
    <div class="nav-row">
      <a class="logo" href="#/">${mark} ShuttleIQ</a>
      <span class="nav-spacer"></span>
      <button class="nav-theme" data-theme-cycle title="Switch theme" aria-label="Switch theme">${navIcon('theme')}</button>
      ${right}
    </div>
    ${links ? `<div class="nav-links">${links}</div>` : ''}`;
  TABBAR.innerHTML = tabs;
  NAV.querySelector('[data-logout]')?.addEventListener('click', logout);
  NAV.querySelector('[data-theme-cycle]').addEventListener('click', () => {
    const order = ['midnight', 'court', 'clean'];
    setTheme(order[(order.indexOf(state.settings.theme) + 1) % order.length]);
  });
  document.getElementById('tab-more')?.addEventListener('click', () => {
    const sheet = document.getElementById('more-sheet');
    const open = sheet.hidden;
    sheet.hidden = !open;
    document.getElementById('tab-more').setAttribute('aria-expanded', String(open));
  });
}

function markNav(name) {
  document.querySelectorAll('a[data-nav]').forEach(a => a.classList.toggle('active', a.dataset.nav === name));
  // light up "More" when the active route lives inside its sheet
  const moreBtn = document.getElementById('tab-more');
  if (moreBtn) moreBtn.classList.toggle('active', !!document.querySelector(`#more-sheet a[data-nav="${name}"]`));
}

function logout() { setRole(null); location.hash = '#/'; route(); }

const THEME_LABELS = { midnight: 'Midnight', court: 'Court', clean: 'Clean' };

function setTheme(name) {
  applyTheme(name);
  saveState();
  toast('Theme: ' + THEME_LABELS[state.settings.theme]);
}

/* ---------- guided tour ----------
   Runs on demo data so a brand-new coach or player can see a working team
   before they have one. Exiting puts their real (usually empty) data back. */

const TOUR_KEY = 'siq_tour';
const TOUR_MOUNT = document.getElementById('tour');

const TOURS = {
  coach: {
    label: 'Coach tour',
    steps: [
      { hash: '#/', title: 'Your dashboard', body: 'The scoreboard up top is the season at a glance. Below it you get streak and slump alerts, who\'s in form, and the latest results — so you walk into practice already knowing what needs attention.' },
      { hash: '#/players', title: 'The roster', body: 'Everyone on your team. Add several at once by pasting "Alex, Ben, Chris". The Available column is the important one — mark someone injured or away and the app stops putting them in lineups.' },
      { hash: '#/score', title: 'Score a match courtside', body: 'Pick a player, tap the two big numbers as points happen. It knows the real rules — first to 21, win by 2, capped at 30, best of three — and saves the finished match straight to the log. This is the fastest way to keep records during a meet.' },
      { hash: '#/matches', title: 'Match history', body: 'Every result, filterable by player. The optional 1–5 ratings you give after a match are what power the skill radars, position fit and depth chart — a few seconds each time pays off all season.' },
      { hash: '#/ladder', title: 'The challenge ladder', body: 'Your internal pecking order. Record a challenge and if the lower-ranked player wins, they take that spot. Both players get the match on their record automatically. Print it for the gym wall.' },
      { hash: '#/rosters', title: 'Build a lineup', body: 'Hit Auto-suggest and it fills the lineup using position fit, win rate and which doubles pairs actually win together — and it never picks anyone marked injured or away. Adjust anything, then print or copy it.' },
      { hash: '#/insights', title: 'Team insights', body: 'Your depth chart per role, the team\'s weakest skills with a drill for each (printable as a practice plan), records against every opponent, and doubles chemistry.' },
      { hash: '#/tryouts', title: 'Tryout scouting', body: 'Add prospects and tap 1–5 across seven drills while they play. The board re-ranks live, so by the end of the session you already know your cuts. Promote keepers straight to the roster.' },
      { hash: '#/analyze', title: 'AI video analysis', body: 'Record up to a minute of play and get scored feedback with timestamps you can tap to jump to that moment. Needs a free API key (Settings) — everything else in the app works without one.' },
    ],
  },
  student: {
    label: 'Player tour',
    steps: [
      { hash: '#/', title: 'Your home screen', body: 'Your recent form, your skill radar, what to work on next, and the latest AI feedback on your play — all in one place.' },
      { hash: '#/analyze', title: 'Film and get coached', body: 'Record up to a minute of play, and the AI gives you scores plus specific coaching notes. Tap any note to jump to that exact moment in your clip.' },
      { hash: '#/compare', title: 'Compare with a pro', body: 'Pick a pro who plays your style, load a clip of them next to yours, and watch both in slow motion — or let the AI spell out the differences and how to close them.' },
      { hash: '#/drills', title: 'Drills that target your gaps', body: 'The whole library is here, and the top of the page recommends the drills matched to your two weakest skills, each with a target to hit.' },
      { hash: '#/ladder', title: 'Where you stand', body: 'The team ladder, with your spot highlighted. Beat someone above you in a challenge and you take their place — ask your coach to record it.' },
    ],
  },
};

function tourState() {
  try { return JSON.parse(sessionGet(TOUR_KEY) || 'null'); } catch { return null; }
}

function beginTour(kind) {
  const prevRole = getRole();
  const prevStudent = getStudentId();
  startDemo();
  if (kind === 'student') { setRole('student'); setStudentId('p1'); }
  else setRole('coach');
  sessionSet(TOUR_KEY, JSON.stringify({ kind, step: 0, prevRole, prevStudent }));
  location.hash = TOURS[kind].steps[0].hash;
  route();
}

function moveTour(delta) {
  const t = tourState();
  if (!t) return;
  const steps = TOURS[t.kind].steps;
  const next = t.step + delta;
  if (next < 0 || next >= steps.length) return;
  t.step = next;
  sessionSet(TOUR_KEY, JSON.stringify(t));
  location.hash = steps[next].hash;
  route();
}

/* `known` carries the tour state when the caller already cleared it (the finish
   card), so the role the user had before the tour is still restored. */
function finishTour(known) {
  const t = known || tourState();
  sessionRemove(TOUR_KEY);
  endDemo();
  if (t) {
    setRole(t.prevRole || null);
    if (t.prevStudent) setStudentId(t.prevStudent);
    else if (t.prevRole !== 'student') setStudentId(null);
  }
  location.hash = '#/';
  route();
  toast('Sample team cleared — the app is yours now');
}

function exitDemo() {
  let prev = null;
  try { prev = JSON.parse(sessionGet('siq_tour_prev') || 'null'); } catch { prev = null; }
  sessionRemove('siq_tour_prev');
  finishTour(tourState() || prev);
}

function renderTourChrome() {
  const t = tourState();
  const inDemo = demoActive();
  if (!inDemo && !t) { TOUR_MOUNT.innerHTML = ''; document.body.classList.remove('has-tour', 'has-demo'); return; }
  document.body.classList.toggle('has-demo', inDemo);
  document.body.classList.toggle('has-tour', !!t);

  const banner = inDemo
    ? `<div class="demo-banner">
         <span><b>Demo mode</b> — sample team, nothing here is your real data</span>
         <button class="btn btn-sm" id="demo-exit">Exit demo</button>
       </div>`
    : '';

  let panel = '';
  if (t) {
    const steps = TOURS[t.kind].steps;
    const s = steps[t.step];
    const last = t.step === steps.length - 1;
    panel = `
      <div class="tour-panel" role="dialog" aria-label="Guided tour">
        <div class="tour-progress"><span style="width:${((t.step + 1) / steps.length) * 100}%"></span></div>
        <div class="tour-body">
          <div class="tour-step">Step ${t.step + 1} of ${steps.length} · ${esc(TOURS[t.kind].label)}</div>
          <h3>${esc(s.title)}</h3>
          <p>${esc(s.body)}</p>
        </div>
        <div class="tour-actions">
          <button class="btn btn-sm" id="tour-skip">Skip tour</button>
          <span style="flex:1"></span>
          <button class="btn btn-sm" id="tour-back" ${t.step === 0 ? 'disabled' : ''}>Back</button>
          <button class="btn btn-primary btn-sm" id="tour-next">${last ? 'Finish' : 'Next'}</button>
        </div>
      </div>`;
  }

  TOUR_MOUNT.innerHTML = banner + panel;
  document.getElementById('demo-exit')?.addEventListener('click', () => {
    if (!confirm('Clear the sample team and go back to your own data?')) return;
    exitDemo();
  });
  document.getElementById('tour-back')?.addEventListener('click', () => moveTour(-1));
  document.getElementById('tour-skip')?.addEventListener('click', () => finishTour());
  document.getElementById('tour-next')?.addEventListener('click', () => {
    const cur = tourState();
    const steps = TOURS[cur.kind].steps;
    if (cur.step < steps.length - 1) moveTour(1);
    else renderTourFinish(cur);
  });
}

function renderTourFinish(t) {
  const kind = t.kind;
  sessionRemove(TOUR_KEY);
  document.body.classList.remove('has-tour');
  TOUR_MOUNT.innerHTML = `
    <div class="tour-panel">
      <div class="tour-body">
        <div class="tour-step">Tour complete</div>
        <h3>That's the whole app</h3>
        <p>${kind === 'coach'
          ? 'Clear the sample team whenever you\'re ready and start adding your own players — or keep poking around first.'
          : 'Clear the sample data whenever you\'re ready. Your coach\'s real team lives on their device.'}</p>
      </div>
      <div class="tour-actions">
        <button class="btn btn-sm" id="tour-keep">Keep exploring</button>
        <span style="flex:1"></span>
        <button class="btn btn-primary btn-sm" id="tour-clear">Clear sample data</button>
      </div>
    </div>`;
  document.getElementById('tour-keep').addEventListener('click', () => {
    // stay in demo, but remember who they were so "Exit demo" can restore it
    sessionSet('siq_tour_prev', JSON.stringify({ prevRole: t.prevRole, prevStudent: t.prevStudent }));
    TOUR_MOUNT.innerHTML = '';
    renderTourChrome();
  });
  document.getElementById('tour-clear').addEventListener('click', () => finishTour(t));
}

/* ---------- shared UI builders ---------- */

function skillBars(profile) {
  return SKILLS.map(s => {
    const v = profile[s];
    return `<div class="bar-row">
      <span class="bar-label">${SKILL_LABELS[s]}</span>
      <span class="bar-track"><span class="bar-fill" style="width:${v ?? 0}%"></span></span>
      <span class="bar-val">${v ?? '—'}</span>
    </div>`;
  }).join('');
}

function wlDots(playerId, n = 8) {
  const ms = playerMatches(playerId).slice(0, n).reverse(); // oldest -> newest
  if (!ms.length) return '<span class="muted small">no matches</span>';
  return `<span class="wl-dots">${ms.map(m => `<i class="${m.result === 'W' ? 'w' : 'l'}" title="${esc(m.result)} vs ${esc(m.opponent)}"></i>`).join('')}</span>`;
}

function trendArrow(form) {
  if (!form) return '<span class="trend-flat">—</span>';
  if (form.trend === 'up') return '<span class="trend-up" title="Trending up">▲</span>';
  if (form.trend === 'down') return '<span class="trend-down" title="Trending down">▼</span>';
  return '<span class="trend-flat" title="Steady">—</span>';
}

function resultChip(r) {
  return r === 'W' ? '<span class="chip chip-w">W</span>' : '<span class="chip chip-l">L</span>';
}

function ratingRow(key, label, value = 0) {
  const dots = [1, 2, 3, 4, 5].map(v =>
    `<button type="button" data-v="${v}" class="${v <= value ? 'on' : ''}" aria-label="${label} ${v}"></button>`).join('');
  return `<div class="rate-row" data-skill="${key}" data-value="${value}">
    <span class="rate-label">${label}</span><span class="rate-dots">${dots}</span>
  </div>`;
}

/* tap a dot to set 1-5; tapping the current value clears to 0 */
function wireRatingRows(container, onChange) {
  container.querySelectorAll('.rate-row').forEach(row => {
    row.querySelectorAll('.rate-dots button').forEach(btn => {
      btn.addEventListener('click', () => {
        const v = Number(btn.dataset.v);
        const cur = Number(row.dataset.value);
        const next = v === cur ? 0 : v;
        row.dataset.value = next;
        row.querySelectorAll('.rate-dots button').forEach(b =>
          b.classList.toggle('on', Number(b.dataset.v) <= next));
        if (onChange) onChange(row.dataset.skill, next);
      });
    });
  });
}

function readRatings(container) {
  const out = {};
  container.querySelectorAll('.rate-row').forEach(row => {
    const v = Number(row.dataset.value);
    if (v > 0) out[row.dataset.skill] = v;
  });
  return out;
}

function playerOptions(selectedId, { statuses = ['roster'] } = {}) {
  return state.players
    .filter(p => statuses.includes(p.status))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(p => `<option value="${p.id}" ${p.id === selectedId ? 'selected' : ''}>${esc(p.name)}${p.status === 'tryout' ? ' (tryout)' : ''}</option>`)
    .join('');
}

function playerLink(id) {
  const p = getPlayer(id);
  if (!p) return 'Unknown';
  return isCoach() || getStudentId() === id
    ? `<a class="player-link" href="#/player/${id}">${esc(p.name)}</a>`
    : `<span class="player-link">${esc(p.name)}</span>`;
}

/* ---------- landing / login / coach gate ---------- */

function renderLanding() {
  const check = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12.5l5 5L20 6.5"/></svg>';
  const courtArt = `
    <svg viewBox="0 0 340 244" fill="none" aria-hidden="true">
      <rect x="10" y="10" width="320" height="224" rx="8" stroke="currentColor" stroke-width="2.5"/>
      <line x1="34" y1="10" x2="34" y2="234" stroke="currentColor" stroke-width="1.5" opacity="0.55"/>
      <line x1="306" y1="10" x2="306" y2="234" stroke="currentColor" stroke-width="1.5" opacity="0.55"/>
      <line x1="10" y1="34" x2="330" y2="34" stroke="currentColor" stroke-width="1.5" opacity="0.55"/>
      <line x1="10" y1="210" x2="330" y2="210" stroke="currentColor" stroke-width="1.5" opacity="0.55"/>
      <line x1="128" y1="10" x2="128" y2="234" stroke="currentColor" stroke-width="1.5" opacity="0.55"/>
      <line x1="212" y1="10" x2="212" y2="234" stroke="currentColor" stroke-width="1.5" opacity="0.55"/>
      <line x1="128" y1="122" x2="10" y2="122" stroke="currentColor" stroke-width="1.5" opacity="0.55"/>
      <line x1="212" y1="122" x2="330" y2="122" stroke="currentColor" stroke-width="1.5" opacity="0.55"/>
      <line x1="170" y1="6" x2="170" y2="238" stroke="currentColor" stroke-width="3"/>
      <path d="M40 196 C 110 60, 210 52, 288 88" stroke="var(--art-accent)" stroke-width="2" stroke-dasharray="1 7" stroke-linecap="round"/>
      <g transform="translate(288 88) rotate(38)">
        <path d="M0 0l7 -18h-14z" fill="var(--bg)" stroke="var(--art-accent)" stroke-width="2" stroke-linejoin="round"/>
        <circle cx="0" cy="3.5" r="4" fill="var(--art-accent)"/>
      </g>
    </svg>`;
  const points = [
    'AI feedback on 60-second clips',
    'Live-ranked tryout scoreboard',
    'Win/loss and form tracking',
    'Position fit & team depth chart',
    'One-tap lineup suggestions',
    'Works offline · installs on phones',
  ];
  VIEW.innerHTML = `
  <div class="landing">
    <div class="hero">
      <div class="hero-copy">
        <div class="hero-kicker">ShuttleIQ · Team badminton</div>
        <h1>Run your team like a pro program.</h1>
        <p class="lead">Film a rally and get AI coaching. Score tryouts as they happen. Know every player's form — and pick lineups with receipts.</p>
        <div class="btn-row" style="margin:0">
          <a class="btn btn-primary btn-lg" href="#/login">Enter as player</a>
          <a class="btn btn-lg" href="#/coach">Coach login</a>
        </div>
        <p class="hero-trust"><b>Free</b> · no accounts · your data stays on this device · <a href="#/guide">How it works</a></p>
      </div>
      <div class="hero-art">${courtArt}</div>
    </div>
    <div class="hero-points">
      ${points.map(p => `<div class="point">${check}${p}</div>`).join('')}
    </div>
  </div>`;
}

function renderLogin() {
  if (getRole()) { location.hash = '#/'; return; }
  const roster = state.players.filter(p => p.status === 'roster');
  VIEW.innerHTML = `
  <div class="gate">
    <div class="card">
      <h2>Who are you?</h2>
      ${roster.length ? `
        <label>Pick your name
          <select id="login-player">${playerOptions(null)}</select>
        </label>
        <div class="btn-row"><button class="btn btn-primary" id="login-go">Enter as player</button></div>
        <hr>` : `<p class="muted small">No roster on this device yet — you can still explore as a guest.</p>`}
      <div class="btn-row">
        <button class="btn" id="login-guest">Continue as guest</button>
        <a class="btn" href="#/coach">I'm the coach</a>
      </div>
    </div>
  </div>`;
  document.getElementById('login-go')?.addEventListener('click', () => {
    setRole('student');
    setStudentId(document.getElementById('login-player').value);
    location.hash = '#/';
  });
  document.getElementById('login-guest').addEventListener('click', () => {
    setRole('student');
    setStudentId(null);
    location.hash = '#/';
  });
}

function renderGate(_, params) {
  if (isCoach()) { location.hash = '#/'; return; }
  const mode = params?.get('mode') === 'recover' && coachPassIsSet() ? 'recover'
    : coachPassIsSet() ? 'login' : 'setup';

  const forms = {
    setup: `
      <h2>Set up coach access</h2>
      <p class="muted small">Create a passcode (4+ digits). It keeps players out of the coach tools on a shared device.</p>
      <label>Passcode<input type="password" id="gate-pass" inputmode="numeric" autocomplete="new-password"></label>
      <label style="margin-top:8px">Repeat it<input type="password" id="gate-pass2" inputmode="numeric" autocomplete="new-password"></label>`,
    login: `
      <h2>Coach login</h2>
      <label>Passcode<input type="password" id="gate-pass" inputmode="numeric" autocomplete="current-password"></label>`,
    recover: `
      <h2>Reset your passcode</h2>
      <p class="muted small">Enter the recovery code you saved when you set up coach access. Your team data stays intact.</p>
      <label>Recovery code<input type="text" id="gate-recovery" placeholder="XXXX-XXXX-XXXX" autocomplete="off" spellcheck="false"></label>
      <label style="margin-top:8px">New passcode<input type="password" id="gate-pass" inputmode="numeric" autocomplete="new-password"></label>`,
  };

  VIEW.innerHTML = `
  <div class="gate">
    <div class="card">
      ${forms[mode]}
      <div id="gate-err" class="small" style="color:var(--loss); min-height:18px; margin-top:6px"></div>
      <div class="btn-row">
        <button class="btn btn-primary" id="gate-go">${mode === 'setup' ? 'Create & enter' : mode === 'recover' ? 'Reset passcode' : 'Enter'}</button>
        <a class="btn" href="#/">Back</a>
      </div>
      ${mode === 'login' ? (recoveryIsSet()
          ? `<p class="small"><a href="#/coach?mode=recover">Forgot your passcode?</a></p>`
          : `<p class="muted small">Forgot it? Without a recovery code, the only way in is clearing this site's browser data — which erases the team too.</p>`)
        : ''}
      ${mode === 'recover' ? `<p class="small"><a href="#/coach">Back to passcode login</a></p>` : ''}
    </div>
  </div>`;

  const err = document.getElementById('gate-err');
  const go = () => {
    const code = document.getElementById('gate-pass').value.trim();
    if (mode === 'setup') {
      const code2 = document.getElementById('gate-pass2').value.trim();
      if (code.length < 4) { err.textContent = 'Use at least 4 digits.'; return; }
      if (code !== code2) { err.textContent = 'Passcodes don\'t match.'; return; }
      setCoachPass(code);
      setRole('coach');
      issueRecoveryCode();
    } else if (mode === 'recover') {
      if (!checkRecoveryCode(document.getElementById('gate-recovery').value)) { err.textContent = 'That recovery code doesn\'t match.'; return; }
      if (code.length < 4) { err.textContent = 'New passcode needs at least 4 digits.'; return; }
      setCoachPass(code);
      setRole('coach');
      toast('Passcode reset — your team data is untouched');
      location.hash = '#/';
    } else if (checkCoachPass(code)) {
      setRole('coach');
      location.hash = '#/';
    } else {
      err.textContent = 'Wrong passcode.';
    }
  };
  document.getElementById('gate-go').addEventListener('click', go);
  VIEW.querySelectorAll('input').forEach(i => i.addEventListener('keydown', e => { if (e.key === 'Enter') go(); }));
  VIEW.querySelector('input')?.focus();
}

/* The plaintext code exists only until the coach confirms they've saved it.
   Held in a variable + shown via its own route so a stray re-render can't
   destroy it before it's written down. */
let pendingRecoveryCode = null;

function issueRecoveryCode() {
  pendingRecoveryCode = makeRecoveryCode();
  setRecoveryCode(pendingRecoveryCode);
  location.hash = '#/recovery';
  route();
}

function renderRecovery() {
  if (!pendingRecoveryCode) { location.hash = '#/settings'; return; }
  const code = pendingRecoveryCode;
  VIEW.innerHTML = `
  <div class="gate">
    <div class="card">
      <h2>Save your recovery code</h2>
      <p class="muted small">This is the only way back in if you forget your passcode. Write it down or photograph it — it won't be shown again.</p>
      <p style="font-size:clamp(20px,5vw,27px);font-weight:800;letter-spacing:0.1em;text-align:center;padding:16px;background:var(--accent-soft);color:var(--link);border-radius:10px;font-variant-numeric:tabular-nums;user-select:all;word-break:break-word">${esc(code)}</p>
      <div class="btn-row">
        <button class="btn" id="rec-copy">Copy code</button>
        <button class="btn btn-primary" id="rec-done">I've saved it — continue</button>
      </div>
    </div>
  </div>`;
  document.getElementById('rec-copy').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(code); toast('Recovery code copied'); }
    catch { prompt('Copy your recovery code:', code); }
  });
  document.getElementById('rec-done').addEventListener('click', () => {
    pendingRecoveryCode = null;
    location.hash = '#/';
    route();
  });
}

/* ---------- coach dashboard ---------- */

function renderDashboard() {
  const roster = state.players.filter(p => p.status === 'roster');
  const tryouts = state.players.filter(p => p.status === 'tryout');

  if (!state.players.length) {
    VIEW.innerHTML = `
    <div class="empty" style="margin-top:6vh">
      <h3>Welcome, coach</h3>
      <p>Nothing here yet — this is your team's device. New to ShuttleIQ? Take the two-minute tour: it loads a sample team so you can see every screen working, then clears it when you're done.</p>
      <div class="btn-row center">
        <button class="btn btn-primary btn-lg" id="dash-tour">Take the tour</button>
        <a class="btn btn-lg" href="#/players">Add players</a>
      </div>
      <p class="small muted" style="margin-top:14px">Already know your way around? <a href="#/players">Add your roster</a> or <a href="#/tryouts">start tryouts</a>.</p>
    </div>`;
    document.getElementById('dash-tour').addEventListener('click', () => beginTour('coach'));
    return;
  }

  const wins = state.matches.filter(m => m.result === 'W').length;
  const losses = state.matches.length - wins;
  const rate = state.matches.length ? Math.round((wins / state.matches.length) * 100) : null;

  // streak + slump alerts
  const alerts = [];
  for (const p of roster) {
    const form = recentForm(p.id);
    if (!form) continue;
    if (form.streak.count >= 3 && form.streak.type === 'W') alerts.push(`${playerLink(p.id)} is on a <b>${form.streak.count}-match win streak</b>.`);
    else if (form.streak.count >= 3 && form.streak.type === 'L') alerts.push(`${playerLink(p.id)} has lost <b>${form.streak.count} straight</b> — worth a check-in.`);
    else if (form.trend === 'down') alerts.push(`${playerLink(p.id)}'s form is dipping versus earlier matches.`);
  }

  const inForm = roster
    .map(p => ({ p, form: recentForm(p.id) }))
    .filter(x => x.form)
    .sort((a, b) => b.form.recentRate - a.form.recentRate)
    .slice(0, 5);

  const recent = [...state.matches].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 5);

  VIEW.innerHTML = `
  <div class="page-head">
    <h1>${esc(state.settings.teamName)}</h1>
    <p class="muted">${new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</p>
  </div>

  <div class="scoreboard">
    <div class="sb-item"><div class="sb-num">${roster.length}</div><div class="sb-label">Roster</div></div>
    <div class="sb-item"><div class="sb-num">${wins}–${losses}</div><div class="sb-label">Record</div></div>
    <div class="sb-item"><div class="sb-num gold">${rate == null ? '—' : rate + '%'}</div><div class="sb-label">Win rate</div></div>
    <div class="sb-item"><div class="sb-num">${tryouts.length}</div><div class="sb-label">${tryouts.length ? '<a href="#/tryouts">Prospects</a>' : 'Prospects'}</div></div>
  </div>

  ${backupIsStale() && sessionGet('siq_backup_dismissed') !== '1' ? `
    <div class="notice section" id="backup-nudge" style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">
      <span style="flex:1;min-width:220px">${daysSinceBackup() === null
        ? '<b>Back up your season.</b> Browsers can clear local data — a backup file is the only copy that survives.'
        : `<b>Last backup was ${daysSinceBackup()} days ago.</b> Keep a fresh copy so a cleared browser can't wipe the season.`}</span>
      <button class="btn btn-sm btn-primary" id="nudge-backup">Export backup</button>
      <button class="btn btn-sm" id="nudge-dismiss">Not now</button>
    </div>` : ''}

  <div class="dash-grid section">
    <div class="dash-main">
      ${alerts.length ? `<div class="card"><div class="card-title">Needs attention</div>${alerts.map(a => `<p style="margin:4px 0">${a}</p>`).join('')}</div>` : ''}
      <div class="grid2">
        <div class="card">
          <div class="card-title">In form</div>
          ${inForm.length ? `<div class="table-wrap"><table>
            <thead><tr><th>Player</th><th>Last 5</th><th>Trend</th></tr></thead>
            <tbody>${inForm.map(({ p, form }) => `<tr>
              <td>${playerLink(p.id)}</td>
              <td>${form.recentWins}/${form.recentTotal} ${wlDots(p.id, 5)}</td>
              <td>${trendArrow(form)}</td>
            </tr>`).join('')}</tbody></table></div>`
          : '<p class="muted">Log matches to see who\'s hot.</p>'}
        </div>
        <div class="card">
          <div class="card-title">Latest matches</div>
          ${recent.length ? `<div class="table-wrap"><table>
            <thead><tr><th>Date</th><th>Player</th><th>Opponent</th><th></th></tr></thead>
            <tbody>${recent.map(m => `<tr>
              <td class="muted">${fmtDate(m.date)}</td>
              <td>${playerLink(m.playerId)}${m.partnerId ? ' / ' + playerLink(m.partnerId) : ''}</td>
              <td>${esc(m.opponent)}</td>
              <td>${resultChip(m.result)}</td>
            </tr>`).join('')}</tbody></table></div>`
          : '<p class="muted">No matches logged yet.</p>'}
        </div>
      </div>
      ${roster.length ? `<div class="card"><div class="card-title">Season trajectory</div>
        ${state.matches.length >= 2 ? sparklineSVG([...teamTrend()].reverse(), { w: 640, h: 56 }) : '<p class="muted">Log a few matches to see the season curve.</p>'}
      </div>` : ''}
    </div>
    <aside class="dash-rail">
      <div class="card">
        <div class="card-title">Quick actions</div>
        <div class="rail-actions">
          <a class="btn" href="#/matches">Log a match</a>
          <a class="btn" href="#/tryouts">Score tryouts</a>
          <a class="btn" href="#/rosters">Build a roster</a>
          <a class="btn" href="#/analyze">Analyze video</a>
          <a class="btn" href="#/insights">Team insights</a>
        </div>
      </div>
      ${tryouts.length ? `<div class="card"><div class="card-title">Tryouts open</div>
        <p class="small" style="margin-bottom:8px">${tryouts.length} prospect${tryouts.length === 1 ? '' : 's'} waiting on scores or a decision.</p>
        <a class="btn btn-primary btn-sm" href="#/tryouts">Open the board</a>
      </div>` : ''}
    </aside>
  </div>`;

  document.getElementById('nudge-backup')?.addEventListener('click', () => {
    exportData();
    toast('Backup saved — keep it somewhere safe');
    route();
  });
  document.getElementById('nudge-dismiss')?.addEventListener('click', () => {
    sessionSet('siq_backup_dismissed', '1');
    document.getElementById('backup-nudge')?.remove();
  });
}

/* ---------- student dashboard ---------- */

/* ---------- level, rank and skill tiles ---------- */

/* Big level ring + rank + what earns points. Gives a reason to keep filming. */
function levelCard(playerId, { compact = false } = {}) {
  const lv = playerXP(playerId);
  const badges = playerBadges(playerId);
  const earned = badges.list.filter(b => b.earned).length;
  const nextUp = badges.list.find(b => !b.earned);
  return `
  <div class="card level-card">
    <div class="level-top">
      ${ringSVG(lv.progressPct, { size: compact ? 84 : 104, stroke: compact ? 9 : 11, center: lv.level, sub: 'LEVEL' })}
      <div class="level-meta">
        <span class="rank-badge ${lv.rank.cls}">${esc(lv.rank.name)}</span>
        <div class="level-xp">${lv.xp} XP</div>
        <div class="small muted">${lv.needForNext} XP to level ${lv.level + 1}</div>
        ${lv.breakdown.length
          ? `<div class="xp-chips">${lv.breakdown.map(b => `<span class="xp-chip">+${b.xp}<span class="muted"> ${esc(b.label.toLowerCase())}</span></span>`).join('')}</div>`
          : '<div class="small muted" style="margin-top:6px">Film a clip or play a match to earn your first XP.</div>'}
      </div>
    </div>
    <div class="badge-row">
      ${badges.list.map(b => `
        <span class="badge ${b.earned ? 'on' : 'off'}" title="${esc(b.label)} - ${esc(b.desc)}">
          <span class="badge-ico">${b.icon}</span><span class="badge-label">${esc(b.label)}</span>
        </span>`).join('')}
    </div>
    <div class="small muted" style="margin-top:10px">
      ${earned} of ${badges.total} badges${nextUp ? ` · next: <b>${esc(nextUp.label)}</b> — ${esc(nextUp.desc)}` : ' · all done!'}
    </div>
  </div>`;
}

/* One tile per skill, coloured by tier - the "rank each body part" view. */
function skillTierGrid(playerId) {
  const cards = skillTierCards(playerId);
  if (!cards.some(c => c.value != null)) {
    return '<p class="muted">No skill grades yet. Film one clip and every skill gets a grade.</p>';
  }
  return `<div class="tier-grid">${cards.map(c => {
    const arrow = c.delta == null || c.delta === 0 ? ''
      : `<span class="tier-delta ${c.delta > 0 ? 'trend-up' : 'trend-down'}">${c.delta > 0 ? '▲' : '▼'}${Math.abs(c.delta)}</span>`;
    return `
    <div class="tier-card ${c.tier.cls}">
      <div class="tier-head">${esc(c.label)}</div>
      <div class="tier-val">${c.value ?? '—'}${arrow}</div>
      <div class="tier-meter"><span style="width:${c.value ?? 0}%"></span></div>
      <div class="tier-foot">${esc(c.tier.name)}</div>
    </div>`;
  }).join('')}</div>`;
}

function renderStudentDashboard() {
  const me = currentStudent();
  if (!me) {
    const roster = state.players.filter(p => p.status === 'roster');
    VIEW.innerHTML = `
    <div class="page-head"><h1>Welcome</h1></div>
    <div class="card">
      <p>You're browsing as a guest. You can analyze your own clips, compare with pros, and browse drills.</p>
      ${roster.length ? `
        <label style="max-width:280px">On the roster? Pick your name
          <select id="me-pick">${playerOptions(null)}</select>
        </label>
        <div class="btn-row"><button class="btn btn-sm" id="me-go">That's me</button></div>`
      : '<p class="muted small">Once your coach adds you to the roster on this device, you can link your name and see your own stats here.</p>'}
    </div>
    <div class="grid3">
      <div class="card"><h3>Analyze my game</h3><p class="muted small">Record 60 seconds and get coached.</p><a class="btn btn-sm" href="#/analyze">Open →</a></div>
      <div class="card"><h3>Compare with a pro</h3><p class="muted small">Side-by-side with the greats.</p><a class="btn btn-sm" href="#/compare">Open →</a></div>
      <div class="card"><h3>Drill library</h3><p class="muted small">Standard drills by skill.</p><a class="btn btn-sm" href="#/drills">Open →</a></div>
    </div>
    <div class="card" style="display:flex;gap:14px;align-items:center;flex-wrap:wrap">
      <span style="flex:1;min-width:240px"><b>First time here?</b> Take a two-minute tour on a sample team to see what the app does.</span>
      <button class="btn btn-primary btn-sm" data-tour="student">Take the tour</button>
    </div>`;
    VIEW.querySelectorAll('[data-tour]').forEach(b => b.addEventListener('click', () => beginTour(b.dataset.tour)));
    document.getElementById('me-go')?.addEventListener('click', () => {
      setStudentId(document.getElementById('me-pick').value);
      route();
    });
    return;
  }

  const form = recentForm(me.id);
  const profile = skillProfile(me.id);
  const weak = improvementAreas(me.id);
  const latest = playerSessions(me.id)[0];

  VIEW.innerHTML = `
  <div class="page-head">
    <h1>Hi, ${esc(me.name.split(' ')[0])}</h1>
    <p class="muted">${esc(state.settings.teamName)}</p>
  </div>

  ${levelCard(me.id)}

  <div class="card">
    <div class="card-title">My skill grades</div>
    ${skillTierGrid(me.id)}
  </div>

  <div class="grid2">
    <div class="card">
      <div class="card-title">My form</div>
      ${form ? `
        <p style="font-size:18px;font-weight:700;margin-bottom:4px">${form.recentWins} of ${form.recentTotal} won ${trendArrow(form)}</p>
        <p>${wlDots(me.id)} ${form.streak.count >= 2 ? `<span class="small muted">· ${form.streak.count}-match ${form.streak.type === 'W' ? 'win' : 'loss'} streak</span>` : ''}</p>
        ${sparklineSVG(playerMatches(me.id), { w: 220, h: 36 })}`
      : '<p class="muted">No matches logged yet — your coach logs them after each game.</p>'}
    </div>
    <div class="card">
      <div class="card-title">My skills</div>
      ${profile ? radarSVG(profile, { size: 230 }) : '<p class="muted">Run a video analysis or play rated matches to build your skill profile.</p>'}
    </div>
  </div>

  <div class="grid2">
    <div class="card">
      <div class="card-title">What to work on</div>
      ${weak.length ? weak.map(w => `
        <p style="margin:6px 0"><b>${w.label}</b> <span class="muted small">(${w.score}/100)</span><br>
        <span class="small">${esc(w.drill)}</span></p>`).join('') + `<a class="small" href="#/drills">Browse all drills →</a>`
      : '<p class="muted">Nothing yet — analyze a clip to find your focus areas.</p>'}
    </div>
    <div class="card">
      <div class="card-title">Latest AI feedback</div>
      ${latest ? `
        <p class="small muted">${esc(latest.label)} · ${fmtDate(latest.date)}</p>
        ${latest.feedback.slice(0, 2).map(f => `
          <div class="fb-card fb-${esc(f.type)}" style="cursor:default">
            <div class="fb-head"><span class="fb-time">${esc(f.timestamp)}</span>${esc(f.title)}</div>
            <div class="fb-body small">${esc(f.body)}</div>
          </div>`).join('')}`
      : '<p class="muted">No analyses yet.</p>'}
      <div class="btn-row"><a class="btn btn-primary btn-sm" href="#/analyze">Analyze my game</a><a class="btn btn-sm" href="#/compare">Compare with a pro</a></div>
    </div>
  </div>`;
}

/* ---------- team (read-only for players) ---------- */

function renderTeam() {
  const roster = state.players.filter(p => p.status === 'roster');
  VIEW.innerHTML = `
  <div class="page-head"><h1>${esc(state.settings.teamName)}</h1><p class="muted">${roster.length} players</p></div>
  ${roster.length ? `<div class="card"><div class="table-wrap"><table>
    <thead><tr><th>Player</th><th>Year</th><th>Record</th><th>Last 8</th><th>Trend</th></tr></thead>
    <tbody>${roster.map(p => {
      const ms = playerMatches(p.id);
      const w = ms.filter(m => m.result === 'W').length;
      return `<tr>
        <td>${playerLink(p.id)}</td>
        <td class="muted">${esc(p.year ?? '')}</td>
        <td>${ms.length ? `${w}–${ms.length - w}` : '<span class="muted">—</span>'}</td>
        <td>${wlDots(p.id)}</td>
        <td>${trendArrow(recentForm(p.id))}</td>
      </tr>`;
    }).join('')}</tbody></table></div></div>`
  : '<div class="empty"><h3>No roster yet</h3><p>The coach hasn\'t added players on this device.</p></div>'}`;
}

/* ---------- insights (coach) ---------- */

function renderInsights() {
  const chart = depthChart();
  const plan = practicePlan();
  const h2h = headToHead();
  const chem = pairChemistry().filter(c => c.total >= 2).slice(0, 6);
  const trend = [...teamTrend()].reverse(); // sparkline expects newest-first
  const wins = state.matches.filter(m => m.result === 'W').length;

  const depthCol = key => `
    <div class="card">
      <div class="card-title">${POSITIONS[key].label}</div>
      ${chart[key].length ? chart[key].map((x, i) => `
        <p style="margin:5px 0"><span class="rank-num">${i + 1}.</span>${playerLink(x.player.id)}
        <span class="muted small">fit ${x.score}${x.wr != null ? ` · ${Math.round(x.wr * 100)}% wins` : ''}</span></p>`).join('')
      : '<p class="muted small">Needs rated matches or analyses.</p>'}
    </div>`;

  VIEW.innerHTML = `
  <div class="page-head"><h1>Team insights</h1><p class="muted">Everything derived from logged matches and analyses</p></div>

  <div class="card">
    <div class="card-title">Season trajectory</div>
    ${state.matches.length >= 2
      ? `${sparklineSVG(trend, { w: 520, h: 48 })}<p class="small muted" style="margin-top:6px">Rolling team win rate · record ${wins}–${state.matches.length - wins}</p>`
      : '<p class="muted">Log a few matches to see the season curve.</p>'}
  </div>

  <h2 class="section">Depth chart</h2>
  <p class="muted small">Best-fit players per role, from merged coach ratings and AI scores.</p>
  <div class="grid3">${depthCol('singles')}${depthCol('front')}${depthCol('back')}</div>

  <h2 class="section">Practice plan <button class="btn btn-sm no-print" id="plan-print" style="vertical-align:middle">Print</button></h2>
  ${plan.length ? `<div class="card"><div class="table-wrap"><table>
    <thead><tr><th>Skill</th><th>Team avg</th><th>Focus players</th><th>Drill</th></tr></thead>
    <tbody>${plan.map(r => `<tr>
      <td><b>${r.label}</b></td>
      <td>${r.avg}</td>
      <td class="small">${r.focusPlayers.length ? r.focusPlayers.map(esc).join(', ') : '<span class="muted">—</span>'}</td>
      <td class="small">${esc(r.drill)}</td>
    </tr>`).join('')}</tbody></table></div></div>`
  : '<div class="card"><p class="muted">No skill data yet — rate matches or run analyses.</p></div>'}

  <div class="grid2 section">
    <div class="card">
      <div class="card-title">Head-to-head</div>
      ${h2h.length ? `<div class="table-wrap"><table>
        <thead><tr><th>Opponent</th><th>W</th><th>L</th><th>Win %</th></tr></thead>
        <tbody>${h2h.map(r => `<tr><td>${esc(r.opponent)}</td><td>${r.wins}</td><td>${r.losses}</td><td>${Math.round(r.rate * 100)}%</td></tr>`).join('')}</tbody>
      </table></div>` : '<p class="muted">No matches yet.</p>'}
    </div>
    <div class="card">
      <div class="card-title">Doubles chemistry</div>
      ${chem.length ? `<div class="table-wrap"><table>
        <thead><tr><th>Pair</th><th>Together</th><th>Win %</th></tr></thead>
        <tbody>${chem.map(c => `<tr>
          <td>${playerLink(c.ids[0])} + ${playerLink(c.ids[1])}</td>
          <td>${c.total}</td><td>${Math.round(c.rate * 100)}%</td>
        </tr>`).join('')}</tbody></table></div>`
      : '<p class="muted">Log doubles matches (with a partner) to measure pair chemistry.</p>'}
    </div>
  </div>`;

  document.getElementById('plan-print')?.addEventListener('click', () => window.print());
}

/* ---------- players (coach) ---------- */

function renderPlayers(_, params) {
  const filter = params?.get('f') || 'all';
  const counts = { all: state.players.length };
  for (const s of ['roster', 'tryout', 'cut']) counts[s] = state.players.filter(p => p.status === s).length;
  const list = state.players
    .filter(p => filter === 'all' || p.status === filter)
    .sort((a, b) => a.name.localeCompare(b.name));

  VIEW.innerHTML = `
  <div class="page-head"><h1>Players</h1></div>

  <div class="inline-form">
    <div class="form-grid">
      <label>Name<input type="text" id="np-name" placeholder="Full name — or several: Alex, Ben, Chris"></label>
      <label>Year<select id="np-year"><option>9</option><option>10</option><option>11</option><option selected>12</option></select></label>
      <label>Hand<select id="np-hand"><option>Right</option><option>Left</option></select></label>
      <label>Status<select id="np-status"><option value="roster">Roster</option><option value="tryout">Tryout</option></select></label>
    </div>
    <button class="btn btn-primary btn-sm" id="np-add">Add player</button>
  </div>

  <div class="filter-row">
    ${['all', 'roster', 'tryout', 'cut'].map(f =>
      `<button class="filter-chip ${f === filter ? 'active' : ''}" data-f="${f}">${f[0].toUpperCase() + f.slice(1)} (${counts[f]})</button>`).join('')}
    <input type="text" id="pl-search" placeholder="Search name…" style="max-width:200px;margin-left:auto" autocomplete="off">
  </div>

  ${list.length ? `<div class="card"><div class="table-wrap"><table>
    <thead><tr><th>Player</th><th>Year</th><th>Hand</th><th>Status</th><th>Available</th><th>Record</th><th>Trend</th><th>Best fit</th></tr></thead>
    <tbody>${list.map(p => {
      const ms = playerMatches(p.id);
      const w = ms.filter(m => m.result === 'W').length;
      const pos = positionScores(p.id);
      const av = playerAvailability(p);
      return `<tr data-name="${esc(p.name.toLowerCase())}">
        <td>${playerLink(p.id)}</td>
        <td class="muted">${esc(p.year ?? '')}</td>
        <td class="muted">${esc(p.hand ?? '')}</td>
        <td><span class="chip chip-neutral">${esc(p.status)}</span></td>
        <td><select class="avail-pick" data-id="${p.id}" style="width:auto;padding:3px 6px;font-size:12px">
          ${Object.entries(AVAILABILITY).map(([k, v]) => `<option value="${k}" ${av === k ? 'selected' : ''}>${v.label}</option>`).join('')}
        </select></td>
        <td>${ms.length ? `${w}–${ms.length - w}` : '<span class="muted">—</span>'}</td>
        <td>${trendArrow(recentForm(p.id))}</td>
        <td class="small">${pos ? POSITIONS[pos.best].label : '<span class="muted">—</span>'}</td>
      </tr>`;
    }).join('')}</tbody></table></div>
    <p class="small muted" id="pl-empty" style="display:none">No players match that search.</p></div>`
  : `<div class="empty"><h3>No players ${filter === 'all' ? 'yet' : 'in this group'}</h3><p>Add players above${filter === 'all' ? ' or load sample data from Settings' : ''}.</p></div>`}`;

  document.getElementById('np-add').addEventListener('click', () => {
    const names = document.getElementById('np-name').value.split(/[,\n]/).map(s => s.trim()).filter(Boolean);
    if (!names.length) { toast('Enter a name first'); return; }
    for (const name of names) {
      state.players.push({
        id: uid(), name,
        year: Number(document.getElementById('np-year').value),
        hand: document.getElementById('np-hand').value,
        status: document.getElementById('np-status').value,
        tryoutScores: null, aiNote: null, notes: '', createdAt: new Date().toISOString(),
      });
    }
    saveState();
    toast(names.length === 1 ? `${names[0]} added` : `${names.length} players added`);
    route();
  });
  document.getElementById('np-name').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('np-add').click();
  });
  VIEW.querySelectorAll('.filter-chip').forEach(b => b.addEventListener('click', () => {
    location.hash = `#/players?f=${b.dataset.f}`;
  }));

  VIEW.querySelectorAll('.avail-pick').forEach(sel => sel.addEventListener('change', () => {
    const p = getPlayer(sel.dataset.id);
    if (!p) return;
    p.availability = sel.value;
    saveState();
    toast(`${p.name}: ${AVAILABILITY[sel.value].label}`);
  }));

  const search = document.getElementById('pl-search');
  search?.addEventListener('input', () => {
    const q = search.value.trim().toLowerCase();
    let shown = 0;
    VIEW.querySelectorAll('tbody tr[data-name]').forEach(row => {
      const hit = !q || row.dataset.name.includes(q);
      row.style.display = hit ? '' : 'none';
      if (hit) shown++;
    });
    const empty = document.getElementById('pl-empty');
    if (empty) empty.style.display = shown ? 'none' : '';
  });
}

/* ---------- player detail ---------- */

function renderPlayerDetail(id) {
  const p = getPlayer(id);
  if (!p) { VIEW.innerHTML = '<div class="empty"><h3>Player not found</h3></div>'; return; }
  const coach = isCoach();
  const profile = skillProfile(id);
  const form = recentForm(id);
  const pos = positionScores(id);
  const weak = improvementAreas(id);
  const strong = strengths(id);
  const ms = playerMatches(id);
  const wins = ms.filter(m => m.result === 'W').length;
  const sessions = playerSessions(id);

  VIEW.innerHTML = `
  ${coach ? '<p class="small no-print"><a href="#/players">← Players</a></p>' : ''}
  <div class="page-head">
    <h1>${esc(p.name)} <span class="chip chip-neutral">${esc(p.status)}</span>${playerAvailability(p) !== 'available' ? ` <span class="chip ${AVAILABILITY[playerAvailability(p)].chip}">${AVAILABILITY[playerAvailability(p)].label}</span>` : ''}${ladderRank(id) ? ` <span class="chip chip-neutral">Ladder #${ladderRank(id)}</span>` : ''}</h1>
    <div class="btn-row no-print" style="margin:0">
      ${coach ? `<a class="btn btn-sm" href="#/matches?player=${id}">Log match</a>` : ''}
      <a class="btn btn-sm" href="#/analyze?player=${id}">Analyze video</a>
      <button class="btn btn-sm" id="pd-print">Print report</button>
      ${coach ? `<button class="btn btn-sm" id="pd-edit-toggle">Edit</button>` : ''}
    </div>
  </div>
  <p class="muted" style="margin-top:-10px">Year ${esc(p.year ?? '—')} · ${esc(p.hand ?? '—')}-handed${ms.length ? ` · ${wins}–${ms.length - wins} overall` : ''}</p>

  <div id="pd-edit" class="inline-form" style="display:none">
    <div class="form-grid">
      <label>Name<input type="text" id="pe-name" value="${esc(p.name)}"></label>
      <label>Year<select id="pe-year">${[9, 10, 11, 12].map(y => `<option ${p.year === y ? 'selected' : ''}>${y}</option>`).join('')}</select></label>
      <label>Hand<select id="pe-hand">${['Right', 'Left'].map(h => `<option ${p.hand === h ? 'selected' : ''}>${h}</option>`).join('')}</select></label>
      <label>Status<select id="pe-status">${['roster', 'tryout', 'cut'].map(s => `<option value="${s}" ${p.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select></label>
      <label>Availability<select id="pe-avail">${Object.entries(AVAILABILITY).map(([k, v]) => `<option value="${k}" ${playerAvailability(p) === k ? 'selected' : ''}>${v.label}</option>`).join('')}</select></label>
    </div>
    <label style="margin-top:8px">Coach notes (only shown in coach view)<textarea id="pe-notes" placeholder="Anything worth remembering about this player">${esc(p.notes || '')}</textarea></label>
    <div class="btn-row">
      <button class="btn btn-primary btn-sm" id="pe-save">Save</button>
      <button class="btn btn-danger btn-sm" id="pe-delete">Delete player…</button>
    </div>
  </div>

  <div class="grid2">
    <div class="card">
      <div class="card-title">Skill grades</div>
      ${skillTierGrid(id)}
    </div>
    <div class="card">
      <div class="card-title">Skill profile</div>
      ${profile ? radarSVG(profile) + skillBars(profile) : '<p class="muted">No data yet — rate a match or run a video analysis.</p>'}
    </div>
    <div>
      <div class="card">
        <div class="card-title">Form</div>
        ${form ? `
          <p style="font-size:18px;font-weight:700;margin-bottom:4px">Won ${form.recentWins} of last ${form.recentTotal} ${trendArrow(form)}</p>
          <p>${wlDots(id)} ${form.streak.count >= 2 ? `<span class="small muted">· ${form.streak.count}-match ${form.streak.type === 'W' ? 'win' : 'loss'} streak</span>` : ''}</p>
          ${sparklineSVG(ms, { w: 240, h: 40 })}`
        : '<p class="muted">No matches yet.</p>'}
      </div>
      <div class="card">
        <div class="card-title">Position fit</div>
        ${pos ? `
          <p style="margin-bottom:8px">Best fit: <b>${POSITIONS[pos.best].label}</b></p>
          ${Object.keys(POSITIONS).map(k => `
            <div class="bar-row">
              <span class="bar-label" style="width:150px">${POSITIONS[k].label}</span>
              <span class="bar-track"><span class="bar-fill" style="width:${pos[k]}%"></span></span>
              <span class="bar-val">${pos[k]}</span>
            </div>`).join('')}`
        : '<p class="muted">Needs skill data first.</p>'}
      </div>
      <div class="card">
        <div class="card-title">Strengths & focus</div>
        ${strong.length ? `<p>${strong.map(s => `<span class="tag tag-accent">${s.label} ${s.score}</span>`).join(' ')}</p>` : ''}
        ${weak.length ? weak.map(w => `<p class="small" style="margin:6px 0"><b>${w.label}</b> (${w.score}) — ${esc(w.drill)}</p>`).join('') : '<p class="muted">No skill data yet.</p>'}
      </div>
    </div>
  </div>

  <div class="card">
    <div class="card-title">Coach's read</div>
    ${coach && p.notes ? `<p style="white-space:pre-wrap"><b>Notes:</b> ${esc(p.notes)}</p>` : ''}
    <p>${esc(localCoachNote(id))}</p>
    <div id="pd-ainote">
      ${p.aiNote ? `<hr><p style="white-space:pre-wrap">${esc(p.aiNote.text)}</p><p class="small muted">AI note · ${fmtDate(p.aiNote.date)}</p>` : ''}
    </div>
    ${coach ? `<div class="btn-row no-print">
      <button class="btn btn-sm" id="pd-ainote-btn" ${hasApiKey() ? '' : 'disabled title="Add an API key in Settings"'}>${p.aiNote ? 'Refresh AI note' : 'Generate AI note'}</button>
      <span class="small muted" id="pd-ainote-status"></span>
    </div>` : ''}
  </div>

  ${(() => {
    const trend = sessionTrend(id);
    const prog = skillProgress(id);
    if (trend.length < 2 && !prog) return '';
    return `<div class="card">
      <div class="card-title">Progress</div>
      ${trend.length >= 2 ? `${lineChartSVG(trend)}<p class="small muted">Average AI session score across ${trend.length} analyses</p>` : ''}
      ${prog ? `<div class="grid3" style="margin-top:10px">${prog.rows.map(r => `
        <div class="small"><b>${r.label}</b><br>
          <span class="muted">${r.from} → ${r.to}</span>
          <span class="${r.delta > 0 ? 'trend-up' : r.delta < 0 ? 'trend-down' : 'trend-flat'}">${r.delta > 0 ? '+' : ''}${r.delta}</span>
        </div>`).join('')}</div>` : ''}
    </div>`;
  })()}

  <div class="card no-print">
    <div class="card-title">Saved clips</div>
    <div id="pd-clips"><p class="muted small">Loading…</p></div>
  </div>

  <div class="grid2">
    <div class="card">
      <div class="card-title">Recent matches</div>
      ${ms.length ? `<div class="table-wrap"><table><tbody>
        ${ms.slice(0, 10).map(m => `<tr>
          <td class="muted small">${fmtDate(m.date)}</td>
          <td><span class="tag">${esc(m.discipline)}</span>${esc(m.opponent)}${m.notes ? `<div class="small muted">${esc(m.notes)}</div>` : ''}</td>
          <td class="small muted">${esc(m.score)}</td>
          <td>${resultChip(m.result)}</td>
        </tr>`).join('')}
      </tbody></table></div>` : '<p class="muted">None yet.</p>'}
    </div>
    <div class="card">
      <div class="card-title">Analysis sessions</div>
      ${sessions.length ? sessions.slice(0, 6).map(s => `
        <details>
          <summary>${esc(s.label)} <span class="muted small">· ${fmtDate(s.date)}${s.focus && s.focus !== 'all' ? ' · focus: ' + esc(s.focus) : ''}</span></summary>
          ${s.scores ? skillBars(s.scores) : ''}
          ${(s.feedback || []).map(f => `
            <div class="fb-card fb-${esc(f.type)}" style="cursor:default">
              <div class="fb-head"><span class="fb-time">${esc(f.timestamp)}</span>${esc(f.title)}</div>
              <div class="fb-body small">${esc(f.body)}</div>
              ${f.tip ? `<div class="fb-tip">Drill: ${esc(f.tip)}</div>` : ''}
            </div>`).join('')}
        </details>`).join('')
      : '<p class="muted">No analyses yet.</p>'}
    </div>
  </div>`;

  document.getElementById('pd-print').addEventListener('click', () => window.print());

  // clips
  listClips().then(clips => {
    const mine = clips.filter(c => c.playerId === id);
    const box = document.getElementById('pd-clips');
    if (!box) return;
    if (!mine.length) { box.innerHTML = '<p class="muted">No saved clips. Record one from the Analyze page.</p>'; return; }
    box.innerHTML = mine.map(c => `
      <div class="btn-row" data-clip="${c.id}" style="margin:6px 0">
        <b>${esc(c.label || 'Clip')}</b>
        <span class="muted small">${fmtDate(c.date)}${c.duration ? ` · ${Math.round(c.duration)}s` : ''}</span>
        <button class="btn btn-sm" data-act="play">Play</button>
        <a class="btn btn-sm" href="#/analyze?clip=${c.id}">Analyze</a>
        ${coach ? '<button class="btn btn-danger btn-sm" data-act="del">Delete</button>' : ''}
      </div>
      <div class="clip-slot" data-slot="${c.id}"></div>`).join('');
    box.querySelectorAll('[data-act="play"]').forEach(btn => btn.addEventListener('click', async () => {
      const row = btn.closest('[data-clip]');
      const clip = await getClip(row.dataset.clip);
      const slot = box.querySelector(`[data-slot="${row.dataset.clip}"]`);
      if (!clip) { toast('Clip missing'); return; }
      if (slot.innerHTML) { slot.innerHTML = ''; return; }
      box.querySelectorAll('.clip-slot').forEach(s => s.innerHTML = '');
      slot.innerHTML = `<video controls autoplay src="${trackUrl(URL.createObjectURL(clip.blob))}" style="margin-bottom:10px"></video>`;
    }));
    box.querySelectorAll('[data-act="del"]').forEach(btn => btn.addEventListener('click', async () => {
      if (!confirm('Delete this clip?')) return;
      await deleteClip(btn.closest('[data-clip]').dataset.clip);
      toast('Clip deleted');
      renderPlayerDetail(id);
    }));
  });

  if (!coach) return;

  document.getElementById('pd-edit-toggle').addEventListener('click', () => {
    const f = document.getElementById('pd-edit');
    f.style.display = f.style.display === 'none' ? '' : 'none';
  });
  document.getElementById('pe-save').addEventListener('click', () => {
    p.name = document.getElementById('pe-name').value.trim() || p.name;
    p.year = Number(document.getElementById('pe-year').value);
    p.hand = document.getElementById('pe-hand').value;
    p.status = document.getElementById('pe-status').value;
    p.availability = document.getElementById('pe-avail').value;
    p.notes = document.getElementById('pe-notes').value.trim();
    saveState();
    toast('Saved');
    renderPlayerDetail(id);
  });
  document.getElementById('pe-delete').addEventListener('click', async () => {
    if (!confirm(`Delete ${p.name}? Their matches, analyses, and clips are removed too. This cannot be undone.`)) return;
    state.players = state.players.filter(x => x.id !== id);
    state.matches = state.matches.filter(m => m.playerId !== id);
    state.matches.forEach(m => { if (m.partnerId === id) m.partnerId = null; });
    state.sessions = state.sessions.filter(s => s.playerId !== id);
    state.rosters.forEach(r => r.slots.forEach(s => { s.playerIds = s.playerIds.filter(x => x !== id); }));
    saveState();
    await deletePlayerClips(id);
    toast('Player deleted');
    location.hash = '#/players';
  });
  document.getElementById('pd-ainote-btn')?.addEventListener('click', async () => {
    const btn = document.getElementById('pd-ainote-btn');
    const status = document.getElementById('pd-ainote-status');
    btn.disabled = true;
    status.textContent = 'Writing note…';
    try {
      const text = await aiCoachNote(p);
      p.aiNote = { text, date: new Date().toISOString() };
      saveState();
      renderPlayerDetail(id);
    } catch (err) {
      status.textContent = 'Failed: ' + err.message;
      btn.disabled = false;
    }
  });
}

/* ---------- matches (coach) ---------- */

const DISCIPLINES = ['MS', 'WS', 'MD', 'WD', 'XD'];
const DOUBLES = new Set(['MD', 'WD', 'XD']);

function renderMatches(_, params) {
  const preselect = params?.get('player') || null;
  const filterPlayer = params?.get('f') || '';
  let result = 'W';

  const all = [...state.matches].sort((a, b) => (a.date < b.date ? 1 : -1));
  const list = filterPlayer ? all.filter(m => m.playerId === filterPlayer || m.partnerId === filterPlayer) : all;
  const fromTryout = preselect && getPlayer(preselect)?.status === 'tryout';

  VIEW.innerHTML = `
  ${fromTryout ? '<p class="small no-print"><a href="#/tryouts">← Back to tryouts</a></p>' : ''}
  <div class="page-head"><h1>Matches</h1><p class="muted">${state.matches.length} logged</p></div>

  <div class="card">
    <div class="card-title">Log a match</div>
    <div class="form-grid">
      <label>Player<select id="mf-player">${playerOptions(preselect, { statuses: ['roster', 'tryout'] })}</select></label>
      <label>Discipline<select id="mf-disc">${DISCIPLINES.map(d => `<option>${d}</option>`).join('')}</select></label>
      <label id="mf-partner-wrap" style="display:none">Partner<select id="mf-partner"><option value="">—</option>${playerOptions(null, { statuses: ['roster', 'tryout'] })}</select></label>
      <label>Date<input type="date" id="mf-date" value="${todayISO()}"></label>
      <label>Opponent<input type="text" id="mf-opp" placeholder="School or player"></label>
      <label>Score<input type="text" id="mf-score" placeholder="21-15, 21-18"></label>
    </div>
    <div class="btn-row">
      <span class="small muted">Result:</span>
      <span class="seg">
        <button id="mf-w" class="active seg-w">Won</button>
        <button id="mf-l" class="seg-l">Lost</button>
      </span>
    </div>
    <details>
      <summary>Rate their play (optional, 1–5)</summary>
      <div id="mf-ratings">${SKILLS.map(s => ratingRow(s, SKILL_LABELS[s])).join('')}</div>
    </details>
    <label style="margin-top:8px">Notes<input type="text" id="mf-notes" placeholder="Anything worth remembering"></label>
    <div class="btn-row"><button class="btn btn-primary" id="mf-save">Save match</button></div>
  </div>

  <div class="card">
    <div class="card-title">History</div>
    <div class="btn-row">
      <label style="max-width:220px">Filter by player
        <select id="ml-filter"><option value="">Everyone</option>${playerOptions(filterPlayer, { statuses: ['roster', 'tryout', 'cut'] })}</select>
      </label>
    </div>
    ${list.length ? `<div class="table-wrap"><table>
      <thead><tr><th>Date</th><th>Player</th><th>Event</th><th>Opponent</th><th>Score</th><th></th><th></th></tr></thead>
      <tbody>${list.slice(0, 40).map(m => `<tr>
        <td class="muted small">${fmtDate(m.date)}</td>
        <td>${playerLink(m.playerId)}${m.partnerId ? '<span class="muted"> / </span>' + playerLink(m.partnerId) : ''}</td>
        <td><span class="tag">${esc(m.discipline)}</span>${m.context === 'tryout' ? '<span class="tag">tryout</span>' : ''}</td>
        <td>${esc(m.opponent)}${m.notes ? `<div class="small muted">${esc(m.notes)}</div>` : ''}</td>
        <td class="small muted">${esc(m.score)}</td>
        <td>${resultChip(m.result)}</td>
        <td><button class="btn btn-danger btn-sm" data-del="${m.id}">✕</button></td>
      </tr>`).join('')}</tbody></table></div>
      ${list.length > 40 ? `<p class="small muted">Showing latest 40 of ${list.length}.</p>` : ''}`
    : '<p class="muted">Nothing here yet.</p>'}
  </div>`;

  const discSel = document.getElementById('mf-disc');
  const partnerWrap = document.getElementById('mf-partner-wrap');
  const syncPartner = () => { partnerWrap.style.display = DOUBLES.has(discSel.value) ? '' : 'none'; };
  discSel.addEventListener('change', syncPartner);
  syncPartner();

  const wBtn = document.getElementById('mf-w'), lBtn = document.getElementById('mf-l');
  wBtn.addEventListener('click', () => { result = 'W'; wBtn.classList.add('active'); lBtn.classList.remove('active'); });
  lBtn.addEventListener('click', () => { result = 'L'; lBtn.classList.add('active'); wBtn.classList.remove('active'); });

  wireRatingRows(document.getElementById('mf-ratings'));

  document.getElementById('mf-save').addEventListener('click', () => {
    const playerId = document.getElementById('mf-player').value;
    if (!playerId) { toast('Add a player first'); return; }
    const player = getPlayer(playerId);
    let partnerId = DOUBLES.has(discSel.value) ? (document.getElementById('mf-partner').value || null) : null;
    if (partnerId === playerId) partnerId = null;
    state.matches.push({
      id: uid(), playerId, partnerId,
      date: document.getElementById('mf-date').value || todayISO(),
      opponent: document.getElementById('mf-opp').value.trim() || 'Unknown',
      discipline: discSel.value,
      result,
      score: document.getElementById('mf-score').value.trim(),
      ratings: readRatings(document.getElementById('mf-ratings')),
      notes: document.getElementById('mf-notes').value.trim(),
      context: player && player.status === 'tryout' ? 'tryout' : 'season',
    });
    saveState();
    toast('Match saved');
    // keep the player preselected (and the tryouts back-link) for quick repeat logging
    renderMatches(_, new URLSearchParams(preselect ? `player=${preselect}` : (filterPlayer ? `f=${filterPlayer}` : '')));
  });

  document.getElementById('ml-filter').addEventListener('change', e => {
    location.hash = e.target.value ? `#/matches?f=${e.target.value}` : '#/matches';
  });
  VIEW.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => {
    if (!confirm('Delete this match?')) return;
    state.matches = state.matches.filter(m => m.id !== b.dataset.del);
    saveState();
    toast('Match deleted');
    route();
  }));
}

/* ---------- tryouts (coach) ---------- */

const TRYOUT_DRILLS = [
  ['serve', 'Serving'], ['footwork', 'Footwork'], ['smash', 'Smash'], ['net', 'Net play'],
  ['rally', 'Rally length'], ['sense', 'Court sense'], ['athleticism', 'Athleticism'],
];

function renderTryouts() {
  const prospects = state.players.filter(p => p.status === 'tryout')
    .sort((a, b) => tryoutComposite(b) - tryoutComposite(a));
  const cut = state.players.filter(p => p.status === 'cut');

  VIEW.innerHTML = `
  <div class="page-head"><h1>Tryouts</h1><p class="muted">Tap scores as they play — the board ranks live</p></div>

  <div class="inline-form">
    <div class="form-grid">
      <label>Name<input type="text" id="tp-name" placeholder="Prospect name — or several, comma-separated"></label>
      <label>Year<select id="tp-year"><option selected>9</option><option>10</option><option>11</option><option>12</option></select></label>
      <label>Hand<select id="tp-hand"><option>Right</option><option>Left</option></select></label>
    </div>
    <button class="btn btn-primary btn-sm" id="tp-add">Add prospect</button>
  </div>

  <div id="tryout-board">
  ${prospects.length ? prospects.map((p, i) => {
    const ms = playerMatches(p.id);
    const w = ms.filter(m => m.result === 'W').length;
    return `
    <div class="card" data-prospect="${p.id}" data-composite="${tryoutComposite(p)}">
      <div class="page-head" style="margin-bottom:8px">
        <h3 style="margin:0"><span class="rank-num" data-rank>${i + 1}.</span> ${playerLink(p.id)}
          <span class="muted small">yr ${esc(p.year)} · ${esc(p.hand)}</span></h3>
        <div>
          <span class="tag" title="Match record in tryouts">${ms.length ? `${w}–${ms.length - w}` : 'no matches'}</span>
          <span class="chip chip-w" data-composite-chip>${tryoutComposite(p).toFixed(1)}/5</span>
        </div>
      </div>
      <div class="ratings">${TRYOUT_DRILLS.map(([k, label]) => ratingRow(k, label, p.tryoutScores?.[k] || 0)).join('')}</div>
      <div class="btn-row">
        <button class="btn btn-primary btn-sm" data-act="promote">Promote to roster</button>
        <a class="btn btn-sm" href="#/matches?player=${p.id}">Log match</a>
        <a class="btn btn-sm" href="#/analyze?player=${p.id}">Record video</a>
        <button class="btn btn-danger btn-sm" data-act="cut">Cut</button>
      </div>
    </div>`;
  }).join('')
  : `<div class="empty"><h3>No prospects yet</h3><p>Add each player trying out, tap 1–5 scores while they play the drills, and log their tryout matches. The board ranks them by composite score.</p></div>`}
  </div>

  ${cut.length ? `
  <details class="section">
    <summary>Cut (${cut.length})</summary>
    ${cut.map(p => `<div class="btn-row" data-cut="${p.id}">
      <b>${esc(p.name)}</b><span class="muted small">yr ${esc(p.year)}</span>
      <button class="btn btn-sm" data-act="restore">Back to tryouts</button>
      <button class="btn btn-danger btn-sm" data-act="forget">Delete forever</button>
    </div>`).join('')}
  </details>` : ''}`;

  document.getElementById('tp-add').addEventListener('click', () => {
    const names = document.getElementById('tp-name').value.split(/[,\n]/).map(s => s.trim()).filter(Boolean);
    if (!names.length) { toast('Enter a name first'); return; }
    for (const name of names) {
      state.players.push({
        id: uid(), name,
        year: Number(document.getElementById('tp-year').value),
        hand: document.getElementById('tp-hand').value,
        status: 'tryout', tryoutScores: null, aiNote: null, notes: '', createdAt: new Date().toISOString(),
      });
    }
    saveState();
    toast(names.length === 1 ? `${names[0]} added to tryouts` : `${names.length} prospects added`);
    renderTryouts();
  });
  document.getElementById('tp-name').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('tp-add').click();
  });

  const board = document.getElementById('tryout-board');

  const resort = () => {
    if (!document.body.contains(board)) return; // page changed before the timer fired
    const cards = [...board.querySelectorAll('[data-prospect]')];
    cards.sort((a, b) => Number(b.dataset.composite) - Number(a.dataset.composite));
    cards.forEach(c => board.appendChild(c));
    cards.forEach((c, i) => { c.querySelector('[data-rank]').textContent = `${i + 1}.`; });
  };
  // re-rank a moment after the last tap, so the card doesn't jump out from
  // under the coach's finger while they're still scoring one player
  let resortTimer = null;
  const resortSoon = () => { clearTimeout(resortTimer); resortTimer = setTimeout(resort, 1200); };

  board.querySelectorAll('[data-prospect]').forEach(card => {
    const p = getPlayer(card.dataset.prospect);
    wireRatingRows(card.querySelector('.ratings'), (skill, v) => {
      p.tryoutScores = p.tryoutScores || {};
      p.tryoutScores[skill] = v;
      saveState();
      card.dataset.composite = tryoutComposite(p);
      card.querySelector('[data-composite-chip]').textContent = `${tryoutComposite(p).toFixed(1)}/5`;
      resortSoon();
    });
    card.querySelector('[data-act="promote"]').addEventListener('click', () => {
      p.status = 'roster';
      saveState();
      toast(`${p.name} promoted to the roster 🎉`);
      renderTryouts();
    });
    card.querySelector('[data-act="cut"]').addEventListener('click', () => {
      if (!confirm(`Cut ${p.name}? Their data is kept and they can be restored.`)) return;
      p.status = 'cut';
      saveState();
      renderTryouts();
    });
  });

  VIEW.querySelectorAll('[data-cut]').forEach(row => {
    const p = getPlayer(row.dataset.cut);
    row.querySelector('[data-act="restore"]').addEventListener('click', () => {
      p.status = 'tryout';
      saveState();
      renderTryouts();
    });
    row.querySelector('[data-act="forget"]').addEventListener('click', async () => {
      if (!confirm(`Permanently delete ${p.name} and all their data?`)) return;
      state.players = state.players.filter(x => x.id !== p.id);
      state.matches = state.matches.filter(m => m.playerId !== p.id);
      state.sessions = state.sessions.filter(s => s.playerId !== p.id);
      saveState();
      await deletePlayerClips(p.id);
      renderTryouts();
    });
  });
}

/* ---------- rosters (coach) ---------- */

const DEFAULT_SLOTS = [
  { code: 'S1', label: 'Singles 1', type: 'singles' },
  { code: 'S2', label: 'Singles 2', type: 'singles' },
  { code: 'S3', label: 'Singles 3', type: 'singles' },
  { code: 'D1', label: 'Doubles 1', type: 'doubles' },
  { code: 'D2', label: 'Doubles 2', type: 'doubles' },
  { code: 'XD', label: 'Mixed doubles', type: 'doubles' },
];

function rosterWarnings(r) {
  const seen = {};
  const warns = [];
  for (const slot of r.slots) {
    const ids = slot.playerIds.filter(Boolean);
    if (slot.type === 'doubles' && ids.length === 2 && ids[0] === ids[1]) {
      warns.push(`${slot.label}: same player twice.`);
    }
    for (const id of ids) {
      const p = getPlayer(id);
      if (p && !isAvailable(p)) warns.push(`${p.name} is marked ${AVAILABILITY[playerAvailability(p)].label.toLowerCase()} but is in ${slot.label}.`);
    }
    ids.forEach(id => { seen[id] = (seen[id] || 0) + 1; });
  }
  for (const [id, n] of Object.entries(seen)) {
    if (n > 2) warns.push(`${playerName(id)} is in ${n} events — most leagues cap at 2.`);
  }
  return [...new Set(warns)];
}

function renderRosters() {
  const rosters = [...state.rosters].sort((a, b) => (a.date < b.date ? 1 : -1));
  VIEW.innerHTML = `
  <div class="page-head"><h1>Rosters</h1><p class="muted">Lineups for upcoming matches</p></div>

  <div class="inline-form no-print">
    <div class="form-grid">
      <label>Name<input type="text" id="nr-name" placeholder="vs Westfield"></label>
      <label>Date<input type="date" id="nr-date" value="${todayISO()}"></label>
    </div>
    <button class="btn btn-primary btn-sm" id="nr-add">New roster</button>
  </div>

  <div id="roster-list">
    ${rosters.length ? rosters.map(r => renderRosterCard(r)).join('')
    : '<div class="empty"><h3>No rosters yet</h3><p>Create one above, then auto-suggest a lineup or pick players yourself.</p></div>'}
  </div>`;

  document.getElementById('nr-add').addEventListener('click', () => {
    const name = document.getElementById('nr-name').value.trim() || 'New lineup';
    state.rosters.push({
      id: uid(), name,
      date: document.getElementById('nr-date').value || todayISO(),
      slots: DEFAULT_SLOTS.map(s => ({ ...s, playerIds: [] })),
    });
    saveState();
    renderRosters();
  });
  document.getElementById('nr-name').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('nr-add').click();
  });

  state.rosters.forEach(r => wireRosterCard(r));
}

function renderRosterCard(r) {
  const opts = selected => `<option value="">—</option>${playerOptions(selected)}`;
  return `
  <div class="card" data-roster="${r.id}">
    <div class="page-head" style="margin-bottom:10px">
      <h3 style="margin:0">${esc(r.name)} <span class="muted small">· ${fmtDate(r.date)}</span></h3>
      <div class="btn-row no-print" style="margin:0">
        <button class="btn btn-sm" data-act="auto">Auto-suggest</button>
        <button class="btn btn-sm" data-act="brief" ${hasApiKey() ? '' : 'disabled title="Add an API key in Settings"'}>AI match brief</button>
        <button class="btn btn-sm" data-act="copy">Copy as text</button>
        <button class="btn btn-sm" data-act="print">Print</button>
        <button class="btn btn-danger btn-sm" data-act="del">Delete</button>
      </div>
    </div>
    <div class="table-wrap"><table><tbody>
      ${r.slots.map((slot, si) => `<tr>
        <td style="width:130px"><b>${esc(slot.label)}</b></td>
        <td>
          <div class="btn-row" style="margin:0">
            <select data-slot="${si}" data-pos="0" style="max-width:220px">${opts(slot.playerIds[0])}</select>
            ${slot.type === 'doubles' ? `<select data-slot="${si}" data-pos="1" style="max-width:220px">${opts(slot.playerIds[1])}</select>` : ''}
            <button class="btn btn-sm no-print" data-remove-slot="${si}" title="Remove this slot">✕</button>
          </div>
        </td>
      </tr>`).join('')}
    </tbody></table></div>
    <div class="btn-row no-print" style="margin-top:4px">
      <button class="btn btn-sm" data-act="add-singles">+ Singles slot</button>
      <button class="btn btn-sm" data-act="add-doubles">+ Doubles slot</button>
    </div>
    <div class="small" style="color:var(--loss)" data-warnings>${rosterWarnings(r).map(esc).join('<br>')}</div>
    <div data-brief></div>
  </div>`;
}

function wireRosterCard(r) {
  const card = document.querySelector(`[data-roster="${r.id}"]`);
  if (!card) return;
  card.querySelectorAll('select[data-slot]').forEach(sel => {
    sel.addEventListener('change', () => {
      const slot = r.slots[Number(sel.dataset.slot)];
      slot.playerIds[Number(sel.dataset.pos)] = sel.value || undefined;
      slot.playerIds = slot.playerIds.filter(Boolean);
      saveState();
      card.querySelector('[data-warnings]').innerHTML = rosterWarnings(r).map(esc).join('<br>');
    });
  });
  const addSlot = type => {
    const prefix = type === 'singles' ? 'S' : 'D';
    let n = r.slots.filter(s => s.type === type).length + 1;
    while (r.slots.some(s => s.code === prefix + n)) n++;
    r.slots.push({ code: prefix + n, label: `${type === 'singles' ? 'Singles' : 'Doubles'} ${n}`, type, playerIds: [] });
    saveState();
    renderRosters();
  };
  card.querySelector('[data-act="add-singles"]').addEventListener('click', () => addSlot('singles'));
  card.querySelector('[data-act="add-doubles"]').addEventListener('click', () => addSlot('doubles'));
  card.querySelectorAll('[data-remove-slot]').forEach(btn => btn.addEventListener('click', () => {
    r.slots.splice(Number(btn.dataset.removeSlot), 1);
    saveState();
    renderRosters();
  }));
  card.querySelector('[data-act="auto"]').addEventListener('click', () => {
    const suggestion = suggestRoster(r.slots);
    // rebuild from scratch — leaving stale picks in unfillable slots is how an
    // injured player ends up still listed in the lineup
    r.slots.forEach(slot => { slot.playerIds = suggestion[slot.code] || []; });
    saveState();
    const unfilled = r.slots.filter(s => !s.playerIds.length).length;
    const sidelined = state.players.filter(p => p.status === 'roster' && !isAvailable(p)).length;
    toast(unfilled
      ? `Filled ${r.slots.length - unfilled} of ${r.slots.length} slots${sidelined ? ` — ${sidelined} player${sidelined === 1 ? '' : 's'} unavailable` : ' — not enough available players'}`
      : 'Lineup set from position fit, form, and pair chemistry');
    renderRosters();
  });
  card.querySelector('[data-act="brief"]').addEventListener('click', async () => {
    const btn = card.querySelector('[data-act="brief"]');
    const box = card.querySelector('[data-brief]');
    const opponent = (r.name.match(/vs\.?\s+(.+)/i)?.[1] || r.name).trim();
    const lineup = r.slots.filter(s => s.playerIds.length).map(s => ({ slot: s.label, players: s.playerIds }));
    if (!lineup.length) { box.innerHTML = '<p class="small muted">Fill in some slots first — the brief is built around who\'s playing.</p>'; return; }
    btn.disabled = true;
    box.innerHTML = '<p class="small muted">Writing the brief…</p>';
    try {
      const brief = await aiMatchBrief(opponent, lineup);
      box.innerHTML = `
        <hr>
        <div class="card-title">Match brief vs ${esc(opponent)}</div>
        <p><b>${esc(brief.headline)}</b></p>
        <ul class="small" style="padding-left:20px">${(brief.keyPoints || []).map(k => `<li>${esc(k)}</li>`).join('')}</ul>
        ${(brief.perSlot || []).length ? `<div class="table-wrap"><table><tbody>${brief.perSlot.map(sl => `<tr><td style="width:130px"><b>${esc(sl.slot)}</b></td><td class="small">${esc(sl.advice)}</td></tr>`).join('')}</tbody></table></div>` : ''}
        ${brief.watchOut ? `<p class="small" style="color:var(--loss)"><b>Watch out:</b> ${esc(brief.watchOut)}</p>` : ''}`;
    } catch (err) {
      box.innerHTML = `<p class="small" style="color:var(--loss)">Brief failed: ${esc(err.message)}</p>`;
    } finally {
      btn.disabled = false;
    }
  });

  card.querySelector('[data-act="copy"]').addEventListener('click', async () => {
    const lines = [`${r.name} — ${fmtDate(r.date)}`, ...r.slots.map(s =>
      `${s.label}: ${s.playerIds.length ? s.playerIds.map(playerName).join(' / ') : '—'}`)];
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      toast('Copied to clipboard');
    } catch {
      prompt('Copy the lineup:', lines.join('\n'));
    }
  });
  card.querySelector('[data-act="print"]').addEventListener('click', () => {
    // print just this lineup, not the whole rosters page
    card.classList.add('print-target');
    document.body.classList.add('print-one');
    const cleanup = () => {
      card.classList.remove('print-target');
      document.body.classList.remove('print-one');
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    window.print();
  });
  card.querySelector('[data-act="del"]').addEventListener('click', () => {
    if (!confirm(`Delete roster "${r.name}"?`)) return;
    state.rosters = state.rosters.filter(x => x.id !== r.id);
    saveState();
    renderRosters();
  });
}

/* ---------- analyze (record / upload → AI feedback) ---------- */

let cameraStream = null;
let mediaRecorder = null;
let recordTimer = null;
let currentBlob = null;     // the clip currently loaded in the player
let currentClipId = null;   // set when the loaded clip is saved in the library
window.lastClipBlob = null; // handoff to the Compare page

function stopCamera() {
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    mediaRecorder.onstop = null; // page is going away — discard the take, don't touch dead DOM
    mediaRecorder.stop();
  }
  if (cameraStream) { cameraStream.getTracks().forEach(t => t.stop()); cameraStream = null; }
  if (recordTimer) { clearInterval(recordTimer); recordTimer = null; }
  mediaRecorder = null;
}

function renderAnalyze(_, params) {
  const coach = isCoach();
  const me = currentStudent();
  const preselect = params?.get('player') || (me ? me.id : null);
  const loadClipId = params?.get('clip') || null;
  currentBlob = null;
  currentClipId = null;
  const fromTryout = coach && preselect && getPlayer(preselect)?.status === 'tryout';

  VIEW.innerHTML = `
  ${fromTryout ? '<p class="small no-print"><a href="#/tryouts">← Back to tryouts</a></p>' : ''}
  <div class="page-head"><h1>Analyze</h1><p class="muted">One minute of play → scored, timestamped coaching</p></div>
  ${hasApiKey() ? '' : `<div class="notice">No API key set${coach ? ' — add one in <a href="#/settings">Settings</a>' : ' — ask your coach to add one in Settings'}. You can still record and save clips, and preview a sample analysis.</div>`}

  <div class="grid2">
    <div class="card">
      <div class="card-title">Record (auto-stops at 1:00)</div>
      <video id="cam-live" autoplay muted playsinline style="display:none; margin-bottom:10px"></video>
      <div class="btn-row" style="margin:0">
        <button class="btn" id="cam-start">Start camera</button>
        <button class="btn btn-primary" id="rec-start" style="display:none">● Record</button>
        <button class="btn" id="rec-stop" style="display:none">■ Stop</button>
        <span id="rec-timer" class="rec-timer" style="display:none"><span class="rec-dot"></span>1:00</span>
      </div>
      <p class="small muted" style="margin-top:8px" id="cam-hint">Prop the phone/laptop at the back corner of the court so the whole half-court is visible.</p>
    </div>
    <div class="card">
      <div class="card-title">Or upload a clip</div>
      <input type="file" id="an-file" accept="video/*">
      <p class="muted small" style="margin-top:8px">Short clips work best — about a minute of rally play.</p>
      <div id="an-library"></div>
    </div>
  </div>

  <video id="an-video" controls style="display:none; margin-bottom:12px"></video>

  <div id="an-controls" class="card" style="display:none">
    <div class="form-grid">
      ${coach
        ? `<label>Player<select id="an-player"><option value="">—</option>${playerOptions(preselect, { statuses: ['roster', 'tryout'] })}</select></label>`
        : `<input type="hidden" id="an-player" value="${esc(me ? me.id : '')}">`}
      <label>Focus<select id="an-focus">
        <option value="all">Everything</option><option value="footwork">Footwork</option>
        <option value="smash">Smash</option><option value="serve">Serve</option>
        <option value="net">Net play</option><option value="defense">Defense</option>
      </select></label>
      <label>Label<input type="text" id="an-label" placeholder="e.g. Practice ${fmtDate(new Date().toISOString())}"></label>
    </div>
    <div class="btn-row">
      ${hasApiKey()
        ? `<button class="btn btn-primary" id="an-go">Analyze with AI</button>`
        : `<button class="btn" id="an-demo">Preview a sample analysis</button>`}
      ${coach || me ? '<button class="btn" id="an-save-clip">Save clip to library</button>' : ''}
    </div>
    <div id="an-progress" class="ai-progress" hidden>
      <div class="ai-bar"><span id="an-bar"></span></div>
      <div class="ai-progress-row">
        <span class="small muted" id="an-status"></span>
        <span class="small muted" id="an-pct"></span>
      </div>
    </div>
  </div>

  <div id="an-results"></div>`;

  const liveEl = document.getElementById('cam-live');
  const videoEl = document.getElementById('an-video');
  const timerEl = document.getElementById('rec-timer');
  const startCamBtn = document.getElementById('cam-start');
  const recBtn = document.getElementById('rec-start');
  const stopBtn = document.getElementById('rec-stop');
  const statusEl = document.getElementById('an-status');

  function loadClipBlob(blob, { clipId = null } = {}) {
    currentBlob = blob;
    currentClipId = clipId;
    window.lastClipBlob = blob;
    videoEl.src = trackUrl(URL.createObjectURL(blob));
    videoEl.style.display = '';
    document.getElementById('an-controls').style.display = '';
    ensureDuration(videoEl); // resolve webm Infinity-duration early so the scrubber works
    videoEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  startCamBtn.addEventListener('click', async () => {
    try {
      cameraStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 } }, audio: false,
      });
      liveEl.srcObject = cameraStream;
      liveEl.style.display = '';
      startCamBtn.style.display = 'none';
      recBtn.style.display = '';
    } catch (err) {
      document.getElementById('cam-hint').textContent = 'Camera unavailable: ' + err.message + ' — you can still upload a clip.';
    }
  });

  recBtn.addEventListener('click', () => {
    if (!cameraStream) return;
    const chunks = [];
    const mime = ['video/webm;codecs=vp9', 'video/webm'].find(t => window.MediaRecorder && MediaRecorder.isTypeSupported(t)) || '';
    mediaRecorder = new MediaRecorder(cameraStream, mime ? { mimeType: mime } : undefined);
    mediaRecorder.ondataavailable = e => chunks.push(e.data);
    mediaRecorder.onstop = () => {
      loadClipBlob(new Blob(chunks, { type: mediaRecorder?.mimeType || 'video/webm' }));
      stopCamera();
      liveEl.style.display = 'none';
      timerEl.style.display = 'none';
      recBtn.style.display = 'none';
      stopBtn.style.display = 'none';
      startCamBtn.style.display = '';
    };
    mediaRecorder.start();
    recBtn.style.display = 'none';
    stopBtn.style.display = '';
    timerEl.style.display = '';
    let remaining = 60;
    timerEl.innerHTML = '<span class="rec-dot"></span>1:00';
    recordTimer = setInterval(() => {
      remaining--;
      timerEl.innerHTML = `<span class="rec-dot"></span>0:${String(Math.max(remaining, 0)).padStart(2, '0')}`;
      if (remaining <= 0) stopBtn.click();
    }, 1000);
  });

  stopBtn.addEventListener('click', () => {
    if (recordTimer) { clearInterval(recordTimer); recordTimer = null; }
    if (mediaRecorder && mediaRecorder.state === 'recording') mediaRecorder.stop();
  });

  document.getElementById('an-file').addEventListener('change', e => {
    const f = e.target.files?.[0];
    if (f) loadClipBlob(f);
  });

  document.getElementById('an-save-clip')?.addEventListener('click', async () => {
    if (!currentBlob) return;
    if (currentClipId) { toast('Already in the library'); return; }
    const id = uid();
    try {
      const dur = await ensureDuration(videoEl);
      await saveClip({
        id,
        playerId: document.getElementById('an-player').value || null,
        label: document.getElementById('an-label').value.trim() || `Clip ${fmtDate(new Date().toISOString())}`,
        date: new Date().toISOString(),
        duration: isFinite(dur) && dur > 0 ? dur : null,
        blob: currentBlob,
      });
      currentClipId = id;
      toast('Clip saved to library');
      renderClipLibrary();
    } catch (err) {
      toast('Could not save clip: ' + err.message);
    }
  });

  const progressBox = document.getElementById('an-progress');
  const barEl = document.getElementById('an-bar');
  const pctEl = document.getElementById('an-pct');

  function setProgress(msg, pct) {
    progressBox.hidden = false;
    statusEl.textContent = msg || '';
    if (pct == null) {
      // no honest number while the model is thinking — show motion, not a fake %
      barEl.classList.add('indeterminate');
      barEl.style.width = '100%';
      pctEl.textContent = 'working…';
    } else {
      barEl.classList.remove('indeterminate');
      barEl.style.width = Math.max(0, Math.min(100, pct)) + '%';
      pctEl.textContent = Math.round(pct) + '%';
    }
  }

  function hideProgress() {
    progressBox.hidden = true;
    barEl.classList.remove('indeterminate');
    barEl.style.width = '0%';
    pctEl.textContent = '';
  }

  async function runAnalysis(demo) {
    const goBtn = document.getElementById(demo ? 'an-demo' : 'an-go');
    const results = document.getElementById('an-results');
    goBtn.disabled = true;
    results.innerHTML = '';
    try {
      let parsed;
      if (demo) {
        setProgress('Building a sample analysis…', 60);
        parsed = demoAnalysis(document.getElementById('an-focus').value);
      } else {
        parsed = await runGameplayAnalysis({
          videoEl,
          blob: currentBlob,
          focus: document.getElementById('an-focus').value,
          onStatus: (msg, pct) => setProgress(msg, pct),
        });
        const playerId = document.getElementById('an-player').value || null;
        state.sessions.push({
          id: uid(), playerId, date: new Date().toISOString(),
          label: document.getElementById('an-label').value.trim() || `Session ${state.sessions.length + 1}`,
          focus: document.getElementById('an-focus').value,
          scores: parsed.scores, feedback: parsed.feedback, clipId: currentClipId,
          method: parsed.method, confidence: parsed.confidence,
        });
        saveState();
      }
      hideProgress();
      results.innerHTML = renderAnalysisResults(parsed);
      results.querySelectorAll('[data-seek]').forEach(el => el.addEventListener('click', () => {
        const [m, sec] = el.dataset.seek.split(':').map(Number);
        if (!isNaN(m)) videoEl.currentTime = m * 60 + sec;
        // open this point's detail, close the others - keeps the list short
        const detail = el.nextElementSibling;
        if (detail && detail.classList.contains('fb-detail')) {
          const open = detail.hidden;
          results.querySelectorAll('.fb-detail').forEach(d => { d.hidden = true; });
          results.querySelectorAll('.fb-row').forEach(r => r.setAttribute('aria-expanded', 'false'));
          detail.hidden = !open;
          el.setAttribute('aria-expanded', String(open));
        }
        videoEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }));
    } catch (err) {
      hideProgress();
      progressBox.hidden = false;
      statusEl.textContent = 'Analysis failed: ' + err.message;
    } finally {
      goBtn.disabled = false;
    }
  }

  document.getElementById('an-go')?.addEventListener('click', () => runAnalysis(false));
  document.getElementById('an-demo')?.addEventListener('click', () => runAnalysis(true));

  async function renderClipLibrary() {
    const box = document.getElementById('an-library');
    const clips = await listClips();
    // coach sees all; a linked player sees their own; guests see none
    const visible = coach ? clips : (me ? clips.filter(c => c.playerId === me.id) : []);
    if (!visible.length) { box.innerHTML = ''; return; }
    box.innerHTML = `<hr><div class="card-title">Clip library</div>` + visible.slice(0, 8).map(c => `
      <div class="btn-row" style="margin:5px 0" data-clip="${c.id}">
        <b>${esc(c.label || 'Clip')}</b>
        <span class="muted small">${c.playerId ? esc(playerName(c.playerId)) + ' · ' : ''}${fmtDate(c.date)}</span>
        <button class="btn btn-sm" data-act="load">Load</button>
        ${coach ? '<button class="btn btn-danger btn-sm" data-act="del">✕</button>' : ''}
      </div>`).join('');
    box.querySelectorAll('[data-act="load"]').forEach(btn => btn.addEventListener('click', async () => {
      const clip = await getClip(btn.closest('[data-clip]').dataset.clip);
      if (!clip) { toast('Clip missing'); return; }
      loadClipBlob(clip.blob, { clipId: clip.id });
      const sel = document.getElementById('an-player');
      if (clip.playerId && sel.tagName === 'SELECT') sel.value = clip.playerId;
      if (clip.label) document.getElementById('an-label').value = clip.label;
    }));
    box.querySelectorAll('[data-act="del"]').forEach(btn => btn.addEventListener('click', async () => {
      if (!confirm('Delete this clip?')) return;
      await deleteClip(btn.closest('[data-clip]').dataset.clip);
      renderClipLibrary();
    }));
  }
  renderClipLibrary();

  if (loadClipId) {
    getClip(loadClipId).then(clip => {
      if (!clip) return;
      loadClipBlob(clip.blob, { clipId: clip.id });
      const sel = document.getElementById('an-player');
      if (clip.playerId && sel.tagName === 'SELECT') sel.value = clip.playerId;
      if (clip.label) document.getElementById('an-label').value = clip.label;
    });
  }
}

function renderAnalysisResults(parsed) {
  const ICONS = {
    positive: '<path d="M4 12.5l5 5L20 6.5"/>',
    critical: '<path d="M12 7v6"/><circle cx="12" cy="17" r="1.1" fill="currentColor" stroke="none"/>',
    suggestion: '<path d="M5 12h13M13 6l6 6-6 6"/>',
  };
  const icon = t => `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">${ICONS[t] || ICONS.suggestion}</svg>`;

  const scores = parsed.scores || {};
  const vals = SKILLS.map(k => scores[k]).filter(v => v != null);
  const overall = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0;

  const counts = { critical: 0, suggestion: 0, positive: 0 };
  for (const f of parsed.feedback) if (counts[f.type] != null) counts[f.type]++;

  // scores as graded tiles, same language as the player's skill grades
  const tiles = SKILLS.map(k => {
    const v = scores[k];
    const tier = skillTier(v);
    return `
    <div class="tier-card ${tier.cls}">
      <div class="tier-head">${esc(SKILL_LABELS[k])}</div>
      <div class="tier-val">${v ?? '—'}</div>
      <div class="tier-meter"><span style="width:${v ?? 0}%"></span></div>
      <div class="tier-foot">${esc(tier.name)}</div>
    </div>`;
  }).join('');

  const chips = [];
  if (!parsed.demo) {
    chips.push(parsed.method === 'video'
      ? '<span class="chip chip-w">Full video read</span>'
      : '<span class="chip chip-neutral">8 key moments</span>');
    if (parsed.confidence) {
      const cls = parsed.confidence === 'high' ? 'chip-w' : parsed.confidence === 'low' ? 'chip-l' : 'chip-neutral';
      chips.push(`<span class="chip ${cls}">${esc(parsed.confidence)} confidence</span>`);
    }
  }
  const notSeen = Array.isArray(parsed.notSeen) && parsed.notSeen.length
    ? `<p class="small muted" style="margin-top:10px">Not visible in this clip: ${parsed.notSeen.map(esc).join(', ')}. Film those to get graded on them.</p>`
    : '';

  return `
  <div class="card">
    ${parsed.demo ? '<div class="notice">This is a <b>sample</b> so you can see the layout. It is not from your video and is not saved. Add an API key in Settings for the real thing.</div>' : ''}

    <div class="score-hero">
      ${ringSVG(overall, { size: 118, stroke: 12, sub: 'OVERALL' })}
      <div class="score-hero-meta">
        <div class="hero-tier ${skillTier(overall).cls}">${esc(skillTier(overall).name)}</div>
        <div class="chip-row">${chips.join('')}</div>
        <div class="fb-counts">
          <span class="fb-count fb-critical">${icon('critical')} ${counts.critical} to fix</span>
          <span class="fb-count fb-suggestion">${icon('suggestion')} ${counts.suggestion} to try</span>
          <span class="fb-count fb-positive">${icon('positive')} ${counts.positive} good</span>
        </div>
      </div>
    </div>

    <div class="card-title" style="margin-top:18px">Skill grades</div>
    <div class="tier-grid">${tiles}</div>

    <div class="card-title" style="margin-top:18px">Coaching points <span class="muted" style="text-transform:none;letter-spacing:0">— tap one to watch that moment</span></div>
    <div class="fb-list">
      ${parsed.feedback.map((f, i) => `
        <div class="fb-item fb-${esc(f.type)}">
          <button type="button" class="fb-row" data-seek="${esc(f.timestamp)}" data-fb="${i}" aria-expanded="false">
            <span class="fb-dot">${icon(f.type)}</span>
            <span class="fb-time">${esc(f.timestamp)}</span>
            <span class="fb-title">${esc(f.title)}</span>
            <span class="fb-chev" aria-hidden="true">▾</span>
          </button>
          <div class="fb-detail" id="fb-d-${i}" hidden>
            <p>${esc(f.body)}</p>
            ${f.tip ? `<p class="fb-tip"><b>Try this:</b> ${esc(f.tip)}</p>` : ''}
          </div>
        </div>`).join('')}
    </div>
    ${notSeen}
  </div>`;
}

/* ---------- compare with a pro ---------- */

function renderCompare() {
  const pros = window.SIQ_PROS || [];
  const byDisc = {};
  pros.forEach(pro => { (byDisc[pro.discipline] = byDisc[pro.discipline] || []).push(pro); });
  const discLabels = { MS: "Men's singles", WS: "Women's singles", MD: "Men's doubles", WD: "Women's doubles", XD: 'Mixed doubles' };

  VIEW.innerHTML = `
  <div class="page-head"><h1>Compare with a pro</h1><p class="muted">Watch side by side, then let the AI spell out the gaps</p></div>
  ${hasApiKey() ? '' : '<div class="notice">Side-by-side playback works without a key. AI comparison needs one (Settings).</div>'}

  ${pros.length ? `
  <div class="card pro-card">
    <div class="card-title">Pick a pro to study</div>
    <div class="form-grid">
      <label>Player<select id="pro-pick"><option value="">—</option>
        ${Object.entries(byDisc).map(([d, list]) =>
          `<optgroup label="${discLabels[d] || d}">${list.map(pro => `<option value="${pro.id}">${esc(pro.name)} (${esc(pro.country)})</option>`).join('')}</optgroup>`).join('')}
      </select></label>
    </div>
    <div id="pro-info"></div>
  </div>` : ''}

  <div class="grid2 compare-grid">
    <div class="card">
      <div class="card-title">You</div>
      <input type="file" id="cmp-you" accept="video/*">
      <div class="btn-row" id="cmp-you-extra"></div>
      <video id="cmp-you-video" controls muted style="display:none; margin-top:10px"></video>
    </div>
    <div class="card">
      <div class="card-title">Pro</div>
      <input type="file" id="cmp-pro" accept="video/*">
      <div class="btn-row" style="margin:8px 0 0">
        <input type="url" id="cmp-yt" placeholder="…or paste a YouTube link" style="max-width:260px">
        <button class="btn btn-sm" id="cmp-yt-go">Embed</button>
      </div>
      <p class="muted small" style="margin:8px 0 0">A local clip file gets synced playback and AI comparison; a YouTube embed is watch-only.</p>
      <div id="cmp-pro-embed" style="margin-top:10px"></div>
      <video id="cmp-pro-video" controls muted style="display:none; margin-top:10px"></video>
    </div>
  </div>

  <div class="btn-row">
    <button class="btn" id="cmp-sync">▶ Play both</button>
    <button class="btn" id="cmp-pause">❚❚ Pause both</button>
    <button class="btn" id="cmp-speed" data-speed="1">Speed: 1×</button>
    <button class="btn" id="cmp-back">−1 frame</button>
    <button class="btn" id="cmp-step">+1 frame</button>
    <button class="btn btn-primary" id="cmp-ai" ${hasApiKey() ? '' : 'disabled'}>AI comparison</button>
    <span class="muted small" id="cmp-status"></span>
  </div>
  <div id="cmp-results"></div>`;

  const youV = document.getElementById('cmp-you-video');
  const proV = document.getElementById('cmp-pro-video');
  let youBlob = null, proBlob = null, pickedPro = null;

  const loadSide = (videoEl, blob) => {
    videoEl.src = trackUrl(URL.createObjectURL(blob));
    videoEl.style.display = '';
    videoEl.playbackRate = Number(document.getElementById('cmp-speed').dataset.speed);
    ensureDuration(videoEl);
  };

  document.getElementById('cmp-you').addEventListener('change', e => {
    const f = e.target.files?.[0];
    if (f) { youBlob = f; loadSide(youV, f); }
  });
  document.getElementById('cmp-pro').addEventListener('change', e => {
    const f = e.target.files?.[0];
    if (f) { proBlob = f; document.getElementById('cmp-pro-embed').innerHTML = ''; loadSide(proV, f); }
  });

  document.getElementById('cmp-yt-go').addEventListener('click', () => {
    const m = /(?:youtube\.com\/(?:watch\?[^#]*v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{11})/.exec(document.getElementById('cmp-yt').value);
    if (!m) { toast('Could not read that YouTube link'); return; }
    proBlob = null;
    proV.pause();
    proV.style.display = 'none';
    document.getElementById('cmp-pro-embed').innerHTML =
      `<iframe width="100%" height="280" src="https://www.youtube-nocookie.com/embed/${m[1]}" title="Pro video" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen style="border:0;border-radius:8px"></iframe>`;
  });

  // quick sources for "you": last analyzed clip + saved library clips
  const extra = document.getElementById('cmp-you-extra');
  if (window.lastClipBlob) {
    const b = document.createElement('button');
    b.className = 'btn btn-sm';
    b.textContent = 'Use clip from Analyze';
    b.addEventListener('click', () => { youBlob = window.lastClipBlob; loadSide(youV, youBlob); });
    extra.appendChild(b);
  }
  listClips().then(clips => {
    const me = currentStudent();
    const visible = isCoach() ? clips : (me ? clips.filter(c => c.playerId === me.id) : []);
    if (!visible.length) return;
    const sel = document.createElement('select');
    sel.style.maxWidth = '240px';
    sel.innerHTML = `<option value="">Load from library…</option>` +
      visible.map(c => `<option value="${c.id}">${esc(c.label || 'Clip')}${c.playerId ? ' — ' + esc(playerName(c.playerId)) : ''}</option>`).join('');
    sel.addEventListener('change', async () => {
      if (!sel.value) return;
      const clip = await getClip(sel.value);
      if (clip) { youBlob = clip.blob; loadSide(youV, clip.blob); }
    });
    extra.appendChild(sel);
  });

  // pro picker info card
  document.getElementById('pro-pick')?.addEventListener('change', e => {
    pickedPro = pros.find(pro => pro.id === e.target.value) || null;
    const box = document.getElementById('pro-info');
    if (!pickedPro) { box.innerHTML = ''; return; }
    box.innerHTML = `
      <p style="margin:8px 0 4px"><b>${esc(pickedPro.name)}</b> — ${esc(pickedPro.style)} <span class="tag">${esc(pickedPro.era)}</span></p>
      <p class="small muted" style="margin:0 0 4px">Watch for:</p>
      <ul class="watchfor">${pickedPro.watchFor.map(w => `<li>${esc(w)}</li>`).join('')}</ul>
      <a class="btn btn-sm" target="_blank" rel="noopener" href="https://www.youtube.com/results?search_query=${encodeURIComponent(pickedPro.youtubeQuery)}">Find clips on YouTube ↗</a>`;
  });

  // playback controls
  const local = () => [youV, proV].filter(v => v.style.display !== 'none');
  document.getElementById('cmp-sync').addEventListener('click', () => local().forEach(v => v.play()));
  document.getElementById('cmp-pause').addEventListener('click', () => local().forEach(v => v.pause()));
  document.getElementById('cmp-speed').addEventListener('click', e => {
    const next = { '1': '0.5', '0.5': '0.25', '0.25': '1' }[e.target.dataset.speed];
    e.target.dataset.speed = next;
    e.target.textContent = `Speed: ${next}×`;
    local().forEach(v => { v.playbackRate = Number(next); });
  });
  const step = dir => local().forEach(v => { v.pause(); v.currentTime = Math.max(0, v.currentTime + dir / 30); });
  document.getElementById('cmp-step').addEventListener('click', () => step(1));
  document.getElementById('cmp-back').addEventListener('click', () => step(-1));

  // AI comparison
  document.getElementById('cmp-ai').addEventListener('click', async () => {
    const status = document.getElementById('cmp-status');
    const results = document.getElementById('cmp-results');
    const btn = document.getElementById('cmp-ai');
    if (!youBlob || !proBlob) { status.textContent = 'Load both videos first.'; return; }
    btn.disabled = true;
    results.innerHTML = '';
    try {
      status.textContent = 'Extracting frames from both clips…';
      const [yourFrames, proFrames] = [await extractFrames(youV, 6), await extractFrames(proV, 6)];
      status.textContent = 'Asking the AI coach…';
      const proNotes = pickedPro ? `${pickedPro.name} (${pickedPro.style}). Known for: ${pickedPro.watchFor.join('; ')}` : '';
      const parsed = await compareWithPro(yourFrames, proFrames, proNotes);
      status.textContent = '';
      results.innerHTML = `
      <div class="card">
        <div class="card-title">AI comparison</div>
        <p>${esc(parsed.summary)}</p>
        <div class="table-wrap"><table>
          <thead><tr><th>Area</th><th>You</th><th>The pro</th><th>Fix</th></tr></thead>
          <tbody>${parsed.differences.map(d => `<tr>
            <td><b>${esc(d.area)}</b></td>
            <td class="small">${esc(d.student)}</td>
            <td class="small">${esc(d.pro)}</td>
            <td class="small" style="color:var(--accent-dark)">${esc(d.fix)}</td>
          </tr>`).join('')}</tbody>
        </table></div>
      </div>`;
    } catch (err) {
      status.textContent = 'Comparison failed: ' + err.message;
    } finally {
      btn.disabled = false;
    }
  });
}

/* ---------- drill library ---------- */

function renderDrills(_, params) {
  const drills = window.SIQ_DRILLS || Object.entries(DRILLS).map(([skill, description], i) => ({
    id: 'd' + i, skill, name: SKILL_LABELS[skill] + ' drill', level: '', minutes: 10, description, target: '',
  }));
  const activeSkill = params?.get('skill') || 'all';
  const me = currentStudent();
  const weak = me ? improvementAreas(me.id) : [];
  const recommended = weak.length ? drills.filter(d => weak.some(w => w.skill === d.skill)).slice(0, 4) : [];

  const drillCard = d => `
    <div class="card">
      <h3 style="margin-bottom:4px">${esc(d.name)}</h3>
      <p style="margin-bottom:6px">
        <span class="tag tag-accent">${SKILL_LABELS[d.skill] || esc(d.skill)}</span>
        ${d.level ? `<span class="tag">${esc(d.level)}</span>` : ''}
        ${d.minutes ? `<span class="tag">${d.minutes} min</span>` : ''}
      </p>
      <p class="small">${esc(d.description)}</p>
      ${d.target ? `<p class="small" style="color:var(--link)"><b>Target:</b> ${esc(d.target)}</p>` : ''}
      ${d.youtubeQuery ? `<a class="btn btn-sm" target="_blank" rel="noopener"
        href="https://www.youtube.com/results?search_query=${encodeURIComponent(d.youtubeQuery)}">▶ Watch on YouTube</a>` : ''}
    </div>`;

  const filtered = drills.filter(d => activeSkill === 'all' || d.skill === activeSkill);

  VIEW.innerHTML = `
  <div class="page-head"><h1>Drills</h1><p class="muted">Standard drills the team can run at practice</p></div>

  ${recommended.length ? `
    <h2>Recommended for you</h2>
    <p class="muted small">Based on your current focus areas: ${weak.map(w => w.label).join(', ')}</p>
    <div class="grid2">${recommended.map(drillCard).join('')}</div>
    <hr>` : ''}

  <div class="filter-row">
    <button class="filter-chip ${activeSkill === 'all' ? 'active' : ''}" data-skill="all">All</button>
    ${SKILLS.map(s => `<button class="filter-chip ${activeSkill === s ? 'active' : ''}" data-skill="${s}">${SKILL_LABELS[s]}</button>`).join('')}
  </div>
  <div class="grid2">${filtered.map(drillCard).join('') || '<p class="muted">No drills for this filter.</p>'}</div>`;

  VIEW.querySelectorAll('.filter-chip').forEach(b => b.addEventListener('click', () => {
    location.hash = b.dataset.skill === 'all' ? '#/drills' : `#/drills?skill=${b.dataset.skill}`;
  }));
}

/* ---------- live scorer ----------
   Rally scoring: first to 21, win by 2, hard cap at 30. Best of three.
   Kept in sessionStorage so a dropped phone or accidental refresh mid-match
   doesn't lose the score. */

const SCORER_KEY = 'siq_live_match';

function loadScorer() {
  try { return JSON.parse(sessionGet(SCORER_KEY) || 'null'); } catch { return null; }
}

function saveScorer(s) {
  if (s) sessionSet(SCORER_KEY, JSON.stringify(s));
  else sessionRemove(SCORER_KEY);
}

function gameWinner(a, b) {
  if (a >= 30 && a > b) return 'us';
  if (b >= 30 && b > a) return 'them';
  if (a >= 21 && a - b >= 2) return 'us';
  if (b >= 21 && b - a >= 2) return 'them';
  return null;
}

function scorerStanding(s) {
  const usGames = s.games.filter(g => gameWinner(g[0], g[1]) === 'us').length;
  const themGames = s.games.filter(g => gameWinner(g[0], g[1]) === 'them').length;
  return { usGames, themGames, matchOver: usGames === 2 || themGames === 2 };
}

function renderScore(_, params) {
  const live = loadScorer();
  if (live) return renderScorerBoard(live);

  const preselect = params?.get('player') || null;
  VIEW.innerHTML = `
  <div class="page-head"><h1>Live scoring</h1><p class="muted">Tap to score — it saves the match when you're done</p></div>
  <div class="card" style="max-width:560px">
    <div class="form-grid">
      <label>Player<select id="sc-player">${playerOptions(preselect, { statuses: ['roster', 'tryout'] })}</select></label>
      <label>Discipline<select id="sc-disc">${DISCIPLINES.map(d => `<option>${d}</option>`).join('')}</select></label>
      <label id="sc-partner-wrap" style="display:none">Partner<select id="sc-partner"><option value="">—</option>${playerOptions(null, { statuses: ['roster', 'tryout'] })}</select></label>
      <label>Opponent<input type="text" id="sc-opp" placeholder="School or player"></label>
    </div>
    <div class="btn-row"><button class="btn btn-primary btn-lg" id="sc-start">Start match</button></div>
    <p class="small muted">Rally scoring to 21, win by 2, capped at 30. Best of three games.</p>
  </div>`;

  if (!state.players.length) {
    VIEW.innerHTML = '<div class="empty"><h3>Add a player first</h3><p>Live scoring attaches the result to a player on your roster.</p><div class="btn-row center"><a class="btn btn-primary" href="#/players">Add players</a></div></div>';
    return;
  }

  const disc = document.getElementById('sc-disc');
  const wrap = document.getElementById('sc-partner-wrap');
  const sync = () => { wrap.style.display = DOUBLES.has(disc.value) ? '' : 'none'; };
  disc.addEventListener('change', sync); sync();

  document.getElementById('sc-start').addEventListener('click', () => {
    const playerId = document.getElementById('sc-player').value;
    if (!playerId) { toast('Pick a player first'); return; }
    let partnerId = DOUBLES.has(disc.value) ? (document.getElementById('sc-partner').value || null) : null;
    if (partnerId === playerId) partnerId = null;
    saveScorer({
      playerId, partnerId, discipline: disc.value,
      opponent: document.getElementById('sc-opp').value.trim() || 'Opponent',
      games: [], us: 0, them: 0, history: [],
    });
    route();
  });
}

function renderScorerBoard(s) {
  const usName = s.partnerId ? `${playerName(s.playerId).split(' ')[0]} / ${playerName(s.partnerId).split(' ')[0]}` : playerName(s.playerId);
  const { usGames, themGames, matchOver } = scorerStanding(s);
  const winner = gameWinner(s.us, s.them);
  const gameNo = s.games.length + 1;

  VIEW.innerHTML = `
  <div class="scorer">
    <div class="scorer-head">
      <div>
        <div class="small muted">${esc(s.discipline)} · vs ${esc(s.opponent)}</div>
        <div style="font-weight:750">Game ${matchOver ? s.games.length : gameNo} · ${usGames}–${themGames} in games</div>
      </div>
      <button class="btn btn-sm" id="sc-quit">Cancel match</button>
    </div>

    ${s.games.length ? `<p class="small muted">Completed: ${s.games.map(g => `${g[0]}–${g[1]}`).join(', ')}</p>` : ''}

    ${matchOver ? `
      <div class="card center">
        <h2 style="margin-bottom:6px">${usGames > themGames ? 'Win' : 'Loss'} — ${s.games.map(g => `${g[0]}-${g[1]}`).join(', ')}</h2>
        <p class="muted small">Save it to the match log, with optional skill ratings.</p>
        <details style="text-align:left;margin-top:10px"><summary>Rate their play (optional, 1–5)</summary>
          <div id="sc-ratings">${SKILLS.map(k => ratingRow(k, SKILL_LABELS[k])).join('')}</div>
        </details>
        <div class="btn-row center" style="margin-top:12px">
          <button class="btn btn-primary btn-lg" id="sc-save">Save match</button>
          <button class="btn" id="sc-discard">Discard</button>
        </div>
      </div>`
    : `
      <div class="scorer-grid">
        <button class="score-panel score-us" id="sc-us">
          <span class="score-name">${esc(usName)}</span>
          <span class="score-num">${s.us}</span>
          <span class="score-hint">tap to score</span>
        </button>
        <button class="score-panel score-them" id="sc-them">
          <span class="score-name">${esc(s.opponent)}</span>
          <span class="score-num">${s.them}</span>
          <span class="score-hint">tap to score</span>
        </button>
      </div>
      ${winner ? `<p class="center" style="font-weight:700;color:var(--link)">Game ${gameNo} to ${winner === 'us' ? esc(usName) : esc(s.opponent)} — tap "Next game"</p>` : ''}
      <div class="btn-row center">
        <button class="btn" id="sc-undo" ${s.history.length ? '' : 'disabled'}>Undo point</button>
        ${winner ? `<button class="btn btn-primary" id="sc-next">Next game</button>` : ''}
      </div>
      <p class="center small muted">First to 21, win by 2 · capped at 30</p>`}
  </div>`;

  const push = side => {
    s.history.push([s.us, s.them]);
    if (side === 'us') s.us++; else s.them++;
    saveScorer(s);
    renderScorerBoard(s);
  };

  document.getElementById('sc-us')?.addEventListener('click', () => { if (!gameWinner(s.us, s.them)) push('us'); });
  document.getElementById('sc-them')?.addEventListener('click', () => { if (!gameWinner(s.us, s.them)) push('them'); });
  document.getElementById('sc-undo')?.addEventListener('click', () => {
    const prev = s.history.pop();
    if (!prev) return;
    [s.us, s.them] = prev;
    saveScorer(s);
    renderScorerBoard(s);
  });
  document.getElementById('sc-next')?.addEventListener('click', () => {
    s.games.push([s.us, s.them]);
    s.us = 0; s.them = 0; s.history = [];
    saveScorer(s);
    renderScorerBoard(s);
  });
  document.getElementById('sc-quit')?.addEventListener('click', () => {
    if (!confirm('Cancel this match? The score is discarded.')) return;
    saveScorer(null);
    route();
  });
  document.getElementById('sc-discard')?.addEventListener('click', () => {
    if (!confirm('Discard this result without saving?')) return;
    saveScorer(null);
    route();
  });

  const ratingsBox = document.getElementById('sc-ratings');
  if (ratingsBox) wireRatingRows(ratingsBox);

  document.getElementById('sc-save')?.addEventListener('click', () => {
    const player = getPlayer(s.playerId);
    state.matches.push({
      id: uid(), playerId: s.playerId, partnerId: s.partnerId,
      date: todayISO(), opponent: s.opponent, discipline: s.discipline,
      result: usGames > themGames ? 'W' : 'L',
      score: s.games.map(g => `${g[0]}-${g[1]}`).join(', '),
      ratings: ratingsBox ? readRatings(ratingsBox) : {},
      notes: '', context: player && player.status === 'tryout' ? 'tryout' : 'season',
    });
    saveState();
    saveScorer(null);
    toast('Match saved to the log');
    location.hash = '#/matches';
  });
}

/* ---------- challenge ladder ---------- */

function renderLadder() {
  const coach = isCoach();   // players can see the ladder; only the coach moves anyone on it
  const ids = ladderIds();
  const rows = ids.map((id, i) => ({ p: getPlayer(id), rank: i + 1 })).filter(r => r.p);
  const meId = getStudentId();

  VIEW.innerHTML = `
  <div class="page-head">
    <h1>Challenge ladder</h1>
    <p class="muted">${coach ? 'Beat the player above you and you take their spot' : 'Where the team stands — your coach records challenges'}</p>
  </div>

  ${coach && rows.length >= 2 ? `
  <div class="card">
    <div class="card-title">Record a challenge</div>
    <div class="form-grid">
      <label>Challenger (lower rank)<select id="ch-challenger">${rows.map(r => `<option value="${r.p.id}">#${r.rank} ${esc(r.p.name)}</option>`).join('')}</select></label>
      <label>Defender (higher rank)<select id="ch-defender">${rows.map(r => `<option value="${r.p.id}">#${r.rank} ${esc(r.p.name)}</option>`).join('')}</select></label>
      <label>Score (optional)<input type="text" id="ch-score" placeholder="21-18, 21-15"></label>
    </div>
    <div class="btn-row">
      <button class="btn btn-primary" id="ch-challenger-won">Challenger won</button>
      <button class="btn" id="ch-defender-won">Defender held</button>
    </div>
    <p class="small muted">Either way it's logged as a match for both players, so it counts toward their form.</p>
  </div>` : ''}

  ${rows.length ? `<div class="card"><div class="table-wrap"><table>
    <thead><tr><th>#</th><th>Player</th><th>Status</th><th>Record</th><th>Last 8</th><th>Fit</th>${coach ? '<th class="no-print">Move</th>' : ''}</tr></thead>
    <tbody>${rows.map(r => {
      const ms = playerMatches(r.p.id);
      const w = ms.filter(m => m.result === 'W').length;
      const pos = positionScores(r.p.id);
      const av = playerAvailability(r.p);
      return `<tr${r.p.id === meId ? ' style="background:var(--accent-soft)"' : ''}>
        <td><span class="rank-num">${r.rank}</span></td>
        <td>${playerLink(r.p.id)}${r.p.id === meId ? ' <span class="tag tag-accent">you</span>' : ''}</td>
        <td>${av === 'available' ? '<span class="muted small">—</span>' : `<span class="chip ${AVAILABILITY[av].chip}">${AVAILABILITY[av].label}</span>`}</td>
        <td>${ms.length ? `${w}–${ms.length - w}` : '<span class="muted">—</span>'}</td>
        <td>${wlDots(r.p.id)}</td>
        <td class="small">${pos ? POSITIONS[pos.best].label : '<span class="muted">—</span>'}</td>
        ${coach ? `<td class="no-print" style="white-space:nowrap">
          <button class="btn btn-sm" data-move="up" data-id="${r.p.id}" ${r.rank === 1 ? 'disabled' : ''}>↑</button>
          <button class="btn btn-sm" data-move="down" data-id="${r.p.id}" ${r.rank === rows.length ? 'disabled' : ''}>↓</button>
        </td>` : ''}
      </tr>`;
    }).join('')}</tbody>
  </table></div>
  <div class="btn-row no-print"><button class="btn btn-sm" id="ladder-print">Print ladder</button>${coach ? '<button class="btn btn-sm" id="ladder-reset">Reseed from form</button>' : ''}</div>
  </div>`
  : '<div class="empty"><h3>No roster players yet</h3><p>The ladder ranks everyone with roster status. Add players and they\'ll seed automatically by current form.</p><div class="btn-row center"><a class="btn btn-primary" href="#/players">Add players</a></div></div>'}`;

  const logChallenge = challengerWon => {
    if (!isCoach()) return;   // belt and braces: the form isn't rendered for players
    const challengerId = document.getElementById('ch-challenger').value;
    const defenderId = document.getElementById('ch-defender').value;
    if (challengerId === defenderId) { toast('Pick two different players'); return; }
    const score = document.getElementById('ch-score').value.trim();
    const winnerId = challengerWon ? challengerId : defenderId;
    const loserId = challengerWon ? defenderId : challengerId;
    const date = todayISO();
    state.matches.push(
      { id: uid(), playerId: winnerId, partnerId: null, date, opponent: playerName(loserId), discipline: 'MS', result: 'W', score, ratings: {}, notes: 'Ladder challenge', context: 'ladder' },
      { id: uid(), playerId: loserId, partnerId: null, date, opponent: playerName(winnerId), discipline: 'MS', result: 'L', score, ratings: {}, notes: 'Ladder challenge', context: 'ladder' },
    );
    saveState();
    if (challengerWon) {
      const newRank = applyChallengeResult(challengerId, defenderId);
      toast(newRank ? `${playerName(challengerId)} moves to #${newRank}` : 'Result logged — no rank change');
    } else {
      toast('Defender held their spot');
    }
    renderLadder();
  };

  document.getElementById('ch-challenger-won')?.addEventListener('click', () => logChallenge(true));
  document.getElementById('ch-defender-won')?.addEventListener('click', () => logChallenge(false));
  document.getElementById('ladder-print')?.addEventListener('click', () => window.print());
  document.getElementById('ladder-reset')?.addEventListener('click', () => {
    if (!confirm('Reseed the ladder from current win rates? Manual order is lost.')) return;
    state.ladder = [];
    saveState();
    ladderIds();
    toast('Ladder reseeded');
    renderLadder();
  });
  VIEW.querySelectorAll('[data-move]').forEach(b => b.addEventListener('click', () => {
    if (!isCoach()) return;
    if (moveOnLadder(b.dataset.id, b.dataset.move === 'up' ? -1 : 1)) renderLadder();
  }));
}

/* ---------- player vs player ---------- */

function renderVersus(_, params) {
  const roster = state.players.filter(p => p.status !== 'cut').sort((a, b) => a.name.localeCompare(b.name));
  const aId = params?.get('a') || roster[0]?.id || '';
  const bId = params?.get('b') || roster[1]?.id || '';
  const a = getPlayer(aId), b = getPlayer(bId);

  const pick = (id, which) => `<select data-vs="${which}">${roster.map(p => `<option value="${p.id}" ${p.id === id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select>`;

  if (!a || !b) {
    VIEW.innerHTML = '<div class="empty"><h3>Need two players</h3><p>Add at least two players to compare them side by side.</p><div class="btn-row center"><a class="btn btn-primary" href="#/players">Add players</a></div></div>';
    return;
  }

  const stat = (label, av, bv) => {
    const num = v => (typeof v === 'number' ? v : null);
    const an = num(av), bn = num(bv);
    const lead = an != null && bn != null && an !== bn ? (an > bn ? 'a' : 'b') : null;
    return `<tr>
      <td style="text-align:right;${lead === 'a' ? 'font-weight:750;color:var(--link)' : ''}">${av ?? '—'}</td>
      <td class="small muted" style="text-align:center;white-space:nowrap">${label}</td>
      <td style="${lead === 'b' ? 'font-weight:750;color:var(--link)' : ''}">${bv ?? '—'}</td>
    </tr>`;
  };

  const profA = skillProfile(aId), profB = skillProfile(bId);
  const formA = recentForm(aId), formB = recentForm(bId);
  const posA = positionScores(aId), posB = positionScores(bId);
  const msA = playerMatches(aId), msB = playerMatches(bId);
  const rec = teammateRecord(aId, bId);
  const pct = v => (v == null ? null : Math.round(v * 100) + '%');

  VIEW.innerHTML = `
  <div class="page-head"><h1>Head to head</h1><p class="muted">Compare two players before you set the lineup</p></div>

  <div class="card">
    <div class="grid2" style="align-items:center">
      <div>${pick(aId, 'a')}</div>
      <div>${pick(bId, 'b')}</div>
    </div>
    ${rec.total ? `<p class="center" style="margin-top:14px;font-weight:700">${esc(a.name)} leads ${rec.aWins}–${rec.bWins}${rec.aWins === rec.bWins ? ' (level)' : ''} in ${rec.total} meeting${rec.total === 1 ? '' : 's'}</p>`
      : '<p class="center small muted" style="margin-top:14px">They haven\'t played each other yet — log a ladder challenge to settle it.</p>'}
  </div>

  <div class="grid2">
    <div class="card">
      <div class="card-title">Skills</div>
      ${profA || profB ? radarCompareSVG(profA || {}, profB || {}) : '<p class="muted">No skill data for either player yet.</p>'}
      <p class="small" style="margin-top:8px">
        <span style="color:var(--link);font-weight:700">──</span> ${esc(a.name)} &nbsp;
        <span style="color:var(--muted);font-weight:700">╌╌</span> ${esc(b.name)}
      </p>
    </div>
    <div class="card">
      <div class="card-title">By the numbers</div>
      <table><tbody>
        ${stat('Matches', msA.length, msB.length)}
        ${stat('Win rate', pct(winRate(aId)), pct(winRate(bId)))}
        ${stat('Last 5', formA ? `${formA.recentWins}/${formA.recentTotal}` : null, formB ? `${formB.recentWins}/${formB.recentTotal}` : null)}
        ${stat('Singles fit', posA?.singles, posB?.singles)}
        ${stat('Doubles front', posA?.front, posB?.front)}
        ${stat('Doubles back', posA?.back, posB?.back)}
        ${stat('Ladder rank', ladderRank(aId) ? '#' + ladderRank(aId) : null, ladderRank(bId) ? '#' + ladderRank(bId) : null)}
      </tbody></table>
    </div>
  </div>`;

  VIEW.querySelectorAll('[data-vs]').forEach(sel => sel.addEventListener('change', () => {
    const nextA = VIEW.querySelector('[data-vs="a"]').value;
    const nextB = VIEW.querySelector('[data-vs="b"]').value;
    location.hash = `#/vs?a=${nextA}&b=${nextB}`;
  }));
}

/* ---------- guide (public) ---------- */

function renderGuide() {
  const coach = isCoach();
  const step = (n, title, body) => `
    <div style="display:flex;gap:14px;margin-bottom:16px">
      <div style="flex-shrink:0;width:28px;height:28px;border-radius:50%;background:var(--accent);color:var(--on-accent);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:14px">${n}</div>
      <div style="min-width:0"><h3 style="margin:2px 0 4px">${title}</h3><p class="small muted" style="margin:0">${body}</p></div>
    </div>`;

  VIEW.innerHTML = `
  <div class="page-head"><h1>How to use ShuttleIQ</h1><p class="muted">Everything stays on your device — no accounts, no server</p></div>

  <div class="card" style="display:flex;gap:14px;align-items:center;flex-wrap:wrap">
    <span style="flex:1;min-width:240px"><b>Prefer to be shown?</b> The guided tour loads a sample team, walks you through every screen, and clears it when you're done.</span>
    <button class="btn btn-primary btn-sm" data-tour="${coach ? 'coach' : 'student'}">Take the ${coach ? 'coach' : 'player'} tour</button>
  </div>

  <div class="grid2">
    <div class="card">
      <div class="card-title">For coaches — first 10 minutes</div>
      ${step(1, 'Add your roster', 'Players → type names (you can paste several at once: "Alex, Ben, Chris") → Add.')}
      ${step(2, 'Score matches live', 'Score → pick the player and opponent → tap the big numbers as points happen. Rally scoring, deuce and the 30-point cap are handled for you, and the finished match saves straight to the log.')}
      ${step(3, 'Or log a finished match', 'Matches → player, opponent, who won. The 1–5 skill ratings are optional but they power the radar, position fit, and depth chart.')}
      ${step(4, 'Run tryouts', 'Tryouts → add prospects → tap 1–5 on each drill while they play. The board re-ranks itself. Promote or cut when you decide.')}
      ${step(5, 'Settle the pecking order', 'Ladder → record challenges. Win and you take that player\'s spot; it logs the match for both players automatically.')}
      ${step(6, 'Build a lineup', 'Rosters → New roster → Auto-suggest. It uses position fit, win rate and pair chemistry, and it never picks anyone marked injured or away.')}
      ${step(7, 'Back it up', 'Settings → Export backup. Browsers can clear local data, so keep a file at the end of each week.')}
    </div>
    <div class="card">
      <div class="card-title">For players</div>
      ${step(1, 'Sign in as yourself', 'Enter as player → pick your name so your stats and clips are yours.')}
      ${step(2, 'Film one minute', 'Analyze → Start camera → Record. Prop the phone at the back corner so your whole half-court is in frame. It stops at 60 seconds.')}
      ${step(3, 'Read the feedback', 'You get 0–100 skill scores plus coaching cards. Tap any card to jump to that exact moment in your clip.')}
      ${step(4, 'Compare with a pro', 'Compare → pick a pro → paste a YouTube link, or load a downloaded clip for synced slow-motion and an AI breakdown.')}
      ${step(5, 'Work your weak spots', 'Drills shows the drills matched to your two lowest skills, with a target for each.')}
    </div>
  </div>

  <div class="card">
    <div class="card-title">Good filming = good feedback</div>
    <div class="grid3">
      <div><h3>Camera position</h3><p class="small muted">Back corner of the court, waist height or above, phone landscape. The AI needs to see your feet and the shuttle.</p></div>
      <div><h3>What to film</h3><p class="small muted">Real rallies, not warm-ups. A minute of actual play beats five minutes of standing around.</p></div>
      <div><h3>Use Focus</h3><p class="small muted">Set Focus to one skill (footwork, smash, net…) and the feedback goes deeper on it instead of covering everything.</p></div>
    </div>
  </div>

  <div class="grid2">
    <div class="card">
      <div class="card-title">Setting up the AI (free)</div>
      <p class="small">The whole app works without AI. To turn on video analysis, pro comparison, and AI coach notes:</p>
      <p class="small muted" style="margin-bottom:6px">Settings → AI coach → tap <b>Google Gemini</b> → paste a free key from <b>aistudio.google.com</b> → Test key. OpenRouter and Groq also have free tiers and one-tap presets.</p>
      <p class="small muted">The key lives only in this browser and is stripped out of backup files. On a shared device, clear it when you're done.</p>
      ${coach ? '<div class="btn-row"><a class="btn btn-sm" href="#/settings">Open Settings</a></div>' : ''}
    </div>
    <div class="card">
      <div class="card-title">Picking lineups with evidence</div>
      <p class="small muted"><b>Availability</b> — set injured/away on the Players page and auto-suggest skips them; if you place them anyway, the roster warns you.</p>
      <p class="small muted"><b>Head to head</b> — compare any two players side by side: overlaid skill radars, form, position fit, ladder rank, and their record against each other.</p>
      <p class="small muted"><b>Insights</b> — depth chart, the team's weakest skills with drills, per-opponent records, and which doubles pairs actually win together.</p>
      <p class="small muted"><b>AI match brief</b> — on a roster, generates a tactical brief from your real history against that opponent (needs an API key).</p>
    </div>
    <div class="card">
      <div class="card-title">Good to know</div>
      <p class="small muted"><b>Install it.</b> On a phone, use your browser's "Add to Home Screen" — it opens like an app and works without signal in the gym.</p>
      <p class="small muted"><b>Your data is local.</b> Each device keeps its own copy. To move a team to another device, export a backup and import it there.</p>
      <p class="small muted"><b>Videos never leave the device.</b> Saved clips stay in this browser; only a handful of still frames go to the AI provider during analysis.</p>
      <p class="small muted"><b>The coach passcode is a soft gate</b> — it keeps players out of coach tools on a shared tablet, not a determined person with developer tools.</p>
    </div>
  </div>`;

  VIEW.querySelectorAll('[data-tour]').forEach(b => b.addEventListener('click', () => {
    if (demoActive()) { toast('Already in demo mode'); return; }
    beginTour(b.dataset.tour);
  }));
}

/* ---------- settings (coach) ---------- */

function renderSettings() {
  const s = state.settings;
  const provider = AI_PROVIDERS[s.provider] ? s.provider : 'anthropic';
  const def = AI_PROVIDERS[provider];

  VIEW.innerHTML = `
  <div class="page-head"><h1>Settings</h1></div>

  <div class="card">
    <div class="card-title">Team</div>
    <label style="max-width:300px">Team name<input type="text" id="set-team" value="${esc(s.teamName)}"></label>
    <div class="btn-row"><button class="btn btn-sm" id="set-team-save">Save</button></div>
  </div>

  <div class="card">
    <div class="card-title">Guided tour</div>
    <p class="small muted">Walks through every screen using a sample team, then clears it. Your own data is set aside while the demo runs and restored when you exit.</p>
    <div class="btn-row">
      <button class="btn btn-sm" data-tour="coach">Coach tour</button>
      <button class="btn btn-sm" data-tour="student">Player tour</button>
      <a class="btn btn-sm" href="#/guide">Written guide</a>
    </div>
  </div>

  <div class="card">
    <div class="card-title">Appearance</div>
    <div class="theme-row">
      ${Object.entries(THEME_LABELS).map(([k, label]) => `
        <button class="theme-opt ${state.settings.theme === k ? 'active' : ''}" data-set-theme="${k}">
          <span class="theme-dot" style="background:${{ midnight: '#c6ef55', court: '#0d3b26', clean: '#10714a' }[k]}"></span>${label}
        </button>`).join('')}
    </div>
  </div>

  <div class="card">
    <div class="card-title">AI coach</div>
    <p class="small muted">Powers video analysis, pro comparison, and AI coach notes. Everything else works without it.</p>
    <div class="btn-row" style="margin-top:4px">
      <span class="small muted">Free setups:</span>
      <button class="btn btn-sm" data-ai-preset="gemini">Google Gemini</button>
      <button class="btn btn-sm" data-ai-preset="openrouter">OpenRouter</button>
      <button class="btn btn-sm" data-ai-preset="groq">Groq</button>
    </div>
    <p class="small" style="color:var(--link)"><b>Gemini is the one to pick.</b> It's the only free option that reads your actual video — it sees footwork and timing, not just frozen poses. The others analyse still frames, which is useful but blind to movement.</p>
    <p class="small muted"><b>Free-tier limit:</b> Gemini allows roughly <b>20 AI requests per day per model</b>. Every analysis, comparison, coach note and match brief counts as one. If you run out, switch to another model in the box above — each has its own daily allowance.${aiCallsToday() ? ` You've used <b>${aiCallsToday()}</b> today on this device.` : ''}</p>
    <div class="form-grid">
      <label>Provider<select id="ai-provider">
        ${Object.entries(AI_PROVIDERS).map(([k, v]) => `<option value="${k}" ${k === provider ? 'selected' : ''}>${v.label}</option>`).join('')}
      </select></label>
      <label>Model<input type="text" id="ai-model" list="ai-models" value="${esc(s.model)}" placeholder="${esc(def.defaultModel)}">
        <datalist id="ai-models">${def.models.map(m => `<option value="${m}">`).join('')}</datalist></label>
      ${def.needsBaseUrl ? `<label>Base URL<input type="url" id="ai-baseurl" value="${esc(s.baseUrl)}" placeholder="${esc(def.defaultBaseUrl)}"></label>` : ''}
    </div>
    <label>API key<input type="password" id="ai-key" value="${esc(s.apiKey)}" placeholder="Paste your key" autocomplete="off"></label>
    <label class="small" style="display:flex;gap:6px;align-items:center;margin-top:6px;cursor:pointer"><input type="checkbox" id="ai-key-show" style="width:auto;margin:0"> Show key</label>
    <p class="small muted" style="margin-top:6px">${esc(def.help)}</p>
    <div class="btn-row">
      <button class="btn btn-primary btn-sm" id="ai-save">Save</button>
      <button class="btn btn-sm" id="ai-test">Test key</button>
      <span class="small muted" id="ai-status"></span>
    </div>
    <p class="small muted">The key is stored only in this browser and sent only to the provider above. It is stripped from exported backups. On a shared device, clear it when you're done.</p>
  </div>

  <div class="card">
    <div class="card-title">Data</div>
    <p class="small muted">Everything lives in this browser. Export a backup to move or share the team data (video clips aren't included — they stay on this device).</p>
    <div class="btn-row">
      <button class="btn btn-sm" id="data-export">Export backup</button>
      <button class="btn btn-sm" id="data-csv">Export matches (CSV)</button>
      <button class="btn btn-sm" id="data-import">Import backup…</button>
      <input type="file" id="data-file" accept="application/json" style="display:none">
      <button class="btn btn-danger btn-sm" id="data-reset">Reset everything…</button>
    </div>
    <p class="small muted" id="data-usage"></p>
  </div>

  <div class="card">
    <div class="card-title">Coach passcode</div>
    <div class="form-grid">
      <label>New passcode<input type="password" id="pass-1" inputmode="numeric" autocomplete="new-password"></label>
      <label>Repeat<input type="password" id="pass-2" inputmode="numeric" autocomplete="new-password"></label>
    </div>
    <div class="btn-row"><button class="btn btn-sm" id="pass-save">Change passcode</button><span class="small muted" id="pass-status"></span></div>
    <hr>
    <p class="small muted">${recoveryIsSet()
      ? 'A recovery code is saved on this device — it can reset a forgotten passcode without touching your team data. Lost it? Generate a new one (the old code stops working).'
      : 'No recovery code yet. Without one, a forgotten passcode can only be cleared by wiping this site\'s browser data — which erases the team too.'}</p>
    <div class="btn-row"><button class="btn btn-sm" id="rec-new">${recoveryIsSet() ? 'Generate a new recovery code' : 'Create a recovery code'}</button></div>
  </div>

  <div class="card">
    <div class="card-title">About</div>
    <p class="small muted">ShuttleIQ v${esc(APP_VERSION)} — a local-first app: no server, no accounts, data stays in this browser. Use Export/Import to move it between devices.</p>
    <div class="btn-row"><a class="btn btn-sm" href="#/guide">Open the guide</a></div>
  </div>`;

  document.getElementById('set-team-save').addEventListener('click', () => {
    s.teamName = document.getElementById('set-team').value.trim() || 'ShuttleIQ';
    saveState();
    toast('Team name saved');
    buildNav();
  });

  const saveAI = () => {
    s.model = document.getElementById('ai-model').value.trim();
    s.apiKey = document.getElementById('ai-key').value.trim();
    const baseEl = document.getElementById('ai-baseurl');
    if (baseEl) s.baseUrl = baseEl.value.trim();
    saveState();
  };
  document.getElementById('ai-provider').addEventListener('change', e => {
    saveAI(); // keep whatever was typed — switching provider shouldn't eat an unsaved key
    s.provider = e.target.value;
    s.model = ''; // model names don't carry over between providers
    saveState();
    renderSettings();
  });
  document.getElementById('ai-key-show').addEventListener('change', e => {
    document.getElementById('ai-key').type = e.target.checked ? 'text' : 'password';
  });

  VIEW.querySelectorAll('[data-set-theme]').forEach(b => b.addEventListener('click', () => {
    setTheme(b.dataset.setTheme);
    renderSettings();
  }));

  const AI_PRESETS = {
    gemini: { provider: 'gemini', model: '', baseUrl: '', note: 'Now paste a free key from aistudio.google.com and hit Test.' },
    openrouter: { provider: 'openai', model: 'google/gemini-2.0-flash-exp:free', baseUrl: 'https://openrouter.ai/api/v1', note: 'Now paste a key from openrouter.ai — any vision model tagged :free works.' },
    groq: { provider: 'openai', model: 'meta-llama/llama-4-scout-17b-16e-instruct', baseUrl: 'https://api.groq.com/openai/v1', note: 'Now paste a free key from console.groq.com and hit Test.' },
  };
  VIEW.querySelectorAll('[data-ai-preset]').forEach(b => b.addEventListener('click', () => {
    const preset = AI_PRESETS[b.dataset.aiPreset];
    const typedKey = document.getElementById('ai-key').value.trim(); // keep anything already pasted
    s.provider = preset.provider;
    s.model = preset.model;
    s.baseUrl = preset.baseUrl;
    if (typedKey) s.apiKey = typedKey;
    saveState();
    renderSettings();
    document.getElementById('ai-status').textContent = preset.note;
  }));
  document.getElementById('ai-save').addEventListener('click', () => { saveAI(); toast('AI settings saved'); });
  document.getElementById('ai-test').addEventListener('click', async () => {
    saveAI();
    const status = document.getElementById('ai-status');
    status.textContent = 'Testing…';
    try {
      await testAIKey();
      status.textContent = `✓ Working (${aiConfig().model})`;
    } catch (err) {
      status.textContent = '✗ ' + err.message;
    }
  });

  document.getElementById('data-export').addEventListener('click', exportData);
  document.getElementById('data-csv').addEventListener('click', () => {
    const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = [['date', 'player', 'partner', 'discipline', 'opponent', 'score', 'result', 'context', 'notes'].map(q).join(',')];
    for (const m of [...state.matches].sort((a, b) => (a.date < b.date ? -1 : 1))) {
      rows.push([m.date, playerName(m.playerId), m.partnerId ? playerName(m.partnerId) : '', m.discipline, m.opponent, m.score, m.result, m.context || 'season', m.notes].map(q).join(','));
    }
    const blob = new Blob(['﻿' + rows.join('\r\n')], { type: 'text/csv' }); // BOM so Excel opens it cleanly
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `shuttleiq-matches-${todayISO()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  });
  document.getElementById('data-import').addEventListener('click', () => document.getElementById('data-file').click());
  document.getElementById('data-file').addEventListener('change', e => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!confirm('Importing replaces the team data on this device (your API key and passcode are kept). Continue?')) return;
    importData(f, err => {
      if (err) { toast('Import failed: ' + err.message); return; }
      toast('Backup imported');
      route();
    });
  });
  VIEW.querySelectorAll('[data-tour]').forEach(b => b.addEventListener('click', () => {
    if (demoActive()) { toast('Already in demo mode'); return; }
    beginTour(b.dataset.tour);
  }));
  document.getElementById('data-reset').addEventListener('click', () => {
    if (!confirm('Delete ALL players, matches, analyses, rosters, and settings on this device?')) return;
    if (!confirm('Really sure? There is no undo.')) return;
    resetData();
    setRole(null);
    location.hash = '#/';
  });

  // storage meter — coaches should know how much room clips are taking
  (async () => {
    const el = document.getElementById('data-usage');
    try {
      const clips = await listClips();
      let line = `${state.players.length} players · ${state.matches.length} matches · ${clips.length} saved clip${clips.length === 1 ? '' : 's'}`;
      const est = await navigator.storage?.estimate?.();
      if (est?.usage != null) line += ` · ${(est.usage / 1048576).toFixed(1)} MB of browser storage used`;
      const days = daysSinceBackup();
      line += days === null ? ' · never backed up' : days === 0 ? ' · backed up today' : ` · last backup ${days} day${days === 1 ? '' : 's'} ago`;
      if (el) el.textContent = line;
    } catch { /* meter is best-effort */ }
  })();

  document.getElementById('rec-new').addEventListener('click', () => {
    if (recoveryIsSet() && !confirm('Generate a new recovery code? The old one stops working immediately.')) return;
    issueRecoveryCode();
  });

  document.getElementById('pass-save').addEventListener('click', () => {
    const a = document.getElementById('pass-1').value.trim();
    const b = document.getElementById('pass-2').value.trim();
    const status = document.getElementById('pass-status');
    if (a.length < 4) { status.textContent = 'Use at least 4 digits.'; return; }
    if (a !== b) { status.textContent = 'They don\'t match.'; return; }
    setCoachPass(a);
    status.textContent = '✓ Changed';
    toast('Passcode updated');
  });
}

/* ---------- boot ---------- */

// offline support once opened over http(s) — gyms have bad wifi
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
// ask the browser not to evict clips/team data under storage pressure
navigator.storage?.persist?.().catch(() => {});

window.addEventListener('hashchange', route);
route();

/* ShuttleIQ v5 — views and interaction */

const VIEW = document.getElementById('view');
const NAV = document.getElementById('topnav');

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

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
  plan: renderPlanner,
  analyze: renderAnalyze,
  compare: renderCompare,
  settings: renderSettings,
};

const COACH_ONLY = new Set(['players', 'matches', 'tryouts', 'rosters', 'plan', 'settings']);
const NEEDS_ROLE = new Set([...COACH_ONLY, 'analyze', 'compare', 'team', 'player']);

let gateKeyHandler = null;
let revealObserver = null;

function route() {
  stopCamera();
  if (gateKeyHandler) { document.removeEventListener('keydown', gateKeyHandler); gateKeyHandler = null; }

  const hash = location.hash.replace(/^#\/?/, '');
  const [name, arg] = hash.split('/');
  const role = getRole();

  // gate access before rendering
  if (NEEDS_ROLE.has(name) && !role) { location.hash = '#/'; return; }
  if (COACH_ONLY.has(name) && !isCoach()) { location.hash = '#/coach'; return; }

  const fn = ROUTES[name] || renderRoot;
  const dark = ((name === '' || name === 'home') && !role) || name === 'coach' || name === 'login';
  document.body.classList.toggle('on-dark', dark);
  document.body.classList.remove('scrolled');

  buildNav();
  VIEW.innerHTML = '';
  fn(arg);
  markNav(name || 'home');
  wireReveals();
  window.scrollTo(0, 0);
}

function renderRoot() {
  const role = getRole();
  if (role === 'coach') return renderDashboard();
  if (role === 'student') return renderStudentDashboard();
  return renderLanding();
}

/* ---------- dynamic nav ---------- */

function buildNav() {
  const role = getRole();
  const link = (k, label) => `<a data-nav="${k}" href="#/${k === 'home' ? '' : k}">${label}</a>`;
  let links;
  if (role === 'coach') {
    links = [
      link('home', 'Dashboard'), link('plan', 'Coach HQ'), link('players', 'Players'),
      link('matches', 'Matches'), link('tryouts', 'Tryouts'), link('rosters', 'Rosters'),
      link('analyze', 'Analyze'), link('compare', 'Compare'), link('settings', 'Settings'),
    ].join('') + `<button class="nav-role" onclick="logout()">Log out</button>`;
  } else if (role === 'student') {
    links = [link('home', 'Dashboard'), link('team', 'Team'), link('analyze', 'Analyze'), link('compare', 'Compare')].join('')
      + `<button class="nav-role" onclick="logout()">Sign out</button>`;
  } else {
    links = `<a class="nav-role" href="#/login">Log in</a>`;
  }
  NAV.innerHTML = `<a class="logo" href="#/">ShuttleIQ</a><div class="links">${links}</div>`;
}

function markNav(name) {
  NAV.querySelectorAll('a[data-nav]').forEach(a => a.classList.toggle('active', a.dataset.nav === name));
}

function logout() { setRole(null); location.hash = '#/'; route(); }

/* ---------- scroll reveal + nav background ---------- */

function wireReveals() {
  if (!revealObserver) {
    revealObserver = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); revealObserver.unobserve(e.target); } });
    }, { threshold: 0.12 });
  }
  document.querySelectorAll('.reveal:not(.in)').forEach(el => revealObserver.observe(el));
}

window.addEventListener('scroll', () => {
  document.body.classList.toggle('scrolled', window.scrollY > 40);
}, { passive: true });

window.addEventListener('hashchange', route);
window.addEventListener('DOMContentLoaded', route);

/* ---------- shared snippets ---------- */

function skillBars(profile) {
  if (!profile) return '<p class="muted">No skill data yet.</p>';
  return SKILLS.map(s => {
    const v = profile[s];
    return `<div class="bar-row">
      <span class="bar-label">${SKILL_LABELS[s]}</span>
      <span class="bar-track"><span class="bar-fill" style="width:${v ?? 0}%"></span></span>
      <span class="bar-val">${v == null ? '—' : v}</span>
    </div>`;
  }).join('');
}

function formBadge(form) {
  if (!form) return '<span class="muted">no matches</span>';
  const arrow = form.trend === 'up' ? '▲' : form.trend === 'down' ? '▼' : '—';
  return `<span class="form-badge">${form.recentWins}/${form.recentTotal} <span class="trend trend-${form.trend}">${arrow}</span></span>`;
}

function wlDots(playerId, n = 8) {
  const ms = playerMatches(playerId).slice(0, n).reverse();
  if (!ms.length) return '';
  return `<span class="wl-dots">${ms.map(m =>
    `<span class="dot ${m.result === 'W' ? 'dot-w' : 'dot-l'}" title="${m.result} vs ${esc(m.opponent)}"></span>`).join('')}</span>`;
}

function ratingRow(skill, label, value = 0) {
  const boxes = [1, 2, 3, 4, 5].map(n =>
    `<button type="button" class="rate-box ${n <= value ? 'on' : ''}" data-skill="${skill}" data-val="${n}"></button>`).join('');
  return `<div class="rate-row" data-rate="${skill}">
    <span class="rate-label">${label}</span>
    <span class="rate-boxes">${boxes}</span>
  </div>`;
}

function wireRatingRows(container) {
  container.addEventListener('click', e => {
    const box = e.target.closest('.rate-box');
    if (!box) return;
    const row = box.closest('.rate-row');
    const val = Number(box.dataset.val);
    row.dataset.value = val;
    row.querySelectorAll('.rate-box').forEach(b => b.classList.toggle('on', Number(b.dataset.val) <= val));
  });
}

function readRatings(container) {
  const out = {};
  container.querySelectorAll('.rate-row').forEach(row => {
    out[row.dataset.rate] = Number(row.dataset.value || 0);
  });
  return out;
}

function playerOptions(selected, { tryoutsToo = false } = {}) {
  return state.players
    .filter(p => p.status === 'roster' || (tryoutsToo && p.status === 'tryout'))
    .map(p => `<option value="${p.id}" ${p.id === selected ? 'selected' : ''}>${esc(p.name)}</option>`)
    .join('');
}

/* ---------- landing (public homepage) ---------- */

const FEATURES = [
  ['Analyze', 'Record sixty seconds of play and get scored, timestamped coaching across six skills.'],
  ['Scout tryouts', 'Tap drill scores courtside. Prospects rank themselves, live. Promote or cut in a tap.'],
  ['Track form', 'Every match logged. Streaks, win rates, and who is heating up or cooling off.'],
  ['Read position', 'Singles, front court, back court — fit is computed from how each player actually plays.'],
  ['Build rosters', 'One click drafts a lineup from position fit, win rate, and real doubles chemistry.'],
  ['Beat the pros', 'Put your clip next to a professional and watch the AI name every difference.'],
];

function renderLanding() {
  VIEW.innerHTML = `
  <section class="hero">
    <div class="blob"></div>
    <div class="hero-inner">
      <p class="hero-eyebrow">AI badminton intelligence</p>
      <h1 class="hero-title">Shuttle<span class="thin">IQ</span></h1>
      <p class="hero-sub">Film a rally. Score a tryout. Draft a lineup. One darkroom for the whole team — players and coach alike.</p>
      <div class="btn-row center">
        <a class="btn btn-onblack" href="#/login">Log in</a>
        <a class="btn btn-ghost-white" href="#/login">Coach access</a>
      </div>
    </div>
    <div class="scroll-hint">SCROLL TO EXPLORE</div>
  </section>

  <div class="marquee"><span class="marquee-track">FOOTWORK · SMASH · SERVE · DEFENSE · NET PLAY · CONSISTENCY · FOOTWORK · SMASH · SERVE · DEFENSE · NET PLAY · CONSISTENCY · </span></div>

  <section class="editorial">
    <p class="section-eyebrow reveal">What it does</p>
    <h2 class="section-title reveal">Everything the<br>bench already knew.</h2>
    <p class="lead reveal">ShuttleIQ turns a phone camera and a few taps into the picture a coach carries in their head — made visible, scored, and shared.</p>
    <div class="feature-rows reveal">
      ${FEATURES.map((f, i) => `
        <a class="feature-row" href="#/login">
          <span class="feature-idx">${String(i + 1).padStart(2, '0')}</span>
          <span class="feature-name">${esc(f[0])}</span>
          <span class="feature-desc">${esc(f[1])}</span>
        </a>`).join('')}
    </div>
  </section>

  <section class="dark-frame">
    <div class="blob"></div>
    <div class="hero-inner">
      <h2 class="frame-title">Footage in.<br><em>Decisions out.</em></h2>
      <p class="frame-sub">No spreadsheets, no servers. Everything lives in this browser until you say otherwise.</p>
      <div class="btn-row center">
        <a class="btn btn-onblack" href="#/login">Get started</a>
      </div>
    </div>
  </section>

  <section class="editorial">
    <p class="section-eyebrow reveal">How it works</p>
    <h2 class="section-title reveal">Three taps to a verdict.</h2>
    <div class="steps">
      <div class="step reveal"><div class="step-n">01</div><h4>Capture</h4><p>Record a minute of play or upload a clip. The AI samples frames across the rally.</p></div>
      <div class="step reveal"><div class="step-n">02</div><h4>Score</h4><p>Coaches rate matches; the AI scores footage. Both feed one honest skill profile.</p></div>
      <div class="step reveal"><div class="step-n">03</div><h4>Decide</h4><p>Form, position fit, and lineup suggestions surface — so the call is obvious.</p></div>
    </div>
  </section>

  <footer class="site-footer">
    <span class="foot-logo">ShuttleIQ</span>
    <span class="small">Local-first · Anthropic-powered · Built for the team</span>
  </footer>`;
}

/* ---------- login page ---------- */

function renderLogin() {
  const roster = state.players.filter(p => p.status === 'roster');
  VIEW.innerHTML = `
  <div class="auth">
    <div class="blob"></div>
    <a class="gate-back" href="#/">← home</a>
    <div class="auth-inner">
      <p class="gate-label">ShuttleIQ · Sign in</p>
      <h1 class="auth-title">Welcome back</h1>
      <p class="auth-sub">Choose how you're signing in.</p>
      <div class="auth-grid">
        <div class="auth-card">
          <div class="auth-card-head">
            <span class="auth-role">Student</span>
            <p class="auth-card-desc">See your own stats, analyze your play, and compare with a pro.</p>
          </div>
          <label class="auth-field">Who are you?
            <select id="login-student">
              <option value="">Guest (no profile)</option>
              ${roster.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('')}
            </select>
          </label>
          <button class="btn btn-onblack auth-btn" id="login-student-go">Enter as student</button>
        </div>

        <div class="auth-card">
          <div class="auth-card-head">
            <span class="auth-role">Coach</span>
            <p class="auth-card-desc">Full access: matches, tryouts, rosters, planning, and team management.</p>
          </div>
          <div class="auth-coach-note">${coachPassIsSet() ? 'Protected by your 4-digit passcode.' : 'First time — you create a passcode.'}</div>
          <a class="btn btn-ghost-white auth-btn" href="#/coach">Continue to coach login</a>
        </div>
      </div>
    </div>
  </div>`;

  document.getElementById('login-student-go').addEventListener('click', () => {
    const id = document.getElementById('login-student').value || null;
    setRole('student');
    setStudentId(id);
    location.hash = '#/';
    route();
  });
}

/* ---------- coach login (keypad gate) ---------- */

function renderGate() {
  let stage = coachPassIsSet() ? 'login' : 'create';
  let first = '';
  let entry = '';
  const TITLE = { create: 'Set a coach passcode', confirm: 'Confirm passcode', login: 'Coach access' };
  const NOTE = {
    create: 'Choose a 4-digit passcode. It lives only on this device.',
    confirm: 'Enter it once more to confirm.',
    login: 'Enter your 4-digit coach passcode.',
  };

  VIEW.innerHTML = `
  <div class="gate">
    <div class="blob"></div>
    <a class="gate-back" href="#/login">← back</a>
    <div class="gate-inner">
      <div class="gate-label">ShuttleIQ · Coach</div>
      <h2 class="gate-title">${TITLE[stage]}</h2>
      <div class="gate-dots">${[0, 1, 2, 3].map(() => '<span class="gate-dot"></span>').join('')}</div>
      <div class="keypad">
        ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<button class="key" data-k="${n}">${n}</button>`).join('')}
        <button class="key key-ghost" data-k="clear">clear</button>
        <button class="key" data-k="0">0</button>
        <button class="key key-ghost" data-k="back">⌫</button>
      </div>
      <p class="gate-note">${NOTE[stage]}</p>
    </div>
  </div>`;

  const gate = VIEW.querySelector('.gate');

  function paint() {
    gate.querySelectorAll('.gate-dot').forEach((d, i) => d.classList.toggle('full', i < entry.length));
    gate.querySelector('.gate-title').textContent = TITLE[stage];
    gate.querySelector('.gate-note').textContent = NOTE[stage];
  }
  function shake() { gate.classList.add('shake'); setTimeout(() => gate.classList.remove('shake'), 420); }

  function submit() {
    if (stage === 'create') {
      first = entry; entry = ''; stage = 'confirm'; paint();
    } else if (stage === 'confirm') {
      if (entry === first) { setCoachPass(first); setRole('coach'); location.hash = '#/'; }
      else { shake(); first = ''; entry = ''; stage = 'create'; paint(); }
    } else {
      if (checkCoachPass(entry)) { setRole('coach'); location.hash = '#/'; }
      else { shake(); entry = ''; paint(); }
    }
  }

  function press(k) {
    if (k === 'clear') entry = '';
    else if (k === 'back') entry = entry.slice(0, -1);
    else if (/^[0-9]$/.test(k) && entry.length < 4) entry += k;
    else return;
    paint();
    if (entry.length === 4) setTimeout(submit, 160);
  }

  gate.querySelector('.keypad').addEventListener('click', e => {
    const btn = e.target.closest('.key');
    if (btn) press(btn.dataset.k);
  });

  gateKeyHandler = e => {
    if (e.key >= '0' && e.key <= '9') press(e.key);
    else if (e.key === 'Backspace') press('back');
    else if (e.key === 'Escape') press('clear');
  };
  document.addEventListener('keydown', gateKeyHandler);
}

/* ---------- coach dashboard ---------- */

function renderDashboard() {
  const roster = state.players.filter(p => p.status === 'roster');
  const totalMatches = state.matches.length;
  const wins = state.matches.filter(m => m.result === 'W').length;
  const wr = totalMatches ? Math.round((wins / totalMatches) * 100) : null;

  const alerts = [];
  for (const p of roster) {
    const form = recentForm(p.id);
    if (!form) continue;
    if (form.streak.type === 'L' && form.streak.count >= 3)
      alerts.push({ kind: 'cold', text: `${p.name} has lost ${form.streak.count} straight — check in or adjust their role.`, id: p.id });
    if (form.streak.type === 'W' && form.streak.count >= 3)
      alerts.push({ kind: 'hot', text: `${p.name} is on a ${form.streak.count}-match win streak.`, id: p.id });
  }
  const pendingTryouts = state.players.filter(p => p.status === 'tryout').length;
  if (pendingTryouts) alerts.push({ kind: 'tryout', text: `${pendingTryouts} tryout prospect${pendingTryouts > 1 ? 's' : ''} awaiting a decision.`, href: '#/tryouts' });

  const topForm = roster
    .map(p => ({ p, form: recentForm(p.id) }))
    .filter(x => x.form)
    .sort((a, b) => b.form.recentRate - a.form.recentRate)
    .slice(0, 3);

  VIEW.innerHTML = `
  <section class="hero hero-app">
    <div class="hero-inner">
      <p class="hero-eyebrow">${esc(state.settings.teamName || 'ShuttleIQ')} · Coach</p>
      <h1 class="hero-title">Dashboard</h1>
      <div class="hero-stats">
        <div><span class="stat-n">${roster.length}</span><span class="stat-l">PLAYERS</span></div>
        <div><span class="stat-n">${totalMatches}</span><span class="stat-l">MATCHES</span></div>
        <div><span class="stat-n">${wr == null ? '—' : wr + '%'}</span><span class="stat-l">WIN RATE</span></div>
        <div><span class="stat-n">${state.sessions.length}</span><span class="stat-l">AI SESSIONS</span></div>
      </div>
    </div>
  </section>

  <section class="editorial">
    <p class="section-eyebrow">Team pulse</p>
    <h2 class="section-title">Where things stand.</h2>
    ${state.players.length === 0 ? `
      <p class="lead">Nothing here yet. Add players and log matches — or load sample data to see every screen working.</p>
      <div class="btn-row">
        <a class="btn btn-solid" href="#/players">Add players</a>
        <button class="btn" onclick="loadSampleData(); route();">Load sample data</button>
      </div>` : `
      ${alerts.length ? `<div class="alerts">${alerts.map(a =>
        `<a class="alert alert-${a.kind}" href="${a.href || '#/player/' + a.id}">${esc(a.text)}</a>`).join('')}</div>` : '<p class="muted">No alerts. All quiet.</p>'}
      ${topForm.length ? `
      <h3 class="sub-title">In form</h3>
      <div class="card-grid">
        ${topForm.map(({ p, form }) => `
          <a class="card card-link" href="#/player/${p.id}">
            <div class="card-name">${esc(p.name)}</div>
            <div class="card-meta">${formBadge(form)} · last ${form.recentTotal}</div>
            <div class="card-spark">${sparklineSVG(playerMatches(p.id).slice(0, 10)) || wlDots(p.id)}</div>
          </a>`).join('')}
      </div>` : ''}
    `}
    <h3 class="sub-title">Tools</h3>
    <div class="card-grid">
      <a class="card card-link" href="#/plan"><div class="card-name">Coach HQ</div><div class="card-meta">Depth chart, practice plan, opponent records</div></a>
      <a class="card card-link" href="#/analyze"><div class="card-name">Analyze</div><div class="card-meta">Record 60 seconds, get AI coaching feedback</div></a>
      <a class="card card-link" href="#/matches"><div class="card-name">Log match</div><div class="card-meta">Record results and rate each player's play</div></a>
      <a class="card card-link" href="#/tryouts"><div class="card-name">Tryouts</div><div class="card-meta">Score prospects fast, rank, promote or cut</div></a>
      <a class="card card-link" href="#/rosters"><div class="card-name">Rosters</div><div class="card-meta">Build lineups with auto-suggested placements</div></a>
      <a class="card card-link" href="#/compare"><div class="card-name">Compare</div><div class="card-meta">Your clip vs a pro, side by side</div></a>
      <a class="card card-link" href="#/players"><div class="card-name">Players</div><div class="card-meta">Form, positions, strengths, improvement plans</div></a>
    </div>
  </section>`;
}

/* ---------- student dashboard (personalized) ---------- */

function renderStudentDashboard() {
  const me = currentStudent();
  const quickTools = `
    <h3 class="sub-title">Quick actions</h3>
    <div class="card-grid">
      <a class="card card-link" href="#/analyze"><div class="card-name">Analyze my play</div><div class="card-meta">Record 60 seconds and get AI coaching feedback</div></a>
      <a class="card card-link" href="#/compare"><div class="card-name">Compare with a pro</div><div class="card-meta">Your clip next to a professional, side by side</div></a>
      <a class="card card-link" href="#/team"><div class="card-name">The team</div><div class="card-meta">Browse teammates, form, and positions</div></a>
    </div>`;

  if (!me) {
    VIEW.innerHTML = `
    <section class="hero hero-app">
      <div class="hero-inner">
        <p class="hero-eyebrow">${esc(state.settings.teamName || 'ShuttleIQ')}</p>
        <h1 class="hero-title">Welcome</h1>
        <p class="hero-sub">You're signed in as a guest. Analyze your play and compare with a pro — or pick your name to see your own stats.</p>
        <div class="btn-row center"><a class="btn btn-ghost-white" href="#/login">Pick my profile</a></div>
      </div>
    </section>
    <section class="editorial">${quickTools}</section>`;
    return;
  }

  const form = recentForm(me.id);
  const profile = skillProfile(me.id);
  const pos = positionScores(me.id);
  const weak = improvementAreas(me.id);
  const strong = strengths(me.id);
  const matches = playerMatches(me.id).slice(0, 8);

  VIEW.innerHTML = `
  <section class="hero hero-app">
    <div class="hero-inner">
      <p class="hero-eyebrow">${esc(state.settings.teamName || 'ShuttleIQ')} · My dashboard</p>
      <h1 class="hero-title">${esc(me.name.split(' ')[0])}</h1>
      <div class="hero-stats">
        <div><span class="stat-n">${form ? Math.round(form.recentRate * 100) + '%' : '—'}</span><span class="stat-l">RECENT WIN RATE</span></div>
        <div><span class="stat-n">${pos ? pos[pos.best] : '—'}</span><span class="stat-l">${pos ? POSITIONS[pos.best].label.toUpperCase() : 'POSITION'}</span></div>
        <div><span class="stat-n">${playerMatches(me.id).length}</span><span class="stat-l">MATCHES</span></div>
      </div>
    </div>
  </section>

  <section class="editorial">
    <p class="section-eyebrow">Your game</p>
    <h2 class="section-title">How you're playing.</h2>
    ${matches.length >= 2 ? `<div class="sparkline-row"><span class="spark-label">Win-rate trend</span>${sparklineSVG(matches)}</div>` : ''}

    <div class="two-col">
      <div>
        <h3 class="sub-title">Skill profile</h3>
        ${profile ? `<div class="radar-wrap">${radarSVG(profile)}</div>${skillBars(profile)}` : '<p class="muted">No skill data yet. Run a video analysis or ask your coach to log a match.</p>'}
      </div>
      <div>
        <h3 class="sub-title">Best position</h3>
        ${pos ? Object.keys(POSITIONS).map(k => `
          <div class="bar-row ${k === pos.best ? 'bar-best' : ''}">
            <span class="bar-label">${POSITIONS[k].label}${k === pos.best ? ' ★' : ''}</span>
            <span class="bar-track"><span class="bar-fill" style="width:${pos[k]}%"></span></span>
            <span class="bar-val">${pos[k]}</span>
          </div>`).join('') : '<p class="muted">Play a few rated matches to see your fit.</p>'}
        ${strong.length ? `<h3 class="sub-title">Your strengths</h3><p class="lead">${strong.map(s => s.label).join(' · ')}</p>` : ''}
      </div>
    </div>

    <h3 class="sub-title">Work on this</h3>
    ${weak.length ? weak.map(w => `
      <div class="drill-card">
        <div class="drill-head">${w.label} — ${w.score}/100</div>
        <div class="drill-body">${esc(w.drill)}</div>
      </div>`).join('') : '<p class="muted">No data yet — analyze a clip to get targeted drills.</p>'}

    ${matches.length ? `<h3 class="sub-title">Recent matches</h3>
    <table class="table"><thead><tr><th>Date</th><th>vs</th><th>Type</th><th>Result</th></tr></thead>
    <tbody>${matches.map(m => `<tr>
      <td>${esc(m.date)}</td><td>${esc(m.opponent)}</td><td>${esc(m.discipline)}</td>
      <td><span class="pill ${m.result === 'W' ? 'pill-solid' : 'pill-ghost'}">${m.result}</span></td></tr>`).join('')}</tbody>
    </table>` : ''}

    ${quickTools}
  </section>`;
}

/* ---------- team view (roster browse) ---------- */

function renderTeam() {
  const roster = state.players.filter(p => p.status === 'roster');
  VIEW.innerHTML = `
  <section class="hero hero-app">
    <div class="hero-inner">
      <p class="hero-eyebrow">${esc(state.settings.teamName || 'ShuttleIQ')}</p>
      <h1 class="hero-title">The Team</h1>
      <div class="btn-row center">
        <a class="btn btn-onblack" href="#/analyze">Analyze my play</a>
        <a class="btn btn-ghost-white" href="#/compare">Compare with a pro</a>
      </div>
    </div>
  </section>

  <section class="editorial">
    <p class="section-eyebrow">Squad</p>
    <h2 class="section-title">Know the room.</h2>
    ${roster.length === 0 ? '<p class="lead">No players on the roster yet. Check back once your coach sets things up.</p>' : `
    <p class="lead">Tap a teammate to see their form, strengths, and where they fit on court.</p>
    <div class="card-grid">
      ${roster.map(p => {
        const form = recentForm(p.id);
        const pos = positionScores(p.id);
        return `<a class="card card-link" href="#/player/${p.id}">
          <div class="card-name">${esc(p.name)}</div>
          <div class="card-meta">${pos ? esc(POSITIONS[pos.best].label) : 'No data yet'}${form ? ' · ' : ''}${form ? `${form.recentWins}/${form.recentTotal} recent` : ''}</div>
          ${wlDots(p.id)}
        </a>`;
      }).join('')}
    </div>`}
  </section>`;
}

/* ---------- coach HQ (command center) ---------- */

function renderPlanner() {
  const roster = state.players.filter(p => p.status === 'roster');
  const depth = depthChart();
  const plan = practicePlan();
  const h2h = headToHead();
  const trend = teamTrend();
  const wins = state.matches.filter(m => m.result === 'W').length;
  const wr = state.matches.length ? Math.round((wins / state.matches.length) * 100) : null;

  VIEW.innerHTML = `
  <section class="hero hero-app">
    <div class="hero-inner">
      <p class="hero-eyebrow">${esc(state.settings.teamName || 'ShuttleIQ')} · Coach HQ</p>
      <h1 class="hero-title">Command</h1>
      <p class="hero-sub">Depth, practice priorities, and every opponent on record — the coach-only view.</p>
    </div>
  </section>

  <section class="editorial">
    ${roster.length === 0 ? '<p class="lead">Add players and log matches to populate the command center.</p>' : `
    <div class="hq-trend">
      <div>
        <p class="section-eyebrow">Team trajectory</p>
        <h2 class="section-title">${wr == null ? '—' : wr + '%'} <span class="trend-cap">all-time win rate</span></h2>
      </div>
      ${trend.length >= 2 ? `<div class="trend-chart">${sparklineSVG([...trend].reverse(), { w: 320, h: 64 })}<span class="trend-foot">${trend.length} matches · oldest → newest</span></div>` : ''}
    </div>

    <h3 class="sub-title">Depth chart</h3>
    <p class="muted small">Best-fit players per role, ranked by position fit. Build lineups from the top down.</p>
    <div class="depth-grid">
      ${Object.entries(POSITIONS).map(([key, pos]) => `
        <div class="depth-col">
          <div class="depth-head">${esc(pos.label)}</div>
          ${depth[key].length ? depth[key].map((d, i) => `
            <a class="depth-row" href="#/player/${d.player.id}">
              <span class="depth-rank">${i + 1}</span>
              <span class="depth-name">${esc(d.player.name)}</span>
              <span class="depth-score">${d.score}</span>
            </a>`).join('') : '<p class="muted small">No data.</p>'}
        </div>`).join('')}
    </div>

    <h3 class="sub-title">Practice plan</h3>
    <p class="muted small">The team's weakest skills first — run these drills at the next session. Names are players currently under 50 in that skill.</p>
    ${plan.length ? `<div class="plan-list">
      ${plan.slice(0, 4).map((row, i) => `
        <div class="plan-card">
          <div class="plan-top">
            <span class="plan-idx">${String(i + 1).padStart(2, '0')}</span>
            <span class="plan-skill">${esc(row.label)}</span>
            <span class="plan-avg">team avg ${row.avg}</span>
          </div>
          <div class="plan-drill">${esc(row.drill)}</div>
          ${row.focusPlayers.length ? `<div class="plan-focus">Focus: ${row.focusPlayers.map(esc).join(', ')}</div>` : '<div class="plan-focus muted">Whole squad solid here — light touch.</div>'}
        </div>`).join('')}
    </div>
    <div class="btn-row"><button class="btn" onclick="window.print()">Print practice plan</button></div>` : '<p class="muted">Log matches with ratings to generate a plan.</p>'}

    <h3 class="sub-title">Head to head</h3>
    ${h2h.length ? `<table class="table">
      <thead><tr><th>Opponent</th><th>Record</th><th>Win rate</th><th>Played</th></tr></thead>
      <tbody>${h2h.map(r => `<tr>
        <td>${esc(r.opponent)}</td>
        <td>${r.wins}–${r.losses}</td>
        <td>${Math.round(r.rate * 100)}%</td>
        <td>${r.total}</td>
      </tr>`).join('')}</tbody>
    </table>` : '<p class="muted">No match history yet.</p>'}
    `}
  </section>`;
}

/* ---------- players ---------- */

function renderPlayers() {
  const roster = state.players.filter(p => p.status === 'roster');
  VIEW.innerHTML = `
  <section class="editorial">
    <h2 class="section-title">Players</h2>
    <form id="add-player" class="inline-form">
      <input type="text" id="np-name" placeholder="Name" required>
      <input type="number" id="np-year" placeholder="Grade / year" min="1" max="13">
      <select id="np-hand"><option>Right</option><option>Left</option></select>
      <button class="btn btn-solid" type="submit">Add player</button>
    </form>
    ${roster.length === 0 ? '<p class="muted">No players on the roster yet.</p>' : `
    <table class="table">
      <thead><tr><th>Name</th><th>Form</th><th>Win rate</th><th>Best position</th><th>Recent</th><th></th></tr></thead>
      <tbody>
        ${roster.map(p => {
          const form = recentForm(p.id);
          const wr = winRate(p.id);
          const pos = positionScores(p.id);
          return `<tr>
            <td><a class="row-link" href="#/player/${p.id}">${esc(p.name)}</a></td>
            <td>${formBadge(form)}</td>
            <td>${wr == null ? '—' : Math.round(wr * 100) + '%'}</td>
            <td>${pos ? esc(POSITIONS[pos.best].label) : '—'}</td>
            <td>${wlDots(p.id)}</td>
            <td><button class="btn btn-mini" onclick="removePlayer('${p.id}')">Remove</button></td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>`}
  </section>`;

  document.getElementById('add-player').addEventListener('submit', e => {
    e.preventDefault();
    const name = document.getElementById('np-name').value.trim();
    if (!name) return;
    state.players.push({
      id: uid(), name,
      year: Number(document.getElementById('np-year').value) || null,
      hand: document.getElementById('np-hand').value,
      status: 'roster', tryoutScores: null, createdAt: new Date().toISOString(),
    });
    saveState();
    renderPlayers();
  });
}

function removePlayer(id) {
  const p = getPlayer(id);
  if (!p) return;
  if (!confirm(`Remove ${p.name} from the roster? Their match history stays.`)) return;
  p.status = 'cut';
  saveState();
  route();
}

function renderPlayerDetail(id) {
  const p = getPlayer(id);
  if (!p) { location.hash = '#/players'; return; }
  const form = recentForm(id);
  const profile = skillProfile(id);
  const pos = positionScores(id);
  const weak = improvementAreas(id);
  const strong = strengths(id);
  const matches = playerMatches(id).slice(0, 10);
  const sessions = playerSessions(id).slice(0, 5);

  const backHref = isCoach() ? '#/players' : '#/team';
  VIEW.innerHTML = `
  <section class="editorial">
    <a class="back-link" href="${backHref}">← Back</a>
    <h2 class="section-title">${esc(p.name)}</h2>
    <p class="muted">${p.year ? 'Year ' + p.year + ' · ' : ''}${esc(p.hand || '')}-handed ${form ? '· ' : ''}${form ? formBadge(form) : ''} ${wlDots(id, 10)}</p>
    ${matches.length >= 2 ? `<div class="sparkline-row"><span class="spark-label">Win-rate trend</span>${sparklineSVG(matches)}</div>` : ''}

    <div class="two-col">
      <div>
        <h3 class="sub-title">Skill profile</h3>
        ${profile ? `<div class="radar-wrap">${radarSVG(profile)}</div>${skillBars(profile)}` : '<p class="muted">No skill data yet. Log a match with ratings or run a video analysis.</p>'}
      </div>
      <div>
        <h3 class="sub-title">Position fit</h3>
        ${pos ? Object.keys(POSITIONS).map(k => `
          <div class="bar-row ${k === pos.best ? 'bar-best' : ''}">
            <span class="bar-label">${POSITIONS[k].label}${k === pos.best ? ' ★' : ''}</span>
            <span class="bar-track"><span class="bar-fill" style="width:${pos[k]}%"></span></span>
            <span class="bar-val">${pos[k]}</span>
          </div>`).join('') : '<p class="muted">Log a match with ratings to see position fit.</p>'}
        ${strong.length ? `<h3 class="sub-title">Strengths</h3><p>${strong.map(s => `${s.label} (${s.score})`).join(' · ')}</p>` : ''}
      </div>
    </div>

    <h3 class="sub-title">What to work on</h3>
    ${weak.length ? weak.map(w => `
      <div class="drill-card">
        <div class="drill-head">${w.label} — ${w.score}/100</div>
        <div class="drill-body">${esc(w.drill)}</div>
      </div>`).join('') : '<p class="muted">No data yet.</p>'}

    <h3 class="sub-title">Coach note</h3>
    <p id="coach-note" class="coach-note">${esc(localCoachNote(id))}</p>
    ${hasApiKey() ? `<button class="btn btn-ghost" id="ai-note-btn">Generate AI coach note</button>` :
      '<p class="muted small">Add an API key in Settings for AI-written coach notes.</p>'}

    <h3 class="sub-title">Recent matches</h3>
    ${matches.length ? `<table class="table">
      <thead><tr><th>Date</th><th>vs</th><th>Type</th><th>Result</th><th>Score</th></tr></thead>
      <tbody>${matches.map(m => `<tr>
        <td>${esc(m.date)}</td><td>${esc(m.opponent)}</td><td>${esc(m.discipline)}${m.partnerId ? ' w/ ' + esc(playerName(m.partnerId === id ? m.playerId : m.partnerId)) : ''}</td>
        <td><span class="pill ${m.result === 'W' ? 'pill-solid' : 'pill-ghost'}">${m.result}</span></td>
        <td>${esc(m.score || '')}</td></tr>`).join('')}</tbody>
    </table>` : '<p class="muted">No matches logged.</p>'}

    ${sessions.length ? `<h3 class="sub-title">AI sessions</h3>
      <table class="table"><thead><tr><th>Date</th><th>Label</th><th>Avg score</th></tr></thead>
      <tbody>${sessions.map(s => {
        const avg = s.scores ? Math.round(SKILLS.reduce((a, k) => a + (s.scores[k] || 0), 0) / SKILLS.length) : '—';
        return `<tr><td>${esc(s.date.slice(0, 10))}</td><td>${esc(s.label)}</td><td>${avg}</td></tr>`;
      }).join('')}</tbody></table>` : ''}
  </section>`;

  const btn = document.getElementById('ai-note-btn');
  if (btn) btn.addEventListener('click', async () => {
    btn.disabled = true; btn.textContent = 'Thinking…';
    try {
      const note = await aiCoachNote(p);
      document.getElementById('coach-note').textContent = note;
    } catch (err) {
      alert('AI note failed: ' + err.message);
    } finally {
      btn.disabled = false; btn.textContent = 'Generate AI coach note';
    }
  });
}

/* ---------- matches ---------- */

function renderMatches() {
  const recent = [...state.matches].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 20);
  VIEW.innerHTML = `
  <section class="editorial">
    <h2 class="section-title">Log a match</h2>
    ${state.players.filter(p => p.status === 'roster').length === 0 ?
      '<p class="muted">Add players first.</p>' : `
    <form id="match-form" class="stack-form">
      <div class="form-grid">
        <label>Player<select id="mf-player" required>${playerOptions()}</select></label>
        <label>Discipline<select id="mf-disc">
          <option value="MS">Singles (MS)</option><option value="WS">Singles (WS)</option>
          <option value="MD">Doubles (MD)</option><option value="WD">Doubles (WD)</option><option value="XD">Mixed (XD)</option>
        </select></label>
        <label id="mf-partner-wrap" style="display:none">Partner<select id="mf-partner"><option value="">—</option>${playerOptions()}</select></label>
        <label>Date<input type="date" id="mf-date" value="${new Date().toISOString().slice(0, 10)}"></label>
        <label>Opponent<input type="text" id="mf-opp" placeholder="School / player"></label>
        <label>Set scores<input type="text" id="mf-score" placeholder="21-15, 19-21, 21-18"></label>
        <label>Result<select id="mf-result"><option value="W">Won</option><option value="L">Lost</option></select></label>
      </div>
      <h3 class="sub-title">Rate their play (optional)</h3>
      <div id="mf-ratings" class="rate-grid">
        ${SKILLS.map(s => ratingRow(s, SKILL_LABELS[s])).join('')}
      </div>
      <label class="full">Notes<textarea id="mf-notes" rows="2" placeholder="Anything worth remembering"></textarea></label>
      <button class="btn btn-solid" type="submit">Save match</button>
    </form>`}

    <h3 class="sub-title">Recent matches</h3>
    ${recent.length ? `<table class="table">
      <thead><tr><th>Date</th><th>Player</th><th>Type</th><th>vs</th><th>Result</th><th></th></tr></thead>
      <tbody>${recent.map(m => `<tr>
        <td>${esc(m.date)}</td>
        <td><a class="row-link" href="#/player/${m.playerId}">${esc(playerName(m.playerId))}</a>${m.partnerId ? ' / ' + esc(playerName(m.partnerId)) : ''}</td>
        <td>${esc(m.discipline)}</td><td>${esc(m.opponent)}</td>
        <td><span class="pill ${m.result === 'W' ? 'pill-solid' : 'pill-ghost'}">${m.result}</span></td>
        <td><button class="btn btn-mini" onclick="deleteMatch('${m.id}')">Delete</button></td>
      </tr>`).join('')}</tbody>
    </table>` : '<p class="muted">No matches yet.</p>'}
  </section>`;

  const form = document.getElementById('match-form');
  if (!form) return;
  wireRatingRows(document.getElementById('mf-ratings'));
  const disc = document.getElementById('mf-disc');
  disc.addEventListener('change', () => {
    document.getElementById('mf-partner-wrap').style.display = ['MD', 'WD', 'XD'].includes(disc.value) ? '' : 'none';
  });
  form.addEventListener('submit', e => {
    e.preventDefault();
    const ratings = readRatings(document.getElementById('mf-ratings'));
    const hasRatings = Object.values(ratings).some(v => v > 0);
    const playerId = document.getElementById('mf-player').value;
    const partnerId = ['MD', 'WD', 'XD'].includes(disc.value) ? (document.getElementById('mf-partner').value || null) : null;
    if (partnerId === playerId) { alert('Partner must be a different player.'); return; }
    state.matches.push({
      id: uid(), playerId, partnerId,
      date: document.getElementById('mf-date').value,
      opponent: document.getElementById('mf-opp').value.trim() || 'Unknown',
      discipline: disc.value,
      result: document.getElementById('mf-result').value,
      score: document.getElementById('mf-score').value.trim(),
      ratings: hasRatings ? ratings : null,
      notes: document.getElementById('mf-notes').value.trim(),
    });
    saveState();
    renderMatches();
  });
}

function deleteMatch(id) {
  if (!confirm('Delete this match?')) return;
  state.matches = state.matches.filter(m => m.id !== id);
  saveState();
  renderMatches();
}

/* ---------- tryouts ---------- */

const TRYOUT_DRILLS = [
  ['serve', 'Serve accuracy'], ['footwork', 'Footwork / agility'], ['smash', 'Smash power'],
  ['net', 'Net control'], ['rally', 'Rally consistency'], ['sense', 'Game sense'], ['athleticism', 'Athleticism'],
];

function renderTryouts() {
  const prospects = state.players
    .filter(p => p.status === 'tryout')
    .sort((a, b) => tryoutComposite(b) - tryoutComposite(a));

  VIEW.innerHTML = `
  <section class="editorial">
    <h2 class="section-title">Tryouts</h2>
    <p class="lead">Add each prospect, tap scores as they run drills, then promote the keepers to the roster.</p>
    <form id="tryout-add" class="inline-form">
      <input type="text" id="ta-name" placeholder="Prospect name" required>
      <input type="number" id="ta-year" placeholder="Grade / year" min="1" max="13">
      <button class="btn btn-solid" type="submit">Add prospect</button>
    </form>

    ${prospects.length === 0 ? '<p class="muted">No prospects yet.</p>' : `
    <div class="tryout-board">
      ${prospects.map((p, rank) => `
      <div class="tryout-card" data-pid="${p.id}">
        <div class="tryout-head">
          <span class="tryout-rank">${rank + 1}</span>
          <span class="tryout-name">${esc(p.name)}${p.year ? ` <span class="muted small">Y${p.year}</span>` : ''}</span>
          <span class="tryout-avg">${tryoutComposite(p) ? tryoutComposite(p).toFixed(1) : '—'}<span class="muted small">/5</span></span>
        </div>
        <div class="rate-grid tryout-rates">
          ${TRYOUT_DRILLS.map(([k, label]) => ratingRow(k, label, p.tryoutScores?.[k] || 0)).join('')}
        </div>
        <div class="btn-row">
          <button class="btn btn-solid btn-mini" onclick="promoteProspect('${p.id}')">Promote to roster</button>
          <button class="btn btn-mini" onclick="cutProspect('${p.id}')">Cut</button>
        </div>
      </div>`).join('')}
    </div>`}
  </section>`;

  document.getElementById('tryout-add').addEventListener('submit', e => {
    e.preventDefault();
    const name = document.getElementById('ta-name').value.trim();
    if (!name) return;
    state.players.push({
      id: uid(), name,
      year: Number(document.getElementById('ta-year').value) || null,
      hand: 'Right', status: 'tryout',
      tryoutScores: {}, createdAt: new Date().toISOString(),
    });
    saveState();
    renderTryouts();
  });

  document.querySelectorAll('.tryout-card').forEach(card => {
    wireRatingRows(card);
    card.addEventListener('click', e => {
      if (!e.target.closest('.rate-box')) return;
      const p = getPlayer(card.dataset.pid);
      p.tryoutScores = readRatings(card.querySelector('.tryout-rates'));
      saveState();
      // update the average without re-rendering (keeps tap flow fast)
      card.querySelector('.tryout-avg').innerHTML = `${tryoutComposite(p).toFixed(1)}<span class="muted small">/5</span>`;
    });
  });
}

function promoteProspect(id) {
  const p = getPlayer(id);
  p.status = 'roster';
  saveState();
  renderTryouts();
}

function cutProspect(id) {
  const p = getPlayer(id);
  if (!confirm(`Cut ${p.name}?`)) return;
  p.status = 'cut';
  saveState();
  renderTryouts();
}

/* ---------- rosters ---------- */

const DEFAULT_SLOTS = [
  { code: 'S1', type: 'singles' }, { code: 'S2', type: 'singles' }, { code: 'S3', type: 'singles' },
  { code: 'D1', type: 'doubles' }, { code: 'D2', type: 'doubles' },
];

function renderRosters() {
  const chem = pairChemistry().slice(0, 5);
  VIEW.innerHTML = `
  <section class="editorial">
    <h2 class="section-title">Rosters</h2>
    <form id="roster-add" class="inline-form">
      <input type="text" id="ra-name" placeholder="e.g. vs Westfield, Apr 20" required>
      <button class="btn btn-solid" type="submit">New roster</button>
    </form>

    ${state.rosters.length === 0 ? '<p class="muted">No rosters yet. Create one — slots cover 3 singles and 2 doubles by default.</p>' :
      state.rosters.map(r => renderRosterCard(r)).join('')}

    ${chem.length ? `
    <h3 class="sub-title">Doubles chemistry</h3>
    <table class="table"><thead><tr><th>Pair</th><th>Together</th><th>Win rate</th></tr></thead>
    <tbody>${chem.map(c => `<tr>
      <td>${esc(playerName(c.ids[0]))} / ${esc(playerName(c.ids[1]))}</td>
      <td>${c.total} match${c.total > 1 ? 'es' : ''}</td>
      <td>${Math.round(c.rate * 100)}%</td></tr>`).join('')}</tbody></table>` : ''}
  </section>`;

  document.getElementById('roster-add').addEventListener('submit', e => {
    e.preventDefault();
    const name = document.getElementById('ra-name').value.trim();
    if (!name) return;
    state.rosters.push({
      id: uid(), name,
      slots: DEFAULT_SLOTS.map(s => ({ ...s, playerIds: [] })),
    });
    saveState();
    renderRosters();
  });

  document.querySelectorAll('[data-roster]').forEach(box => {
    const roster = state.rosters.find(r => r.id === box.dataset.roster);
    box.querySelectorAll('select[data-slot]').forEach(sel => {
      sel.addEventListener('change', () => {
        const slot = roster.slots.find(s => s.code === sel.dataset.slot);
        const idx = Number(sel.dataset.idx);
        slot.playerIds[idx] = sel.value || null;
        saveState();
      });
    });
  });
}

function renderRosterCard(r) {
  return `
  <div class="card roster-card" data-roster="${r.id}">
    <div class="card-name">${esc(r.name)}</div>
    <table class="table roster-table">
      <tbody>
      ${r.slots.map(slot => `
        <tr>
          <td class="slot-code">${esc(slot.code)}</td>
          ${Array.from({ length: slot.type === 'doubles' ? 2 : 1 }, (_, i) => `
          <td><select data-slot="${slot.code}" data-idx="${i}">
            <option value="">—</option>
            ${state.players.filter(p => p.status === 'roster').map(p =>
              `<option value="${p.id}" ${slot.playerIds[i] === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}
          </select></td>`).join('')}
          ${slot.type === 'singles' ? '<td></td>' : ''}
        </tr>`).join('')}
      </tbody>
    </table>
    <div class="btn-row">
      <button class="btn btn-ghost btn-mini" onclick="autoFillRoster('${r.id}')">Auto-suggest lineup</button>
      <button class="btn btn-mini" onclick="deleteRoster('${r.id}')">Delete</button>
    </div>
  </div>`;
}

function autoFillRoster(id) {
  const roster = state.rosters.find(r => r.id === id);
  const suggestion = suggestRoster(roster.slots);
  for (const slot of roster.slots) {
    if (suggestion[slot.code]) slot.playerIds = suggestion[slot.code];
  }
  saveState();
  renderRosters();
}

function deleteRoster(id) {
  if (!confirm('Delete this roster?')) return;
  state.rosters = state.rosters.filter(r => r.id !== id);
  saveState();
  renderRosters();
}

/* ---------- analyze (record / upload + AI) ---------- */

let cameraStream = null, mediaRecorder = null, recordTimer = null;
window.lastClipURL = null;

function stopCamera() {
  if (mediaRecorder && mediaRecorder.state === 'recording') mediaRecorder.stop();
  if (cameraStream) { cameraStream.getTracks().forEach(t => t.stop()); cameraStream = null; }
  if (recordTimer) { clearInterval(recordTimer); recordTimer = null; }
}

function renderAnalyze() {
  VIEW.innerHTML = `
  <section class="editorial">
    <h2 class="section-title">Analyze</h2>
    <p class="lead">Record one minute of play — or upload a clip — and get scored, timestamped coaching feedback.</p>
    ${hasApiKey() ? '' : '<div class="notice">No API key set. You can record and save clips, but AI analysis needs a key — add one in <a href="#/settings">Settings</a>.</div>'}

    <div class="two-col">
      <div class="card">
        <div class="card-name">Record (60s max)</div>
        <video id="cam-live" autoplay muted playsinline style="display:none"></video>
        <div id="rec-timer" class="rec-timer" style="display:none">1:00</div>
        <div class="btn-row">
          <button class="btn btn-ghost" id="cam-start">Start camera</button>
          <button class="btn btn-solid" id="rec-start" style="display:none">● Record</button>
          <button class="btn btn-solid" id="rec-stop" style="display:none">■ Stop</button>
        </div>
      </div>
      <div class="card">
        <div class="card-name">Or upload a clip</div>
        <input type="file" id="an-file" accept="video/*">
        <p class="muted small">Short clips work best — about a minute of rally play.</p>
      </div>
    </div>

    <video id="an-video" controls style="display:none"></video>

    <div id="an-controls" style="display:none">
      <div class="form-grid">
        <label>Player (optional)<select id="an-player"><option value="">—</option>${playerOptions(null, { tryoutsToo: true })}</select></label>
        <label>Focus<select id="an-focus">
          <option value="all">Everything</option><option value="footwork">Footwork</option>
          <option value="smash">Smash</option><option value="serve">Serve</option>
          <option value="net">Net play</option><option value="defense">Defense</option>
        </select></label>
        <label>Label<input type="text" id="an-label" placeholder="e.g. Practice Apr 12"></label>
      </div>
      <button class="btn btn-solid" id="an-go" ${hasApiKey() ? '' : 'disabled'}>Analyze with AI</button>
    </div>

    <div id="an-status" class="muted" style="display:none"></div>
    <div id="an-results"></div>
  </section>`;

  const liveEl = document.getElementById('cam-live');
  const videoEl = document.getElementById('an-video');
  const timerEl = document.getElementById('rec-timer');
  const startCamBtn = document.getElementById('cam-start');
  const recBtn = document.getElementById('rec-start');
  const stopBtn = document.getElementById('rec-stop');

  startCamBtn.addEventListener('click', async () => {
    try {
      cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      liveEl.srcObject = cameraStream;
      liveEl.style.display = '';
      startCamBtn.style.display = 'none';
      recBtn.style.display = '';
    } catch (err) {
      alert('Camera unavailable: ' + err.message);
    }
  });

  recBtn.addEventListener('click', () => {
    const chunks = [];
    mediaRecorder = new MediaRecorder(cameraStream);
    mediaRecorder.ondataavailable = e => chunks.push(e.data);
    mediaRecorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      loadClip(URL.createObjectURL(blob));
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
    timerEl.textContent = '1:00';
    recordTimer = setInterval(() => {
      remaining--;
      timerEl.textContent = `0:${String(remaining).padStart(2, '0')}`;
      if (remaining <= 0) stopBtn.click();
    }, 1000);
  });

  stopBtn.addEventListener('click', () => {
    if (recordTimer) { clearInterval(recordTimer); recordTimer = null; }
    if (mediaRecorder && mediaRecorder.state === 'recording') mediaRecorder.stop();
  });

  document.getElementById('an-file').addEventListener('change', e => {
    const f = e.target.files?.[0];
    if (f) loadClip(URL.createObjectURL(f));
  });

  function loadClip(url) {
    window.lastClipURL = url;
    videoEl.src = url;
    videoEl.style.display = '';
    document.getElementById('an-controls').style.display = '';
    // recorded webm can report Infinity duration — force it to resolve
    videoEl.onloadedmetadata = () => {
      if (videoEl.duration === Infinity) {
        videoEl.currentTime = 1e10;
        videoEl.ontimeupdate = () => { videoEl.ontimeupdate = null; videoEl.currentTime = 0; };
      }
    };
  }

  document.getElementById('an-go').addEventListener('click', async () => {
    const btn = document.getElementById('an-go');
    const status = document.getElementById('an-status');
    const results = document.getElementById('an-results');
    btn.disabled = true;
    status.style.display = '';
    results.innerHTML = '';
    try {
      status.textContent = 'Extracting frames…';
      const frames = await extractFrames(videoEl, 8);
      status.textContent = `Sending ${frames.length} frames to the AI coach…`;
      const focus = document.getElementById('an-focus').value;
      const parsed = await analyzeGameplay(frames, focus);
      status.style.display = 'none';

      const playerId = document.getElementById('an-player').value || null;
      const label = document.getElementById('an-label').value.trim() || `Session ${state.sessions.length + 1}`;
      state.sessions.push({
        id: uid(), playerId, date: new Date().toISOString(), label, focus,
        scores: parsed.scores, feedback: parsed.feedback,
      });
      saveState();
      results.innerHTML = renderAnalysisResults(parsed);
      results.querySelectorAll('[data-seek]').forEach(el => el.addEventListener('click', () => {
        const [m, s] = el.dataset.seek.split(':').map(Number);
        videoEl.currentTime = m * 60 + s;
        videoEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }));
    } catch (err) {
      status.style.display = '';
      status.textContent = 'Analysis failed: ' + err.message;
    } finally {
      btn.disabled = false;
    }
  });
}

function renderAnalysisResults(parsed) {
  return `
    <h3 class="sub-title">Scores</h3>
    ${skillBars(parsed.scores)}
    <h3 class="sub-title">Feedback <span class="muted small">(click a card to jump to that moment)</span></h3>
    ${parsed.feedback.map(f => `
      <div class="feedback-card fb-${esc(f.type)}" data-seek="${esc(f.timestamp)}">
        <div class="fb-head"><span class="fb-time">${esc(f.timestamp)}</span> <span class="fb-type">${esc(f.type.toUpperCase())}</span> ${esc(f.title)}</div>
        <div class="fb-body">${esc(f.body)}</div>
        ${f.tip ? `<div class="fb-tip">Drill: ${esc(f.tip)}</div>` : ''}
      </div>`).join('')}`;
}

/* ---------- compare with a pro ---------- */

function renderCompare() {
  VIEW.innerHTML = `
  <section class="editorial">
    <h2 class="section-title">Compare</h2>
    <p class="lead">Put your clip next to a pro's. Watch them in sync, then let the AI spell out the differences.</p>
    ${hasApiKey() ? '' : '<div class="notice">AI comparison needs an API key (<a href="#/settings">Settings</a>). Side-by-side playback works without one.</div>'}

    <div class="two-col compare-grid">
      <div class="card">
        <div class="card-name">You</div>
        <input type="file" id="cmp-you" accept="video/*">
        ${window.lastClipURL ? '<button class="btn btn-mini btn-ghost" id="cmp-use-last">Use clip from Analyze</button>' : ''}
        <video id="cmp-you-video" controls muted style="display:none"></video>
      </div>
      <div class="card">
        <div class="card-name">Pro</div>
        <input type="file" id="cmp-pro" accept="video/*">
        <p class="muted small">Download a short clip of a pro playing a similar style and load it here.</p>
        <video id="cmp-pro-video" controls muted style="display:none"></video>
      </div>
    </div>

    <div class="btn-row">
      <button class="btn btn-ghost" id="cmp-sync">▶ Play both</button>
      <button class="btn btn-ghost" id="cmp-pause">❚❚ Pause both</button>
      <button class="btn btn-ghost" id="cmp-slow">0.5× speed</button>
      <button class="btn btn-solid" id="cmp-ai" ${hasApiKey() ? '' : 'disabled'}>AI comparison</button>
    </div>
    <div id="cmp-status" class="muted" style="display:none"></div>
    <div id="cmp-results"></div>
  </section>`;

  const youV = document.getElementById('cmp-you-video');
  const proV = document.getElementById('cmp-pro-video');
  const wire = (inputId, video) => {
    document.getElementById(inputId).addEventListener('change', e => {
      const f = e.target.files?.[0];
      if (!f) return;
      video.src = URL.createObjectURL(f);
      video.style.display = '';
    });
  };
  wire('cmp-you', youV);
  wire('cmp-pro', proV);

  const useLast = document.getElementById('cmp-use-last');
  if (useLast) useLast.addEventListener('click', () => {
    youV.src = window.lastClipURL;
    youV.style.display = '';
  });

  let slow = false;
  document.getElementById('cmp-sync').addEventListener('click', () => { youV.play(); proV.play(); });
  document.getElementById('cmp-pause').addEventListener('click', () => { youV.pause(); proV.pause(); });
  document.getElementById('cmp-slow').addEventListener('click', e => {
    slow = !slow;
    youV.playbackRate = proV.playbackRate = slow ? 0.5 : 1;
    e.target.textContent = slow ? '1× speed' : '0.5× speed';
  });

  document.getElementById('cmp-ai').addEventListener('click', async () => {
    const btn = document.getElementById('cmp-ai');
    const status = document.getElementById('cmp-status');
    const results = document.getElementById('cmp-results');
    if (!youV.src || !proV.src) { alert('Load both clips first.'); return; }
    btn.disabled = true;
    status.style.display = '';
    results.innerHTML = '';
    try {
      status.textContent = 'Extracting frames from both clips…';
      const [yourFrames, proFrames] = [await extractFrames(youV, 6), await extractFrames(proV, 6)];
      status.textContent = 'Comparing…';
      const parsed = await compareWithPro(yourFrames, proFrames);
      status.style.display = 'none';
      results.innerHTML = `
        <h3 class="sub-title">Overall</h3>
        <p>${esc(parsed.summary)}</p>
        <h3 class="sub-title">Key differences</h3>
        ${parsed.differences.map(d => `
          <div class="drill-card">
            <div class="drill-head">${esc(d.area)}</div>
            <div class="drill-body"><strong>You:</strong> ${esc(d.student)}<br><strong>Pro:</strong> ${esc(d.pro)}<br><strong>Fix:</strong> ${esc(d.fix)}</div>
          </div>`).join('')}`;
    } catch (err) {
      status.style.display = '';
      status.textContent = 'Comparison failed: ' + err.message;
    } finally {
      btn.disabled = false;
    }
  });
}

/* ---------- settings ---------- */

function renderSettings() {
  VIEW.innerHTML = `
  <section class="editorial">
    <h2 class="section-title">Settings</h2>
    <div class="settings-block">
      <h3 class="sub-title">Team</h3>
      <label>Team name<input type="text" id="set-team" value="${esc(state.settings.teamName)}" placeholder="SHUTTLEIQ"></label>
    </div>
    <div class="settings-block">
      <h3 class="sub-title">AI</h3>
      <label>Anthropic API key
        <span class="key-row">
          <input type="password" id="set-key" value="${esc(state.settings.apiKey)}" placeholder="sk-ant-…">
          <button class="btn btn-mini" type="button" id="set-key-show">show</button>
        </span>
      </label>
      <label>Model<select id="set-model">
        ${[['claude-opus-4-8', 'Claude Opus 4.8 (best)'], ['claude-sonnet-4-6', 'Claude Sonnet 4.6 (cheaper)'], ['claude-haiku-4-5', 'Claude Haiku 4.5 (fastest)']]
          .map(([v, l]) => `<option value="${v}" ${state.settings.model === v ? 'selected' : ''}>${l}</option>`).join('')}
      </select></label>
      <p class="muted small">The key stays in this browser (localStorage) and is sent only to api.anthropic.com. On a shared or public device, clear it when you're done — anyone with the browser can read it. Backups you export never include the key.</p>
    </div>
    <button class="btn btn-solid" id="set-save">Save settings</button>

    <div class="settings-block">
      <h3 class="sub-title">Coach access</h3>
      <p class="muted small">Your passcode unlocks the coach tools on this device. Resetting it logs you out and lets you set a new one.</p>
      <button class="btn btn-mini" id="set-passcode">Reset coach passcode</button>
    </div>

    <div class="settings-block">
      <h3 class="sub-title">Data</h3>
      <div class="btn-row">
        <button class="btn btn-ghost" onclick="exportData()">Export backup</button>
        <button class="btn btn-ghost" id="set-import">Import backup</button>
        <input type="file" id="set-import-file" accept="application/json" style="display:none">
        <button class="btn btn-ghost" onclick="loadSampleData(); alert('Sample data loaded.'); route();">Load sample data</button>
      </div>
      <button class="btn btn-mini danger" id="set-reset">Erase everything</button>
    </div>
  </section>`;

  document.getElementById('set-key-show').addEventListener('click', () => {
    const k = document.getElementById('set-key');
    k.type = k.type === 'password' ? 'text' : 'password';
  });
  document.getElementById('set-save').addEventListener('click', () => {
    state.settings.teamName = document.getElementById('set-team').value.trim();
    state.settings.apiKey = document.getElementById('set-key').value.trim();
    state.settings.model = document.getElementById('set-model').value;
    saveState();
    alert('Saved.');
  });
  document.getElementById('set-passcode').addEventListener('click', () => {
    if (!confirm('Reset the coach passcode? You will be logged out and asked to set a new one.')) return;
    clearCoachPass();
    setRole(null);
    location.hash = '#/coach';
    route();
  });
  document.getElementById('set-import').addEventListener('click', () => document.getElementById('set-import-file').click());
  document.getElementById('set-import-file').addEventListener('change', e => {
    const f = e.target.files?.[0];
    if (!f) return;
    importData(f, err => {
      if (err) alert('Import failed: ' + err.message);
      else { alert('Imported.'); route(); }
    });
  });
  document.getElementById('set-reset').addEventListener('click', () => {
    if (!confirm('Erase ALL players, matches, sessions, and settings?')) return;
    if (!confirm('Really erase everything? This cannot be undone.')) return;
    resetData();
    route();
  });
}

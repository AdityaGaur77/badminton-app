/* ShuttleIQ Team Edition Core Application Logic */

// Storage & Key Constants
const STORAGE_KEY = 'shuttleiq_team_v2';
const SCORE_KEYS = ['footwork', 'smash', 'serve', 'defense', 'net', 'consistency'];
const SCORE_LABELS = {
  footwork: 'Footwork',
  smash: 'Smash',
  serve: 'Serve',
  defense: 'Defense',
  net: 'Net Play',
  consistency: 'Consistency'
};

// Seed/Demo Data for Tryouts and Roster
const SEED_PLAYERS = [
  {
    id: 101,
    name: 'Marcus Gideon',
    hand: 'Right',
    style: 'Doubles',
    skills: { footwork: 88, smash: 72, serve: 90, defense: 92, net: 95, consistency: 84 },
    tryoutScores: [],
    sessions: [
      {
        id: 1,
        label: 'Tryouts Net Control Drill',
        date: 'May 12, 2026',
        focus: 'net',
        type: 'Tryouts Grade',
        overallScore: 88,
        feedback: [
          { timestamp: '0:12', type: 'positive', title: 'Elite Net Roll', body: 'Tight net tumble rolling right over the tape. Excellent racquet face control.', tip: 'Practice maintaining this loose grip grip.' },
          { timestamp: '0:45', type: 'suggestion', title: 'Slightly high split step', body: 'Split step was a fraction too high, causing a 0.2s delay in forward push.', tip: 'Stay lower on the balls of your feet.' }
        ]
      }
    ]
  },
  {
    id: 102,
    name: 'Lee Zii Jia',
    hand: 'Right',
    style: 'Singles',
    skills: { footwork: 90, smash: 96, serve: 74, defense: 80, net: 78, consistency: 82 },
    tryoutScores: [],
    sessions: [
      {
        id: 2,
        label: 'Smash Alignment Session',
        date: 'May 18, 2026',
        focus: 'smash',
        type: 'AI Video Report',
        overallScore: 89,
        feedback: [
          { timestamp: '0:05', type: 'positive', title: 'Atomic Smash Power', body: 'Full body rotation generating massive whip speed. Contact point was well out in front.', tip: 'Ensure recovery footprint stays narrow.' },
          { timestamp: '0:22', type: 'critical', title: 'Unbalanced Landing', body: 'Landing foot slipped due to weight drifting too far backward.', tip: 'Engage core stability to land squarely on left foot.' }
        ]
      }
    ]
  },
  {
    id: 103,
    name: 'Akane Yamaguchi',
    hand: 'Right',
    style: 'Singles',
    skills: { footwork: 94, smash: 80, serve: 88, defense: 93, net: 86, consistency: 95 },
    tryoutScores: [],
    sessions: []
  },
  {
    id: 104,
    name: 'Yuta Watanabe',
    hand: 'Left',
    style: 'Doubles',
    skills: { footwork: 92, smash: 78, serve: 92, defense: 91, net: 94, consistency: 86 },
    tryoutScores: [],
    sessions: []
  },
  {
    id: 105,
    name: 'Pearly Tan',
    hand: 'Right',
    style: 'Doubles',
    skills: { footwork: 86, smash: 90, serve: 80, defense: 84, net: 82, consistency: 80 },
    tryoutScores: [],
    sessions: []
  }
];

// Pros Data for Benchmark Comparisons
const PROS = [
  {
    id: 'axelsen',
    name: 'Viktor Axelsen',
    country: 'Denmark',
    emoji: '🦁',
    style: 'Singles',
    traits: { footwork: 97, smash: 98, serve: 92, defense: 95, net: 90, consistency: 96 },
    tips: {
      footwork: 'Focus on early split-stepping. Reach at full extension instead of taking extra recovery steps.',
      smash: 'Incorporate shoulder rotation and high contact points to produce steep downward angles.',
      serve: 'Keep racquet setups quiet and uniform. Minimize pre-contact motion to disguise placement.',
      defense: 'Adopt a lower ready stance. Restrict defensive backswings and rely on compact redirect blocks.',
      net: 'Command the net early. Strike near the tape height to prevent looping returns.',
      consistency: 'Maintain identical swing geometry regardless of fatigue levels.'
    }
  },
  {
    id: 'sindhu',
    name: 'P.V. Sindhu',
    country: 'India',
    emoji: '⚡',
    style: 'Singles',
    traits: { footwork: 94, smash: 93, serve: 90, defense: 96, net: 88, consistency: 93 },
    tips: {
      footwork: 'Drive off the back foot with greater force. Stay lower through transition steps.',
      smash: 'Build kinetic power from early hip and core rotation. Whip racquet through contact.',
      serve: 'Establish a single repeatable ball toss rhythm. Avoid varying contact heights.',
      defense: 'Prioritize baseline-deep high lifts. Avoid risky counter-drives when off-balance.',
      net: 'Soften fingers at impact. Absorb shuttle velocity to force tight, tumbling nets.',
      consistency: 'Run prolonged shadow footwork sets to lock in motor habits.'
    }
  },
  {
    id: 'gideon',
    name: 'Kevin Sanjaya',
    country: 'Indonesia',
    emoji: '🎯',
    style: 'Doubles',
    traits: { footwork: 96, smash: 99, serve: 88, defense: 91, net: 97, consistency: 87 },
    tips: {
      footwork: 'Use ultra-compact adjustment steps. Avoid landing flat-footed in the midcourt.',
      smash: 'Unload dynamic jump smashes. Rotate core rapidly to secure smash angles.',
      serve: 'Shorten backswing. Mask flick serves with identical preparation styles.',
      defense: 'Use small wrist block movements. Leverage opponent speed to push down lines.',
      net: 'Hold racquet high at net tape level. Intercept early to kill rallies.',
      consistency: 'Hone primary contact mechanics under high-intensity drill settings.'
    }
  },
  {
    id: 'chen',
    name: 'Chen Long',
    country: 'China',
    emoji: '🐉',
    style: 'Singles',
    traits: { footwork: 95, smash: 91, serve: 95, defense: 97, net: 93, consistency: 98 },
    tips: {
      footwork: 'Instantly reset to center base after every shot. Make court resets automatic.',
      smash: 'Focus on precise, deep corner placement rather than raw terminal velocity.',
      serve: 'Intentionally vary service lengths and speeds to control the opening rally pace.',
      defense: 'Lift deep into rear boundaries to alleviate net pressuring.',
      net: 'Avoid premature net attacks. Patience at the net tape yields safer attack targets.',
      consistency: 'Repeat basic shadow-drills regularly. Muscle memory beats raw reaction speed.'
    }
  },
  {
    id: 'okuhara',
    name: 'Nozomi Okuhara',
    country: 'Japan',
    emoji: '🌸',
    style: 'Singles',
    traits: { footwork: 99, smash: 85, serve: 93, defense: 98, net: 94, consistency: 95 },
    tips: {
      footwork: 'Always maintain slight bouncing adjustment movement. Never stand static.',
      smash: 'Use cross-court angles and deceptive wrist drops if pure power is limited.',
      serve: 'Select a comfortable, low-release strike point. Standardize this release.',
      defense: 'Track the opponent\'s shoulder rotation to anticipate angles before racquet contact.',
      net: 'Take shuttles extremely early. Push them tightly over the net tape.',
      consistency: 'Maintain a calm mental baseline. Wear opponents down with zero-error rallies.'
    }
  }
];

const FOCUS_MAP = {
  overall: 'overall technique including footwork, swing, posture, positioning',
  footwork: 'footwork: court movement, split step, recovery, stance',
  smash: 'smash technique: jump, preparation, contact, power',
  serve: 'service: stance, release, racket angle, consistency',
  clear: 'overhead clear: posture, shoulder rotation, arm extension',
  net: 'net play: approach, racket face, body lean, touch'
};

// Global App State
let players = [];
let lineups = { d1a: null, d1b: null, d2a: null, d2b: null, s1: null, s2: null };
let activePage = 'roster';
let currentSortKey = 'overall';
let currentSortDir = 'desc';
let activeRosterSubtab = 'list';
let activeAssignSlot = null;
let activeCourtFormat = 'doubles';
let lastFeedback = [];
let lastFocusLabel = 'Overall';
let lastSessionLabel = '';

// Chart Instances
let playerTrendChart = null;

// Video/Audio Capture State
let videoFile = null;
let cameraStream = null;
let mediaRecorder = null;
let recordedBlob = null;
let recordedChunks = [];
let recInterval = null;
let recSeconds = 0;

const canvas = document.getElementById('canvas-el');
const ctx2d = canvas.getContext('2d');

/* Initialize Application */
document.addEventListener('DOMContentLoaded', () => {
  loadState();
  showPage('roster');
  loadPlayerSelects();
  renderLeaderboard();
  renderLineupCourt();
  initProsList();
});

// Toast Notification System
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  const icon = type === 'success' ? '⚡' : type === 'error' ? '⚠️' : 'ℹ️';
  toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
  
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// Local Storage Handlers
function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ players, lineups }));
}

function loadState() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (data && data.players && Array.isArray(data.players) && data.players.length > 0) {
      players = data.players.map(p => {
        if (!p.skills) p.skills = { footwork: 70, smash: 70, serve: 70, defense: 70, net: 70, consistency: 70 };
        SCORE_KEYS.forEach(k => {
          if (p.skills[k] === undefined) p.skills[k] = 70;
        });
        if (!p.sessions) p.sessions = [];
        return p;
      });
      lineups = Object.assign({ d1a: null, d1b: null, d2a: null, d2b: null, s1: null, s2: null }, data.lineups || {});
    } else {
      // Seed initial players
      players = JSON.parse(JSON.stringify(SEED_PLAYERS));
      lineups = { d1a: null, d1b: null, d2a: null, d2b: null, s1: null, s2: null };
      saveState();
    }
  } catch (e) {
    players = JSON.parse(JSON.stringify(SEED_PLAYERS));
    lineups = { d1a: null, d1b: null, d2a: null, d2b: null, s1: null, s2: null };
    saveState();
  }
}

// Navigation / Tabs Routing
function showPage(pageId) {
  document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
  
  const activeBtn = document.getElementById(`nav-${pageId}`);
  if (activeBtn) activeBtn.classList.add('active');
  
  const activePageEl = document.getElementById(`page-${pageId}`);
  if (activePageEl) activePageEl.classList.add('active');
  
  activePage = pageId;
  
  // Tab-specific trigger loads
  if (pageId === 'roster') {
    renderLeaderboard();
  } else if (pageId === 'lineups') {
    renderLineupCourt();
  } else if (pageId === 'insights') {
    populateDropdown('insights-player-select', 'insights');
    loadPlayerInsights();
  } else if (pageId === 'analyze') {
    populateDropdown('analyze-player-select', 'analyze');
    populateDropdown('analyze-player-select-cam', 'analyze');
  } else if (pageId === 'compare') {
    populateDropdown('compare-player-select', 'compare');
    selectPro(null);
  }
}

function switchRosterSubTab(subtabId) {
  document.getElementById('roster-subtab-list').classList.toggle('active', subtabId === 'list');
  document.getElementById('roster-subtab-drill').classList.toggle('active', subtabId === 'drill');
  
  document.getElementById('subtab-list').classList.toggle('active', subtabId === 'list');
  document.getElementById('subtab-drill').classList.toggle('active', subtabId === 'drill');
  
  activeRosterSubtab = subtabId;
  if (subtabId === 'drill') {
    populateDropdown('drill-player-select', 'drill');
    loadPlayerDrillValues();
  } else {
    renderLeaderboard();
  }
}

function switchAnalyzeTab(tabId, btn) {
  document.querySelectorAll('#page-analyze .tab-btn').forEach(node => node.classList.remove('active'));
  btn.classList.add('active');
  
  document.getElementById('analyze-tab-upload').classList.toggle('active', tabId === 'upload');
  document.getElementById('analyze-tab-camera').classList.toggle('active', tabId === 'camera');
}

// Populate Select Dropdowns helper
function populateDropdown(selectId, mode) {
  const select = document.getElementById(selectId);
  if (!select) return;
  
  select.innerHTML = players.map(p => `<option value="${p.id}">${p.name} (${p.style})</option>`).join('');
  
  // Set default placeholder if no players
  if (players.length === 0) {
    select.innerHTML = '<option value="">No players added yet</option>';
  }
}

function loadPlayerSelects() {
  populateDropdown('insights-player-select', 'insights');
  populateDropdown('compare-player-select', 'compare');
  populateDropdown('drill-player-select', 'drill');
  populateDropdown('analyze-player-select', 'analyze');
  populateDropdown('analyze-player-select-cam', 'analyze');
}

/* Modals Handlers */
function openAddPlayerModal() {
  document.getElementById('add-player-modal').classList.add('active');
}

function closeAddPlayerModal() {
  document.getElementById('add-player-modal').classList.remove('active');
  // Reset fields
  document.getElementById('new-player-name').value = '';
}

function createNewPlayer() {
  const name = document.getElementById('new-player-name').value.trim();
  const hand = document.getElementById('new-player-hand').value;
  const style = document.getElementById('new-player-style').value;
  
  if (!name) {
    showToast('Player name is required!', 'error');
    return;
  }
  
  // Grab initial skills
  const skills = {
    footwork: Math.min(100, Math.max(10, Math.round(Number(document.getElementById('init-footwork').value) * 10))),
    smash: Math.min(100, Math.max(10, Math.round(Number(document.getElementById('init-smash').value) * 10))),
    serve: Math.min(100, Math.max(10, Math.round(Number(document.getElementById('init-serve').value) * 10))),
    defense: Math.min(100, Math.max(10, Math.round(Number(document.getElementById('init-defense').value) * 10))),
    net: Math.min(100, Math.max(10, Math.round(Number(document.getElementById('init-net').value) * 10))),
    consistency: Math.min(100, Math.max(10, Math.round(Number(document.getElementById('init-consistency').value) * 10)))
  };
  
  const newPlayer = {
    id: Date.now(),
    name,
    hand,
    style,
    skills,
    tryoutScores: [],
    sessions: []
  };
  
  players.push(newPlayer);
  saveState();
  closeAddPlayerModal();
  loadPlayerSelects();
  renderLeaderboard();
  showToast(`Successfully added ${name} to team roster!`);
}

function deletePlayer(id, event) {
  if (event) event.stopPropagation();
  const player = players.find(p => p.id === id);
  if (!player) return;
  
  if (confirm(`Are you sure you want to remove ${player.name} from the team roster?`)) {
    // Remove from lineups
    for (let slot in lineups) {
      if (lineups[slot] === id) lineups[slot] = null;
    }
    
    players = players.filter(p => p.id !== id);
    saveState();
    loadPlayerSelects();
    renderLeaderboard();
    renderLineupCourt();
    showToast(`Removed ${player.name} from roster.`, 'error');
  }
}

/* Roster Leaderboard Module */
function calculateOverall(skills) {
  if (!skills) return 70;
  const sum = Object.values(skills).reduce((a, b) => a + b, 0);
  return Math.round(sum / Object.keys(skills).length);
}

function renderLeaderboard() {
  const tbody = document.getElementById('leaderboard-tbody');
  if (!tbody) return;
  
  if (players.length === 0) {
    tbody.innerHTML = `<tr><td colspan="11" style="text-align:center; padding: 40px 0; color:var(--text-muted);">No players in roster. Click 'Add Player' to start tryouts!</td></tr>`;
    return;
  }
  
  // Sort players list
  let sorted = [...players].sort((a, b) => {
    let valA, valB;
    
    if (SCORE_KEYS.includes(currentSortKey)) {
      valA = a.skills[currentSortKey] || 0;
      valB = b.skills[currentSortKey] || 0;
    } else if (currentSortKey === 'overall') {
      valA = calculateOverall(a.skills);
      valB = calculateOverall(b.skills);
    } else {
      valA = String(a[currentSortKey] || '').toLowerCase();
      valB = String(b[currentSortKey] || '').toLowerCase();
    }
    
    if (valA < valB) return currentSortDir === 'asc' ? -1 : 1;
    if (valA > valB) return currentSortDir === 'asc' ? 1 : -1;
    return 0;
  });
  
  // Update header classes
  document.querySelectorAll('th').forEach(th => {
    th.classList.remove('sort-active');
  });
  const activeTh = document.getElementById(`th-${currentSortKey}`);
  if (activeTh) activeTh.classList.add('sort-active');
  
  // Render
  tbody.innerHTML = sorted.map(p => {
    const overall = calculateOverall(p.skills);
    const overallClass = overall >= 85 ? 'high' : overall >= 70 ? 'mid' : 'low';
    
    return `
      <tr onclick="goToPlayerProfile(${p.id})">
        <td>
          <div class="player-profile-cell">
            <div class="avatar">${p.hand === 'Left' ? '⚡' : '🏸'}</div>
            <div class="player-details-mini">
              <span class="player-name">${escapeHtml(p.name)}</span>
              <span class="player-meta-mini">${p.sessions.length} evaluation sessions</span>
            </div>
          </div>
        </td>
        <td><span class="pill pill-muted">${p.hand}</span></td>
        <td><span class="pill ${p.style === 'Singles' ? 'pill-lime' : p.style === 'Doubles' ? 'pill-cyan' : 'pill-muted'}">${p.style}</span></td>
        <td><span class="score-badge ${overallClass}">${overall}</span></td>
        <td>${p.skills.footwork}</td>
        <td>${p.skills.smash}</td>
        <td>${p.skills.serve}</td>
        <td>${p.skills.defense}</td>
        <td>${p.skills.net}</td>
        <td>${p.skills.consistency}</td>
        <td>
          <button class="btn btn-danger btn-sm" onclick="deletePlayer(${p.id}, event)" style="padding: 4px 8px;">✕</button>
        </td>
      </tr>
    `;
  }).join('');
}

function sortLeaderboard(key) {
  if (currentSortKey === key) {
    currentSortDir = currentSortDir === 'asc' ? 'desc' : 'asc';
  } else {
    currentSortKey = key;
    currentSortDir = key === 'name' || key === 'hand' || key === 'style' ? 'asc' : 'desc';
  }
  renderLeaderboard();
}

function filterRosterTable() {
  const query = document.getElementById('roster-search').value.toLowerCase().trim();
  const rows = document.querySelectorAll('#leaderboard-tbody tr');
  
  rows.forEach(row => {
    const name = row.querySelector('.player-name')?.textContent.toLowerCase() || '';
    if (name.includes(query)) {
      row.style.display = '';
    } else {
      row.style.display = 'none';
    }
  });
}

function goToPlayerProfile(id) {
  showPage('insights');
  document.getElementById('insights-player-select').value = id;
  loadPlayerInsights();
}

/* Tryout Scorecard (Drill Grader) Module */
function loadPlayerDrillValues() {
  const playerId = Number(document.getElementById('drill-player-select').value);
  const player = players.find(p => p.id === playerId);
  if (!player) return;
  
  // Set ranges to current core skills / 10
  const sliders = ['footwork', 'smash', 'serve', 'defense', 'net', 'consistency'];
  sliders.forEach(key => {
    const val = Math.round((player.skills[key] || 70) / 10);
    const el = document.getElementById(`drill-${key}`);
    const valEl = document.getElementById(`drill-${key}-val`);
    if (el && valEl) {
      el.value = val;
      valEl.textContent = val;
    }
  });
}

function updateRangeLabel(slider, labelId) {
  document.getElementById(labelId).textContent = slider.value;
}

function submitDrillGrades() {
  const playerId = Number(document.getElementById('drill-player-select').value);
  const player = players.find(p => p.id === playerId);
  if (!player) {
    showToast('Select a valid player first!', 'error');
    return;
  }
  
  // Get drill values
  const inputDrills = {
    footwork: Math.round(Number(document.getElementById('drill-footwork').value) * 10),
    smash: Math.round(Number(document.getElementById('drill-smash').value) * 10),
    serve: Math.round(Number(document.getElementById('drill-serve').value) * 10),
    defense: Math.round(Number(document.getElementById('drill-defense').value) * 10),
    net: Math.round(Number(document.getElementById('drill-net').value) * 10),
    consistency: Math.round(Number(document.getElementById('drill-consistency').value) * 10)
  };
  
  // We record this session in history
  const overall = calculateOverall(inputDrills);
  const session = {
    id: Date.now(),
    label: `Drill Tryout Assessment`,
    date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    focus: 'overall',
    type: 'Tryouts Grade',
    overallScore: overall,
    feedback: [
      { timestamp: 'Drill Set 1', type: 'suggestion', title: 'Grade Recorded', body: `Coach tryout grades logged. Overal rating: ${overall}.`, tip: 'Target drills in weaker zones.' }
    ]
  };
  
  player.sessions.push(session);
  
  // Update core skills dynamically as a weighted rolling average: (Current Core Skills * 2 + New Drill Grades) / 3
  SCORE_KEYS.forEach(key => {
    const currentVal = player.skills[key] || 70;
    const newVal = inputDrills[key];
    player.skills[key] = Math.round((currentVal * 2 + newVal) / 3);
  });
  
  saveState();
  showToast(`Logged tryout drill grades for ${player.name}. Core skills updated!`);
  
  // Swap subtabs to show updated leaderboard
  switchRosterSubTab('list');
}

/* Court Roster planner & Pair Chemistry Module */
function toggleCourtFormat(format) {
  activeCourtFormat = format;
  document.getElementById('btn-toggle-doubles').classList.toggle('active', format === 'doubles');
  document.getElementById('btn-toggle-singles').classList.toggle('active', format === 'singles');
  
  // Roster buttons styling
  document.getElementById('btn-toggle-doubles').style.borderColor = format === 'doubles' ? 'var(--lime)' : 'var(--border-bright)';
  document.getElementById('btn-toggle-singles').style.borderColor = format === 'singles' ? 'var(--lime)' : 'var(--border-bright)';
  
  // Show / hide court zones
  const doublesSlots = ['slot-d1a', 'slot-d1b', 'slot-d2a', 'slot-d2b'];
  const singlesSlots = ['slot-s1', 'slot-s2'];
  
  doublesSlots.forEach(id => document.getElementById(id).style.display = format === 'doubles' ? 'flex' : 'none');
  singlesSlots.forEach(id => document.getElementById(id).style.display = format === 'singles' ? 'flex' : 'none');
  
  // Chemistry boards
  document.getElementById('panel-singles-chem').style.display = format === 'singles' ? 'block' : 'none';
  
  renderLineupCourt();
}

function renderLineupCourt() {
  const slots = ['d1a', 'd1b', 'd2a', 'd2b', 's1', 's2'];
  
  slots.forEach(slot => {
    const element = document.getElementById(`slot-${slot}`);
    if (!element) return;
    
    const playerId = lineups[slot];
    const player = players.find(p => p.id === playerId);
    
    const circle = document.getElementById(`circle-${slot}`);
    const label = document.getElementById(`label-${slot}`);
    
    if (player) {
      element.classList.add('occupied');
      circle.textContent = getInitials(player.name);
      circle.style.backgroundColor = slot.startsWith('d2') ? 'rgba(0, 229, 255, 0.15)' : 'rgba(204, 255, 0, 0.15)';
      circle.style.borderColor = slot.startsWith('d2') ? 'var(--cyan)' : 'var(--lime)';
      label.textContent = player.name;
    } else {
      element.classList.remove('occupied');
      circle.textContent = '+';
      circle.style.backgroundColor = '';
      circle.style.borderColor = '';
      label.textContent = slot.toUpperCase().replace('D1A', 'D1 Back (A)').replace('D1B', 'D1 Front (P)').replace('D2A', 'D2 Back (A)').replace('D2B', 'D2 Front (P)').replace('S1', 'Singles 1').replace('S2', 'Singles 2');
    }
  });
  
  calculateChemistry();
}

function getInitials(name = '') {
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
}

function clearLineup() {
  if (confirm('Are you sure you want to clear the entire lineup?')) {
    lineups = { d1a: null, d1b: null, d2a: null, d2b: null, s1: null, s2: null };
    saveState();
    renderLineupCourt();
    showToast('Court lineup cleared.', 'error');
  }
}

// Assignment Modal Logic
function openAssignModal(slotId) {
  activeAssignSlot = slotId;
  const overlay = document.getElementById('assign-modal');
  const title = document.getElementById('assign-modal-title');
  const body = document.getElementById('assign-modal-body');
  
  const roleName = {
    d1a: 'Doubles 1 Back Court Attacker',
    d1b: 'Doubles 1 Front Court Playmaker',
    d2a: 'Doubles 2 Back Court Attacker',
    d2b: 'Doubles 2 Front Court Playmaker',
    s1: 'Singles 1 Position',
    s2: 'Singles 2 Position'
  }[slotId];
  
  title.textContent = `Assign Player to ${roleName}`;
  overlay.classList.add('active');
  
  // Generate list sorted by suitability fit
  let list = players.map(p => {
    const fit = calculateRoleFit(p, slotId);
    return { player: p, fit };
  }).sort((a, b) => b.fit - a.fit);
  
  let currentSelection = lineups[slotId];
  
  let html = '';
  if (currentSelection) {
    html += `
      <div class="player-select-row" onclick="assignPlayerToSlot('${slotId}', null)" style="border-color: var(--critical); margin-bottom: 16px;">
        <div style="display:flex; align-items:center; gap:10px;">
          <div class="avatar" style="color:var(--critical);">✕</div>
          <div class="player-details-mini"><span class="player-name">Unassign Current Player</span></div>
        </div>
        <span class="pill btn-danger btn-sm">Remove</span>
      </div>
    `;
  }
  
  html += list.map(item => {
    const p = item.player;
    const isOccupiedInAnotherSlot = Object.values(lineups).includes(p.id) && lineups[slotId] !== p.id;
    const currentClass = lineups[slotId] === p.id ? 'style="border-color:var(--lime); background:rgba(204,255,0,0.02);"' : '';
    
    return `
      <div class="player-select-row" onclick="${isOccupiedInAnotherSlot ? `showToast('${p.name} is already assigned elsewhere!', 'error')` : `assignPlayerToSlot('${slotId}', ${p.id})`}" ${currentClass} style="${isOccupiedInAnotherSlot ? 'opacity:0.4; cursor:not-allowed;' : ''}">
        <div style="display:flex; align-items:center; gap:10px;">
          <div class="avatar">${getInitials(p.name)}</div>
          <div class="player-details-mini">
            <span class="player-name">${escapeHtml(p.name)}</span>
            <span class="player-meta-mini">${p.style} · Hand: ${p.hand}</span>
          </div>
        </div>
        <div style="text-align:right;">
          <div class="chem-badge" style="font-size:16px;">${item.fit}%</div>
          <span class="player-meta-mini">Fit Score</span>
        </div>
      </div>
    `;
  }).join('');
  
  body.innerHTML = html || `<p style="color:var(--text-muted);">Add players to team roster first!</p>`;
}

function closeAssignModal() {
  document.getElementById('assign-modal').classList.remove('active');
  activeAssignSlot = null;
}

function assignPlayerToSlot(slotId, playerId) {
  lineups[slotId] = playerId;
  saveState();
  closeAssignModal();
  renderLineupCourt();
  
  if (playerId) {
    const p = players.find(x => x.id === playerId);
    showToast(`Assigned ${p.name} to slot!`);
  }
}

// Fit Percentage Calculator helper
function calculateRoleFit(player, slotId) {
  const sk = player.skills;
  
  if (slotId === 's1' || slotId === 's2') {
    // Singles: high Footwork (30%), Consistency (30%), Defense (20%), Stamina/Overall (20%)
    const score = (sk.footwork * 0.35) + (sk.consistency * 0.35) + (sk.defense * 0.30);
    return Math.round(score);
  }
  
  if (slotId === 'd1b' || slotId === 'd2b') {
    // Front Court Playmaker: Net play (40%), Serve (30%), Defense/Reflexes (30%)
    const score = (sk.net * 0.40) + (sk.serve * 0.30) + (sk.defense * 0.30);
    return Math.round(score);
  }
  
  if (slotId === 'd1a' || slotId === 'd2a') {
    // Back Court Attacker: Smash (40%), Consistency (30%), Footwork (30%)
    const score = (sk.smash * 0.40) + (sk.consistency * 0.30) + (sk.footwork * 0.30);
    return Math.round(score);
  }
  return 70;
}

// Chemistry calculation algorithm
function calculateChemistry() {
  const calcPairChem = (attackerId, playmakerId) => {
    if (!attackerId || !playmakerId) return { pct: 0, desc: 'Assign both back-court and front-court players to index chemistry.' };
    
    const att = players.find(p => p.id === attackerId);
    const play = players.find(p => p.id === playmakerId);
    
    if (!att || !play) return { pct: 0, desc: 'Error retrieving players.' };
    
    let score = 75; // Baseline chemistry
    let reasons = [];
    
    // Complementary Roles Synergy Check
    // Attacker should have high smash. Playmaker should have high net play
    const attSmash = att.skills.smash;
    const playNet = play.skills.net;
    
    if (attSmash >= 85 && playNet >= 85) {
      score += 12;
      reasons.push('Perfect attack-and-net synergy! Smasher generates heavy drops, Net playmaker kills the returns.');
    } else if (attSmash >= 80 && playNet >= 80) {
      score += 7;
      reasons.push('Complementary net-touch and rear-smash balance matches up well.');
    } else if (attSmash < 65 && playNet < 65) {
      score -= 10;
      reasons.push('Dual defensive style: Pair lacks aggressive finishing options at net tape or rear baseline.');
    }
    
    // Handedness Coverage Check
    if (att.hand !== play.hand) {
      score += 6;
      reasons.push('Left / Right Handed cross-court configuration. Seamless defensive coverages without backhand gaps!');
    } else {
      reasons.push(`Double ${att.hand}-handed pairing. Ensure clear mid-court communication rules.`);
    }
    
    // Serves / Defense coverage
    if (play.skills.serve >= 85 && att.skills.defense >= 85) {
      score += 7;
      reasons.push('Strong opener control. Elite low serves supported by solid rear counter-lifts.');
    }
    
    // Cap at 100, min at 30
    const finalScore = Math.min(100, Math.max(30, score));
    return {
      pct: finalScore,
      desc: reasons.join(' ')
    };
  };
  
  // D1 Pairing
  const d1Chem = calcPairChem(lineups.d1a, lineups.d1b);
  const p1a = players.find(p => p.id === lineups.d1a);
  const p1b = players.find(p => p.id === lineups.d1b);
  document.getElementById('d1-pair-names').textContent = (p1a && p1b) ? `${p1b.name} + ${p1a.name}` : 'Roster Assignment Incomplete';
  document.getElementById('d1-chem-pct').textContent = `${d1Chem.pct}%`;
  document.getElementById('d1-chem-bar').style.width = `${d1Chem.pct}%`;
  document.getElementById('d1-chem-desc').textContent = d1Chem.desc;
  
  // D2 Pairing
  const d2Chem = calcPairChem(lineups.d2a, lineups.d2b);
  const p2a = players.find(p => p.id === lineups.d2a);
  const p2b = players.find(p => p.id === lineups.d2b);
  document.getElementById('d2-pair-names').textContent = (p2a && p2b) ? `${p2b.name} + ${p2a.name}` : 'Roster Assignment Incomplete';
  document.getElementById('d2-chem-pct').textContent = `${d2Chem.pct}%`;
  document.getElementById('d2-chem-bar').style.width = `${d2Chem.pct}%`;
  document.getElementById('d2-chem-desc').textContent = d2Chem.desc;
  
  // Singles Estimates
  if (activeCourtFormat === 'singles') {
    const s1 = players.find(p => p.id === lineups.s1);
    const s2 = players.find(p => p.id === lineups.s2);
    
    const getSinglesDesc = () => {
      if (!s1 && !s2) return 'Assign players to Singles 1 & 2 slots to evaluate singles ratings.';
      let lines = [];
      if (s1) {
        const fit1 = calculateRoleFit(s1, 's1');
        lines.push(`Singles 1 (${s1.name}): Elite fit index ${fit1}%. Strong consistency makes them an ideal lead.`);
      }
      if (s2) {
        const fit2 = calculateRoleFit(s2, 's2');
        lines.push(`Singles 2 (${s2.name}): Backup fit index ${fit2}%. Good standard coverage.`);
      }
      return lines.join('<br><br>');
    };
    
    document.getElementById('singles-chem-desc').innerHTML = getSinglesDesc();
  }
}

/* Player Insights Module & dynamically rendered SVG Radar Chart */
function loadPlayerInsights() {
  const select = document.getElementById('insights-player-select');
  const empty = document.getElementById('insights-empty');
  const body = document.getElementById('insights-body');
  
  if (players.length === 0 || !select.value) {
    empty.style.display = 'block';
    body.style.display = 'none';
    return;
  }
  
  empty.style.display = 'none';
  body.style.display = 'block';
  
  const player = players.find(p => p.id === Number(select.value));
  if (!player) return;
  
  // Render Radar Chart
  drawRadarChart(player);
  
  // Render Matches
  const singles = calculateRoleFit(player, 's1');
  const front = calculateRoleFit(player, 'd1b');
  const back = calculateRoleFit(player, 'd1a');
  
  document.getElementById('rec-singles-pct').textContent = `${singles}%`;
  document.getElementById('rec-front-pct').textContent = `${front}%`;
  document.getElementById('rec-back-pct').textContent = `${back}%`;
  
  // Highlight best recommendation
  const recs = [
    { id: 'rec-singles', score: singles },
    { id: 'rec-front', score: front },
    { id: 'rec-back', score: back }
  ].sort((a, b) => b.score - a.score);
  
  ['rec-singles', 'rec-front', 'rec-back'].forEach(id => {
    document.getElementById(id).classList.remove('recommended');
  });
  document.getElementById(recs[0].id).classList.add('recommended');
  
  // Action Plan
  generateCoachingActionPlan(player);
  
  // Render evaluation sessions table
  renderPlayerSessionsTable(player);
  
  // Render chart trends
  renderPlayerTrendChart(player);
}

// Custom responsive SVG radar chart generator
function drawRadarChart(player) {
  const svg = document.getElementById('radar-chart-svg');
  if (!svg) return;
  
  const R = 110; // Max radius
  const skills = SCORE_KEYS;
  const numAxis = skills.length;
  
  // Calculate polar angles (Footwork at top 12 o'clock = -90deg)
  const getAngle = (i) => -Math.PI / 2 + (i * 2 * Math.PI / numAxis);
  
  let gridPolys = '';
  // 5 grid levels: 20%, 40%, 60%, 80%, 100%
  for (let level = 1; level <= 5; level++) {
    const factor = level / 5;
    const pts = [];
    for (let i = 0; i < numAxis; i++) {
      const angle = getAngle(i);
      const x = Math.round(R * factor * Math.cos(angle));
      const y = Math.round(R * factor * Math.sin(angle));
      pts.push(`${x},${y}`);
    }
    gridPolys += `<polygon points="${pts.join(' ')}" fill="none" class="radar-grid-line" />\n`;
  }
  
  // Web Axes lines
  let axesLines = '';
  let labels = '';
  for (let i = 0; i < numAxis; i++) {
    const angle = getAngle(i);
    const x = Math.round(R * Math.cos(angle));
    const y = Math.round(R * Math.sin(angle));
    axesLines += `<line x1="0" y1="0" x2="${x}" y2="${y}" class="radar-axis" />\n`;
    
    // Label offset
    const lx = Math.round((R + 25) * Math.cos(angle));
    const ly = Math.round((R + 12) * Math.sin(angle)) + 4; // slight vertical adjustment
    labels += `<text x="${lx}" y="${ly}" class="radar-label">${SCORE_LABELS[skills[i]]}</text>\n`;
  }
  
  // Player polygon points
  const playerPts = [];
  for (let i = 0; i < numAxis; i++) {
    const angle = getAngle(i);
    const val = player.skills[skills[i]] || 70;
    const x = Math.round(R * (val / 100) * Math.cos(angle));
    const y = Math.round(R * (val / 100) * Math.sin(angle));
    playerPts.push(`${x},${y}`);
  }
  const playerPoly = `<polygon points="${playerPts.join(' ')}" class="radar-polygon" />\n`;
  
  // Web dots
  let playerDots = '';
  for (let i = 0; i < numAxis; i++) {
    const angle = getAngle(i);
    const val = player.skills[skills[i]] || 70;
    const x = Math.round(R * (val / 100) * Math.cos(angle));
    const y = Math.round(R * (val / 100) * Math.sin(angle));
    playerDots += `<circle cx="${x}" cy="${y}" r="4.5" fill="var(--lime)" stroke="var(--surface-deep)" stroke-width="1.5" />\n`;
  }
  
  // Combine all SVG items
  svg.innerHTML = `
    <!-- Concentric Web Lines -->
    ${gridPolys}
    <!-- Web Axes -->
    ${axesLines}
    <!-- Player Polygon -->
    ${playerPoly}
    <!-- Axis Labels -->
    ${labels}
    <!-- Player Points dots -->
    ${playerDots}
  `;
}

function generateCoachingActionPlan(player) {
  // Find weakest skill
  let weakest = SCORE_KEYS.reduce((best, key) => (player.skills[key] < player.skills[best] ? key : best), SCORE_KEYS[0]);
  const score = player.skills[weakest];
  
  const plans = {
    footwork: {
      title: 'Hone splitting step and lateral reach',
      drill: 'Perform 4-corner shadow shadow-drills. Set metronome to 140 BPM and complete 3 sets of 12 rallies. Ensure hips land low on splits.'
    },
    smash: {
      title: 'Steepness and wrist pronation release',
      drill: 'Practice standing jump drops focusing entirely on racquet head deceleration and steep wrist snaps. Complete 50 reps per drill session.'
    },
    serve: {
      title: 'Repeatable low serve index control',
      drill: 'Perform low serves over high nets into short service lines. Aim to land at least 25 serves in a row inside the tight 10cm safety zone.'
    },
    defense: {
      title: 'Lower body stance load blocks',
      drill: 'Practice doubles drive blocks against high-velocity smashes. Restrict rear racquet extensions; prioritize soft, push counterattacks.'
    },
    net: {
      title: 'Net touch rolling controls',
      drill: 'Practice tight net tumbles by absorbing incoming smash speeds. Complete 3 sets of 20 net tumbles, striving for standard rolls.'
    },
    consistency: {
      title: 'Prolonged high-intensity continuous drives',
      drill: 'Maintain 20-shot continuous mid-court drives. Focus on core stability and posture balance as fatigue increases.'
    }
  };
  
  const activePlan = plans[weakest] || plans.consistency;
  document.getElementById('insight-weak-title').textContent = `Priority Focus: ${SCORE_LABELS[weakest]} (Rating: ${score})`;
  document.getElementById('insight-weak-drill').textContent = activePlan.drill;
}

function renderPlayerSessionsTable(player) {
  const tbody = document.getElementById('insights-sessions-tbody');
  if (!tbody) return;
  
  if (player.sessions.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding: 20px 0; color:var(--text-muted);">No assessments recorded for ${player.name} yet.</td></tr>`;
    return;
  }
  
  tbody.innerHTML = player.sessions.map((s, index) => `
    <tr>
      <td>${s.date}</td>
      <td><span class="pill pill-lime">${s.type}</span></td>
      <td><strong>${s.overallScore}</strong></td>
      <td>
        <button class="btn btn-secondary btn-sm" onclick="viewHistoryAssessment(${player.id}, ${s.id})" style="padding:2px 8px;">View</button>
      </td>
    </tr>
  `).join('');
}

function viewHistoryAssessment(playerId, sessionId) {
  const p = players.find(x => x.id === playerId);
  if (!p) return;
  const s = p.sessions.find(x => x.id === sessionId);
  if (!s) return;
  
  // Show analyze panel results
  showPage('analyze');
  document.getElementById('results-panel').style.display = 'block';
  document.getElementById('results-panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
  
  // Fake feedback loaded
  lastFeedback = s.feedback;
  lastFocusLabel = s.focus;
  lastSessionLabel = s.label;
  
  // Populate results
  renderFeedback(s.feedback);
  document.getElementById('pdf-btn').style.display = 'inline-flex';
}

function renderPlayerTrendChart(player) {
  if (playerTrendChart) {
    playerTrendChart.destroy();
    playerTrendChart = null;
  }
  
  const ctx = document.getElementById('player-trend-chart');
  if (!ctx) return;
  
  const sessions = player.sessions || [];
  if (sessions.length === 0) {
    // Render flat baseline if no sessions
    const baselineChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: ['Baseline'],
        datasets: [{
          label: 'Overall Rating',
          data: [calculateOverall(player.skills)],
          borderColor: '#CCFF00',
          backgroundColor: 'rgba(204, 255, 0, 0.08)',
          tension: 0.3,
          pointRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { color: 'rgba(255, 255, 255, 0.03)' }, ticks: { color: '#888' } },
          y: { min: 40, max: 100, grid: { color: 'rgba(255, 255, 255, 0.03)' }, ticks: { color: '#888' } }
        }
      }
    });
    playerTrendChart = baselineChart;
    return;
  }
  
  const chartData = {
    labels: sessions.map(s => s.date),
    datasets: [{
      label: 'Performance Rating',
      data: sessions.map(s => s.overallScore),
      borderColor: '#CCFF00',
      backgroundColor: 'rgba(204, 255, 0, 0.08)',
      tension: 0.35,
      pointRadius: 5,
      borderWidth: 2
    }]
  };
  
  playerTrendChart = new Chart(ctx, {
    type: 'line',
    data: chartData,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: 'rgba(255, 255, 255, 0.03)' }, ticks: { color: '#888' } },
        y: { min: 50, max: 100, grid: { color: 'rgba(255, 255, 255, 0.03)' }, ticks: { color: '#888' } }
      }
    }
  });
}

/* Video Analyzer & AI Coaching Module */
// API Key visibility toggle
function toggleKeyVisibility() {
  const input = document.getElementById('api-key');
  input.type = input.type === 'password' ? 'text' : 'password';
}

const dropZone = document.getElementById('drop-zone');
if (dropZone) {
  dropZone.addEventListener('dragover', e => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
  dropZone.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('video/')) loadVideo(file);
  });
}

const fileInput = document.getElementById('file-input');
if (fileInput) {
  fileInput.addEventListener('change', e => {
    const file = e.target.files?.[0];
    if (file) loadVideo(file);
  });
}

function loadVideo(file) {
  if (!file.type.startsWith('video/')) {
    showToast('Choose a valid video file!', 'error');
    return;
  }
  
  videoFile = file;
  const preview = document.getElementById('video-preview');
  preview.src = URL.createObjectURL(file);
  preview.style.display = 'block';
  dropZone.style.display = 'none';
  
  document.getElementById('video-info').style.display = 'block';
  document.getElementById('settings-upload').style.display = 'block';
  document.getElementById('analyze-btn').style.display = 'block';
  document.getElementById('vid-name').textContent = file.name;
  
  preview.onloadedmetadata = () => {
    document.getElementById('vid-dur').textContent = fmtTime(Math.round(preview.duration || 0));
  };
}

// Camera stream record modules
async function startCamera() {
  if (!navigator.mediaDevices?.getUserMedia) {
    showToast('This browser does not support camera capture.', 'error');
    return;
  }
  
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
    const live = document.getElementById('cam-live');
    live.srcObject = cameraStream;
    live.style.display = 'block';
    document.getElementById('cam-placeholder').style.display = 'none';
    document.getElementById('cam-controls').style.display = 'flex';
  } catch (error) {
    showToast(`Camera access error: ${error.message}`, 'error');
  }
}

function stopCamera() {
  if (mediaRecorder?.state === 'recording') mediaRecorder.stop();
  if (cameraStream) cameraStream.getTracks().forEach(track => track.stop());
  cameraStream = null;
  clearInterval(recInterval);
  
  document.getElementById('cam-live').style.display = 'none';
  document.getElementById('cam-controls').style.display = 'none';
  document.getElementById('cam-placeholder').style.display = 'block';
  document.getElementById('rec-timer').style.display = 'none';
}

function toggleRecord() {
  if (!cameraStream) {
    showToast('Enable camera first!', 'error');
    return;
  }
  
  const btn = document.getElementById('rec-btn');
  if (!mediaRecorder || mediaRecorder.state === 'inactive') {
    recordedChunks = [];
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm';
    
    mediaRecorder = new MediaRecorder(cameraStream, { mimeType });
    mediaRecorder.ondataavailable = e => {
      if (e.data.size > 0) recordedChunks.push(e.data);
    };
    
    mediaRecorder.onstop = () => {
      recordedBlob = new Blob(recordedChunks, { type: 'video/webm' });
      const recorded = document.getElementById('cam-recorded');
      recorded.src = URL.createObjectURL(recordedBlob);
      recorded.style.display = 'block';
      
      document.getElementById('settings-camera').style.display = 'block';
      document.getElementById('analyze-cam-btn').style.display = 'block';
    };
    
    mediaRecorder.start(100);
    btn.textContent = 'Stop Recording';
    btn.classList.add('recording');
    
    recSeconds = 0;
    document.getElementById('rec-timer').style.display = 'block';
    document.getElementById('rec-timer').textContent = '0:00';
    recInterval = setInterval(() => {
      recSeconds += 1;
      document.getElementById('rec-timer').textContent = fmtTime(recSeconds);
    }, 1000);
    return;
  }
  
  mediaRecorder.stop();
  btn.textContent = 'Record Drill';
  btn.classList.remove('recording');
  clearInterval(recInterval);
  document.getElementById('rec-timer').style.display = 'none';
}

// Frame extractor using hidden canvas
async function extractFrames(videoEl, fpm) {
  if (!Number.isFinite(videoEl.duration) || videoEl.duration <= 0) {
    throw new Error('Video metadata is not ready yet.');
  }
  
  const duration = videoEl.duration;
  const interval = 60 / fpm;
  const times = [];
  const frames = [];
  
  for (let t = 0; t < duration; t += interval) {
    times.push(Math.min(t, Math.max(0, duration - 0.1)));
  }
  if (!times.length) times.push(0);
  
  for (const time of times) {
    await new Promise(resolve => {
      videoEl.currentTime = time;
      videoEl.onseeked = () => {
        canvas.width = 480;
        canvas.height = 270;
        ctx2d.drawImage(videoEl, 0, 0, 480, 270);
        frames.push({
          time,
          b64: canvas.toDataURL('image/jpeg', 0.72).split(',')[1]
        });
        resolve();
      };
    });
  }
  return frames;
}

// API Analysis trigger
async function runAnalysis(source) {
  const isUpload = source === 'upload';
  const videoEl = document.getElementById(isUpload ? 'video-preview' : 'cam-recorded');
  const button = document.getElementById(isUpload ? 'analyze-btn' : 'analyze-cam-btn');
  const apiKey = document.getElementById('api-key').value.trim();
  const model = document.getElementById('model-select').value;
  const fpm = Number(document.getElementById(isUpload ? 'fpm-slider' : 'fpm-slider-cam').value);
  
  const focusSelect = document.getElementById(isUpload ? 'focus-select' : 'focus-select-cam');
  const focus = focusSelect.value;
  lastFocusLabel = focusSelect.options[focusSelect.selectedIndex].text;
  
  const playerSelect = document.getElementById(isUpload ? 'analyze-player-select' : 'analyze-player-select-cam');
  const playerId = Number(playerSelect.value);
  const player = players.find(p => p.id === playerId);
  
  if (!player) {
    showToast('Add a player to target in your team before running analysis!', 'error');
    return;
  }
  
  lastSessionLabel = document.getElementById(isUpload ? 'session-label' : 'session-label-cam').value.trim() || `Session assessment for ${player.name}`;
  
  if (!videoEl.src) {
    showToast('Upload or record a video first!', 'error');
    return;
  }
  if (!apiKey) {
    showToast('Anthropic Vision API key is required!', 'error');
    return;
  }
  
  const results = document.getElementById('results-panel');
  results.style.display = 'block';
  results.scrollIntoView({ behavior: 'smooth', block: 'start' });
  
  document.getElementById('progress-bar').style.display = 'block';
  document.getElementById('status-text').style.display = 'block';
  document.getElementById('feedback-list').innerHTML = '';
  document.getElementById('summary-bar').innerHTML = '';
  document.getElementById('score-grid').style.display = 'none';
  document.getElementById('score-grid').innerHTML = '';
  document.getElementById('seek-hint').style.display = 'none';
  document.getElementById('pdf-btn').style.display = 'none';
  
  button.disabled = true;
  button.textContent = 'Extracting video frames...';
  
  try {
    setStatus('Extracting chronological video frames...', 15);
    const frames = await extractFrames(videoEl, fpm);
    
    document.getElementById('frame-count').textContent = `${frames.length} frames`;
    setStatus(`Transmitting ${frames.length} frames to Claude Vision...`, 40);
    button.textContent = 'Analyzing technique...';
    
    // Construct Anthropic Vision payload
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'dangerously-allow-html-5-requests-api-direct': 'true' // safe local client header
      },
      body: JSON.stringify({
        model,
        max_tokens: 1500,
        messages: [
          {
            role: 'user',
            content: [
              ...frames.map(frame => ({
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: 'image/jpeg',
                  data: frame.b64
                }
              })),
              {
                type: 'text',
                text: `You are an expert badminton coach. Chronological frame sequences are provided, sampled every ${(60/fpm).toFixed(1)} seconds.\nTimestamps:\n${frames.map((f, i) => `Frame ${i+1}: ${fmtTime(f.time)}`).join('\n')}\nFocus: ${FOCUS_MAP[focus]}\nTarget Player Hand: ${player.hand}\nReturn strictly a JSON array without markdown wrapping.\n\nSchema:\n[\n  {\n    "timestamp": "M:SS",\n    "type": "critical|suggestion|positive",\n    "title": "Max 5 words",\n    "body": "2-3 coaching analysis sentences",\n    "tip": "Specific drill fix",\n    "scores": {\n      "footwork": 10-100,\n      "smash": 10-100,\n      "serve": 10-100,\n      "defense": 10-100,\n      "net": 10-100,\n      "consistency": 10-100\n    }\n  }\n]\nRules: Output 4-7 coaching items, include at least one positive item, and match timestamps strictly to the frames provided.`
              }
            ]
          }
        ]
      })
    });
    
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload?.error?.message || payload?.message || `Anthropic gateway error ${response.status}`);
    }
    
    let rawText = (payload.content || []).map(b => b.text || '').join('').trim();
    // Clean raw markdown if AI includes it
    rawText = rawText.replace(/```json|```/g, '').trim();
    
    const feedback = normalizeFeedback(JSON.parse(rawText));
    lastFeedback = feedback;
    
    // Save to player assessment sessions
    const avgScores = averageScores(feedback);
    const overallScore = calculateOverall(avgScores);
    const newSession = {
      id: Date.now(),
      label: lastSessionLabel,
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      focus: lastFocusLabel,
      type: 'AI Video Report',
      overallScore,
      feedback
    };
    
    player.sessions.push(newSession);
    
    // Update player skills based on this session: (Current Core Skills * 2 + Vision assessment score) / 3
    SCORE_KEYS.forEach(key => {
      const current = player.skills[key] || 70;
      const assessed = avgScores[key];
      player.skills[key] = Math.round((current * 2 + assessed) / 3);
    });
    
    saveState();
    renderFeedback(feedback);
    
    document.getElementById('pdf-btn').style.display = 'inline-flex';
    setStatus('Technical Coaching Report Ready!', 100);
    showToast(`AI Video Analysis recorded for ${player.name}! Core skills updated.`);
    
    setTimeout(() => {
      document.getElementById('progress-bar').style.display = 'none';
      document.getElementById('status-text').style.display = 'none';
    }, 1500);
    
  } catch (error) {
    setStatus(`Analysis failed: ${error.message}`, 100);
    document.getElementById('feedback-list').innerHTML = `
      <div style="padding: 20px; color:var(--critical); font-size:13px; text-align:center;">
        <strong>API analysis failed:</strong> ${escapeHtml(error.message)}
      </div>
    `;
    showToast('AI analysis encountered an error.', 'error');
  } finally {
    button.disabled = false;
    button.textContent = isUpload ? 'Run Technical AI Analysis' : 'Analyze Recording';
  }
}

function setStatus(msg, pct) {
  document.getElementById('status-text').textContent = msg;
  document.getElementById('progress-fill').style.width = `${pct}%`;
}

function normalizeFeedback(raw) {
  if (!Array.isArray(raw) || !raw.length) {
    throw new Error('Anthropic response did not return a valid coaching feed JSON array.');
  }
  return raw.slice(0, 8).map((item, i) => {
    const scores = {};
    SCORE_KEYS.forEach(k => {
      const val = Number(item?.scores?.[k]);
      scores[k] = Number.isFinite(val) ? Math.max(10, Math.min(100, Math.round(val))) : 70;
    });
    
    return {
      timestamp: String(item?.timestamp || fmtTime(i * 15)),
      type: ['critical', 'suggestion', 'positive'].includes(item?.type) ? item.type : 'suggestion',
      title: String(item?.title || 'Coaching Point').slice(0, 50),
      body: String(item?.body || 'Assess this portion of video playback closely.'),
      tip: String(item?.tip || 'Practice fundamental alignment.'),
      scores
    };
  });
}

function averageScores(feedback) {
  const result = {};
  SCORE_KEYS.forEach(k => result[k] = 0);
  
  if (!feedback.length) return result;
  feedback.forEach(item => {
    SCORE_KEYS.forEach(k => {
      result[k] += Number(item.scores?.[k] || 70);
    });
  });
  
  SCORE_KEYS.forEach(k => {
    result[k] = Math.round(result[k] / feedback.length);
  });
  return result;
}

function computeCounts(feedback) {
  const counts = { critical: 0, suggestion: 0, positive: 0 };
  feedback.forEach(item => {
    if (counts[item.type] !== undefined) counts[item.type] += 1;
  });
  return counts;
}

function renderFeedback(items) {
  const counts = computeCounts(items);
  const avg = averageScores(items);
  
  document.getElementById('summary-bar').innerHTML = `
    <div class="summary-bar" style="border-top:1px solid var(--border-dim); border-bottom:1px solid var(--border-dim);">
      <div class="stat red" style="color:var(--critical);"><div class="stat-num">${counts.critical}</div><div class="stat-label">Issues</div></div>
      <div class="stat lime" style="color:var(--lime);"><div class="stat-num">${counts.suggestion}</div><div class="stat-label">Suggestions</div></div>
      <div class="stat blue" style="color:var(--cyan);"><div class="stat-num">${counts.positive}</div><div class="stat-label">Strengths</div></div>
      <div style="margin-left:auto; font-size:11px; color:var(--text-muted);">Session: <span style="color:var(--text-main); font-weight:600;">${escapeHtml(lastSessionLabel)}</span></div>
    </div>
  `;
  
  const scoreGrid = document.getElementById('score-grid');
  scoreGrid.style.display = 'grid';
  scoreGrid.innerHTML = SCORE_KEYS.map(k => `
    <div class="score-card">
      <div class="score-name">${SCORE_LABELS[k]}</div>
      <div class="score-value" style="color:${avg[k] >= 85 ? 'var(--positive)' : avg[k] >= 70 ? 'var(--lime)' : 'var(--warning)'};">${avg[k]}</div>
    </div>
  `).join('');
  
  document.getElementById('seek-hint').style.display = 'block';
  
  document.getElementById('feedback-list').innerHTML = items.map(item => {
    const badge = { critical: 'Critique', suggestion: 'Improvement', positive: 'Strength' }[item.type] || 'Note';
    return `
      <div class="feedback-card clickable ${item.type}" onclick="seekVideo(${parseTimestamp(item.timestamp)})">
        <div class="fc-top">
          <span class="fc-ts">${escapeHtml(item.timestamp)}</span>
          <span class="fc-badge badge-${item.type}">${badge}</span>
        </div>
        <div class="fc-title">${escapeHtml(item.title)}</div>
        <div class="fc-body">${escapeHtml(item.body)}</div>
        ${item.tip ? `<div class="fc-tip"><strong>Fix/Drill:</strong> ${escapeHtml(item.tip)}</div>` : ''}
      </div>
    `;
  }).join('');
}

function seekVideo(seconds) {
  const candidates = [document.getElementById('video-preview'), document.getElementById('cam-recorded')];
  const active = candidates.find(el => el.style.display !== 'none' && el.src);
  if (!active) return;
  
  active.currentTime = seconds;
  active.pause();
  active.scrollIntoView({ behavior: 'smooth', block: 'center' });
  showToast(`Jumped playback to ${fmtTime(seconds)}`);
}

/* Pro Compare Benchmarks Module */
function initProsList() {
  const grid = document.getElementById('pro-grid');
  if (!grid) return;
  
  grid.innerHTML = PROS.map(pro => `
    <div class="pro-card" id="pro-${pro.id}" onclick="selectPro('${pro.id}')">
      <div class="pro-avatar">${pro.emoji}</div>
      <div class="pro-name">${escapeHtml(pro.name)}</div>
      <div class="pro-country" style="color:var(--text-muted); font-size:10px; text-transform:uppercase;">${escapeHtml(pro.country)}</div>
      <span class="pill pill-cyan" style="margin-top:6px; font-size:9px;">${pro.style} style</span>
    </div>
  `).join('');
}

function selectPro(proId) {
  const select = document.getElementById('compare-player-select');
  const body = document.getElementById('compare-chart-body');
  const results = document.getElementById('compare-results');
  
  if (players.length === 0 || !select.value) {
    document.getElementById('compare-empty').style.display = 'block';
    document.getElementById('compare-body').style.display = 'none';
    return;
  }
  
  document.getElementById('compare-empty').style.display = 'none';
  document.getElementById('compare-body').style.display = 'block';
  
  const player = players.find(p => p.id === Number(select.value));
  if (!player) return;
  
  document.querySelectorAll('.pro-card').forEach(c => c.classList.remove('selected'));
  
  if (!proId) {
    // Default select Axelsen
    proId = 'axelsen';
  }
  
  const proCard = document.getElementById(`pro-${proId}`);
  if (proCard) proCard.classList.add('selected');
  
  const pro = PROS.find(p => p.id === proId);
  if (!pro) return;
  
  results.style.display = 'block';
  document.getElementById('compare-title').innerHTML = `<span>${player.name}</span> Benchmarked vs <span>${pro.name} (${pro.emoji})</span>`;
  
  // Find weakest area
  const weakest = SCORE_KEYS.reduce((best, key) => (player.skills[key] < player.skills[best] ? key : best), SCORE_KEYS[0]);
  
  // Generate comparison stats bars
  body.innerHTML = `
    <div style="display:flex; gap:16px; font-size:11px; margin-bottom:16px; border-bottom:1px solid var(--border-dim); padding-bottom:8px;">
      <span style="display:flex; align-items:center; gap:5px;"><span style="width:10px; height:4px; background:var(--lime); display:inline-block; border-radius:2px;"></span>${player.name} (Roster Player)</span>
      <span style="display:flex; align-items:center; gap:5px;"><span style="width:10px; height:4px; background:var(--cyan); display:inline-block; border-radius:2px;"></span>${pro.name} (Pro Bench)</span>
    </div>
    
    ${SCORE_KEYS.map(key => {
      const yours = player.skills[key] || 70;
      const theirs = pro.traits[key];
      const diff = yours - theirs;
      const diffText = diff > 0 ? `+${diff}` : diff < 0 ? String(diff) : '—';
      const diffColor = diff > 0 ? 'var(--positive)' : diff < 0 ? 'var(--critical)' : 'var(--text-muted)';
      
      return `
        <div class="compare-row" style="margin-bottom:12px;">
          <div class="cr-label" style="width:100px; font-family:var(--font-head); font-weight:600; text-transform:uppercase; letter-spacing:0.5px;">${SCORE_LABELS[key]}</div>
          <div style="flex:1; display:flex; flex-direction:column; gap:4px;">
            <!-- Player Bar -->
            <div style="display:flex; align-items:center; gap:8px;">
              <div class="cr-bar-wrap" style="flex:1; height:6px;"><div class="cr-bar" style="width:${yours}%; background:var(--lime);"></div></div>
              <span class="cr-val" style="color:var(--lime); width:24px; text-align:right;">${yours}</span>
            </div>
            <!-- Pro Bar -->
            <div style="display:flex; align-items:center; gap:8px;">
              <div class="cr-bar-wrap" style="flex:1; height:6px;"><div class="cr-bar" style="width:${theirs}%; background:var(--cyan);"></div></div>
              <span class="cr-val" style="color:var(--cyan); width:24px; text-align:right;">${theirs}</span>
            </div>
          </div>
          <div style="width:40px; text-align:right; font-weight:700; color:${diffColor}; font-size:12px;">${diffText}</div>
        </div>
      `;
    }).join('')}
    
    <div class="compare-tip" style="margin-top:20px; padding-top:16px; border-top:1px solid var(--border-bright);">
      <strong>Coach Benchmark Recommendation on player's weakest metric (${SCORE_LABELS[weakest]}):</strong><br>
      <p style="margin-top:6px; color:var(--text-muted); font-size:12px; line-height:1.5;">${pro.tips[weakest]}</p>
    </div>
  `;
}

/* Bulk JSON Backup & Resets */
function exportTeamData() {
  const blob = new Blob([JSON.stringify({ players, lineups }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'shuttleiq_team_data.json';
  link.click();
  URL.revokeObjectURL(url);
  showToast('Team roster file successfully exported!');
}

function importTeamData(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      if (!parsed.players || !Array.isArray(parsed.players)) {
        throw new Error('Invalid JSON format. Expected players roster array.');
      }
      
      players = parsed.players;
      lineups = parsed.lineups || { d1a: null, d1b: null, d2a: null, d2b: null, s1: null, s2: null };
      
      saveState();
      loadPlayerSelects();
      renderLeaderboard();
      renderLineupCourt();
      showToast('Team roster file imported successfully!');
    } catch (e) {
      showToast(`Import failed: ${e.message}`, 'error');
    }
  };
  reader.readAsText(file);
  event.target.value = '';
}

function clearTeamData() {
  if (confirm('Are you sure you want to RESET all players, evaluations, history, and lineups back to default seed players?')) {
    players = JSON.parse(JSON.stringify(SEED_PLAYERS));
    lineups = { d1a: null, d1b: null, d2a: null, d2b: null, s1: null, s2: null };
    saveState();
    loadPlayerSelects();
    renderLeaderboard();
    renderLineupCourt();
    showToast('Database reset to defaults successfully.');
  }
}

/* PDF Report Exporter using jsPDF */
function exportPDF() {
  if (!lastFeedback.length || !window.jspdf) {
    showToast('Coaching analysis dataset not loaded yet.', 'error');
    return;
  }
  
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  
  const w = 210;
  const h = 297;
  const m = 18;
  const contentW = w - m * 2;
  const counts = computeCounts(lastFeedback);
  const now = new Date();
  
  // Header Panel Banner
  doc.setFillColor(14, 14, 17); // Slate bg
  doc.rect(0, 0, w, 32, 'F');
  doc.setFillColor(204, 255, 0); // Lime border accent
  doc.rect(0, 0, 5, 32, 'F');
  
  // Brand Header
  doc.setTextColor(204, 255, 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text('ShuttleIQ', m + 2, 14);
  
  doc.setTextColor(150, 150, 150);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('AUTOMATED VISION AI TEAM EVALUATOR', m + 2, 20);
  
  doc.setTextColor(220, 220, 220);
  doc.setFontSize(10);
  doc.text(`DATE: ${now.toLocaleDateString()}`, w - m - 45, 14);
  doc.text(`DRILL: ${lastSessionLabel.toUpperCase()}`, w - m - 45, 20);
  
  // Executive Summary Card
  let y = 42;
  doc.setFillColor(245, 245, 245);
  doc.rect(m, y, contentW, 20, 'F');
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(50, 50, 50);
  doc.text('EXECUTIVE DRILL ANALYSIS SUMMARY:', m + 5, y + 6);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Identified ${counts.critical} critical errors, ${counts.suggestion} suggestions, and logged ${counts.positive} positive strengths.`, m + 5, y + 13);
  
  // Roster stats grid
  y += 28;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(20, 20, 20);
  doc.text('AVERAGE METRIC RATINGS EVALUATED:', m, y);
  
  const avg = averageScores(lastFeedback);
  y += 6;
  doc.setFontSize(9);
  let x = m;
  SCORE_KEYS.forEach(k => {
    doc.setFillColor(235, 235, 235);
    doc.rect(x, y, 26, 12, 'F');
    doc.setTextColor(100, 100, 100);
    doc.setFont('helvetica', 'normal');
    doc.text(SCORE_LABELS[k].toUpperCase(), x + 2, y + 4);
    
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(20, 20, 20);
    doc.text(String(avg[k]), x + 2, y + 9);
    x += 29;
  });
  
  // Timeline items
  y += 24;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(20, 20, 20);
  doc.text('COACHING TIMELINE LOG:', m, y);
  
  y += 6;
  lastFeedback.forEach(item => {
    // Page break protect
    if (y > h - 45) {
      doc.addPage();
      y = 20;
    }
    
    doc.setFillColor(248, 248, 248);
    doc.rect(m, y, contentW, 24, 'F');
    
    // Type accent
    const accentColor = item.type === 'critical' ? [255, 51, 102] : item.type === 'positive' ? [0, 200, 100] : [204, 200, 0];
    doc.setFillColor(...accentColor);
    doc.rect(m, y, 2, 24, 'F');
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(50, 50, 50);
    doc.text(`[${item.timestamp}] ${item.title.toUpperCase()}`, m + 5, y + 6);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(80, 80, 80);
    
    // Split long body lines
    const splitBody = doc.splitTextToSize(item.body, contentW - 10);
    doc.text(splitBody, m + 5, y + 11);
    
    if (item.tip) {
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(110, 110, 110);
      doc.text(`Drill: ${item.tip}`, m + 5, y + 20);
    }
    
    y += 28;
  });
  
  // Footer
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(160, 160, 160);
  doc.text('Report created client-side. ShuttleIQ Team analytics protocol.', m, h - 10);
  
  doc.save(`shuttleiq_coaching_report_${now.getTime()}.pdf`);
  showToast('Technical Coaching PDF report downloaded!');
}

/* Helpers */
function escapeHtml(val = '') {
  return String(val)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function fmtTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.max(0, Math.floor(seconds % 60));
  return `${m}:${String(s).padStart(2, '0')}`;
}

function parseTimestamp(ts) {
  return String(ts || '0:00').split(':').reduce((acc, part) => acc * 60 + Number(part || 0), 0);
}

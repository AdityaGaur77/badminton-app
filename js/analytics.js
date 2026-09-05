/* ShuttleIQ v5 — analytics: form, position fit, improvement areas, roster suggestions */

const SKILLS = ['footwork', 'smash', 'serve', 'defense', 'net', 'consistency'];
const SKILL_LABELS = {
  footwork: 'Footwork', smash: 'Smash', serve: 'Serve',
  defense: 'Defense', net: 'Net play', consistency: 'Consistency',
};

const POSITIONS = {
  singles: { label: 'Singles', weights: { footwork: 0.30, consistency: 0.25, defense: 0.15, smash: 0.15, net: 0.10, serve: 0.05 } },
  front:   { label: 'Doubles — front court', weights: { net: 0.35, serve: 0.20, defense: 0.15, footwork: 0.15, consistency: 0.15, smash: 0 } },
  back:    { label: 'Doubles — back court', weights: { smash: 0.40, footwork: 0.20, defense: 0.15, consistency: 0.15, serve: 0.10, net: 0 } },
};

const DRILLS = {
  footwork: 'Shadow footwork: 4-corner drill, 3 sets of 60 seconds at match pace.',
  smash: 'Half-court smash repetitions — focus on full arm rotation and contact point in front of the body.',
  serve: 'Serve 50 low serves to a target zone on the front service line; track how many land short of the line.',
  defense: 'Two-on-one defense drill — defending player covers drives and smashes from both sides.',
  net: 'Net kill and tumbling net-shot ladder: alternate tight spinners and kills for 5 minutes per side.',
  consistency: 'Rally cap drill — cooperative clears to 50 without an error, then repeat with drops mixed in.',
};

/* Average 0-100 skill profile from coach match ratings (1-5 scaled) and AI session scores. */
function skillProfile(playerId) {
  const totals = {}, counts = {};
  SKILLS.forEach(s => { totals[s] = 0; counts[s] = 0; });
  for (const m of playerMatches(playerId)) {
    if (!m.ratings) continue;
    for (const s of SKILLS) {
      if (m.ratings[s]) { totals[s] += m.ratings[s] * 20; counts[s]++; }
    }
  }
  for (const sess of playerSessions(playerId)) {
    if (!sess.scores) continue;
    for (const s of SKILLS) {
      if (sess.scores[s] != null) { totals[s] += sess.scores[s]; counts[s]++; }
    }
  }
  const profile = {};
  let any = false;
  for (const s of SKILLS) {
    profile[s] = counts[s] ? Math.round(totals[s] / counts[s]) : null;
    if (counts[s]) any = true;
  }
  return any ? profile : null;
}

function winRate(playerId) {
  const ms = playerMatches(playerId);
  if (!ms.length) return null;
  return ms.filter(m => m.result === 'W').length / ms.length;
}

/* Form over the last 5 matches vs the 5 before, plus current streak. */
function recentForm(playerId) {
  const ms = playerMatches(playerId); // newest first
  if (!ms.length) return null;
  const recent = ms.slice(0, 5);
  const prior = ms.slice(5, 10);
  const rate = arr => arr.filter(m => m.result === 'W').length / arr.length;
  const recentRate = rate(recent);
  let trend = 'flat';
  if (prior.length >= 3) {
    const diff = recentRate - rate(prior);
    if (diff > 0.1) trend = 'up';
    else if (diff < -0.1) trend = 'down';
  }
  let streak = 0;
  const first = ms[0].result;
  for (const m of ms) { if (m.result === first) streak++; else break; }
  return {
    recentWins: recent.filter(m => m.result === 'W').length,
    recentTotal: recent.length,
    recentRate, trend,
    streak: { type: first, count: streak },
  };
}

function positionScores(playerId) {
  const profile = skillProfile(playerId);
  if (!profile) return null;
  const out = {};
  for (const [key, pos] of Object.entries(POSITIONS)) {
    let sum = 0, weightUsed = 0;
    for (const [skill, w] of Object.entries(pos.weights)) {
      if (profile[skill] != null) { sum += profile[skill] * w; weightUsed += w; }
    }
    out[key] = weightUsed ? Math.round(sum / weightUsed) : 0;
  }
  out.best = Object.keys(POSITIONS).reduce((a, b) => (out[a] >= out[b] ? a : b));
  return out;
}

/* Two weakest skills with a drill for each. */
function improvementAreas(playerId) {
  const profile = skillProfile(playerId);
  if (!profile) return [];
  return SKILLS
    .filter(s => profile[s] != null)
    .sort((a, b) => profile[a] - profile[b])
    .slice(0, 2)
    .map(s => ({ skill: s, label: SKILL_LABELS[s], score: profile[s], drill: DRILLS[s] }));
}

function strengths(playerId) {
  const profile = skillProfile(playerId);
  if (!profile) return [];
  return SKILLS
    .filter(s => profile[s] != null)
    .sort((a, b) => profile[b] - profile[a])
    .slice(0, 2)
    .map(s => ({ skill: s, label: SKILL_LABELS[s], score: profile[s] }));
}

/* Win rate of doubles pairs that have played together. */
function pairChemistry() {
  const pairs = {};
  for (const m of state.matches) {
    if (!m.partnerId) continue;
    const key = [m.playerId, m.partnerId].sort().join('|');
    pairs[key] = pairs[key] || { wins: 0, total: 0, ids: key.split('|') };
    pairs[key].total++;
    if (m.result === 'W') pairs[key].wins++;
  }
  return Object.values(pairs)
    .map(p => ({ ...p, rate: p.wins / p.total }))
    .sort((a, b) => b.rate - a.rate || b.total - a.total);
}

function tryoutComposite(p) {
  if (!p.tryoutScores) return 0;
  const vals = Object.values(p.tryoutScores).filter(v => v > 0);
  if (!vals.length) return 0;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

/* Greedy roster fill: singles slots by singles score, doubles pairs by front/back fit + chemistry.
   Injured/away players are never suggested — a lineup you can't field is worse than none. */
function suggestRoster(slots) {
  const rosterPlayers = state.players.filter(p => p.status === 'roster' && isAvailable(p));
  const scored = rosterPlayers.map(p => ({
    id: p.id,
    pos: positionScores(p.id) || { singles: 0, front: 0, back: 0 },
    wr: winRate(p.id) ?? 0.5,
  }));
  const overall = s => Math.max(s.pos.singles, s.pos.front, s.pos.back) * 0.7 + s.wr * 100 * 0.3;
  const used = new Set();
  const result = {};

  const singlesSlots = slots.filter(s => s.type === 'singles');
  const doublesSlots = slots.filter(s => s.type === 'doubles');

  const bySingles = [...scored].sort((a, b) => (b.pos.singles * 0.7 + b.wr * 100 * 0.3) - (a.pos.singles * 0.7 + a.wr * 100 * 0.3));
  for (const slot of singlesSlots) {
    const pick = bySingles.find(s => !used.has(s.id));
    if (pick) { used.add(pick.id); result[slot.code] = [pick.id]; }
  }

  const chem = pairChemistry();
  for (const slot of doublesSlots) {
    const avail = scored.filter(s => !used.has(s.id));
    if (avail.length < 2) break;
    // best back-court attacker + best front-court player, nudged by chemistry
    const back = [...avail].sort((a, b) => b.pos.back - a.pos.back)[0];
    let front = [...avail].filter(s => s.id !== back.id).sort((a, b) => b.pos.front - a.pos.front)[0];
    const knownPair = chem.find(c => c.ids.includes(back.id) && c.ids.some(id => id !== back.id && avail.some(s => s.id === id)) && c.rate >= 0.6 && c.total >= 2);
    if (knownPair) {
      const mateId = knownPair.ids.find(id => id !== back.id);
      const mate = avail.find(s => s.id === mateId);
      if (mate) front = mate;
    }
    used.add(back.id); used.add(front.id);
    result[slot.code] = [back.id, front.id];
  }
  void overall;
  return result;
}

/* Depth chart: best-fit players ranked per position. */
function depthChart() {
  const roster = state.players.filter(p => p.status === 'roster');
  const scored = roster.map(p => ({ p, pos: positionScores(p.id), wr: winRate(p.id) }))
    .filter(x => x.pos);
  const out = {};
  for (const key of Object.keys(POSITIONS)) {
    out[key] = scored
      .map(x => ({ player: x.p, score: x.pos[key], wr: x.wr }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  }
  return out;
}

/* Team practice plan: which skills the roster is weakest at, with a drill each. */
function practicePlan() {
  const roster = state.players.filter(p => p.status === 'roster');
  const totals = {}, counts = {}, weakFor = {};
  SKILLS.forEach(s => { totals[s] = 0; counts[s] = 0; weakFor[s] = []; });
  for (const p of roster) {
    const prof = skillProfile(p.id);
    if (!prof) continue;
    for (const s of SKILLS) {
      if (prof[s] != null) {
        totals[s] += prof[s];
        counts[s]++;
        if (prof[s] < 50) weakFor[s].push(p.name);
      }
    }
  }
  const rows = SKILLS
    .filter(s => counts[s])
    .map(s => ({ skill: s, label: SKILL_LABELS[s], avg: Math.round(totals[s] / counts[s]), drill: DRILLS[s], focusPlayers: weakFor[s] }))
    .sort((a, b) => a.avg - b.avg);
  return rows;
}

/* Per-opponent win/loss record. */
function headToHead() {
  const map = {};
  for (const m of state.matches) {
    const o = m.opponent || 'Unknown';
    map[o] = map[o] || { opponent: o, wins: 0, losses: 0 };
    if (m.result === 'W') map[o].wins++; else map[o].losses++;
  }
  return Object.values(map)
    .map(r => ({ ...r, total: r.wins + r.losses, rate: r.wins / (r.wins + r.losses) }))
    .sort((a, b) => b.total - a.total);
}

/* Rolling team win-rate trend (chronological), for a sparkline. */
function teamTrend() {
  return [...state.matches].sort((a, b) => (a.date < b.date ? -1 : 1));
}

/* Skill movement: average AI session scores from the first half of a player's
   sessions vs the most recent, so "is this working?" has an answer. */
function skillProgress(playerId) {
  const sessions = playerSessions(playerId).filter(s => s.scores).reverse(); // oldest -> newest
  if (sessions.length < 2) return null;
  const mid = Math.max(1, Math.floor(sessions.length / 2));
  const early = sessions.slice(0, mid);
  const late = sessions.slice(-mid);
  const avg = (arr, skill) => {
    const vals = arr.map(s => s.scores[skill]).filter(v => v != null);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  };
  const rows = SKILLS.map(s => {
    const a = avg(early, s), b = avg(late, s);
    return a == null || b == null ? null : { skill: s, label: SKILL_LABELS[s], from: Math.round(a), to: Math.round(b), delta: Math.round(b - a) };
  }).filter(Boolean);
  if (!rows.length) return null;
  return { rows: rows.sort((a, b) => b.delta - a.delta), sessions: sessions.length };
}

/* Session-average score over time — the "am I improving overall" line. */
function sessionTrend(playerId) {
  return playerSessions(playerId)
    .filter(s => s.scores)
    .reverse()
    .map(s => {
      const vals = SKILLS.map(k => s.scores[k]).filter(v => v != null);
      return { date: s.date, label: s.label, value: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null };
    })
    .filter(p => p.value != null);
}

/* Record between two teammates, from matches they played against each other
   (ladder challenges and any singles match logged with the other as opponent). */
function teammateRecord(aId, bId) {
  const aName = playerName(aId), bName = playerName(bId);
  let aWins = 0, bWins = 0;
  // A ladder challenge is stored twice — once from each player's side — so the
  // same encounter must only be counted once. Key on date+score to collapse them.
  const seen = new Set();
  for (const m of state.matches) {
    const fromA = m.playerId === aId && m.opponent === bName;
    const fromB = m.playerId === bId && m.opponent === aName;
    if (!fromA && !fromB) continue;
    const key = `${m.date}|${m.score}|${m.discipline}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const aWon = fromA ? m.result === 'W' : m.result === 'L';
    if (aWon) aWins++; else bWins++;
  }
  return { aWins, bWins, total: aWins + bWins };
}

/* ---------- player level, rank and skill tiers ----------
   Points come from doing the work (filming, playing) AND from getting better,
   so a hard-working beginner still climbs. Everything is derived from data
   already stored — nothing extra to track. */

const XP_RULES = {
  analysis: 25,   // per AI video analysis
  match: 15,      // per match played
  win: 10,        // extra per win
  skillPoint: 2,  // per point of skill improvement
};

/* Cumulative XP needed to reach a level. Cheap early, steeper later. */
function xpForLevel(level) {
  const n = Math.max(0, level - 1);
  return 40 * n + 10 * n * n;
}

const RANKS = [
  { min: 15, name: 'Elite', cls: 'rank-elite' },
  { min: 10, name: 'Captain', cls: 'rank-captain' },
  { min: 6, name: 'Varsity', cls: 'rank-varsity' },
  { min: 3, name: 'Starter', cls: 'rank-starter' },
  { min: 1, name: 'Rookie', cls: 'rank-rookie' },
];

function rankForLevel(level) {
  return RANKS.find(r => level >= r.min) || RANKS[RANKS.length - 1];
}

function playerXP(playerId) {
  const sessions = playerSessions(playerId);
  const matches = playerMatches(playerId);
  const wins = matches.filter(m => m.result === 'W').length;
  const prog = skillProgress(playerId);
  const gained = prog ? prog.rows.reduce((sum, r) => sum + Math.max(0, r.delta), 0) : 0;

  const breakdown = [
    { label: 'Video analyses', count: sessions.length, xp: sessions.length * XP_RULES.analysis },
    { label: 'Matches played', count: matches.length, xp: matches.length * XP_RULES.match },
    { label: 'Matches won', count: wins, xp: wins * XP_RULES.win },
    { label: 'Skill points gained', count: gained, xp: gained * XP_RULES.skillPoint },
  ];
  const xp = breakdown.reduce((s, b) => s + b.xp, 0);

  let level = 1;
  while (xpForLevel(level + 1) <= xp && level < 99) level++;
  const base = xpForLevel(level);
  const next = xpForLevel(level + 1);
  const span = Math.max(1, next - base);

  return {
    xp, level, rank: rankForLevel(level),
    intoLevel: xp - base,
    needForNext: next - xp,
    progressPct: Math.round(((xp - base) / span) * 100),
    breakdown: breakdown.filter(b => b.count > 0),
  };
}

/* Per-skill tier — the "rank each body part" idea, one tier per badminton skill. */
const SKILL_TIERS = [
  { min: 80, name: 'Elite', cls: 'tier-5' },
  { min: 65, name: 'Strong', cls: 'tier-4' },
  { min: 50, name: 'Solid', cls: 'tier-3' },
  { min: 35, name: 'Building', cls: 'tier-2' },
  { min: 0, name: 'Starting', cls: 'tier-1' },
];

function skillTier(value) {
  if (value == null) return { name: 'No data', cls: 'tier-0', min: 0 };
  return SKILL_TIERS.find(t => value >= t.min) || SKILL_TIERS[SKILL_TIERS.length - 1];
}

/* Every skill with its score, tier and recent movement — powers the card grid. */
function skillTierCards(playerId) {
  const profile = skillProfile(playerId);
  const prog = skillProgress(playerId);
  const deltas = {};
  if (prog) for (const r of prog.rows) deltas[r.skill] = r.delta;
  return SKILLS.map(s => {
    const value = profile ? profile[s] : null;
    return { skill: s, label: SKILL_LABELS[s], value, tier: skillTier(value), delta: deltas[s] ?? null };
  });
}

/* Milestones. Simple, visible, and all reachable by a normal school player. */
function playerBadges(playerId) {
  const sessions = playerSessions(playerId).length;
  const matches = playerMatches(playerId);
  const wins = matches.filter(m => m.result === 'W').length;
  const form = recentForm(playerId);
  const profile = skillProfile(playerId);
  const prog = skillProgress(playerId);
  const bestGain = prog ? Math.max(0, ...prog.rows.map(r => r.delta)) : 0;
  const solidCount = profile ? SKILLS.filter(s => (profile[s] ?? 0) >= 50).length : 0;

  const list = [
    { id: 'first-film', icon: '🎬', label: 'First film', desc: 'Analyse one clip', earned: sessions >= 1 },
    { id: 'five-films', icon: '🎥', label: 'Regular filmer', desc: 'Analyse 5 clips', earned: sessions >= 5 },
    { id: 'first-win', icon: '🏸', label: 'First win', desc: 'Win a match', earned: wins >= 1 },
    { id: 'ten-matches', icon: '📅', label: 'Match ready', desc: 'Play 10 matches', earned: matches.length >= 10 },
    { id: 'streak', icon: '🔥', label: 'On a run', desc: 'Win 3 in a row', earned: !!form && form.streak.type === 'W' && form.streak.count >= 3 },
    { id: 'improver', icon: '📈', label: 'Improver', desc: 'Raise a skill by 10', earned: bestGain >= 10 },
    { id: 'allrounder', icon: '⭐', label: 'All-rounder', desc: 'All 6 skills at 50+', earned: solidCount === SKILLS.length },
  ];
  return { list, earned: list.filter(b => b.earned).length, total: list.length };
}

/* Plain-language coach read on a player, no API needed. */
function localCoachNote(playerId) {
  const form = recentForm(playerId);
  const pos = positionScores(playerId);
  const weak = improvementAreas(playerId);
  const strong = strengths(playerId);
  if (!form && !pos) return 'No data yet. Log a match or run a video analysis to build this player’s profile.';
  const parts = [];
  if (form) {
    const pct = Math.round(form.recentRate * 100);
    parts.push(`Won ${form.recentWins} of the last ${form.recentTotal} (${pct}%).`);
    if (form.trend === 'up') parts.push('Form is trending up versus earlier matches.');
    if (form.trend === 'down') parts.push('Form has dipped compared to earlier matches — worth a check-in.');
    if (form.streak.count >= 3) parts.push(form.streak.type === 'W' ? `On a ${form.streak.count}-match win streak.` : `On a ${form.streak.count}-match losing run — consider easing match load or adjusting position.`);
  }
  if (pos) parts.push(`Best projected role: ${POSITIONS[pos.best].label} (${pos[pos.best]}/100).`);
  if (strong.length) parts.push(`Strengths: ${strong.map(s => s.label.toLowerCase()).join(', ')}.`);
  if (weak.length) parts.push(`Priority to improve: ${weak.map(w => w.label.toLowerCase()).join(', ')}.`);
  return parts.join(' ');
}

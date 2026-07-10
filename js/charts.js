/* ShuttleIQ v6 — inline SVG charts, dependency-free, tuned for the light theme. */

const CHART_INK = '#1c2a24';
const CHART_ACCENT = '#147a4d';
const CHART_FAINT = '#e2e8e5';
const CHART_MUTED = '#64756d';

/* Hexagonal skill radar. profile: {footwork, smash, ...} 0-100 (nulls allowed). */
function radarSVG(profile, { size = 280 } = {}) {
  const axes = SKILLS;
  const cx = size / 2, cy = size / 2;
  const r = size / 2 - 34;
  const n = axes.length;

  const point = (i, frac) => {
    const a = (Math.PI * 2 * i) / n - Math.PI / 2;
    return [cx + Math.cos(a) * r * frac, cy + Math.sin(a) * r * frac];
  };

  // concentric rings
  let rings = '';
  for (const ring of [0.25, 0.5, 0.75, 1]) {
    const pts = axes.map((_, i) => point(i, ring).join(',')).join(' ');
    rings += `<polygon points="${pts}" fill="none" stroke="${CHART_FAINT}" stroke-width="1"/>`;
  }
  // spokes
  let spokes = '';
  axes.forEach((_, i) => {
    const [x, y] = point(i, 1);
    spokes += `<line x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="${CHART_FAINT}" stroke-width="1"/>`;
  });
  // data polygon (missing skills sit at the centre)
  const dataPts = axes.map((s, i) => point(i, (profile[s] ?? 0) / 100).join(',')).join(' ');
  // vertices + axis labels
  let dots = '', labels = '';
  axes.forEach((s, i) => {
    const v = profile[s];
    if (v != null) {
      const [x, y] = point(i, v / 100);
      dots += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.5" fill="${CHART_ACCENT}"/>`;
    }
    const [lx, ly] = point(i, 1.16);
    const anchor = Math.abs(lx - cx) < 6 ? 'middle' : lx > cx ? 'start' : 'end';
    labels += `<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" fill="${CHART_MUTED}" font-size="10" text-anchor="${anchor}" dominant-baseline="middle" font-family="system-ui, sans-serif">${SKILL_LABELS[s]}</text>`;
  });

  return `<svg viewBox="0 0 ${size} ${size}" width="100%" style="max-width:${size}px;overflow:visible" role="img" aria-label="Skill radar">
    ${rings}${spokes}
    <polygon points="${dataPts}" fill="rgba(20,122,77,0.12)" stroke="${CHART_ACCENT}" stroke-width="1.5" stroke-linejoin="round"/>
    ${dots}${labels}
  </svg>`;
}

/* Rolling win-rate sparkline from a newest-first match list. */
function sparklineSVG(matches, { w = 120, h = 28 } = {}) {
  const ms = [...matches].reverse(); // oldest -> newest
  if (ms.length < 2) return '';
  // cumulative win rate after each match
  let wins = 0;
  const pts = ms.map((m, i) => {
    if (m.result === 'W') wins++;
    return wins / (i + 1);
  });
  const stepX = w / (pts.length - 1);
  const path = pts.map((v, i) => `${i === 0 ? 'M' : 'L'}${(i * stepX).toFixed(1)},${(h - v * h).toFixed(1)}`).join(' ');
  const last = pts[pts.length - 1];
  return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" style="display:block" aria-hidden="true">
    <line x1="0" y1="${(h / 2).toFixed(1)}" x2="${w}" y2="${(h / 2).toFixed(1)}" stroke="${CHART_FAINT}" stroke-width="1" stroke-dasharray="2 3"/>
    <path d="${path}" fill="none" stroke="${CHART_INK}" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/>
    <circle cx="${w}" cy="${(h - last * h).toFixed(1)}" r="2.5" fill="${CHART_ACCENT}"/>
  </svg>`;
}

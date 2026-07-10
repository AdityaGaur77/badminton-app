/* ShuttleIQ v5 — inline SVG charts, monochrome and dependency-free.
   Every chart is pure ink-on-paper (or paper-on-ink) to stay inside the
   achromatic system; depth comes from line weight and fill opacity only. */

/* Hexagonal skill radar. profile: {footwork, smash, ...} 0-100 (nulls allowed).
   `tone` = 'dark' renders white strokes for use on black surfaces. */
function radarSVG(profile, { size = 280, tone = 'dark' } = {}) {
  const axes = SKILLS;
  const cx = size / 2, cy = size / 2;
  const r = size / 2 - 34;
  const stroke = tone === 'dark' ? '#70dcd3' : '#181818';      // phosphor mint glow for the data
  const faint = tone === 'dark' ? 'rgba(217,218,229,0.22)' : '#e4e4e4';
  const label = tone === 'dark' ? '#aeaeb7' : '#6d6d6d';
  const n = axes.length;

  const point = (i, frac) => {
    const a = (Math.PI * 2 * i) / n - Math.PI / 2;
    return [cx + Math.cos(a) * r * frac, cy + Math.sin(a) * r * frac];
  };

  // concentric rings
  let rings = '';
  for (const ring of [0.25, 0.5, 0.75, 1]) {
    const pts = axes.map((_, i) => point(i, ring).join(',')).join(' ');
    rings += `<polygon points="${pts}" fill="none" stroke="${faint}" stroke-width="1"/>`;
  }
  // spokes
  let spokes = '';
  axes.forEach((_, i) => {
    const [x, y] = point(i, 1);
    spokes += `<line x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="${faint}" stroke-width="1"/>`;
  });
  // data polygon (missing skills sit at the centre)
  const dataPts = axes.map((s, i) => point(i, (profile[s] ?? 0) / 100).join(',')).join(' ');
  const dataFill = tone === 'dark' ? 'rgba(112,220,211,0.14)' : 'rgba(24,24,24,0.10)';
  // vertices + axis labels
  let dots = '', labels = '';
  axes.forEach((s, i) => {
    const v = profile[s];
    if (v != null) {
      const [x, y] = point(i, v / 100);
      dots += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.5" fill="${stroke}"/>`;
    }
    const [lx, ly] = point(i, 1.16);
    const anchor = Math.abs(lx - cx) < 6 ? 'middle' : lx > cx ? 'start' : 'end';
    labels += `<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" fill="${label}" font-size="9" letter-spacing="0.12em" text-anchor="${anchor}" dominant-baseline="middle" font-family="Inter, sans-serif">${SKILL_LABELS[s].toUpperCase()}</text>`;
  });

  return `<svg viewBox="0 0 ${size} ${size}" width="100%" style="max-width:${size}px;overflow:visible" role="img" aria-label="Skill radar">
    ${rings}${spokes}
    <polygon points="${dataPts}" fill="${dataFill}" stroke="${stroke}" stroke-width="1.5" stroke-linejoin="round"/>
    ${dots}${labels}
  </svg>`;
}

/* Rolling win-rate sparkline from a chronological-newest-first match list. */
function sparklineSVG(matches, { w = 120, h = 28, tone = 'dark' } = {}) {
  const ms = [...matches].reverse(); // oldest -> newest
  if (ms.length < 2) return '';
  const stroke = tone === 'dark' ? '#ffffff' : '#181818';
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
    <line x1="0" y1="${(h / 2).toFixed(1)}" x2="${w}" y2="${(h / 2).toFixed(1)}" stroke="${tone === 'dark' ? 'rgba(255,255,255,0.15)' : '#e4e4e4'}" stroke-width="1" stroke-dasharray="2 3"/>
    <path d="${path}" fill="none" stroke="${stroke}" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/>
    <circle cx="${w}" cy="${(h - last * h).toFixed(1)}" r="2.5" fill="${stroke}"/>
  </svg>`;
}

/* Horizontal mini bar (0-100) for compact stat readouts. */
function miniBar(value, { tone = 'dark' } = {}) {
  const fill = tone === 'dark' ? '#ffffff' : '#181818';
  const track = tone === 'dark' ? 'rgba(255,255,255,0.15)' : '#e4e4e4';
  return `<span style="display:inline-block;width:80px;height:2px;background:${track};position:relative;vertical-align:middle">
    <span style="position:absolute;left:0;top:0;bottom:0;width:${Math.max(0, Math.min(100, value))}%;background:${fill}"></span></span>`;
}

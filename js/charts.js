/* ShuttleIQ v6.3 — inline SVG charts, dependency-free, theme-aware.
   Colors are read from the active theme's CSS variables at render time,
   so charts restyle instantly when the theme switches. */

function chartColors() {
  const cs = getComputedStyle(document.documentElement);
  const v = name => cs.getPropertyValue(name).trim();
  return {
    ink: v('--chart-ink') || '#45544b',
    accent: v('--chart-accent') || '#10714a',
    faint: v('--chart-faint') || '#e2dfd2',
    muted: v('--chart-muted') || '#6b7a70',
    ring: v('--chart-dot-ring') || '#ffffff',
  };
}

/* Hexagonal skill radar. profile: {footwork, smash, ...} 0-100 (nulls allowed). */
function radarSVG(profile, { size = 280 } = {}) {
  const C = chartColors();
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
    rings += `<polygon points="${pts}" fill="none" stroke="${C.faint}" stroke-width="1" class="c-grid"/>`;
  }
  // spokes
  let spokes = '';
  axes.forEach((_, i) => {
    const [x, y] = point(i, 1);
    spokes += `<line x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="${C.faint}" stroke-width="1" class="c-grid"/>`;
  });
  // data polygon (missing skills sit at the centre)
  const dataPts = axes.map((s, i) => point(i, (profile[s] ?? 0) / 100).join(',')).join(' ');
  // vertices + axis labels
  let dots = '', labels = '';
  axes.forEach((s, i) => {
    const v = profile[s];
    if (v != null) {
      const [x, y] = point(i, v / 100);
      dots += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3" fill="${C.accent}" stroke="${C.ring}" stroke-width="1.5" class="c-mark"/>`;
    }
    const [lx, ly] = point(i, 1.17);
    const anchor = Math.abs(lx - cx) < 6 ? 'middle' : lx > cx ? 'start' : 'end';
    labels += `<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" fill="${C.muted}" font-size="10.5" font-weight="600" text-anchor="${anchor}" dominant-baseline="middle" font-family="system-ui, sans-serif" class="c-label">${SKILL_LABELS[s]}</text>`;
  });

  return `<svg viewBox="0 0 ${size} ${size}" width="100%" style="max-width:${size}px;overflow:visible" role="img" aria-label="Skill radar">
    ${rings}${spokes}
    <polygon points="${dataPts}" fill="${C.accent}22" stroke="${C.accent}" stroke-width="2" stroke-linejoin="round" class="c-area"/>
    ${dots}${labels}
  </svg>`;
}

/* Session-score line over time. points: [{date, label, value 0-100}] oldest-first. */
function lineChartSVG(points, { w = 560, h = 150 } = {}) {
  const C = chartColors();
  if (!points || points.length < 2) return '';
  const padL = 30, padR = 12, padT = 12, padB = 22;
  const x = i => padL + (i / (points.length - 1)) * (w - padL - padR);
  const y = v => padT + (1 - v / 100) * (h - padT - padB);
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const area = `${path} L${x(points.length - 1).toFixed(1)},${y(0).toFixed(1)} L${x(0).toFixed(1)},${y(0).toFixed(1)} Z`;
  let grid = '', axis = '';
  for (const v of [0, 25, 50, 75, 100]) {
    grid += `<line x1="${padL}" y1="${y(v).toFixed(1)}" x2="${w - padR}" y2="${y(v).toFixed(1)}" stroke="${C.faint}" stroke-width="1" class="c-grid"/>`;
    axis += `<text x="${padL - 6}" y="${y(v).toFixed(1)}" fill="${C.muted}" font-size="9" text-anchor="end" dominant-baseline="middle" font-family="system-ui, sans-serif" class="c-label">${v}</text>`;
  }
  const dots = points.map((p, i) =>
    `<circle cx="${x(i).toFixed(1)}" cy="${y(p.value).toFixed(1)}" r="3.5" fill="${C.accent}" stroke="${C.ring}" stroke-width="1.5" class="c-mark"><title>${String(p.label || '').replace(/[<>&"]/g, '')}: ${Math.round(p.value)}</title></circle>`).join('');
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" style="max-width:${w}px;display:block" role="img" aria-label="Session score trend">
    ${grid}${axis}
    <path d="${area}" fill="${C.accent}18" stroke="none"/>
    <path d="${path}" fill="none" stroke="${C.accent}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" class="c-line"/>
    ${dots}
  </svg>`;
}

/* Two-player radar overlay for head-to-head comparison. */
function radarCompareSVG(profileA, profileB, { size = 300 } = {}) {
  const C = chartColors();
  const axes = SKILLS;
  const cx = size / 2, cy = size / 2, r = size / 2 - 36, n = axes.length;
  const point = (i, frac) => {
    const a = (Math.PI * 2 * i) / n - Math.PI / 2;
    return [cx + Math.cos(a) * r * frac, cy + Math.sin(a) * r * frac];
  };
  let rings = '';
  for (const ring of [0.25, 0.5, 0.75, 1]) {
    rings += `<polygon points="${axes.map((_, i) => point(i, ring).join(',')).join(' ')}" fill="none" stroke="${C.faint}" stroke-width="1" class="c-grid"/>`;
  }
  const poly = (profile, stroke, dash) =>
    `<polygon points="${axes.map((s, i) => point(i, (profile?.[s] ?? 0) / 100).join(',')).join(' ')}" fill="none" stroke="${stroke}" stroke-width="2" stroke-linejoin="round" ${dash ? `stroke-dasharray="5 4"` : ''} class="c-line"/>`;
  let labels = '';
  axes.forEach((s, i) => {
    const [lx, ly] = point(i, 1.18);
    const anchor = Math.abs(lx - cx) < 6 ? 'middle' : lx > cx ? 'start' : 'end';
    labels += `<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" fill="${C.muted}" font-size="10" font-weight="600" text-anchor="${anchor}" dominant-baseline="middle" font-family="system-ui, sans-serif" class="c-label">${SKILL_LABELS[s]}</text>`;
  });
  return `<svg viewBox="0 0 ${size} ${size}" width="100%" style="max-width:${size}px;overflow:visible" role="img" aria-label="Skill comparison">
    ${rings}${poly(profileA, C.accent, false)}${poly(profileB, C.ink, true)}${labels}
  </svg>`;
}

/* Circular progress ring — a score you can read at a glance, no reading needed. */
function ringSVG(value, { size = 92, stroke = 9, tone = null, center = null, sub = null } = {}) {
  const C = chartColors();
  const pct = Math.max(0, Math.min(100, Number(value) || 0));
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  const colour = tone || C.accent;
  const mid = size / 2;
  const clean = t => String(t).replace(/[<>&"]/g, '');
  const bigText = clean(center != null ? center : Math.round(pct));
  return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" class="ring" role="img" aria-label="${bigText}${sub ? ' ' + clean(sub) : ''}">
    <circle cx="${mid}" cy="${mid}" r="${r}" fill="none" stroke="${C.faint}" stroke-width="${stroke}" class="c-grid"/>
    <circle cx="${mid}" cy="${mid}" r="${r}" fill="none" stroke="${colour}" stroke-width="${stroke}"
      stroke-linecap="round" stroke-dasharray="${dash.toFixed(1)} ${(circ - dash).toFixed(1)}"
      transform="rotate(-90 ${mid} ${mid})" class="c-line"/>
    <text x="${mid}" y="${mid}" text-anchor="middle" dominant-baseline="central"
      font-family="system-ui, sans-serif" font-size="${Math.round(size * 0.30)}" font-weight="800"
      fill="${C.ink}" class="c-label">${bigText}</text>
    ${sub ? `<text x="${mid}" y="${mid + size * 0.23}" text-anchor="middle" dominant-baseline="central"
      font-family="system-ui, sans-serif" font-size="${Math.round(size * 0.13)}" font-weight="700"
      fill="${C.muted}" class="c-label">${clean(sub)}</text>` : ''}
  </svg>`;
}

/* Rolling win-rate sparkline from a newest-first match list. */
function sparklineSVG(matches, { w = 120, h = 28 } = {}) {
  const C = chartColors();
  const ms = [...matches].reverse(); // oldest -> newest
  if (ms.length < 2) return '';
  // cumulative win rate after each match
  let wins = 0;
  const pts = ms.map((m, i) => {
    if (m.result === 'W') wins++;
    return wins / (i + 1);
  });
  const pad = 6; // keeps the endpoint dot + its ring fully inside the viewBox
  const x = i => pad + (i / (pts.length - 1)) * (w - pad * 2);
  const y = v => pad + (1 - v) * (h - pad * 2);
  const path = pts.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const last = pts[pts.length - 1];
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}" style="display:block;max-width:${w}px" aria-hidden="true" preserveAspectRatio="none">
    <line x1="${pad}" y1="${y(0.5).toFixed(1)}" x2="${w - pad}" y2="${y(0.5).toFixed(1)}" stroke="${C.faint}" stroke-width="1" stroke-dasharray="2 3" class="c-grid"/>
    <path d="${path}" fill="none" stroke="${C.ink}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" class="c-line"/>
    <circle cx="${(w - pad).toFixed(1)}" cy="${y(last).toFixed(1)}" r="4" fill="${C.accent}" stroke="${C.ring}" stroke-width="1.5" class="c-mark"/>
  </svg>`;
}

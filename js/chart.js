// Tiny SVG chart helpers. Colors come from CSS classes so charts follow the theme.
const W = 600;

function niceStep(range, count) {
  const raw = range / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const f = raw / mag;
  return (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * mag;
}

const fmt = (n) => (Math.abs(n) >= 100 ? Math.round(n) : Math.round(n * 10) / 10);
const shortDate = (ts) => new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

/** points: [{ x: timestamp, y: number }] sorted by x. */
export function lineChart(points, { unit = '', height = 200, label = 'Chart' } = {}) {
  const H = height, P = { l: 48, r: 16, t: 16, b: 30 };
  let x0 = points[0].x, x1 = points[points.length - 1].x;
  if (x0 === x1) { x0 -= 1; x1 += 1; }
  let y0 = Math.min(...points.map((p) => p.y)), y1 = Math.max(...points.map((p) => p.y));
  const pad = (y1 - y0) * 0.15 || Math.max(1, y1 * 0.05);
  y0 -= pad; y1 += pad;
  const sx = (x) => P.l + ((x - x0) / (x1 - x0)) * (W - P.l - P.r);
  const sy = (y) => H - P.b - ((y - y0) / (y1 - y0)) * (H - P.t - P.b);

  const step = niceStep(y1 - y0, 4);
  let grid = '';
  for (let v = Math.ceil(y0 / step) * step; v <= y1; v += step) {
    grid += `<line class="grid" x1="${P.l}" x2="${W - P.r}" y1="${sy(v)}" y2="${sy(v)}"/>`
      + `<text class="axis" x="${P.l - 8}" y="${sy(v) + 5}" text-anchor="end">${fmt(v)}</text>`;
  }
  const pts = points.map((p) => [sx(p.x), sy(p.y)]);
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join('');
  const area = `${line}L${pts[pts.length - 1][0].toFixed(1)},${H - P.b}L${pts[0][0].toFixed(1)},${H - P.b}Z`;
  const dots = points.map((p, i) => `<circle class="dot" cx="${pts[i][0]}" cy="${pts[i][1]}" r="${points.length > 30 ? 3 : 5}"><title>${shortDate(p.x)}: ${fmt(p.y)} ${unit}</title></circle>`).join('');
  const last = points[points.length - 1];
  const lx = Math.min(pts[pts.length - 1][0], W - P.r - 4);
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${label}">
    ${grid}
    <path class="area" d="${area}"/><path class="line" d="${line}"/>${dots}
    <text class="value" x="${lx}" y="${Math.max(pts[pts.length - 1][1] - 12, 14)}" text-anchor="end">${fmt(last.y)} ${unit}</text>
    <text class="axis" x="${P.l}" y="${H - 8}">${shortDate(points[0].x)}</text>
    <text class="axis" x="${W - P.r}" y="${H - 8}" text-anchor="end">${shortDate(last.x)}</text>
  </svg>`;
}

/** items: [{ label, y }]. */
export function barChart(items, { height = 160, label = 'Chart' } = {}) {
  const H = height, P = { l: 16, r: 16, t: 22, b: 28 };
  const max = Math.max(1, ...items.map((i) => i.y));
  const slot = (W - P.l - P.r) / items.length;
  const bw = Math.min(36, slot * 0.6);
  const bars = items.map((it, i) => {
    const h = (it.y / max) * (H - P.t - P.b);
    const x = P.l + slot * i + (slot - bw) / 2;
    const y = H - P.b - h;
    const cur = i === items.length - 1 ? ' current' : '';
    return `<rect class="bar${cur}" x="${x}" y="${y}" width="${bw}" height="${Math.max(h, it.y ? 2 : 0)}" rx="4"><title>Week of ${it.label}: ${it.y}</title></rect>`
      + (it.y ? `<text class="axis" x="${x + bw / 2}" y="${y - 6}" text-anchor="middle">${it.y}</text>` : '')
      + (i % 2 === (items.length - 1) % 2 ? `<text class="axis" x="${x + bw / 2}" y="${H - 8}" text-anchor="middle">${it.label}</text>` : '');
  }).join('');
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${label}">
    <line class="grid" x1="${P.l}" x2="${W - P.r}" y1="${H - P.b}" y2="${H - P.b}"/>${bars}</svg>`;
}

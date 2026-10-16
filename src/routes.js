export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
export const lerp = (a, b, t) => a + (b - a) * t;

// The road mesh, enemy movement and rally validation all use these same samples.
export function makeRoute(points) {
  const raw = points.map(([x, z]) => ({ x, z })), samples = [raw[0]];
  for (let i = 1; i < raw.length - 1; i++) {
    const a = raw[i - 1], b = raw[i], c = raw[i + 1];
    const cut = Math.min(1.05, distance(a, b) * .23, distance(b, c) * .23);
    const u = cut / distance(a, b), v = cut / distance(b, c);
    const from = { x: lerp(b.x, a.x, u), z: lerp(b.z, a.z, u) };
    const to = { x: lerp(b.x, c.x, v), z: lerp(b.z, c.z, v) };
    samples.push(from);
    for (let k = 1; k <= 10; k++) {
      const t = k / 10, s = 1 - t;
      samples.push({ x: s * s * from.x + 2 * s * t * b.x + t * t * to.x, z: s * s * from.z + 2 * s * t * b.z + t * t * to.z });
    }
  }
  samples.push(raw.at(-1));
  const cumulative = [0];
  for (let i = 1; i < samples.length; i++) cumulative.push(cumulative[i - 1] + distance(samples[i - 1], samples[i]));
  const length = cumulative.at(-1);
  return {
    points: samples, cumulative, length,
    at(d) {
      d = clamp(d, 0, length);
      let lo = 1, hi = samples.length - 1;
      while (lo < hi) { const mid = (lo + hi) >> 1; if (cumulative[mid] < d) lo = mid + 1; else hi = mid; }
      const a = samples[lo - 1], b = samples[lo], t = (d - cumulative[lo - 1]) / Math.max(.001, cumulative[lo] - cumulative[lo - 1]);
      return { x: lerp(a.x, b.x, t), z: lerp(a.z, b.z, t), angle: Math.atan2(b.x - a.x, b.z - a.z) };
    },
    nearest(p) {
      let best = { distance: Infinity, d: 0, x: 0, z: 0 };
      for (let i = 1; i < samples.length; i++) {
        const a = samples[i - 1], b = samples[i], dx = b.x - a.x, dz = b.z - a.z;
        const t = clamp(((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz), 0, 1);
        const q = { x: a.x + dx * t, z: a.z + dz * t }, dd = distance(p, q);
        if (dd < best.distance) best = { ...q, distance: dd, d: lerp(cumulative[i - 1], cumulative[i], t) };
      }
      return best;
    }
  };
}

// A bounded grid search makes heroes and soldiers go around built structures.
export function navigate(from, to, obstacles, bounds = { x: 14.7, z: 10.8 }) {
  const step = .55, width = Math.ceil(bounds.x * 2 / step) + 1, height = Math.ceil(bounds.z * 2 / step) + 1;
  const toCell = p => [clamp(Math.round((p.x + bounds.x) / step), 0, width - 1), clamp(Math.round((p.z + bounds.z) / step), 0, height - 1)];
  const pos = (x, z) => ({ x: x * step - bounds.x, z: z * step - bounds.z });
  const blocked = p => obstacles.some(o => distance(p, o) < o.r + .22);
  if (Math.abs(to.x) > bounds.x || Math.abs(to.z) > bounds.z || blocked(to)) return null;
  const clear = (a, b) => {
    const n = Math.ceil(distance(a, b) / .2);
    for (let i = 1; i <= n; i++) if (blocked({ x: lerp(a.x, b.x, i / n), z: lerp(a.z, b.z, i / n) })) return false;
    return true;
  };
  if (clear(from, to)) return [{ ...to }];
  const [sx, sz] = toCell(from), [tx, tz] = toCell(to), key = (x, z) => z * width + x;
  const start = key(sx, sz), target = key(tx, tz), open = [{ x: sx, z: sz, k: start, f: 0 }], prev = new Map(), costs = new Map([[start, 0]]), closed = new Set();
  let found = false;
  while (open.length && closed.size < width * height) {
    open.sort((a, b) => a.f - b.f);
    const p = open.shift(); if (closed.has(p.k)) continue; closed.add(p.k);
    if (p.k === target) { found = true; break; }
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      const x = p.x + dx, z = p.z + dz, k = key(x, z);
      if (x < 0 || z < 0 || x >= width || z >= height || closed.has(k)) continue;
      const point = pos(x, z); if (blocked(point) || !clear(pos(p.x, p.z), point)) continue;
      const g = costs.get(p.k) + Math.hypot(dx, dz);
      if (g >= (costs.get(k) ?? Infinity)) continue;
      costs.set(k, g); prev.set(k, p.k); open.push({ x, z, k, f: g + Math.hypot(tx - x, tz - z) });
    }
  }
  if (!found) return null;
  const route = [to]; let k = target;
  while (k !== start) { route.unshift(pos(k % width, Math.floor(k / width))); k = prev.get(k); }
  const smooth = []; let anchor = from;
  for (let i = 0; i < route.length;) {
    let j = route.length - 1; while (j > i && !clear(anchor, route[j])) j--;
    smooth.push(route[j]); anchor = route[j]; i = j + 1;
  }
  return smooth;
}

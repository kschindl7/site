/*
 * Floor-plan navigation: a coarse grid built from the room's colliders, A*
 * pathfinding across it, and circle-vs-box collision for free movement.
 */
import { ROOM } from './world.js';

const CELL = 0.5;
let grid = null;
let cols = 0, rows = 0;
let boxes = [];

export function init(colliders, radius) {
  boxes = colliders;
  cols = Math.round((ROOM.maxX - ROOM.minX) / CELL);
  rows = Math.round((ROOM.maxZ - ROOM.minZ) / CELL);
  grid = new Uint8Array(cols * rows);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = ROOM.minX + (c + 0.5) * CELL, z = ROOM.minZ + (r + 0.5) * CELL;
      grid[r * cols + c] = blocked(x, z, radius) ? 1 : 0;
    }
  }
}

function blocked(x, z, radius) {
  if (x < ROOM.minX + radius || x > ROOM.maxX - radius || z < ROOM.minZ + radius || z > ROOM.maxZ - radius) return true;
  for (let i = 0; i < boxes.length; i++) {
    const b = boxes[i];
    if (x > b.minX - radius && x < b.maxX + radius && z > b.minZ - radius && z < b.maxZ + radius) return true;
  }
  return false;
}

function cellOf(x, z) {
  return [Math.max(0, Math.min(cols - 1, Math.floor((x - ROOM.minX) / CELL))), Math.max(0, Math.min(rows - 1, Math.floor((z - ROOM.minZ) / CELL)))];
}
function centerOf(c, r) { return { x: ROOM.minX + (c + 0.5) * CELL, z: ROOM.minZ + (r + 0.5) * CELL }; }
function open(c, r) { return c >= 0 && r >= 0 && c < cols && r < rows && !grid[r * cols + c]; }

// Nearest open cell to a point, for targets that sit inside furniture.
function nearestOpen(c, r) {
  if (open(c, r)) return [c, r];
  for (let d = 1; d < 12; d++) {
    let best = null, bestD = 1e9;
    for (let dr = -d; dr <= d; dr++) {
      for (let dc = -d; dc <= d; dc++) {
        if (Math.max(Math.abs(dc), Math.abs(dr)) !== d || !open(c + dc, r + dr)) continue;
        const dd = dc * dc + dr * dr;
        if (dd < bestD) { bestD = dd; best = [c + dc, r + dr]; }
      }
    }
    if (best) return best;
  }
  return null;
}

// A* over the grid with diagonal moves. Returns a list of {x, z} waypoints.
export function findPath(ax, az, bx, bz) {
  const s = nearestOpen.apply(null, cellOf(ax, az));
  const g = nearestOpen.apply(null, cellOf(bx, bz));
  if (!s || !g) return null;
  const start = s[1] * cols + s[0], goal = g[1] * cols + g[0];
  const came = new Int32Array(cols * rows).fill(-1);
  const cost = new Float32Array(cols * rows).fill(Infinity);
  const openSet = [start];
  cost[start] = 0;
  const h = function (i) { const c = i % cols, r = (i / cols) | 0; return Math.hypot(c - g[0], r - g[1]); };
  const f = new Float32Array(cols * rows).fill(Infinity);
  f[start] = h(start);
  while (openSet.length) {
    let bi = 0;
    for (let i = 1; i < openSet.length; i++) if (f[openSet[i]] < f[openSet[bi]]) bi = i;
    const cur = openSet.splice(bi, 1)[0];
    if (cur === goal) break;
    const c = cur % cols, r = (cur / cols) | 0;
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (!dc && !dr) continue;
        const nc = c + dc, nr = r + dr;
        if (!open(nc, nr)) continue;
        if (dc && dr && (!open(c + dc, r) || !open(c, r + dr))) continue;
        const ni = nr * cols + nc;
        const nd = cost[cur] + (dc && dr ? 1.414 : 1);
        if (nd < cost[ni]) {
          cost[ni] = nd;
          came[ni] = cur;
          f[ni] = nd + h(ni);
          if (openSet.indexOf(ni) < 0) openSet.push(ni);
        }
      }
    }
  }
  if (came[goal] < 0 && goal !== start) return null;
  const cells = [];
  for (let i = goal; i !== -1 && i !== start; i = came[i]) cells.unshift(i);
  const pts = cells.map(function (i) { return centerOf(i % cols, (i / cols) | 0); });
  // Finish on the exact target when it's reachable.
  if (open.apply(null, cellOf(bx, bz))) pts.push({ x: bx, z: bz });
  return smooth({ x: ax, z: az }, pts);
}

// Drops waypoints that a straight walk can skip.
function smooth(from, pts) {
  const out = [];
  let anchor = from, i = 0;
  while (i < pts.length) {
    let j = pts.length - 1;
    while (j > i && !clear(anchor, pts[j])) j--;
    out.push(pts[j]);
    anchor = pts[j];
    i = j + 1;
  }
  return out;
}

function clear(a, b) {
  const steps = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / (CELL * 0.5));
  for (let k = 1; k <= steps; k++) {
    const t = k / steps;
    const cr = cellOf(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t);
    if (!open(cr[0], cr[1])) return false;
  }
  return true;
}

// Pushes a circle out of the room's furniture and walls.
export function resolve(p, radius) {
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < boxes.length; i++) {
      const b = boxes[i];
      const cx = Math.max(b.minX, Math.min(p.x, b.maxX));
      const cz = Math.max(b.minZ, Math.min(p.z, b.maxZ));
      const dx = p.x - cx, dz = p.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= radius * radius) continue;
      if (d2 > 1e-8) {
        const d = Math.sqrt(d2);
        p.x = cx + dx / d * radius;
        p.z = cz + dz / d * radius;
      } else {
        // Center is inside the box: push out the shortest way.
        const opts = [[b.minX - radius - p.x, 0], [b.maxX + radius - p.x, 0], [0, b.minZ - radius - p.z], [0, b.maxZ + radius - p.z]];
        opts.sort(function (u, v) { return Math.abs(u[0] + u[1]) - Math.abs(v[0] + v[1]); });
        p.x += opts[0][0]; p.z += opts[0][1];
      }
    }
  }
  p.x = Math.max(ROOM.minX + radius, Math.min(ROOM.maxX - radius, p.x));
  p.z = Math.max(ROOM.minZ + radius, Math.min(ROOM.maxZ - radius, p.z));
}

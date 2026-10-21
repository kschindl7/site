/*
 * The Wayward Lantern in 3D: the room, its furniture, the fireplace and
 * quest board (built in code), lighting, rain outside, and lightning.
 *
 * Coordinates: x runs west to east, z runs north to south, y is up. One unit
 * is roughly a third of a person's height. The room's inside walls sit at
 * x = +/-9.5 and z = +/-7.5. The bar is on the north wall, the fireplace on
 * the east wall, the door and quest board on the south wall. Stairs along the
 * north wall lead to the upstairs bedrooms (see upstairs.js), whose floor sits
 * at y = UPPER_Y.
 */
import * as THREE from 'three';
import { prop } from './assets.js';
import { buildUpstairs, STAIRS } from './upstairs.js';

export const ROOM = { minX: -9.5, maxX: 9.5, minZ: -7.5, maxZ: 7.5 };
export const UPPER_Y = 4.05;

// Floor-plan blockers for each floor: [ground, upstairs].
const colliders = [[], []];
const hotspots = [];
const flickers = [];
let scene;
// Each wall and what hangs on it, so the wall nearest the camera can be hidden.
// Upstairs walls live in their own groups inside `upper`.
const sides = {};
const sidesUp = {};
let upper = null;
let target = null;
let floor = 0; // which floor the build helpers are adding to
let upperShown = false;
const fadeWalls = [];

// ---------- Small helpers ----------
function place(role, x, z, rot, y) {
  const obj = prop(role);
  obj.position.set(x, y || 0, z);
  obj.rotation.y = rot || 0;
  (target || scene).add(obj);
  return obj;
}

// Places everything built inside fn on the named wall of the current floor.
function onWall(name, fn) {
  const prev = target;
  target = floor ? sidesUp[name] : sides[name];
  fn();
  target = prev;
}

const SIDE_ROT = { north: 0, south: Math.PI, west: Math.PI / 2, east: -Math.PI / 2 };

// Axis-aligned blocker on the floor plan.
function block(x0, x1, z0, z1, tag) {
  colliders[floor].push({ minX: Math.min(x0, x1), maxX: Math.max(x0, x1), minZ: Math.min(z0, z1), maxZ: Math.max(z0, z1), tag: tag });
}
function blockAt(x, z, w, d, tag) { block(x - w / 2, x + w / 2, z - d / 2, z + d / 2, tag); }

function mat(color, opts) {
  return new THREE.MeshStandardMaterial(Object.assign({ color: color, roughness: 0.9, metalness: 0, flatShading: true }, opts || {}));
}

// Darkens a prop that reads too bright under the firelight.
function dim(obj, k) {
  obj.traverse(function (o) {
    if (o.isMesh) {
      o.material = o.material.clone();
      o.material.color.multiplyScalar(k);
    }
  });
}

function box(w, h, d, material, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y + h / 2, z);
  (target || scene).add(m);
  return m;
}

// Hand-drawn style textures made on a canvas, so they need no image files.
function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function stoneTexture() {
  return canvasTexture(256, 256, function (g, w, h) {
    g.fillStyle = '#3d3936';
    g.fillRect(0, 0, w, h);
    const rows = 8;
    const rh = h / rows;
    for (let r = 0; r < rows; r++) {
      let x = (r % 2) * -24;
      while (x < w) {
        const sw = 36 + Math.random() * 30;
        const shade = 95 + Math.random() * 45;
        g.fillStyle = 'rgb(' + shade + ',' + (shade - 6) + ',' + (shade - 12) + ')';
        g.beginPath();
        g.roundRect(x + 3, r * rh + 3, sw - 6, rh - 6, 6);
        g.fill();
        g.fillStyle = 'rgba(255,255,255,0.08)';
        g.fillRect(x + 6, r * rh + 5, sw - 14, 4);
        x += sw;
      }
    }
  });
}

function woodTexture(base) {
  return canvasTexture(128, 128, function (g, w, h) {
    g.fillStyle = base;
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 4; i++) {
      g.fillStyle = 'rgba(0,0,0,0.28)';
      g.fillRect(i * 32, 0, 2, h);
      for (let k = 0; k < 6; k++) {
        g.fillStyle = 'rgba(0,0,0,' + (0.05 + Math.random() * 0.08) + ')';
        g.fillRect(i * 32 + 4 + Math.random() * 24, Math.random() * h, 2, 10 + Math.random() * 30);
      }
    }
  });
}

function hotspot(h) {
  hotspots.push(Object.assign({ radius: 0.8, reach: 1.8, level: floor }, h));
}

// ---------- Room shell ----------
function buildShell() {
  for (let x = -8; x <= 8; x += 4) {
    for (let z = -6; z <= 6; z += 4) {
      place((x + z) % 8 === 0 ? 'floorDark' : 'floor', x, z);
    }
  }
  // Outside ground, so looking over the walls shows a dark wet yard.
  const yard = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), mat('#0d1018', { roughness: 0.4 }));
  yard.rotation.x = -Math.PI / 2;
  yard.position.y = -0.12;
  scene.add(yard);

  ['north', 'south', 'west', 'east'].forEach(function (n) {
    sides[n] = new THREE.Group();
    scene.add(sides[n]);
  });
  // North wall (behind the bar).
  onWall('north', function () {
    [-8, -4, 0, 4, 8].forEach(function (x) { place('wall', x, -8, 0); });
    place('banner', -2, -7.45, 0, 1.4);
  });
  // South wall, with the door.
  onWall('south', function () {
    [-8, -4, 0, 8].forEach(function (x) { place('wall', x, 8, Math.PI); });
    place('wallDoor', 4, 8, Math.PI);
    place('bannerShield', -3.2, 7.45, Math.PI, 1.3);
  });
  // West wall, with two rain windows.
  onWall('west', function () {
    place('wall', -10, -6, Math.PI / 2);
    place('wallWindow', -10, -2, Math.PI / 2);
    place('wallWindow', -10, 2, Math.PI / 2);
    place('wall', -10, 6, Math.PI / 2);
  });
  // East wall: fireplace in the middle, a window by the bookshelf.
  onWall('east', function () {
    place('wall', 10, -6, -Math.PI / 2);
    place('wall', 10, -2, -Math.PI / 2);
    place('wall', 10, 2, -Math.PI / 2);
    place('wallWindow', 10, 6, -Math.PI / 2);
    place('painting', 9.45, 0.9, -Math.PI / 2, 1.6).scale.setScalar(1.4);
  });

  hotspot({ id: 'window', kind: 'flavor', x: -9.4, z: -2, radius: 1.4 });
  hotspot({ id: 'window', kind: 'flavor', x: -9.4, z: 2, radius: 1.4 });
  hotspot({ id: 'window', kind: 'flavor', x: 9.4, z: 6, radius: 1.4 });
  hotspot({ id: 'door', kind: 'flavor', x: 4, z: 7.4, radius: 1.2 });

  // Wall torches.
  [[-9.5, -5.5, 'west'], [-9.5, 5, 'west'], [9.5, -5.5, 'east'], [-1, 7.5, 'south'], [7.2, 7.5, 'south'], [2.0, -7.5, 'north']].forEach(function (p) {
    const rot = SIDE_ROT[p[2]];
    onWall(p[2], function () {
      place('torch', p[0], p[1], rot, 2.2);
      addFlame(p[0] + Math.sin(rot) * 0.45, 2.95, p[1] + Math.cos(rot) * 0.45, 0.32);
    });
  });
}

// ---------- Bar ----------
function buildBar() {
  const wood = mat('#9b6438', { map: woodTexture('#a8703f') });
  const dark = mat('#5e3a20');
  const top = mat('#7a4a28', { roughness: 0.6 });
  // Counter front and the return that closes off the area behind the bar.
  box(7.0, 1.1, 0.9, wood, -6.0, 0, -5.1);
  box(0.9, 1.1, 2.8, wood, -2.05, 0, -6.1);
  box(7.4, 0.12, 1.15, top, -5.9, 1.1, -5.1);
  box(1.15, 0.12, 2.9, top, -2.05, 1.1, -6.05);
  box(7.0, 0.14, 0.95, dark, -6.0, 0, -5.07);
  block(-9.5, -1.55, -5.6, -4.6, 'bar');
  block(-2.5, -1.55, -7.5, -4.6, 'bar');

  // Back shelves and bottles.
  const bottles = ['bottleBrown', 'bottleGreen', 'bottleTall', 'bottleRound'];
  onWall('north', function () {
    place('wallShelves', -7.8, -7.75, 0);
    place('wallShelves', -5.2, -7.75, 0);
    [-8.5, -8.0, -7.4, -6.9, -5.9, -5.4, -4.8, -4.4].forEach(function (x, i) {
      place(bottles[i % 4], x, -7.25, 0, i % 2 ? 1.62 : 2.32);
    });
  });
  place('bottleGreen', -8.6, -5.0, 0, 1.22);
  place('mug', -3.6, -5.0, 0, 1.22);
  place('mug', -3.2, -5.2, 1.2, 1.22);
  place('candles', -6.6, -5.0, 0, 1.22);
  place('barrelStack', -9.0, -6.6, 0);

  // Kegs and stock along the rest of the north wall.
  place('kegFancy', -0.4, -6.6, 0);
  place('barrel', 2.0, -6.8, 0);
  place('crates', 7.6, 6.5, Math.PI);
  blockAt(-0.4, -6.6, 1.9, 2.0, 'keg');
  blockAt(2.0, -6.8, 1.6, 1.6, 'barrel');
  blockAt(7.6, 6.5, 2.4, 2.0, 'crates');
  hotspot({ id: 'barrel', kind: 'flavor', x: -0.4, z: -5.8, radius: 1.0 });

  // Bar stools.
  [-8.0, -6.6, -3.6].forEach(function (x) {
    place('stool', x, -3.95, 0);
    blockAt(x, -3.95, 0.7, 0.7, 'stool');
  });
}

// ---------- Fireplace and bookshelf (Interests) ----------
const fire = { light: null, flames: [], embers: null, glow: null };

function buildFireplace() {
  const stone = mat('#d2cac2', { map: stoneTexture() });
  const soot = mat('#141012');
  const mantel = mat('#5e3a20', { map: woodTexture('#6b4224') });
  const zc = -1.2;
  box(1.3, 1.5, 0.6, stone, 8.85, 0, zc - 1.25);
  box(1.3, 1.5, 0.6, stone, 8.85, 0, zc + 1.25);
  box(0.4, 1.5, 1.9, soot, 9.35, 0, zc);
  box(1.5, 0.28, 3.4, mantel, 8.75, 1.5, zc);
  box(0.95, 2.22, 2.8, stone, 9.05, 1.78, zc);
  box(2.1, 0.1, 3.8, mat('#6e6762', { map: stoneTexture() }), 8.45, 0, zc);
  block(8.15, 9.5, zc - 1.6, zc + 1.6, 'fireplace');

  // Logs.
  const logMat = mat('#4a2c16');
  [[-0.3, 0.2], [0.3, -0.25]].forEach(function (o) {
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.3, 7), logMat);
    log.rotation.x = Math.PI / 2;
    log.rotation.y = o[1];
    log.position.set(9.0 + o[0] * 0.2, 0.22, zc + o[0]);
    scene.add(log);
  });
  // Flames: stacked additive cones that flicker.
  const flameMats = ['#ffd27a', '#ff9a3a', '#ff5a1f'].map(function (c) {
    return new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
  });
  for (let i = 0; i < 7; i++) {
    const h = 0.6 + Math.random() * 0.5;
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.16 + Math.random() * 0.1, h, 6), flameMats[i % 3]);
    f.position.set(8.95 + (Math.random() - 0.5) * 0.25, 0.3 + h / 2, zc + (i - 3) * 0.17);
    f.userData = { base: f.position.y, h: h, phase: Math.random() * 10, speed: 7 + Math.random() * 6 };
    scene.add(f);
    fire.flames.push(f);
  }
  fire.glow = glowSprite('#ff8a3a', 3.2);
  fire.glow.position.set(8.7, 0.8, zc);
  scene.add(fire.glow);
  fire.light = new THREE.PointLight('#ff8a3a', 11, 18, 1.2);
  fire.light.position.set(8.4, 1.3, zc);
  scene.add(fire.light);
  pool.push(poolEntry(fire.light, 11, true));

  // Embers drifting up the chimney.
  const n = 40;
  const pos = new Float32Array(n * 3);
  const seeds = [];
  for (let i = 0; i < n; i++) seeds.push({ t: Math.random(), x: (Math.random() - 0.5) * 0.6, z: (Math.random() - 0.5) * 1.2, s: 0.4 + Math.random() * 0.6 });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  fire.embers = new THREE.Points(geo, new THREE.PointsMaterial({ color: '#ffb35a', size: 0.06, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
  fire.embers.userData = { seeds: seeds, zc: zc };
  scene.add(fire.embers);

  // Trophies over the mantel and candles on it.
  place('trophy', 8.58, zc, -Math.PI / 2, 2.4);
  candleAt(8.4, zc - 1.4, 1.78, 0.7);
  candleAt(8.4, zc + 1.4, 1.78, 0.7);
  place('mug', 8.4, zc + 0.9, 0.4, 1.78);

  const rug = place('rug', 6.6, zc, Math.PI / 2);
  rug.scale.setScalar(1.3);
  dim(rug, 0.4);
  place('armchair', 6.9, 1.4, Math.PI * 0.75);
  blockAt(6.9, 1.4, 1.5, 1.5, 'armchair');

  // Bookshelf on the east wall, south of the painting.
  onWall('east', function () {
    place('wallShelves', 9.75, 3.6, -Math.PI / 2);
    [0.95, 1.6, 2.3].forEach(function (y, i) {
      place('books', 9.15, 3.2 + (i % 2) * 0.3, -Math.PI / 2, y + 0.25);
      place('books', 9.15, 4.0 - (i % 2) * 0.2, -Math.PI / 2 + 0.1, y + 0.25);
    });
  });
  place('barrelSmall', 9.0, 5.0, 0);
  blockAt(9.0, 5.0, 1.0, 1.0, 'barrel');

  hotspot({ id: 'interests', kind: 'section', x: 8.3, z: zc, radius: 1.6, look: 'fire', label: 'Interests' });
  hotspot({ id: 'interests', kind: 'section', x: 9.2, z: 3.6, radius: 1.2, look: 'books', label: 'Interests' });
}

function glowSprite(color, size) {
  const tex = canvasTexture(64, 64, function (g) {
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    // Glows blend before tone mapping (see quality.js), so the falloff is
    // steeper than it looks here to keep the halos tight.
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.2, 'rgba(255,255,255,0.4)');
    grad.addColorStop(0.5, 'rgba(255,255,255,0.06)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
  });
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  s.scale.setScalar(size);
  return s;
}

// A table candle, scaled down, with its flame placed on the wick.
function candleAt(x, z, y, scale) {
  const c = place('candle', x, z, 0, y);
  c.scale.setScalar(scale || 0.55);
  c.updateMatrixWorld(true);
  const top = new THREE.Box3().setFromObject(c).max.y;
  addFlame(x, top + 0.04, z, 0.08);
  return c;
}

// Small flickering flame and glow for torches and candles.
function addFlame(x, y, z, size) {
  const g = glowSprite('#ffae55', size * 4);
  g.position.set(x, y, z);
  (target || scene).add(g);
  flickers.push({ sprite: g, base: size * 4, phase: Math.random() * 10, level: floor });
}

// ---------- Quest board (Work) ----------
function buildQuestBoard() {
  const x = 0.6, z = 7.38;
  const frame = mat('#4e2f18');
  const board = mat('#8a5a32', { map: woodTexture('#8f5e35') });
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = Math.PI;
  sides.south.add(g);
  function add(mesh, px, py, pz) { mesh.position.set(px, py, pz); g.add(mesh); return mesh; }
  add(new THREE.Mesh(new THREE.BoxGeometry(2.8, 1.8, 0.1), board), 0, 1.95, 0);
  add(new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.14, 0.18), frame), 0, 2.9, 0.02);
  add(new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.14, 0.18), frame), 0, 1.02, 0.02);
  add(new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.9, 0.18), frame), -1.43, 1.95, 0.02);
  add(new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.9, 0.18), frame), 1.43, 1.95, 0.02);
  // Sign over the board.
  const sign = canvasTexture(256, 64, function (c, w, h) {
    c.fillStyle = '#3a2210'; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#c9a25a'; c.lineWidth = 4; c.strokeRect(4, 4, w - 8, h - 8);
    c.fillStyle = '#f2d28a'; c.font = 'bold 34px Georgia, serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('QUESTS', w / 2, h / 2 + 2);
  });
  add(new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.4, 0.08), [frame, frame, frame, frame, new THREE.MeshStandardMaterial({ map: sign, roughness: 0.9 }), frame]), 0, 3.22, 0.04);
  // Pinned notices.
  const notes = [[-0.85, 2.3, 0.1], [0.05, 2.4, -0.06], [0.9, 2.25, 0.08], [-0.55, 1.5, -0.04], [0.55, 1.5, 0.05]];
  notes.forEach(function (n, i) {
    const tex = canvasTexture(96, 128, function (c, w, h) {
      c.fillStyle = i % 2 ? '#efe2bf' : '#e6d3a5'; c.fillRect(0, 0, w, h);
      c.fillStyle = 'rgba(80,50,20,0.7)';
      for (let l = 0; l < 7; l++) c.fillRect(12, 22 + l * 13, 30 + Math.random() * 44, 4);
      if (i < 3) { c.strokeStyle = '#9b2a1a'; c.lineWidth = 5; c.strokeRect(54, 92, 30, 24); c.fillStyle = '#9b2a1a'; c.font = 'bold 12px Georgia'; c.fillText('DONE', 56, 109); }
      c.fillStyle = '#7a1f12'; c.beginPath(); c.arc(w / 2, 8, 5, 0, 7); c.fill();
    });
    const m = add(new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.8), new THREE.MeshStandardMaterial({ map: tex, roughness: 1 })), n[0], n[1], 0.06);
    m.rotation.z = n[2];
  });
  hotspot({ id: 'work', kind: 'section', x: x, z: 6.9, radius: 1.5, look: 'board', label: 'Work experience' });
}

// ---------- Tables and seats ----------
// Seats NPCs use: position, facing (radians, 0 faces south/+z), and seat height.
export const SEATS = {};

function seat(id, kind, x, z, rot) {
  place(kind, x, z, rot);
  blockAt(x, z, 0.75, 0.75, 'seat');
  SEATS[id] = { x: x, z: z, rot: rot, y: kind === 'stool' ? 0.0 : 0.0 };
}

function buildTables() {
  // Table A: Durgin and Hilda.
  place('table', 0.5, -1.6, 0);
  blockAt(0.5, -1.6, 2.0, 2.0, 'table');
  seat('durgin', 'chair', -0.95, -1.6, Math.PI / 2);
  seat('hilda', 'chair', 1.95, -1.6, -Math.PI / 2);
  place('mug', 0.0, -1.4, 0.3, 1.0);
  place('mug', 1.0, -1.9, -0.5, 1.0);
  place('plateA', 0.5, -1.3, 0, 1.0);
  candleAt(0.6, -2.1, 1.0);

  // Table B, by the fire: Pip and Tobias.
  place('table', 4.4, 2.6, 0);
  blockAt(4.4, 2.6, 2.0, 2.0, 'table');
  seat('tobias', 'chair', 2.95, 2.6, Math.PI / 2);
  seat('pip', 'chair', 5.85, 2.6, -Math.PI / 2);
  place('mug', 3.9, 2.9, 0.8, 1.0);
  place('plateB', 4.6, 2.3, 0, 1.0);
  place('bottleTall', 4.9, 3.0, 0, 1.0);

  // Long table on the west side, under the windows.
  place('tableLong', -6.2, 0.2, 0);
  blockAt(-6.2, 0.2, 2.0, 4.0, 'table');
  seat('mara', 'stool', -7.55, -0.9, Math.PI / 2);
  place('stool', -7.55, 1.3, 0);
  place('stool', -4.85, 1.3, 0);
  place('stool', -4.85, -0.9, 0);
  blockAt(-7.55, 1.3, 0.7, 0.7, 'stool');
  blockAt(-4.85, 1.3, 0.7, 0.7, 'stool');
  blockAt(-4.85, -0.9, 0.7, 0.7, 'stool');
  place('mug', -6.5, -0.8, 0.2, 1.0);
  place('plateB', -6.0, 0.9, 0, 1.0);
  place('candles', -6.2, 0.1, 0, 1.0);
  addFlame(-6.2, 1.55, 0.1, 0.16);

  // Table C: Fenwick reading.
  place('tableSmall', -2.6, 4.2, 0);
  blockAt(-2.6, 4.2, 1.0, 1.0, 'table');
  seat('fenwick', 'chair', -3.55, 4.2, Math.PI / 2);
  candleAt(-2.4, 4.4, 1.0);

  // The stranger's corner table.
  place('tableSmall', -7.2, 6.3, 0);
  blockAt(-7.2, 6.3, 1.0, 1.0, 'table');
  seat('stranger', 'chair', -8.4, 6.3, Math.PI / 2);
  candleAt(-7.1, 6.5, 1.0, 0.7);
}

// ---------- Rain and lightning ----------
// Rain stops at the top of the visible walls so a high camera never sees it
// over the room: the ground walls downstairs, the upstairs walls upstairs.
const RAIN_TOP = 8.2;
const RAIN_TOP_GROUND = 4.2;
const rain = { lines: null, speed: 16, boxes: [] };
const lightning = { next: 8, flashes: [], level: 0, light: null };

function buildWeather() {
  // Rain falls outside each wall. A side's rain hides along with its wall,
  // so it never streaks across the camera's view of the room.
  rain.boxes = [
    { side: 'west', x0: -16, x1: -10.6, z0: -10, z1: 10 },
    { side: 'east', x0: 10.6, x1: 16, z0: -10, z1: 10 },
    { side: 'south', x0: -10, x1: 10, z0: 8.6, z1: 14 },
    { side: 'north', x0: -10, x1: 10, z0: -14, z1: -8.6 }
  ];
  const per = 450;
  const n = per * rain.boxes.length;
  const pos = new Float32Array(n * 6);
  const drops = [];
  rain.boxes.forEach(function (b) {
    for (let i = 0; i < per; i++) drops.push({ side: b.side, x: b.x0 + Math.random() * (b.x1 - b.x0), z: b.z0 + Math.random() * (b.z1 - b.z0), y: Math.random() * RAIN_TOP });
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  rain.lines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: '#8ea4d8', transparent: true, opacity: 0.45 }));
  rain.lines.frustumCulled = false;
  rain.drops = drops;
  scene.add(rain.lines);

  lightning.light = new THREE.DirectionalLight('#b8c8ff', 0);
  lightning.light.position.set(-20, 18, 4);
  scene.add(lightning.light);
}

function updateWeather(dt, t, reduceMotion) {
  const pos = rain.lines.geometry.attributes.position.array;
  rain.drops.forEach(function (d, i) {
    d.y -= rain.speed * dt;
    d.x += 2.2 * dt;
    if (d.y < 0) { d.y += RAIN_TOP; d.x -= RAIN_TOP * 0.14; }
    const k = i * 6;
    if (!sides[d.side].visible || (!upperShown && d.y > RAIN_TOP_GROUND)) { pos.fill(-50, k, k + 6); return; }
    pos[k] = d.x; pos[k + 1] = d.y; pos[k + 2] = d.z;
    pos[k + 3] = d.x - 0.08; pos[k + 4] = d.y + 0.45; pos[k + 5] = d.z;
  });
  rain.lines.geometry.attributes.position.needsUpdate = true;

  if (t > lightning.next) {
    lightning.next = t + 14 + Math.random() * 22;
    const n = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) lightning.flashes.push({ at: t + i * 0.14 + Math.random() * 0.05, dur: 0.08 });
    if (window.Sound) window.Sound.thunder(0.6 + Math.random() * 1.8);
  }
  lightning.flashes = lightning.flashes.filter(function (f) { return t < f.at + f.dur; });
  const on = lightning.flashes.some(function (f) { return t >= f.at; });
  lightning.level = reduceMotion ? 0 : (on ? 1 : Math.max(0, lightning.level - dt * 6));
  lightning.light.intensity = lightning.level * 2.5;
}

// ---------- Lights ----------
// Three point lights serve both floors: downstairs they are the fire and the
// two lanterns, upstairs they follow the player to the three nearest of the
// upstairs lamp spots, fading as they move. Point lights are the most
// expensive part of every pixel, and a fixed count means the shaders compile
// once instead of on every floor change.
const pool = [];
const upperSpots = [];
let focusX = 0, focusZ = 0;
let hemi = null;
function poolEntry(l, base, isFire) {
  return { light: l, isFire: !!isFire, phase: Math.random() * 10, ground: { pos: l.position.clone(), color: l.color.clone(), distance: l.distance, decay: l.decay, base: base }, spot: null, want: null, fade: 1 };
}
function moveTo(p, spot) {
  const g = p.ground;
  p.spot = p.want = spot;
  p.light.position.copy(spot ? spot.pos : g.pos);
  p.light.color.set(spot ? '#ffc585' : g.color);
  p.light.distance = spot ? 11 : g.distance;
  p.light.decay = spot ? 1.5 : g.decay;
}
// Picks which upstairs spots the lights should sit at, nearest first.
function aimPool() {
  const near = upperSpots.slice().sort(function (a, b) {
    return Math.hypot(a.pos.x - focusX, a.pos.z - focusZ) - Math.hypot(b.pos.x - focusX, b.pos.z - focusZ);
  }).slice(0, pool.length);
  const free = near.filter(function (s) { return !pool.some(function (p) { return p.want === s; }); });
  pool.forEach(function (p) {
    if (near.indexOf(p.want) < 0) p.want = free.shift() || null;
  });
}
function usePool(up) {
  // Downstairs the fire and lanterns also light the upstairs through the
  // floor, so the sky light makes up the difference up there.
  if (hemi) hemi.intensity = up ? 1.1 : 0.7;
  pool.forEach(function (p) { moveTo(p, null); p.fade = 1; });
  if (!up) return;
  aimPool();
  pool.forEach(function (p) { moveTo(p, p.want); });
}
// The player's position, so upstairs lights can follow them.
export function setFocus(x, z) { focusX = x; focusZ = z; }

const lamps = [];
const lanterns = [];
function buildLights() {
  hemi = new THREE.HemisphereLight('#6a78b8', '#2a1a10', 0.7);
  scene.add(hemi);
  const moon = new THREE.DirectionalLight('#7f93d6', 0.35);
  moon.position.set(-12, 10, 3);
  scene.add(moon);
  [[-5.5, 3.3, -4.6, 10], [0.5, 3.4, -1.6, 9]].forEach(function (p) {
    const l = new THREE.PointLight('#ffc585', p[3], 13, 1.5);
    l.position.set(p[0], p[1], p[2]);
    scene.add(l);
    lamps.push(l);
    pool.push(poolEntry(l, p[3]));
    // A simple hanging lantern for each light.
    const lantern = new THREE.Group();
    const frameMat = mat('#2a1d14');
    const cage = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.26, 0.45, 6), new THREE.MeshStandardMaterial({ color: '#ffcc80', emissive: '#ff9a40', emissiveIntensity: 1.4 }));
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.27, 0.2, 6), frameMat);
    cap.position.y = 0.33;
    const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.3, 4), frameMat);
    chain.position.y = 0.58;
    lantern.add(cage, cap, chain);
    lantern.position.set(p[0], p[1], p[2]);
    scene.add(lantern);
    lanterns.push(lantern);
  });
}

// ---------- Public ----------
export function build(s) {
  scene = s;
  buildShell();
  buildBar();
  buildFireplace();
  buildQuestBoard();
  buildTables();
  buildWeather();
  buildLights();

  upper = new THREE.Group();
  upper.visible = false;
  scene.add(upper);
  ['north', 'south', 'west', 'east'].forEach(function (n) {
    sidesUp[n] = new THREE.Group();
    upper.add(sidesUp[n]);
  });
  floor = 1;
  target = upper;
  buildUpstairs({
    THREE: THREE, scene: scene, upper: upper, place: place, box: box, mat: mat, dim: dim,
    block: block, blockAt: blockAt, hotspot: hotspot, onWall: onWall, candleAt: candleAt,
    woodTexture: woodTexture, canvasTexture: canvasTexture, flickers: flickers, fadeWalls: fadeWalls, upperSpots: upperSpots,
    setTarget: function (t) { target = t; }, setFloor: function (f) { floor = f; }, UPPER_Y: UPPER_Y
  });
  target = null;
  floor = 0;
  usePool(false);
  return { colliders: colliders, hotspots: hotspots, lightning: lightning };
}

// Shows the upstairs only while the player is up there, so it never hides
// the ground floor.
export function showUpper(on) {
  if (on !== upperShown) usePool(on);
  upperShown = on;
  upper.visible = on;
}

// Floor height under a point: the stair ramp, or the floor the walker is on.
// Returns which floor they now count as being on.
export function heightAt(x, z, level) {
  if (x >= STAIRS.x0 && x <= STAIRS.x1 && z >= STAIRS.z0 && z <= STAIRS.z1) {
    const y = UPPER_Y * Math.max(0, Math.min(1, (STAIRS.x1 - x) / (STAIRS.x1 - STAIRS.x0)));
    return { y: y, level: y > UPPER_Y / 2 ? 1 : 0 };
  }
  return { y: level ? UPPER_Y : 0, level: level };
}

// Hides the wall between the camera and the room, like a dollhouse.
export function cutaway(cam) {
  sides.north.visible = cam.z > ROOM.minZ - 0.1;
  sides.south.visible = cam.z < ROOM.maxZ + 0.1;
  sides.west.visible = cam.x > ROOM.minX - 0.1;
  sides.east.visible = cam.x < ROOM.maxX + 0.1;
  ['north', 'south', 'west', 'east'].forEach(function (n) { sidesUp[n].visible = sides[n].visible; });
  // Hanging lanterns vanish when the camera swings right into them.
  lanterns.forEach(function (l) { l.visible = cam.distanceTo(l.position) > 2.2; });
}

// Upstairs inner walls turn see-through when they stand between the camera
// and the player.
export function fadeBetween(cam, p) {
  fadeWalls.forEach(function (w) {
    const hit = upperShown && segmentHitsBox(cam.x, cam.z, p.x, p.z, w.box);
    const goal = hit ? 0.18 : 1;
    w.material.opacity += (goal - w.material.opacity) * 0.2;
    w.material.depthWrite = w.material.opacity > 0.9;
  });
}

function segmentHitsBox(ax, az, bx, bz, b) {
  let t0 = 0, t1 = 1;
  const dx = bx - ax, dz = bz - az;
  const tests = [[-dx, ax - b.minX], [dx, b.maxX - ax], [-dz, az - b.minZ], [dz, b.maxZ - az]];
  for (let i = 0; i < 4; i++) {
    const pp = tests[i][0], q = tests[i][1];
    if (pp === 0) { if (q < 0) return false; continue; }
    const r = q / pp;
    if (pp < 0) { if (r > t1) return false; if (r > t0) t0 = r; }
    else { if (r < t0) return false; if (r < t1) t1 = r; }
  }
  return true;
}

export function update(dt, t, reduceMotion) {
  fire.flames.forEach(function (f) {
    const u = f.userData;
    const k = reduceMotion ? 1 : 0.8 + 0.35 * Math.sin(t * u.speed + u.phase) * Math.sin(t * u.speed * 0.53 + u.phase * 2);
    f.scale.set(1, k, 1);
    f.position.y = u.base - (1 - k) * u.h * 0.5;
  });
  const flick = reduceMotion ? 1 : 0.88 + 0.08 * Math.sin(t * 9.1) + 0.05 * Math.sin(t * 23.7);
  fire.glow.material.opacity = 0.55 * flick;
  if (upperShown) aimPool();
  pool.forEach(function (p) {
    // A light leaving for another spot fades out, moves, and fades back in.
    if (p.want !== p.spot) {
      p.fade -= dt * 4;
      if (p.fade <= 0) { p.fade = 0; moveTo(p, p.want); }
    } else p.fade = Math.min(1, p.fade + dt * 4);
    const fireNow = p.isFire && !p.spot;
    const k = fireNow ? flick : reduceMotion ? 1 : 0.9 + 0.06 * Math.sin(t * 11 + p.phase) + 0.04 * Math.sin(t * 27 + p.phase);
    p.light.intensity = (p.spot ? p.spot.base * 1.4 : p.ground.base) * k * p.fade;
  });
  flickers.forEach(function (f) {
    const k = reduceMotion ? 1 : 0.9 + 0.06 * Math.sin(t * 11 + f.phase) + 0.04 * Math.sin(t * 27 + f.phase);
    f.sprite.scale.setScalar(f.base * k);
  });
  const ep = fire.embers.geometry.attributes.position.array;
  fire.embers.userData.seeds.forEach(function (s, i) {
    s.t += dt * s.s * 0.5;
    if (s.t > 1) s.t -= 1;
    ep[i * 3] = 8.95 + s.x + Math.sin(t * 2 + i) * 0.05;
    ep[i * 3 + 1] = 0.5 + s.t * 1.2;
    ep[i * 3 + 2] = fire.embers.userData.zc + s.z * (1 - s.t * 0.5);
  });
  fire.embers.geometry.attributes.position.needsUpdate = true;
  updateWeather(dt, t, reduceMotion);
}

// Sound panning and other code use this to find the fire.
export const FIRE_POS = new THREE.Vector3(8.8, 0.8, -1.2);

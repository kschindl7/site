/*
 * The second floor: stairs up from the taproom, a hallway around the
 * stairwell, two small bedrooms, and a large bedroom with a canopy bed.
 *
 * Layout upstairs (x west to east, z north to south):
 *   large bedroom   x -9.5..-2,   z -7.5..7.5 (windows on the west wall)
 *   hallway         x -2..9.5,    z -7.5..1.5 (stairwell in its north-east corner)
 *   small bedroom A x -2..3.75,   z 1.5..7.5  (window on the south wall)
 *   small bedroom B x 3.75..9.5,  z 1.5..7.5  (windows on the south and east walls)
 */

// The stair ramp's footprint. The low end is at x1 (east), the top at x0.
export const STAIRS = { x0: 3.3, x1: 9.3, z0: -7.5, z1: -4.2 };

const WALL_H = 2.8;

let K, THREE, U;

export function buildUpstairs(kit) {
  K = kit;
  THREE = kit.THREE;
  U = kit.UPPER_Y;
  buildStairs();
  buildFloor();
  buildOuterWalls();
  buildInnerWalls();
  buildLargeBedroom();
  buildSmallBedrooms();
  buildHallway();
}

function wood(color) { return K.mat(color, { map: K.woodTexture(color) }); }

// ---------- Stairs (on the ground floor, always visible) ----------
function buildStairs() {
  K.setTarget(K.scene);
  K.setFloor(0);
  K.place('stairs', STAIRS.x0, (STAIRS.z0 + STAIRS.z1) / 2, Math.PI / 2);
  // Ground floor: you can only step onto the stairs at the low east end.
  K.block(STAIRS.x0 - 0.3, STAIRS.x1 - 1.0, STAIRS.z1 - 0.15, STAIRS.z1 + 0.1, 'stair rail');
  K.block(STAIRS.x0 - 0.3, STAIRS.x0 + 0.1, STAIRS.z0, STAIRS.z1, 'under stairs');
  railing(STAIRS.x0 + 0.2, STAIRS.x1 - 0.9, STAIRS.z1 - 0.05, true);

  K.setTarget(K.upper);
  K.setFloor(1);
  // Upstairs: a rail around the stairwell, open at the top step.
  K.block(STAIRS.x0, 9.5, STAIRS.z1 - 0.15, STAIRS.z1 + 0.15, 'stairwell rail');
  railing(STAIRS.x0 + 0.1, 9.45, STAIRS.z1 + 0.05, false);
}

// Posts and a handrail. On the stairs the rail follows the slope.
function railing(xa, xb, z, sloped) {
  const m = wood('#5e3a20');
  const yAt = function (x) {
    if (!sloped) return U;
    return U * Math.max(0, Math.min(1, (STAIRS.x1 - x) / (STAIRS.x1 - STAIRS.x0)));
  };
  const n = Math.max(2, Math.round((xb - xa) / 1.1) + 1);
  for (let i = 0; i < n; i++) {
    const x = xa + (xb - xa) * i / (n - 1);
    K.box(0.12, 1.0, 0.12, m, x, yAt(x), z);
  }
  const len = Math.hypot(xb - xa, yAt(xa) - yAt(xb));
  const rail = K.box(len, 0.1, 0.16, m, (xa + xb) / 2, 0, z);
  rail.position.y = (yAt(xa) + yAt(xb)) / 2 + 1.0;
  rail.rotation.z = Math.atan2(yAt(xb) - yAt(xa), xb - xa);
}

// ---------- Floor ----------
function buildFloor() {
  for (let x = -8; x <= 8; x += 4) {
    for (let z = -6; z <= 6; z += 4) {
      if (z === -6 && x >= 4) continue; // the stairwell
      K.place((x + z) % 8 === 0 ? 'floorDark' : 'floor', x, z, 0, U - 0.05);
    }
  }
  const boards = wood('#8a5a32');
  K.box(1.3, 0.15, 4.0, boards, 2.65, U - 0.15, -6.0);
  K.box(8.0, 0.15, 0.2, boards, 6.0, U - 0.15, -4.1);
  // Floor edge seen from the stairwell.
  K.box(6.3, 0.35, 0.12, wood('#5e3a20'), 6.35, U - 0.35, STAIRS.z1 + 0.02);
}

// ---------- Outer walls ----------
function buildOuterWalls() {
  const H = Math.PI / 2;
  K.onWall('north', function () {
    K.place('wall', -8, -8, 0, U);
    K.place('wall', -4, -8, 0, U);
    K.place('wallWindow', 0, -8, 0, U);
    K.place('wall', 4, -8, 0, U);
    K.place('wall', 8, -8, 0, U);
  });
  K.onWall('south', function () {
    K.place('wall', -8, 8, Math.PI, U);
    K.place('wall', -4, 8, Math.PI, U);
    K.place('wallWindow', 0, 8, Math.PI, U);
    K.place('wall', 4, 8, Math.PI, U);
    K.place('wallWindow', 8, 8, Math.PI, U);
  });
  K.onWall('west', function () {
    K.place('wall', -10, -6, H, U);
    K.place('wallWindow', -10, -2, H, U);
    K.place('wallWindow', -10, 2, H, U);
    K.place('wall', -10, 6, H, U);
  });
  K.onWall('east', function () {
    K.place('wall', 10, -6, -H, U);
    K.place('wall', 10, -2, -H, U);
    K.place('wall', 10, 2, -H, U);
    K.place('wallWindow', 10, 6, -H, U);
  });
  [[-9.4, -2], [-9.4, 2]].forEach(function (p) { K.hotspot({ id: 'window', kind: 'flavor', x: p[0], z: p[1], radius: 1.4 }); });
  [[0, 7.4], [8, 7.4], [0, -7.4]].forEach(function (p) { K.hotspot({ id: 'window', kind: 'flavor', x: p[0], z: p[1], radius: 1.4 }); });
  K.hotspot({ id: 'window', kind: 'flavor', x: 9.4, z: 6, radius: 1.4 });
}

// ---------- Inner walls: half-timbered plaster ----------
let plasterTex = null;
function plasterMaterial() {
  if (!plasterTex) {
    plasterTex = K.canvasTexture(128, 128, function (g, w, h) {
      g.fillStyle = '#e4d6b8';
      g.fillRect(0, 0, w, h);
      for (let i = 0; i < 40; i++) {
        g.fillStyle = 'rgba(120,90,50,' + (0.03 + Math.random() * 0.05) + ')';
        g.fillRect(Math.random() * w, Math.random() * h, 6 + Math.random() * 18, 3 + Math.random() * 8);
      }
      g.fillStyle = '#5a3a1e';
      g.fillRect(0, 0, w, 14);
      g.fillRect(0, h - 10, w, 10);
    });
  }
  // Each wall gets its own material so it can fade on its own.
  return K.mat('#ffffff', { map: plasterTex, transparent: true, opacity: 1 });
}

function innerWall(x0, x1, z0, z1, h, y) {
  const material = plasterMaterial();
  const m = K.box(x1 - x0, h || WALL_H, z1 - z0, material, (x0 + x1) / 2, y === undefined ? U : y, (z0 + z1) / 2);
  const box = { minX: x0, maxX: x1, minZ: z0, maxZ: z1 };
  K.fadeWalls.push({ material: material, box: box });
  if (y === undefined) K.block(x0, x1, z0, z1, 'wall');
  return m;
}

function doorway(x0, x1, z0, z1) {
  // A lintel over the gap and dark posts at each side.
  innerWall(x0, x1, z0, z1, 0.5, U + WALL_H - 0.5);
  const post = wood('#4e2f18');
  const alongX = x1 - x0 > z1 - z0;
  [[x0, z0], [x1, z1]].forEach(function (p) {
    K.box(alongX ? 0.14 : 0.24, WALL_H - 0.5, alongX ? 0.24 : 0.14, post, p[0], U, p[1] + (alongX ? (z1 - z0) / 2 : 0));
  });
}

function buildInnerWalls() {
  // Large bedroom wall, door from the hallway.
  innerWall(-2.1, -1.9, -7.5, -1.8);
  doorway(-2.1, -1.9, -1.8, -0.4);
  innerWall(-2.1, -1.9, -0.4, 7.5);
  // Hallway wall along the two small bedrooms, a door into each.
  innerWall(-1.9, 0.2, 1.4, 1.6);
  doorway(0.2, 1.6, 1.4, 1.6);
  innerWall(1.6, 6.0, 1.4, 1.6);
  doorway(6.0, 7.4, 1.4, 1.6);
  innerWall(7.4, 9.5, 1.4, 1.6);
  // Between the small bedrooms.
  innerWall(3.65, 3.85, 1.6, 7.5);
}

// ---------- Large bedroom ----------
function buildLargeBedroom() {
  const bx = -5.75, bz = 5.6;
  K.place('bedDouble', bx, bz, Math.PI, U);
  K.blockAt(bx, bz, 3.4, 3.3, 'bed');
  canopy(bx, bz, 3.3, 3.2);
  K.place('trunk', bx, bz - 2.3, 0, U);
  K.blockAt(bx, bz - 2.3, 1.6, 1.4, 'trunk');
  const rug = K.place('rugOval', bx, 0.6, 0, U);
  rug.scale.setScalar(1.4);
  K.dim(rug, 0.6);

  K.place('wardrobe', -6.2, -6.95, 0, U);
  K.blockAt(-6.2, -6.95, 2.1, 1.1, 'wardrobe');
  K.place('tableSmall', -8.8, -4.6, 0, U);
  K.blockAt(-8.8, -4.6, 1.0, 1.0, 'desk');
  K.place('chairWood', -7.9, -4.6, -Math.PI / 2, U);
  K.blockAt(-7.9, -4.6, 0.8, 0.8, 'chair');
  K.candleAt(-8.8, -4.6, U + 1.0);
  K.place('painting', -3.6, -7.45, 0, U + 1.5).scale.setScalar(1.2);
  K.candleAt(-3.2, 7.2, U, 0.9);

  light(bx, U + 2.6, 1.5, 7);
  K.hotspot({ id: 'canopy', kind: 'flavor', x: bx, z: bz, radius: 1.9 });
}

// Four posts, a fabric roof, a valance, and curtains tied back at each post.
function canopy(cx, cz, w, d) {
  const post = wood('#4a2a14');
  const velvet = K.mat('#7a1620', { roughness: 0.95 });
  const gold = K.mat('#c9a24a', { roughness: 0.5, metalness: 0.3 });
  const H = 3.2;
  const hx = w / 2 - 0.1, hz = d / 2 - 0.1;
  [[-hx, -hz], [hx, -hz], [-hx, hz], [hx, hz]].forEach(function (c) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, H, 8), post);
    p.position.set(cx + c[0], U + H / 2, cz + c[1]);
    K.upper.add(p);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), gold);
    knob.position.set(cx + c[0], U + H + 0.08, cz + c[1]);
    K.upper.add(knob);
    // Gathered curtain: a tall narrow cone pinched at the tie.
    const upperCloth = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.08, 1.4, 8), velvet);
    upperCloth.position.set(cx + c[0] * 0.94, U + H - 0.75, cz + c[1] * 0.94);
    const lowerCloth = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.26, 1.6, 8), velvet);
    lowerCloth.position.set(cx + c[0] * 0.94, U + 0.85, cz + c[1] * 0.94);
    const tie = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.03, 6, 10), gold);
    tie.rotation.x = Math.PI / 2;
    tie.position.set(cx + c[0] * 0.94, U + 1.65, cz + c[1] * 0.94);
    K.upper.add(upperCloth, lowerCloth, tie);
  });
  K.box(w + 0.1, 0.06, d + 0.1, velvet, cx, U + H, cz);
  // Valance with a gold trim along the bottom edge.
  [[0, -d / 2, w, 0.06], [0, d / 2, w, 0.06], [-w / 2, 0, 0.06, d], [w / 2, 0, 0.06, d]].forEach(function (v) {
    K.box(v[2] + 0.12, 0.4, v[3] + 0.12, velvet, cx + v[0], U + H - 0.4, cz + v[1]);
    K.box(v[2] + 0.14, 0.06, v[3] + 0.14, gold, cx + v[0], U + H - 0.44, cz + v[1]);
  });
}

// ---------- Small bedrooms ----------
function buildSmallBedrooms() {
  // Room A.
  K.place('bedSingle', -0.6, 5.9, Math.PI, U);
  K.blockAt(-0.6, 5.9, 1.8, 3.2, 'bed');
  K.place('trunkSmall', -0.6, 3.75, 0, U);
  K.blockAt(-0.6, 3.75, 1.0, 0.9, 'trunk');
  K.place('tableSmall', 2.9, 6.7, 0, U);
  K.blockAt(2.9, 6.7, 1.0, 1.0, 'table');
  K.candleAt(2.9, 6.7, U + 1.0);
  const rugA = K.place('rugPlain', 1.6, 4.1, Math.PI / 2, U);
  K.dim(rugA, 0.55);
  light(1.0, U + 2.6, 4.5, 5);
  K.hotspot({ id: 'bed', kind: 'flavor', x: -0.6, z: 5.9, radius: 1.4 });

  // Room B.
  K.place('bedSingleAlt', 5.1, 5.9, Math.PI, U);
  K.blockAt(5.1, 5.9, 1.8, 3.2, 'bed');
  K.place('trunkSmall', 5.1, 3.75, 0, U);
  K.blockAt(5.1, 3.75, 1.0, 0.9, 'trunk');
  K.place('wardrobe', 9.0, 3.3, -Math.PI / 2, U);
  K.blockAt(9.0, 3.3, 1.1, 2.1, 'wardrobe');
  const rugB = K.place('rugPlain', 7.2, 5.0, 0, U);
  K.dim(rugB, 0.55);
  K.candleAt(7.4, 7.2, U, 0.9);
  light(6.7, U + 2.6, 4.5, 5);
  K.hotspot({ id: 'bed', kind: 'flavor', x: 5.1, z: 5.9, radius: 1.4 });
}

// ---------- Hallway ----------
function buildHallway() {
  const rug = K.place('rugPlain', 0.8, -1.6, 0, U);
  rug.scale.set(1.5, 1, 1.2);
  K.dim(rug, 0.55);
  K.place('tableSmall', -1.2, -6.9, 0, U);
  K.blockAt(-1.2, -6.9, 1.0, 1.0, 'table');
  K.candleAt(-1.2, -6.9, U + 1.0);
  K.place('stool', 0.6, -7.0, 0, U);
  K.place('stool', 1.5, -7.0, 0, U);
  K.blockAt(1.05, -7.0, 1.7, 0.7, 'stools');
  K.place('barrelSmall', 9.0, -3.4, 0, U);
  K.blockAt(9.0, -3.4, 1.0, 1.0, 'barrel');
  light(2.5, U + 2.8, -2.0, 6);
}

function light(x, y, z, intensity) {
  const l = new THREE.PointLight('#ffc585', 0, 11, 1.5);
  l.position.set(x, y, z);
  K.upper.add(l);
  K.flickers.push({ light: l, base: intensity, phase: Math.random() * 10, level: 1 });
}

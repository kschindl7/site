/*
 * The inn's regulars in 3D: who they are, where they sit, how they idle, and
 * the scripted banter they trade (the same lines as the pixel version).
 */
import * as THREE from 'three';
import { character } from './assets.js';
import { SEATS } from './world.js';
import * as Nav from './nav.js';

const rand = Math.random;
const between = function (a, b) { return a + rand() * (b - a); };

// Seated characters sit a little lower than the chair origin suggests.
const SIT_DROP = -0.02;

export const DEFS = [
  {
    id: 'brom', name: 'Brom the Barkeep', short: 'Brom', model: 'barbarian', show: ['Mug'], hide: ['Barbarian_Hat'], tint: '#ffe6cc',
    stand: { x: -6.0, z: -6.5, rot: 0 }, section: 'about',
    // Visitors talk to Brom from the customer side of the counter.
    talkZ: -4.5,
    intro: ['Ah, a new face! Ye\'ll be wanting to hear about Kyle, I reckon.', 'Pull up a stool. I know the lad better than most.']
  },
  {
    id: 'elsa', name: 'Elsa', model: 'rogue', tint: '#ffd9e4',
    stand: { x: -1.0, z: -3.9, rot: -Math.PI / 2 },
    lines: [
      'Welcome to the Wayward Lantern! Brom has the stories, the quest board has the work, and the fireplace has... well, the trophies.',
      'Don\'t mind the stranger in the corner. He tips well. I think.',
      'If you\'re looking for Kyle\'s work history, try the quest board by the door.'
    ]
  },
  {
    id: 'durgin', name: 'Durgin', model: 'barbarian', show: ['Mug'], seat: 'durgin',
    lines: ['Kyle? Good lad. Bought me a drink once. Or I bought him one. Hard to say.', 'Another round! ...Oh, you\'re not Elsa.']
  },
  {
    id: 'hilda', name: 'Hilda', model: 'rogue', tint: '#c8e0ff', seat: 'hilda',
    lines: ['If you want the real story, ask Brom. He knows everyone\'s business.', 'Durgin owes me six silver. Don\'t let him tell you otherwise.']
  },
  {
    id: 'tobias', name: 'Old Tobias', model: 'mage', tint: '#d8d0c0', seat: 'tobias', sleep: true,
    lines: ['Zzz... the quest board... by the door... zzz...', '*snore* ...I was awake the whole time... *snore*']
  },
  {
    id: 'pip', name: 'Pip the Bard', model: 'mage', tint: '#ffd6a0', seat: 'pip', lute: true,
    lines: ['Care for a song? No? Then take a look by the fireplace. Kyle\'s trophies hang there.', 'I\'m writing a ballad about this inn. Nothing rhymes with "Lantern."']
  },
  {
    id: 'mara', name: 'Sergeant Mara', model: 'knight', tint: '#d0ffd8', seat: 'mara',
    lines: ['Quiet night, traveler. Let\'s keep it that way.', 'Off duty. Mostly.']
  },
  {
    id: 'fenwick', name: 'Fenwick', model: 'mage', show: ['Spellbook_open'], tint: '#c0f0ff', seat: 'fenwick',
    lines: ['I\'m told the quest board lists every job Kyle has taken. Quite the list.', 'Shh. I\'m at the good part.']
  },
  {
    id: 'stranger', name: 'Hooded Stranger', short: 'Stranger', model: 'hooded', tint: '#9a9ab0', seat: 'stranger',
    section: 'other',
    intro: ['...You found me. Few think to look in the corner.', 'I keep the things that fit nowhere else. Look, if you dare.']
  },
  {
    id: 'cat', name: 'The Cat', cat: true, stand: { x: 7.3, z: -0.4, rot: -2.2 },
    lines: ['Mrrrow.', 'The cat opens one eye, judges you, and goes back to sleep.']
  }
];

const list = [];
const byId = {};
let scene, layer, hooks;
let now = 0;

// ---------- Building ----------
function blobShadow() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 4, 32, 32, 32);
  grad.addColorStop(0, 'rgba(0,0,0,0.55)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.4), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.03;
  return m;
}
export { blobShadow };

function buildCat() {
  const fur = new THREE.MeshStandardMaterial({ color: '#3b3433', roughness: 1, flatShading: true });
  const belly = new THREE.MeshStandardMaterial({ color: '#cdb9a3', roughness: 1, flatShading: true });
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 6), fur);
  body.scale.set(1.25, 0.6, 1);
  body.position.y = 0.2;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 6), fur);
  head.position.set(0.32, 0.22, 0.12);
  const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 4), belly);
  muzzle.position.set(0.45, 0.18, 0.16);
  const earL = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.13, 4), fur);
  earL.position.set(0.3, 0.38, 0.04);
  const earR = earL.clone();
  earR.position.set(0.36, 0.37, 0.2);
  const tail = new THREE.Group();
  const tailMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, 0.6, 5), fur);
  tailMesh.rotation.z = Math.PI / 2;
  tailMesh.position.x = -0.3;
  tail.add(tailMesh);
  tail.position.set(-0.3, 0.08, 0.15);
  g.add(body, head, muzzle, earL, earR, tail);
  g.userData = { body: body, tail: tail };
  return g;
}

function makeLute() {
  const wood = new THREE.MeshStandardMaterial({ color: '#b07438', roughness: 0.7, flatShading: true });
  const dark = new THREE.MeshStandardMaterial({ color: '#4a2a12', roughness: 0.8, flatShading: true });
  const g = new THREE.Group();
  const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), wood);
  bowl.scale.set(1, 1.25, 0.5);
  const hole = new THREE.Mesh(new THREE.CircleGeometry(0.06, 8), dark);
  hole.position.z = 0.112;
  const neck = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.5, 0.05), dark);
  neck.position.y = 0.48;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.16, 0.05), dark);
  head.position.set(0, 0.76, -0.04);
  head.rotation.x = -0.6;
  g.add(bowl, hole, neck, head);
  return g;
}

function zSprite() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#e8ecff';
  g.font = 'bold 52px Georgia, serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('z', 32, 34);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
  s.scale.setScalar(0.32);
  return s;
}

export function init(s, opts) {
  scene = s;
  layer = opts.layer;
  hooks = opts;
  DEFS.forEach(function (d) {
    const n = Object.assign({ x: 0, z: 0, rot: 0, lineIdx: 0, talkUntil: 0, bubble: null, bubbleUntil: 0, path: [], wait: between(1, 4), state: 'idle' }, d);
    if (d.cat) {
      n.root = buildCat();
      n.x = d.stand.x; n.z = d.stand.z; n.rot = d.stand.rot;
      n.headY = 0.7;
      n.radius = 0.5;
    } else {
      n.rig = character(d.model, { tint: d.tint, show: d.show, hide: d.hide });
      n.root = n.rig.root;
      n.radius = 0.45;
      if (d.seat) {
        const st = SEATS[d.seat];
        n.x = st.x; n.z = st.z; n.rot = st.rot;
        n.seated = true;
        n.root.position.y = SIT_DROP;
        n.rig.play('sit', { offset: rand() * 3 });
        n.headY = 2.45;
      } else {
        n.x = d.stand.x; n.z = d.stand.z; n.rot = d.stand.rot;
        n.rig.play('idle', { offset: rand() });
        n.headY = 2.75;
        n.shadow = blobShadow();
        scene.add(n.shadow);
      }
      n.head = n.rig.find('head');
    }
    if (d.lute) {
      n.lute = makeLute();
      n.lute.position.set(0.15, 1.05, 0.42);
      n.lute.rotation.set(0.15, 0.2, 1.05);
      n.root.add(n.lute);
    }
    if (d.sleep) {
      n.zs = [zSprite(), zSprite(), zSprite()];
      n.zs.forEach(function (z) { scene.add(z); });
    }
    n.root.position.x = n.x;
    n.root.position.z = n.z;
    n.root.rotation.y = n.rot;
    n.root.traverse(function (o) { o.userData.npc = n.id; });
    scene.add(n.root);
    list.push(n);
    byId[n.id] = n;
  });
  elsa.target = null;
}

// ---------- Elsa walks between the bar and the tables ----------
const SPOTS = {
  bar: { x: -1.0, z: -3.9, rot: -Math.PI / 2 },
  tableA: { x: 0.5, z: -0.15, rot: Math.PI },
  tableB: { x: 4.4, z: 4.05, rot: Math.PI },
  tableC: { x: -2.6, z: 5.25, rot: Math.PI }
};
const elsa = { target: null, queued: null, at: 'bar' };

function sendElsa(spot) {
  elsa.queued = spot;
  const e = byId.elsa;
  if (e.state !== 'walk') e.wait = Math.min(e.wait, 0.4);
}

function walkTo(n, path) {
  n.path = path;
  n.state = 'walk';
  n.rig.play('walk');
}

// Steps along n.path. Returns true on arrival.
function stepPath(n, dt, speed) {
  if (!n.path.length) return true;
  const p = n.path[0];
  const dx = p.x - n.x, dz = p.z - n.z;
  const d = Math.hypot(dx, dz);
  // Wait politely if the player is in the way.
  const pl = hooks.player();
  const ahead = Math.hypot(pl.x - (n.x + dx / Math.max(d, 0.01) * 0.6), pl.z - (n.z + dz / Math.max(d, 0.01) * 0.6));
  if (ahead < 0.75) {
    if (n.rig.current() !== n.rig.actions.idle) n.rig.play('idle', { fade: 0.2 });
    n.blockedFor = (n.blockedFor || 0) + dt;
    return false;
  }
  n.blockedFor = 0;
  if (n.rig.current() !== n.rig.actions.walk) n.rig.play('walk', { fade: 0.2 });
  const step = Math.min(d, speed * dt);
  if (d > 0.001) {
    n.x += dx / d * step;
    n.z += dz / d * step;
    turnToward(n, Math.atan2(dx, dz), dt);
  }
  if (d - step < 0.05) n.path.shift();
  return !n.path.length;
}

function turnToward(n, target, dt, rate) {
  let diff = target - n.rot;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  n.rot += diff * Math.min(1, dt * (rate || 10));
}

function updateElsa(e, dt, t) {
  if (t < e.talkUntil) { faceTalk(e, dt); return; }
  if (e.state === 'walk') {
    if (!stepPath(e, dt, 2.2)) return;
    const spot = SPOTS[elsa.target];
    e.state = 'turn';
    e.turnTo = spot.rot;
    e.rig.play('idle');
    elsa.at = elsa.target;
    e.wait = between(3, 6);
    onArrive(elsa.target);
    return;
  }
  if (e.state === 'turn') turnToward(e, e.turnTo, dt, 6);
  e.wait -= dt;
  if (e.wait > 0) return;
  let target = elsa.queued;
  elsa.queued = null;
  if (!target) target = elsa.at !== 'bar' ? 'bar' : ['tableA', 'tableB', 'tableC'][Math.floor(rand() * 3)];
  if (elsa.at === target) { e.wait = between(2, 4); return; }
  const spot = SPOTS[target];
  const path = Nav.findPath(e.x, e.z, spot.x, spot.z);
  if (!path) { e.wait = 1; return; }
  elsa.at = null;
  elsa.target = target;
  walkTo(e, path);
}

// ---------- Brom paces behind the bar ----------
function updateBrom(b, dt, t) {
  if (t < b.talkUntil) { faceTalk(b, dt); return; }
  const p = hooks.player();
  const nearBar = p.z < -2.5 && p.z > -4.6 && p.x < -1.5;
  if (b.goal === undefined) b.goal = b.x;
  b.wait -= dt;
  if (nearBar && Math.abs(b.goal - clampBar(p.x)) > 0.6 && b.wait > 0.3) b.wait = 0.3;
  if (b.wait <= 0) {
    b.wait = between(4, 9);
    b.goal = nearBar ? clampBar(p.x) : between(-8.4, -3.4);
  }
  const dx = b.goal - b.x;
  if (Math.abs(dx) > 0.05) {
    if (b.rig.current() !== b.rig.actions.walk) b.rig.play('walk', { fade: 0.2 });
    b.x += Math.sign(dx) * Math.min(Math.abs(dx), 1.8 * dt);
    turnToward(b, dx > 0 ? Math.PI / 2 : -Math.PI / 2, dt);
  } else {
    if (b.rig.current() === b.rig.actions.walk) b.rig.play('idle', { fade: 0.25 });
    turnToward(b, 0, dt, 6);
  }
}
function clampBar(x) { return Math.max(-8.4, Math.min(-3.4, x)); }

// Standing characters turn toward the visitor while talking.
function faceTalk(n, dt) {
  const p = hooks.player();
  turnToward(n, Math.atan2(p.x - n.x, p.z - n.z), dt, 8);
  if (n.rig && n.rig.current() === n.rig.actions.walk) n.rig.play('idle', { fade: 0.2 });
}

// ---------- Pip's lute ----------
const SCALE = [293.66, 329.63, 369.99, 440, 493.88, 587.33, 659.25];
const pip = { playing: false, until: between(3, 6), next: 0, step: 3, notes: [] };

function noteSprite() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#ffe680';
  g.font = 'bold 48px serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('♪', 32, 34);
  return new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false });
}
let noteMat = null;

function updatePip(n, dt, t) {
  if (t > pip.until) {
    pip.playing = !pip.playing;
    pip.until = t + (pip.playing ? between(6, 11) : between(6, 14));
  }
  if (n.lute) n.lute.rotation.z = 1.05 + (pip.playing ? Math.sin(t * 16) * 0.03 : 0);
  if (pip.playing && t >= pip.next) {
    pip.next = t + (rand() < 0.25 ? 0.6 : 0.32);
    pip.step = Math.max(0, Math.min(SCALE.length - 1, pip.step + Math.floor(between(-2, 3))));
    if (window.Sound) window.Sound.pluck(SCALE[pip.step], hooks.panFor(n.x, n.z));
    if (rand() < 0.5) {
      if (!noteMat) noteMat = noteSprite();
      const s = new THREE.Sprite(noteMat.clone());
      s.scale.setScalar(0.35);
      s.position.set(n.x - 0.3, 1.6, n.z);
      s.userData.born = t;
      scene.add(s);
      pip.notes.push(s);
    }
  }
  for (let i = pip.notes.length - 1; i >= 0; i--) {
    const s = pip.notes[i];
    const age = t - s.userData.born;
    if (age > 2) { scene.remove(s); s.material.dispose(); pip.notes.splice(i, 1); continue; }
    s.position.y += dt * 0.6;
    s.position.x += Math.sin(age * 4) * dt * 0.3;
    s.material.opacity = 1 - age / 2;
  }
}

// ---------- Banter ----------
const SCENES = [
  { lines: [['durgin', 'Another round!'], ['hilda', 'You said that three rounds ago.'], ['durgin', 'And I was right then, too!']], laugh: true },
  { lines: [['brom', 'Elsa! The fireside table is running dry!'], ['elsa', 'Coming, coming!']], after: function () { sendElsa('tableB'); } },
  { lines: [['pip', '♪ Oh, the rain on the roof and the ale in my cup... ♪'], ['tobias', 'Zzz... five more minutes...']] },
  { lines: [['mara', 'Quiet night.'], ['brom', 'Quiet is good. Nobody breaks the chairs.']] },
  { lines: [['fenwick', 'Has anyone actually talked to the stranger?'], ['hilda', 'Not on purpose.']], laugh: true },
  { lines: [['hilda', 'Bet you can\'t finish that in one go.'], ['durgin', 'Watch me.'], ['durgin', '*hic*']], laugh: true },
  { lines: [['brom', 'Mind the cat. She bites.'], ['mara', 'The cat, or Elsa?'], ['elsa', 'Both!']], laugh: true },
  { lines: [['stranger', '...'], ['fenwick', 'Did he just say something?'], ['hilda', 'Don\'t look. Just don\'t.']] },
  { lines: [['durgin', 'To Brom, finest barkeep in the realm!'], ['hilda', 'To Brom!'], ['brom', 'Flattery won\'t cover your tab.']], clink: true, laugh: true, cheer: 'brom' },
  { lines: [['brom', 'Elsa, check on Fenwick. He\'s been on that page an hour.'], ['elsa', 'On my way.']], after: function () { sendElsa('tableC'); } },
  { at: 'tableA', lines: [['elsa', 'Top you off?'], ['durgin', 'Now you\'re speaking my language!']], clink: true },
  { at: 'tableB', lines: [['elsa', 'Pip, play something cheerful.'], ['pip', 'Every song is cheerful if you drink enough.']], laugh: true },
  { at: 'tableB', lines: [['elsa', 'Tobias? Tobias. ...He\'s fine.']] },
  { at: 'tableC', lines: [['elsa', 'Good book?'], ['fenwick', 'A dragon just ate the hero. On page twelve.']], laugh: true }
];
const banter = { scene: null, idx: 0, lineEnd: 0, nextAt: 6, last: null };

function startScene(s, t) {
  banter.scene = s;
  banter.idx = -1;
  banter.lineEnd = t;
  banter.last = s;
}

function onArrive(spot) {
  if (banter.scene || rand() < 0.35) return;
  const options = SCENES.filter(function (s) { return s.at === spot; });
  if (options.length) startScene(options[Math.floor(rand() * options.length)], now);
}

function updateBanter(t, paused) {
  const s = banter.scene;
  if (s) {
    if (t < banter.lineEnd) return;
    banter.idx++;
    if (banter.idx >= s.lines.length) {
      const last = byId[s.lines[s.lines.length - 1][0]];
      const pan = hooks.panFor(last.x, last.z);
      if (s.clink && window.Sound) window.Sound.clink(pan, 3);
      if (s.laugh && window.Sound) window.Sound.laugh(pan, true);
      if (s.cheer && byId[s.cheer].rig) cheer(byId[s.cheer]);
      if (s.after) s.after();
      banter.scene = null;
      banter.nextAt = t + between(8, 15);
      return;
    }
    const line = s.lines[banter.idx];
    const dur = 1.8 + line[1].length * 0.045;
    say(byId[line[0]], line[1], dur);
    banter.lineEnd = t + dur + 0.25;
    return;
  }
  if (paused || t < banter.nextAt) return;
  const options = SCENES.filter(function (sc) { return !sc.at && sc !== banter.last; });
  startScene(options[Math.floor(rand() * options.length)], t);
}

function cheer(n) {
  if (n.seated || !n.rig.actions.cheer) return;
  n.rig.play('cheer', { once: true });
  n.cheerUntil = now + 2;
}

// ---------- Speech bubbles ----------
export function say(n, text, dur) {
  if (!layer || !n) return;
  if (n.bubble) n.bubble.remove();
  const el = document.createElement('div');
  el.className = 'bubble';
  el.textContent = text;
  layer.appendChild(el);
  n.bubble = el;
  n.bubbleUntil = now + (dur || 3);
  requestAnimationFrame(function () { el.classList.add('show'); });
}

const v = new THREE.Vector3();
export function layoutBubbles(camera, w, h) {
  list.forEach(function (n) {
    if (!n.bubble) return;
    if (now > n.bubbleUntil) {
      const el = n.bubble;
      n.bubble = null;
      el.classList.remove('show');
      setTimeout(function () { el.remove(); }, 250);
      return;
    }
    v.set(n.x, n.headY + 0.25, n.z).project(camera);
    const dist = camera.position.distanceTo(n.root.position);
    const visible = v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1 && dist < 18;
    n.bubble.style.visibility = visible ? 'visible' : 'hidden';
    const bw = n.bubble.offsetWidth;
    const x = Math.max(bw / 2 + 6, Math.min(w - bw / 2 - 6, (v.x + 1) / 2 * w));
    n.bubble.style.transform = 'translate(' + (x - bw / 2) + 'px,' + ((1 - v.y) / 2 * h) + 'px) translateY(-100%)';
  });
}

// ---------- Update ----------
export function update(dt, t, paused) {
  now = t;
  list.forEach(function (n) {
    if (n.rig) {
      if (n.cheerUntil && t > n.cheerUntil) { n.cheerUntil = 0; n.rig.play('idle'); }
      n.rig.mixer.update(dt);
    }
  });
  updateElsa(byId.elsa, dt, t);
  updateBrom(byId.brom, dt, t);
  updatePip(byId.pip, dt, t);
  updateBanter(t, paused);

  list.forEach(function (n) {
    n.root.position.x = n.x;
    n.root.position.z = n.z;
    n.root.rotation.y = n.rot;
    if (n.shadow) n.shadow.position.set(n.x, 0.03, n.z);
    if (n.sleep && n.head) n.head.rotation.x += 0.55 + Math.sin(t * 1.4) * 0.05;
    if (n.zs) {
      n.zs.forEach(function (z, k) {
        const ph = (t * 0.35 + k / 3) % 1;
        z.position.set(n.x + 0.2 + ph * 0.5, 2.3 + ph * 1.0, n.z + 0.1);
        z.material.opacity = 1 - ph;
        z.scale.setScalar(0.22 + ph * 0.2);
      });
    }
    if (n.cat) {
      n.root.userData.tail.rotation.y = Math.sin(t * 1.3) * 0.5;
      n.root.userData.body.scale.y = 0.6 + Math.sin(t * 2) * 0.02;
    }
  });
}

export function startTalking(n, seconds) {
  n.talkUntil = now + seconds;
  if (n.rig && !n.seated && n.rig.actions.talk) {
    n.rig.play('talk', { once: true });
    n.cheerUntil = now + 1.4;
  }
}

export { list, byId };

/*
 * The 3D tavern: renderer, third-person camera, the player, input (keyboard,
 * mouse, touch), dialog, and the menu and section windows.
 */
import * as THREE from 'three';
import { loadAll, character } from './assets.js';
import * as World from './world.js';
import * as Nav from './nav.js';
import * as Cast from './cast.js';
import * as Quality from './quality.js';

const $ = function (id) { return document.getElementById(id); };
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isTouch = window.matchMedia('(hover: none) and (pointer: coarse)').matches;

const SECTIONS = { about: 'About me', work: 'Work experience', interests: 'Interests', other: 'Other' };
const LOOK_LINES = {
  board: ['The quest board is crowded with notices.', 'Several are marked DONE in a familiar hand.'],
  fire: ['Trophies and keepsakes crowd the mantel above a crackling fire.', 'Each one has a story.'],
  books: ['The shelf is full of well-worn books, their spines cracked from rereading.', 'Each one has a story.']
};
const FLAVOR = {
  window: 'A storm rumbles over the hills. Somewhere out there is a road. In here, there is a fire.',
  door: 'It\'s a wild night out there. Best stay by the fire a while.',
  barrel: 'Dwarven stout, by the smell of it. The good stuff.',
  canopy: 'The finest room in the inn. A canopy bed hung with red velvet, kept ready for honored guests.',
  bed: 'A narrow bed under a patched quilt. Simple, but it beats sleeping in the rain.'
};

const canvas = $('scene');
const promptEl = $('prompt');
const dialogEl = $('dialog');
const nameEl = $('dialog-name');
const textEl = $('dialog-text');
const srLive = $('sr-live');
const menuEl = $('menu');
const panelEl = $('panel');
const panelTitle = $('panel-title');
const panelBody = $('panel-body');
const soundBtn = $('sound-btn');
const menuBtn = $('menu-btn');
const titleCard = $('title-card');

let mode = 'loading'; // loading | play | dialog | menu | panel
let clock = 0;

// ---------- Startup ----------
if (new URLSearchParams(location.search).get('view') === 'page') location.replace('../?view=page');

function fail(msg) {
  $('loading').hidden = true;
  $('fallback').hidden = false;
  if (msg) $('fallback-text').textContent = msg;
}

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: false, powerPreference: 'high-performance' });
} catch (e) {
  fail('This browser or device can\'t show the 3D tavern.');
  throw e;
}
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#06070d');
scene.fog = new THREE.Fog('#06070d', 22, 42);
const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 80);
Quality.init(renderer, scene, camera);

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  Quality.resize(w, h);
  camera.aspect = w / h;
  // Narrow phone screens get a wider view so the room still fits.
  camera.fov = w < h ? 62 : 50;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

// Section text lives in the main site's index.html, so both versions share it.
let contentDoc = null;
fetch('../index.html').then(function (r) { return r.text(); }).then(function (html) {
  contentDoc = new DOMParser().parseFromString(html, 'text/html');
}).catch(function () { contentDoc = null; });

const world = { colliders: [], hotspots: [] };
const player = { x: 3.2, y: 0, z: 5.0, level: 0, rot: Math.PI, speed: 4.2, radius: 0.4, path: [], target: null, rig: null, shadow: null };
const portrait = window.innerWidth < window.innerHeight;
// Phones start further back and higher so more of the room fits.
const cam = { yaw: 0.35, pitch: portrait ? 0.8 : 0.62, dist: portrait ? 11 : 9, x: 3.2, y: 1.6, z: 5.0 };

loadAll(function (p) {
  $('loading-fill').style.width = Math.round(p * 100) + '%';
}).then(function () {
  const built = World.build(scene);
  world.colliders = built.colliders;
  world.hotspots = built.hotspots;
  Nav.init(world.colliders, player.radius);
  Cast.init(scene, {
    layer: $('bubbles'),
    player: function () { return player; },
    panFor: panFor
  });
  player.rig = character('knight');
  player.rig.play('idle');
  scene.add(player.rig.root);
  player.shadow = Cast.blobShadow();
  scene.add(player.shadow);
  $('loading').classList.add('done');
  setTimeout(function () { $('loading').hidden = true; }, 700);
  mode = 'play';
  setTimeout(dismissTitle, 5000);
  requestAnimationFrame(frame);
}).catch(function (e) {
  console.error(e);
  fail('The tavern\'s models didn\'t load. Check your connection and try again.');
});

function dismissTitle() { titleCard.classList.add('hide'); }

// ---------- Helpers ----------
const tmp = new THREE.Vector3();
function panFor(x, z) {
  tmp.set(x, 1, z).project(camera);
  return Math.max(-0.85, Math.min(0.85, tmp.x * 0.85));
}

function angleTo(ax, az, bx, bz) { return Math.atan2(bx - ax, bz - az); }

function turnToward(o, target, dt, rate) {
  let diff = target - o.rot;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  o.rot += diff * Math.min(1, dt * (rate || 12));
}

// ---------- Interaction targets ----------
// Every NPC and hotspot the player can use, as {kind, x, z, radius, ...}.
function targets() {
  const out = [];
  // Everyone in the inn drinks downstairs; upstairs there are only rooms.
  if (player.level === 0) Cast.list.forEach(function (n) { out.push(npcTarget(n)); });
  world.hotspots.forEach(function (h) { if (h.level === player.level) out.push(h); });
  return out;
}

function npcTarget(n) {
  return { kind: 'npc', npc: n, x: n.x, z: n.talkZ !== undefined ? n.talkZ : n.z, radius: n.seated ? 0.7 : 0.5 };
}

function gap(t) { return Math.hypot(t.x - player.x, t.z - player.z) - t.radius; }

// The thing the player would use if they pressed E right now.
function focusTarget() {
  let best = null, bestScore = Infinity;
  targets().forEach(function (t) {
    const d = gap(t);
    if (d > 1.3) return;
    let diff = angleTo(player.x, player.z, t.x, t.z) - player.rot;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    if (Math.abs(diff) > 1.6 && d > 0.3) return;
    const score = d + Math.abs(diff) * 0.6;
    if (score < bestScore) { bestScore = score; best = t; }
  });
  return best;
}

function labelFor(t) {
  if (t.kind === 'npc') {
    const n = t.npc;
    if (n.section) return 'Talk to ' + (n.short || n.name) + ': ' + SECTIONS[n.section];
    if (n.cat) return 'Pet the cat';
    return 'Talk to ' + (n.short || n.name);
  }
  if (t.kind === 'section') return (t.look === 'board' ? 'Read the quest board: ' : 'Look closer: ') + t.label;
  return 'Look';
}

function interact(t) {
  if (!t) return;
  dismissTitle();
  player.rot = angleTo(player.x, player.z, t.x, t.z);
  if (t.kind === 'npc') {
    const n = t.npc;
    if (n.cat) {
      if (window.Sound) window.Sound.meow(panFor(n.x, n.z));
      openDialog(null, [n.lines[n.lineIdx++ % n.lines.length]], null);
      return;
    }
    Cast.startTalking(n, 600);
    if (n.section) {
      openDialog(n.name, n.intro, function () { openSection(n.section); }, n);
    } else {
      openDialog(n.name, [n.lines[n.lineIdx++ % n.lines.length]], null, n);
    }
    return;
  }
  if (t.kind === 'section') {
    openDialog(null, LOOK_LINES[t.look], function () { openSection(t.id); });
    return;
  }
  openDialog(null, [FLAVOR[t.id]], null);
}

// ---------- Dialog ----------
const dialog = { lines: [], idx: 0, shown: 0, onDone: null, npc: null };

function openDialog(name, lines, onDone, npc) {
  mode = 'dialog';
  player.path = [];
  player.target = null;
  dialog.lines = lines;
  dialog.idx = 0;
  dialog.onDone = onDone;
  dialog.npc = npc || null;
  nameEl.textContent = name || '';
  nameEl.hidden = !name;
  dialogEl.hidden = false;
  showLine();
  if (window.Sound) window.Sound.blip(false);
}

function showLine() {
  dialog.shown = reduceMotion ? dialog.lines[dialog.idx].length : 0;
  textEl.textContent = dialog.lines[dialog.idx].slice(0, dialog.shown);
  dialogEl.classList.toggle('done', reduceMotion);
  srLive.textContent = (nameEl.hidden ? '' : nameEl.textContent + ': ') + dialog.lines[dialog.idx];
}

function updateDialog(dt) {
  if (mode !== 'dialog') return;
  const line = dialog.lines[dialog.idx];
  if (dialog.shown < line.length) {
    dialog.shown = Math.min(line.length, dialog.shown + dt * 55);
    textEl.textContent = line.slice(0, Math.floor(dialog.shown));
    if (dialog.shown >= line.length) dialogEl.classList.add('done');
  }
}

function advanceDialog() {
  const line = dialog.lines[dialog.idx];
  if (dialog.shown < line.length) {
    dialog.shown = line.length;
    textEl.textContent = line;
    dialogEl.classList.add('done');
    return;
  }
  dialog.idx++;
  if (window.Sound) window.Sound.blip(false);
  if (dialog.idx < dialog.lines.length) { showLine(); return; }
  closeDialog();
}

function closeDialog() {
  dialogEl.hidden = true;
  if (dialog.npc) dialog.npc.talkUntil = 0;
  mode = 'play';
  const next = dialog.onDone;
  dialog.onDone = null;
  if (next) next();
}

dialogEl.addEventListener('click', function (e) {
  e.stopPropagation();
  advanceDialog();
});

// ---------- Menu and section windows ----------
let lastFocus = null;

function openModal(el, focusEl) {
  lastFocus = document.activeElement;
  menuEl.hidden = true;
  panelEl.hidden = true;
  el.hidden = false;
  if (!$('scrim')) {
    const s = document.createElement('div');
    s.id = 'scrim';
    s.addEventListener('click', closeModal);
    document.body.appendChild(s);
  }
  mode = el === menuEl ? 'menu' : 'panel';
  keys.clear();
  (focusEl || el.querySelector('button')).focus();
}

function closeModal() {
  menuEl.hidden = true;
  panelEl.hidden = true;
  const s = $('scrim');
  if (s) s.remove();
  mode = 'play';
  if (lastFocus && lastFocus !== document.body) lastFocus.focus();
  else canvas.focus();
}

function openMenu() {
  if (mode === 'dialog') closeDialog();
  openModal(menuEl);
  if (window.Sound) window.Sound.blip(true);
}

function openSection(id) {
  panelTitle.textContent = SECTIONS[id];
  panelBody.innerHTML = '';
  const src = contentDoc && contentDoc.querySelector('#content [data-section="' + id + '"]');
  if (src) {
    const heading = src.querySelector('h2');
    if (heading) panelTitle.textContent = heading.textContent;
    Array.prototype.forEach.call(src.children, function (child) {
      if (child !== heading) panelBody.appendChild(document.importNode(child, true));
    });
  } else {
    const p = document.createElement('p');
    p.innerHTML = 'This section couldn\'t load here. <a href="../?view=page#' + id + '">Read it on the plain page</a>.';
    panelBody.appendChild(p);
  }
  openModal(panelEl, panelTitle);
  panelEl.scrollTop = 0;
  if (window.Sound) window.Sound.blip(true);
}

menuBtn.addEventListener('click', function (e) { e.stopPropagation(); openMenu(); });
menuEl.addEventListener('click', function (e) {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.section) openSection(b.dataset.section);
  else if (b.hasAttribute('data-close')) closeModal();
});
panelEl.querySelector('[data-close]').addEventListener('click', closeModal);

soundBtn.addEventListener('click', function (e) {
  e.stopPropagation();
  if (!window.Sound) return;
  const on = window.Sound.toggle();
  soundBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
  soundBtn.setAttribute('aria-label', on ? 'Turn sound off' : 'Turn sound on');
  soundBtn.querySelector('.sound-label').textContent = on ? 'Sound on' : 'Sound off';
});

function trapFocus(e, el) {
  const items = el.querySelectorAll('button, a[href]');
  const first = items[0], last = items[items.length - 1];
  if (e.shiftKey && (document.activeElement === first || document.activeElement === panelTitle)) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}

// ---------- Keyboard ----------
const keys = new Set();
const MOVE_KEYS = { w: 'f', arrowup: 'f', s: 'b', arrowdown: 'b', a: 'l', arrowleft: 'l', d: 'r', arrowright: 'r' };
const ACTION_KEYS = [' ', 'enter', 'e'];

document.addEventListener('keydown', function (e) {
  const k = e.key.toLowerCase();
  if (mode === 'menu' || mode === 'panel') {
    if (k === 'escape') { e.preventDefault(); closeModal(); }
    else if (k === 'tab') trapFocus(e, mode === 'menu' ? menuEl : panelEl);
    return;
  }
  if (k === 'escape' || k === 'm') {
    if (mode === 'dialog' && k === 'escape') { closeDialog(); return; }
    if (k === 'm' || mode === 'play') { e.preventDefault(); openMenu(); }
    return;
  }
  if (e.target.closest && e.target.closest('button, a') && (k === ' ' || k === 'enter')) return;
  if (mode === 'dialog') {
    if (ACTION_KEYS.indexOf(k) >= 0) { e.preventDefault(); if (!e.repeat) advanceDialog(); }
    return;
  }
  if (mode !== 'play') return;
  if (MOVE_KEYS[k]) {
    e.preventDefault();
    keys.add(MOVE_KEYS[k]);
    player.path = [];
    player.target = null;
    dismissTitle();
  } else if (ACTION_KEYS.indexOf(k) >= 0 && !e.repeat) {
    e.preventDefault();
    interact(focusTarget());
  }
});
document.addEventListener('keyup', function (e) {
  const m = MOVE_KEYS[e.key.toLowerCase()];
  if (m) keys.delete(m);
});
window.addEventListener('blur', function () { keys.clear(); });

// ---------- Mouse and touch: drag to look, tap to walk or talk ----------
const pointers = new Map();
let drag = null;
let pinch = null;

canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
canvas.addEventListener('pointerdown', function (e) {
  canvas.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 2) {
    const p = Array.from(pointers.values());
    pinch = { d: Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y), dist: cam.dist };
    drag = null;
    return;
  }
  drag = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, moved: false, button: e.button };
});
canvas.addEventListener('pointermove', function (e) {
  if (!pointers.has(e.pointerId)) return;
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pinch && pointers.size === 2) {
    const p = Array.from(pointers.values());
    const d = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
    cam.dist = Math.max(3.5, Math.min(12, pinch.dist * pinch.d / Math.max(d, 1)));
    return;
  }
  if (!drag) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 6) { drag.moved = true; dismissTitle(); }
  if (drag.moved) {
    cam.yaw -= dx * 0.006;
    cam.pitch = Math.max(0.12, Math.min(1.25, cam.pitch + dy * 0.004));
  }
  drag.x = e.clientX;
  drag.y = e.clientY;
});
function endPointer(e) {
  pointers.delete(e.pointerId);
  if (pointers.size < 2) pinch = null;
  if (drag && !drag.moved && e.type === 'pointerup' && drag.button === 0) tap(e.clientX, e.clientY);
  drag = null;
}
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);
canvas.addEventListener('wheel', function (e) {
  e.preventDefault();
  cam.dist = Math.max(3.5, Math.min(12, cam.dist * (1 + Math.sign(e.deltaY) * 0.1)));
}, { passive: false });

const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
let tapMark = null;

function tap(cx, cy) {
  if (mode === 'dialog') { advanceDialog(); return; }
  if (mode !== 'play') return;
  dismissTitle();
  ndc.set(cx / window.innerWidth * 2 - 1, -(cy / window.innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hits = ray.intersectObjects(scene.children, true).filter(function (h) {
    return h.object.isMesh && shown(h.object) && !(h.object.material && h.object.material.blending === THREE.AdditiveBlending);
  });
  if (!hits.length) return;
  const hit = hits[0];
  let target = null;
  // An NPC?
  let o = hit.object;
  while (o && !o.userData.npc) o = o.parent;
  if (o && player.level === 0) {
    target = npcTarget(Cast.byId[o.userData.npc]);
  } else {
    // Something near a hotspot (the quest board, the fire, a window)?
    let best = null, bestD = Infinity;
    world.hotspots.forEach(function (h) {
      if (h.level !== player.level) return;
      const d = Math.hypot(h.x - hit.point.x, h.z - hit.point.z) - h.radius;
      if (d < 0.5 && d < bestD) { bestD = d; best = h; }
    });
    target = best;
  }
  const goal = target ? { x: target.x, z: target.z } : { x: hit.point.x, z: hit.point.z };
  if (target && gap(target) < 1.2) { interact(target); return; }
  const path = Nav.findPath(player.x, player.z, goal.x, goal.z, player.level);
  if (!path) return;
  player.path = path;
  player.target = target;
  showTapMark(path.length ? path[path.length - 1] : goal);
}

// Raycasts see hidden objects too, so check every parent.
function shown(o) {
  for (; o; o = o.parent) if (!o.visible) return false;
  return true;
}

function showTapMark(p) {
  if (!tapMark) {
    tapMark = new THREE.Mesh(new THREE.RingGeometry(0.22, 0.32, 20), new THREE.MeshBasicMaterial({ color: '#f2c94c', transparent: true, depthWrite: false }));
    tapMark.rotation.x = -Math.PI / 2;
    scene.add(tapMark);
  }
  tapMark.position.set(p.x, World.heightAt(p.x, p.z, player.level).y + 0.06, p.z);
  tapMark.userData.born = clock;
  tapMark.visible = true;
}

// ---------- Player ----------
const move = new THREE.Vector2();

function updatePlayer(dt) {
  let moving = false;
  move.set(0, 0);
  if (mode === 'play' && keys.size) {
    // Camera-relative: forward is away from the camera.
    const fx = -Math.sin(cam.yaw), fz = -Math.cos(cam.yaw);
    if (keys.has('f')) move.add({ x: fx, y: fz });
    if (keys.has('b')) move.add({ x: -fx, y: -fz });
    if (keys.has('l')) move.add({ x: fz, y: -fx });
    if (keys.has('r')) move.add({ x: -fz, y: fx });
  } else if (mode === 'play' && player.path.length) {
    const p = player.path[0];
    move.set(p.x - player.x, p.z - player.z);
    if (move.length() < 0.15) {
      player.path.shift();
      move.set(0, 0);
    }
  }
  if (mode === 'play' && player.target && gap(player.target) < 1.1) {
    const t = player.target;
    player.path = [];
    player.target = null;
    interact(t);
  }
  if (move.lengthSq() > 0.0001) {
    move.normalize();
    const step = player.speed * dt;
    const before = { x: player.x, z: player.z };
    const p = { x: player.x + move.x * step, z: player.z + move.y * step };
    Nav.resolve(p, player.radius, player.level);
    if (player.level === 0) pushFromPeople(p);
    player.x = p.x;
    player.z = p.z;
    moving = Math.hypot(p.x - before.x, p.z - before.z) > step * 0.2;
    turnToward(player, Math.atan2(move.x, move.y), dt);
    if (!moving && player.path.length) { player.path = []; player.target = null; }
  }
  if (!player.path.length && !player.target && tapMark) tapMark.visible = false;
  player.rig.play(moving ? 'run' : 'idle', { fade: 0.18 });
  player.rig.mixer.update(dt);
  // Climb the stairs, and show the upstairs only once the player is up there.
  const ground = World.heightAt(player.x, player.z, player.level);
  player.y = ground.y;
  if (ground.level !== player.level) {
    player.level = ground.level;
    World.showUpper(player.level === 1);
  }
  player.rig.root.position.set(player.x, player.y, player.z);
  player.rig.root.rotation.y = player.rot;
  player.shadow.position.set(player.x, player.y + 0.03, player.z);
}

// Standing characters and the cat aren't in the collider list, so keep the
// player from walking through them.
function pushFromPeople(p) {
  Cast.list.forEach(function (n) {
    if (n.seated) return;
    const dx = p.x - n.x, dz = p.z - n.z;
    const d = Math.hypot(dx, dz), min = player.radius + n.radius;
    if (d < min && d > 0.0001) {
      p.x = n.x + dx / d * min;
      p.z = n.z + dz / d * min;
    }
  });
}

// ---------- Camera ----------
function updateCamera(dt) {
  const k = 1 - Math.exp(-dt * 8);
  cam.x += (player.x - cam.x) * k;
  cam.z += (player.z - cam.z) * k;
  cam.y += (player.y + 1.5 - cam.y) * k;
  const look = new THREE.Vector3(cam.x, cam.y, cam.z);
  const h = Math.cos(cam.pitch) * cam.dist;
  const cx = look.x + Math.sin(cam.yaw) * h;
  const cz = look.z + Math.cos(cam.yaw) * h;
  const cy = look.y + Math.sin(cam.pitch) * cam.dist;
  camera.position.set(cx, cy, cz);
  // The wall between the camera and the player drops away, dollhouse style.
  World.cutaway(camera.position);
  World.fadeBetween(camera.position, player);
  camera.lookAt(look);
}

// ---------- Prompt ----------
const promptPos = new THREE.Vector3();
function updatePrompt() {
  const t = mode === 'play' ? focusTarget() : null;
  if (!t || isTouch) { promptEl.classList.remove('show'); return; }
  promptEl.textContent = (isTouch ? '' : 'E  ') + labelFor(t);
  if (t.kind === 'npc') promptPos.set(t.npc.x, t.npc.headY + 0.5, t.npc.z);
  else promptPos.set(t.x, player.y + 2.6, t.z);
  promptPos.project(camera);
  promptEl.style.left = ((promptPos.x + 1) / 2 * window.innerWidth) + 'px';
  promptEl.style.top = ((1 - promptPos.y) / 2 * window.innerHeight) + 'px';
  promptEl.classList.add('show');
}

// ---------- Loop ----------
let last = 0;
function frame(ts) {
  const raw = (ts - last) / 1000 || 0;
  const dt = Math.min(0.05, raw);
  last = ts;
  Quality.sample(raw);
  clock += dt;
  updatePlayer(dt);
  Cast.update(dt, clock, mode !== 'play' && mode !== 'dialog');
  World.setFocus(player.x, player.z);
  World.update(dt, clock, reduceMotion);
  updateDialog(dt);
  updateCamera(dt);
  if (tapMark && tapMark.visible) tapMark.material.opacity = 0.6 + Math.sin(clock * 6) * 0.3;
  Quality.render();
  Cast.layoutBubbles(camera, window.innerWidth, window.innerHeight);
  updatePrompt();
  requestAnimationFrame(frame);
}

// Lets automated checks drive the scene.
window.__tavern = { renderer: renderer, scene: scene, quality: Quality, player: player, cam: cam, interact: interact, focusTarget: focusTarget, mode: function () { return mode; } };

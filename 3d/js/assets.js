/*
 * Loads models named in the manifest and hands out copies. Props are cloned
 * (sharing geometry and materials); characters are cloned with their skeleton
 * and get their own animation mixer.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { PROPS, CHARACTERS } from './manifest.js';

const cache = {};

export function loadAll(onProgress) {
  const manager = new THREE.LoadingManager();
  manager.onProgress = function (url, done, total) { if (onProgress) onProgress(done / total); };
  const loader = new GLTFLoader(manager);
  const jobs = [];
  Object.keys(PROPS).forEach(function (role) {
    jobs.push(loader.loadAsync(PROPS[role].file).then(function (g) { cache['prop:' + role] = g; }));
  });
  Object.keys(CHARACTERS).forEach(function (kind) {
    jobs.push(loader.loadAsync(CHARACTERS[kind].file).then(function (g) { cache['char:' + kind] = g; }));
  });
  return Promise.all(jobs).then(shareTextures);
}

// Each KayKit file embeds its own copy of the same texture atlas, so dozens of
// props would each upload an identical 1024px image to the graphics card.
// Textures whose pixels match are collapsed into one shared copy.
function shareTextures() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const byKey = new Map();
  const seen = new Map();
  function canonical(tex) {
    if (seen.has(tex)) return seen.get(tex);
    const img = tex.image;
    let key = null;
    try {
      ctx.clearRect(0, 0, 64, 64);
      ctx.drawImage(img, 0, 0, 64, 64);
      const px = ctx.getImageData(0, 0, 64, 64).data;
      let h = 2166136261;
      for (let i = 0; i < px.length; i++) h = Math.imul(h ^ px[i], 16777619);
      key = [img.width, img.height, tex.colorSpace, tex.flipY, tex.wrapS, tex.wrapT, h].join(':');
    } catch (e) { key = null; }
    let out = tex;
    if (key) {
      if (byKey.has(key)) { out = byKey.get(key); tex.dispose(); } else byKey.set(key, tex);
    }
    seen.set(tex, out);
    return out;
  }
  Object.keys(cache).forEach(function (k) {
    cache[k].scene.traverse(function (o) {
      if (!o.material) return;
      (Array.isArray(o.material) ? o.material : [o.material]).forEach(function (m) {
        Object.keys(m).forEach(function (p) {
          if (m[p] && m[p].isTexture) m[p] = canonical(m[p]);
        });
      });
    });
  });
}

function prepare(obj) {
  obj.traverse(function (o) {
    if (o.isMesh) {
      o.castShadow = false;
      o.receiveShadow = false;
    }
  });
  return obj;
}

export function prop(role) {
  const g = cache['prop:' + role];
  if (!g) throw new Error('Unknown prop: ' + role);
  const def = PROPS[role];
  const obj = prepare(g.scene.clone(true));
  if (def.scale) obj.scale.setScalar(def.scale);
  const wrap = new THREE.Group();
  wrap.add(obj);
  if (def.yOffset) obj.position.y = def.yOffset;
  return wrap;
}

// Returns { root, mixer, play(name, opts), show(nodeName), def }.
export function character(kind, opts) {
  opts = opts || {};
  const g = cache['char:' + kind];
  const def = CHARACTERS[kind];
  const model = prepare(cloneSkinned(g.scene));
  const hidden = new Set(def.hide || []);
  (opts.show || []).forEach(function (n) { hidden.delete(n); });
  (opts.hide || []).forEach(function (n) { hidden.add(n); });
  model.traverse(function (o) {
    if (hidden.has(o.name)) o.visible = false;
    if (o.isMesh && opts.tint) {
      o.material = o.material.clone();
      o.material.color.multiply(new THREE.Color(opts.tint));
      // A faint warm self-light stands in for a nearby point light.
      if (opts.glow) {
        o.material.emissive.set(opts.glow);
        o.material.emissiveMap = o.material.map;
      }
    }
  });
  if (def.scale) model.scale.setScalar(def.scale);
  const root = new THREE.Group();
  root.add(model);

  const mixer = new THREE.AnimationMixer(model);
  const actions = {};
  Object.keys(def.clips).forEach(function (role) {
    const clip = THREE.AnimationClip.findByName(g.animations, def.clips[role]);
    if (clip) actions[role] = mixer.clipAction(clip);
  });
  let current = null;

  function play(role, o) {
    o = o || {};
    const next = actions[role] || actions.idle;
    if (!next || next === current) return;
    next.reset();
    next.setLoop(o.once ? THREE.LoopOnce : THREE.LoopRepeat);
    next.clampWhenFinished = !!o.once;
    next.timeScale = o.speed || 1;
    next.play();
    if (current) current.crossFadeTo(next, o.fade === undefined ? 0.25 : o.fade, false);
    current = next;
    if (o.offset) next.time = o.offset;
  }

  function find(name) { return model.getObjectByName(name); }

  return { root: root, model: model, mixer: mixer, play: play, find: find, actions: actions, current: function () { return current; } };
}

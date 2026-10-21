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
  return Promise.all(jobs);
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

/*
 * Render quality. The scene is drawn at a modest resolution with a cheap
 * edge-smoothing pass (FXAA) instead of the browser's built-in antialiasing,
 * which on a high-DPI screen meant shading three times as many pixels. A
 * frame-rate watcher then steps the resolution down on slow devices, or up
 * once on fast high-DPI ones.
 */
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';

const dpr = window.devicePixelRatio || 1;
// Pixel ratios from best to cheapest. The game starts at 1.
const TIERS = [Math.min(dpr, 1.5), 1, 0.75, 0.6].filter(function (pr, i, all) { return i === 0 || pr < all[i - 1]; });
const WINDOW = 2; // seconds per frame-rate sample
const SETTLE = 3; // seconds to ignore after a change (shader compiles, loading)
const SLOW = 45; // fps below this steps down
const FAST = 57; // fps at or above this, twice running, steps up once

let renderer, composer, fxaa, tier;
let width = 1, height = 1;
let settle = SETTLE, elapsed = 0, frames = 0, stalled = false, fastWindows = 0;
let triedUp = false, locked = false, raised = false;

export function init(r, scene, camera) {
  renderer = r;
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new OutputPass());
  fxaa = new ShaderPass(FXAAShader);
  composer.addPass(fxaa);
  tier = TIERS.indexOf(1);
  // ?pr=1.5 pins a pixel ratio and turns off the watcher, for testing.
  const pinned = parseFloat(new URLSearchParams(location.search).get('pr'));
  if (pinned > 0) { TIERS.splice(0, TIERS.length, pinned); tier = 0; locked = true; triedUp = true; }
  apply();
}

export function resize(w, h) {
  width = w;
  height = h;
  renderer.setSize(w, h, false);
  apply();
}

function apply() {
  const pr = TIERS[tier];
  renderer.setPixelRatio(pr);
  composer.setPixelRatio(pr);
  composer.setSize(width, height);
  fxaa.material.uniforms.resolution.value.set(1 / (width * pr), 1 / (height * pr));
}

function step(by) {
  tier = Math.max(0, Math.min(TIERS.length - 1, tier + by));
  apply();
  settle = SETTLE;
  elapsed = 0;
  frames = 0;
  fastWindows = 0;
}

export function render() {
  composer.render();
}

// Called once per frame with the real (unclamped) frame time in seconds.
export function sample(dt) {
  if (document.hidden) return;
  if (settle > 0) { settle -= dt; return; }
  // A long hitch means the tab was in the background or the browser paused,
  // not that the scene is slow, so that window doesn't count.
  if (dt > 1) stalled = true;
  elapsed += dt;
  frames++;
  if (elapsed < WINDOW) return;
  const fps = frames / elapsed;
  const ok = !stalled;
  elapsed = 0;
  frames = 0;
  stalled = false;
  if (!ok) return;
  if (fps < SLOW) {
    if (raised) { raised = false; locked = true; step(1); return; }
    locked = true;
    if (tier < TIERS.length - 1) step(1);
    return;
  }
  if (raised && fps < FAST - 7) { raised = false; locked = true; step(1); return; }
  if (!locked && !triedUp && tier > 0 && fps >= FAST) {
    if (++fastWindows >= 2) { triedUp = true; raised = true; step(-1); }
  } else {
    fastWindows = 0;
  }
}

export function pixelRatio() { return TIERS[tier]; }

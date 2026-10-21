/*
 * All sound is synthesized with the Web Audio API, so there are no audio
 * files to license or download. Nothing plays until the visitor turns
 * sound on (browsers require a click before audio can start anyway).
 *
 * Layers: rain on the roof and windows, the fire, a crowd murmuring,
 * occasional laughter, clinking glasses, mugs set down, thunder, and the
 * bard's lute.
 */
(function () {
  // A page can leave out the rain with <script src="audio.js" data-rain="off">.
  const script = document.currentScript;
  const withRain = !(script && script.dataset.rain === 'off');
  'use strict';

  const Sound = { on: false };
  let ctx = null;
  let master, room, crowdBus, noiseBuf;
  let tickTimer = null;
  let voices = [];
  const next = {};

  const rand = Math.random;
  const between = function (a, b) { return a + rand() * (b - a); };
  const pick = function (arr) { return arr[Math.floor(rand() * arr.length)]; };

  function gain(v) { const g = ctx.createGain(); g.gain.value = v; return g; }
  function filter(type, freq, q) {
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    if (q !== undefined) f.Q.value = q;
    return f;
  }
  function panner(p) {
    if (ctx.createStereoPanner) {
      const n = ctx.createStereoPanner();
      n.pan.value = Math.max(-1, Math.min(1, p));
      return n;
    }
    return gain(1);
  }
  function noise(loop) {
    const s = ctx.createBufferSource();
    s.buffer = noiseBuf;
    s.loop = loop !== false;
    return s;
  }

  function makeNoiseBuffer(seconds) {
    const len = Math.floor(ctx.sampleRate * seconds);
    const b = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = rand() * 2 - 1;
    return b;
  }

  function makeImpulse(seconds, decay) {
    const len = Math.floor(ctx.sampleRate * seconds);
    const b = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (rand() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return b;
  }

  function init() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    noiseBuf = makeNoiseBuffer(4);

    master = gain(0);
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 4;
    master.connect(comp);
    comp.connect(ctx.destination);

    // Indoor sounds go through a small-room reverb.
    const reverb = ctx.createConvolver();
    reverb.buffer = makeImpulse(1.8, 3);
    const wet = gain(0.32);
    reverb.connect(wet);
    wet.connect(master);
    room = gain(1);
    room.connect(master);
    room.connect(reverb);

    if (withRain) startRain();
    startFire();
    startCrowd();
    const now = ctx.currentTime;
    next.crackle = now;
    next.patter = now;
    next.clink = now + between(1, 4);
    next.laugh = now + between(3, 8);
    next.thud = now + between(5, 12);
    next.shout = now + between(10, 20);
    tickTimer = setInterval(tick, 50);
    return true;
  }

  // ---------- Rain ----------
  function startRain() {
    // Rain heard from indoors: walls and glass cut the highs, so it's a
    // soft wash rather than a hiss.
    const hiss = noise();
    const hp = filter('highpass', 200);
    const lp = filter('lowpass', 900);
    const g = gain(0.018);
    hiss.connect(hp); hp.connect(lp); lp.connect(g); g.connect(master);
    // Low drumming on the roof.
    const roof = noise();
    const rlp = filter('lowpass', 180);
    const rg = gain(0.05);
    roof.connect(rlp); rlp.connect(rg); rg.connect(master);
    // Slow gusts.
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.08;
    const depth = gain(0.006);
    lfo.connect(depth); depth.connect(g.gain);
    hiss.start(0, rand() * 3);
    roof.start(0, rand() * 3);
    lfo.start();
  }

  function patter(t) {
    const s = noise(false);
    const bp = filter('bandpass', between(700, 1600), 2);
    const g = gain(0);
    const p = panner(pick([-0.6, 0.15, 0.85]) + between(-0.1, 0.1));
    s.connect(bp); bp.connect(g); g.connect(p); p.connect(master);
    const a = between(0.003, 0.009);
    g.gain.setValueAtTime(a, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
    s.start(t, rand() * 3);
    s.stop(t + 0.03);
  }

  // ---------- Fire ----------
  function startFire() {
    const roar = noise();
    const lp = filter('lowpass', 160);
    const g = gain(0.06);
    roar.connect(lp); lp.connect(g); g.connect(room);
    roar.start(0, rand() * 3);
  }

  function crackle(t) {
    const s = noise(false);
    const pop = rand() < 0.12;
    const bp = filter('bandpass', pop ? between(500, 1200) : between(1500, 5000), 1);
    const g = gain(0);
    const p = panner(0.05);
    s.connect(bp); bp.connect(g); g.connect(p); p.connect(room);
    const a = pop ? between(0.25, 0.45) : between(0.04, 0.18);
    const d = pop ? 0.05 : between(0.004, 0.02);
    g.gain.setValueAtTime(a, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    s.start(t, rand() * 3);
    s.stop(t + d + 0.02);
  }

  // ---------- Crowd murmur ----------
  // Each voice is a buzzing source pushed through two formant filters that
  // jump between vowel shapes in syllable rhythm. Eight of them together,
  // muffled and reverberant, read as a room full of conversation.
  const VOWELS = [[730, 1090], [530, 1840], [270, 2290], [570, 840], [300, 870], [660, 1720], [490, 1350], [640, 1190]];

  function startCrowd() {
    crowdBus = gain(0.22);
    const lp = filter('lowpass', 2000);
    crowdBus.connect(lp);
    lp.connect(room);
    for (let i = 0; i < 8; i++) voices.push(makeVoice(i));
  }

  function makeVoice(i) {
    const female = i % 3 === 1;
    const v = {
      female: female,
      f0: female ? between(185, 235) : between(92, 135),
      amp: between(0.35, 0.8),
      next: ctx.currentTime + between(0.2, 3),
      left: 0,
      loud: false
    };
    v.osc = ctx.createOscillator();
    v.osc.type = 'sawtooth';
    v.osc.frequency.value = v.f0;
    v.f1 = filter('bandpass', 700, 6);
    v.f2 = filter('bandpass', 1200, 8);
    const f2g = gain(0.55);
    v.env = gain(0);
    const p = panner(between(-0.9, 0.9));
    v.osc.connect(v.f1); v.f1.connect(v.env);
    v.osc.connect(v.f2); v.f2.connect(f2g); f2g.connect(v.env);
    v.env.connect(p);
    // Consonants: short bursts of hiss before some syllables.
    v.hiss = noise();
    const hp = filter('highpass', 2800);
    v.hissEnv = gain(0);
    v.hiss.connect(hp); hp.connect(v.hissEnv); v.hissEnv.connect(p);
    p.connect(crowdBus);
    v.osc.start();
    v.hiss.start(0, rand() * 3);
    return v;
  }

  function scheduleVoice(v, horizon) {
    while (v.next < horizon) {
      const t = v.next;
      if (v.left <= 0) {
        v.left = 3 + Math.floor(rand() * 12);
        v.loud = rand() < 0.15;
        v.next = t + between(0.3, 2.4);
        continue;
      }
      v.left--;
      const dur = between(0.07, 0.22);
      const vowel = pick(VOWELS);
      const k = v.female ? 1.17 : 1;
      v.f1.frequency.setTargetAtTime(vowel[0] * k, t, 0.02);
      v.f2.frequency.setTargetAtTime(vowel[1] * k, t, 0.02);
      const pitch = v.f0 * (1 + between(-0.12, 0.14)) * (v.loud ? 1.3 : 1);
      v.osc.frequency.setTargetAtTime(pitch, t, 0.04);
      const a = v.amp * (v.loud ? 1.9 : 1) * between(0.6, 1);
      v.env.gain.setTargetAtTime(a, t, 0.015);
      v.env.gain.setTargetAtTime(0, t + dur, 0.03);
      if (rand() < 0.45) {
        const ht = Math.max(ctx.currentTime, t - 0.035);
        v.hissEnv.gain.setTargetAtTime(a * 0.35, ht, 0.004);
        v.hissEnv.gain.setTargetAtTime(0, ht + 0.03, 0.008);
      }
      v.next = t + dur + between(0.03, 0.1);
    }
  }

  // ---------- One-shots ----------
  function laughAt(t, pan, big) {
    const female = rand() < 0.45;
    const base = female ? between(270, 340) : between(140, 200);
    const n = 4 + Math.floor(rand() * 5);
    const period = between(0.15, 0.2);
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    const f1 = filter('bandpass', female ? 920 : 790, 4);
    const f2 = filter('bandpass', female ? 1450 : 1220, 6);
    const f2g = gain(0.6);
    const env = gain(0);
    const breath = noise();
    const bbp = filter('bandpass', 1600, 0.8);
    const benv = gain(0);
    const p = panner(pan);
    osc.connect(f1); f1.connect(env);
    osc.connect(f2); f2.connect(f2g); f2g.connect(env);
    breath.connect(bbp); bbp.connect(benv);
    env.connect(p); benv.connect(p); p.connect(room);
    const peak = big ? 0.75 : 0.5;
    env.gain.setValueAtTime(0.0001, t);
    benv.gain.setValueAtTime(0.0001, t);
    for (let i = 0; i < n; i++) {
      const s = t + i * period * between(0.92, 1.08);
      const pitch = base * (1.12 - i * 0.035);
      osc.frequency.setValueAtTime(pitch * 1.08, s);
      osc.frequency.exponentialRampToValueAtTime(pitch * 0.82, s + period * 0.7);
      const a = peak * (1 - i / (n * 1.7));
      benv.gain.setValueAtTime(0.0001, s);
      benv.gain.linearRampToValueAtTime(a * 0.5, s + 0.012);
      benv.gain.exponentialRampToValueAtTime(0.0001, s + 0.05);
      env.gain.setValueAtTime(0.0001, s + 0.02);
      env.gain.linearRampToValueAtTime(a, s + 0.04);
      env.gain.exponentialRampToValueAtTime(0.0001, s + period * 0.72);
    }
    const end = t + n * period + 0.3;
    osc.start(t);
    osc.stop(end);
    breath.start(t, rand() * 3);
    breath.stop(end);
  }

  function laugh(pan, big) {
    if (!Sound.on) return;
    const t = ctx.currentTime + 0.05;
    const p = pan === undefined ? between(-0.8, 0.8) : pan;
    laughAt(t, p, big);
    if (big || rand() < 0.45) laughAt(t + between(0.08, 0.35), p + between(-0.3, 0.3), false);
  }

  function clinkAt(t, pan) {
    const base = between(2100, 3600);
    const p = panner(pan);
    p.connect(room);
    [1, 2.76, 5.4, 8.93].forEach(function (ratio, i) {
      if (base * ratio > ctx.sampleRate * 0.45) return;
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = base * ratio;
      const g = gain(0);
      o.connect(g); g.connect(p);
      const a = 0.05 / (i + 1);
      const d = (0.55 - i * 0.1) * between(0.6, 1.2);
      g.gain.setValueAtTime(a, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.start(t);
      o.stop(t + d + 0.05);
    });
  }

  function clink(pan, count) {
    if (!Sound.on) return;
    const p = pan === undefined ? between(-0.8, 0.8) : pan;
    const n = count || (rand() < 0.35 ? 2 + Math.floor(rand() * 2) : 1);
    let t = ctx.currentTime + 0.03;
    for (let i = 0; i < n; i++) {
      clinkAt(t, p + between(-0.15, 0.15));
      t += between(0.04, 0.1);
    }
  }

  function thud(t, pan) {
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(110, t);
    o.frequency.exponentialRampToValueAtTime(55, t + 0.12);
    const g = gain(0);
    const p = panner(pan);
    o.connect(g); g.connect(p); p.connect(room);
    g.gain.setValueAtTime(0.35, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    o.start(t);
    o.stop(t + 0.2);
    const s = noise(false);
    const lp = filter('lowpass', 700);
    const ng = gain(0);
    s.connect(lp); lp.connect(ng); ng.connect(p);
    ng.gain.setValueAtTime(0.2, t);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
    s.start(t, rand() * 3);
    s.stop(t + 0.06);
  }

  // A short loud exclamation that rises over the murmur ("Hah!", "Oi!").
  function shout(t, pan) {
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    const base = between(130, 210);
    const f1 = filter('bandpass', 750, 5);
    const f2 = filter('bandpass', 1150, 7);
    const env = gain(0);
    const p = panner(pan);
    osc.connect(f1); f1.connect(env);
    osc.connect(f2); f2.connect(env);
    env.connect(p); p.connect(room);
    const syll = 1 + Math.floor(rand() * 3);
    for (let i = 0; i < syll; i++) {
      const s = t + i * 0.22;
      osc.frequency.setValueAtTime(base * 1.25, s);
      osc.frequency.exponentialRampToValueAtTime(base * 0.9, s + 0.18);
      env.gain.setValueAtTime(0.0001, s);
      env.gain.linearRampToValueAtTime(0.4, s + 0.03);
      env.gain.exponentialRampToValueAtTime(0.0001, s + 0.2);
    }
    osc.start(t);
    osc.stop(t + syll * 0.22 + 0.1);
  }

  function thunder(delay) {
    if (!Sound.on) return;
    const t = ctx.currentTime + (delay || 0);
    const s = noise();
    const lp = filter('lowpass', 500);
    const g = gain(0);
    s.connect(lp); lp.connect(g); g.connect(master);
    lp.frequency.setValueAtTime(400, t);
    lp.frequency.exponentialRampToValueAtTime(60, t + 4);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.4, t + 0.25);
    g.gain.setTargetAtTime(0.18, t + 0.6, 0.4);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 4.8);
    s.start(t, rand() * 3);
    s.stop(t + 5);
  }

  function pluck(freq, pan) {
    if (!Sound.on) return;
    const t = ctx.currentTime + 0.01;
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.value = freq;
    const o2 = ctx.createOscillator();
    o2.type = 'sine';
    o2.frequency.value = freq * 2;
    const g = gain(0);
    const p = panner(pan);
    o.connect(g); o2.connect(g); g.connect(p); p.connect(room);
    g.gain.setValueAtTime(0.09, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
    o.start(t); o2.start(t);
    o.stop(t + 1); o2.stop(t + 1);
  }

  function meow(pan) {
    if (!Sound.on) return;
    const t = ctx.currentTime + 0.02;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(520, t);
    o.frequency.linearRampToValueAtTime(820, t + 0.18);
    o.frequency.exponentialRampToValueAtTime(430, t + 0.5);
    const bp = filter('bandpass', 1300, 3);
    const g = gain(0);
    const p = panner(pan);
    o.connect(bp); bp.connect(g); g.connect(p); p.connect(room);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.35, t + 0.06);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
    o.start(t);
    o.stop(t + 0.6);
  }

  // Menu cursor blip, in the spirit of the old SNES menus.
  function blip(high) {
    if (!Sound.on) return;
    const t = ctx.currentTime + 0.005;
    const o = ctx.createOscillator();
    o.type = 'square';
    o.frequency.value = high ? 1320 : 880;
    const g = gain(0);
    o.connect(g); g.connect(master);
    g.gain.setValueAtTime(0.05, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
    o.start(t);
    o.stop(t + 0.08);
  }

  function tick() {
    if (!Sound.on || !ctx) return;
    const now = ctx.currentTime;
    const horizon = now + 0.25;
    voices.forEach(function (v) { scheduleVoice(v, horizon); });
    while (next.crackle < horizon) {
      crackle(Math.max(now, next.crackle));
      next.crackle += between(0.03, 0.35);
    }
    while (withRain && next.patter < horizon) {
      patter(Math.max(now, next.patter));
      next.patter += between(0.06, 0.25);
    }
    if (now > next.clink) { clink(); next.clink = now + between(2.5, 7); }
    if (now > next.laugh) { laugh(undefined, rand() < 0.3); next.laugh = now + between(5, 14); }
    if (now > next.thud) { thud(now + 0.02, between(-0.8, 0.8)); next.thud = now + between(6, 16); }
    if (now > next.shout) { shout(now + 0.02, between(-0.8, 0.8)); next.shout = now + between(9, 22); }
  }

  Sound.toggle = function () {
    if (!ctx && !init()) return false;
    Sound.on = !Sound.on;
    const now = ctx.currentTime;
    if (Sound.on) {
      ctx.resume();
      // Skip anything that would have been scheduled while muted.
      ['crackle', 'patter'].forEach(function (k) { next[k] = Math.max(next[k], now); });
      voices.forEach(function (v) { v.next = Math.max(v.next, now + between(0, 1)); });
      master.gain.cancelScheduledValues(now);
      master.gain.setValueAtTime(master.gain.value, now);
      master.gain.linearRampToValueAtTime(0.9, now + 0.8);
    } else {
      master.gain.cancelScheduledValues(now);
      master.gain.setValueAtTime(master.gain.value, now);
      master.gain.linearRampToValueAtTime(0, now + 0.4);
      setTimeout(function () { if (!Sound.on) ctx.suspend(); }, 500);
    }
    return Sound.on;
  };

  Sound.laugh = laugh;
  Sound.clink = clink;
  Sound.thunder = thunder;
  Sound.pluck = pluck;
  Sound.meow = meow;
  Sound.blip = blip;

  window.Sound = Sound;
})();

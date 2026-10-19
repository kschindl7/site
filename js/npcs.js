/*
 * The inn's regulars: who they are, how they idle, where they walk, and the
 * short scripted conversations they have with each other.
 */
(function () {
  'use strict';

  const T = 16;
  const SEAT = 2; // seated characters sit this many pixels lower
  const rand = Math.random;
  const between = function (a, b) { return a + rand() * (b - a); };

  const DEFS = [
    {
      id: 'brom', name: 'Brom the Barkeep', short: 'Brom', sprite: 'brom', x: 2, y: 4, dir: 'down', idle: 'wipe',
      section: 'about',
      intro: ['Ah, a new face! Ye\'ll be wanting to hear about Kyle, I reckon.', 'Pull up a stool. I know the lad better than most.']
    },
    {
      id: 'elsa', name: 'Elsa', sprite: 'elsa', x: 6, y: 5, dir: 'left', at: 'bar',
      lines: [
        'Welcome to the Wayward Lantern! Brom has the stories, the quest board has the work, and the fireplace has... well, the trophies.',
        'Don\'t mind the stranger in the corner. He tips well. I think.',
        'If you\'re looking for Kyle\'s work history, try the quest board by the door.'
      ]
    },
    {
      id: 'durgin', name: 'Durgin', sprite: 'durgin', x: 7, y: 7, dir: 'right', seated: true, idle: 'drink',
      lines: ['Kyle? Good lad. Bought me a drink once. Or I bought him one. Hard to say.', 'Another round! ...Oh, you\'re not Elsa.']
    },
    {
      id: 'hilda', name: 'Hilda', sprite: 'hilda', x: 10, y: 7, dir: 'left', seated: true, idle: 'drink',
      lines: ['If you want the real story, ask Brom. He knows everyone\'s business.', 'Durgin owes me six silver. Don\'t let him tell you otherwise.']
    },
    {
      id: 'tobias', name: 'Old Tobias', sprite: 'tobias', x: 12, y: 8, dir: 'right', seated: true, idle: 'sleep',
      lines: ['Zzz... the quest board... by the door... zzz...', '*snore* ...I was awake the whole time... *snore*']
    },
    {
      id: 'pip', name: 'Pip the Bard', sprite: 'pip', x: 15, y: 7, dir: 'left', seated: true, idle: 'lute',
      lines: ['Care for a song? No? Then take a look by the fireplace. Kyle\'s trophies hang there.', 'I\'m writing a ballad about this inn. Nothing rhymes with "Lantern."']
    },
    {
      id: 'mara', name: 'Sergeant Mara', sprite: 'mara', x: 3, y: 6, dir: 'up', seated: true, idle: 'drink',
      lines: ['Quiet night, traveler. Let\'s keep it that way.', 'Off duty. Mostly.']
    },
    {
      id: 'fenwick', name: 'Fenwick', sprite: 'fenwick', x: 7, y: 11, dir: 'right', seated: true, idle: 'read',
      lines: ['I\'m told the quest board lists every job Kyle has taken. Quite the list.', 'Shh. I\'m at the good part.']
    },
    {
      id: 'stranger', name: 'Hooded Stranger', short: 'Stranger', sprite: 'stranger', x: 18, y: 12, dir: 'left', seated: true, idle: 'still',
      section: 'other',
      intro: ['...You found me. Few think to look in the corner.', 'I keep the things that fit nowhere else. Look, if you dare.']
    },
    {
      id: 'cat', name: 'The Cat', sprite: null, x: 12, y: 3, dir: 'down', cat: true,
      lines: ['Mrrrow.', 'The cat opens one eye, judges you, and goes back to sleep.']
    }
  ];

  const list = DEFS.map(function (d) {
    return Object.assign({
      px: d.x * T, py: d.y * T,
      fx: d.x, fy: d.y, mt: 0, moving: false, parity: 0, speed: 3,
      path: [], wait: between(1, 4), lineIdx: 0,
      baseDir: d.dir,
      blinkUntil: 0, nextBlink: between(1, 5),
      phase: rand() * 6.28,
      mugUntil: 0, nextMug: between(2, 8),
      talkUntil: 0, bubble: null, bubbleUntil: 0
    }, d);
  });
  const byId = {};
  list.forEach(function (n) { byId[n.id] = n; });

  let hooks = { isFree: function () { return true; }, player: function () { return { x: 0, y: 0 }; } };
  let layer = null;
  let now = 0;

  function at(x, y) {
    for (let i = 0; i < list.length; i++) {
      if (list[i].x === x && list[i].y === y) return list[i];
    }
    return null;
  }

  function dirFrom(dx, dy) {
    if (dx > 0) return 'right';
    if (dx < 0) return 'left';
    if (dy < 0) return 'up';
    return 'down';
  }

  function stepTo(n, x, y) {
    n.dir = dirFrom(x - n.x, y - n.y);
    n.fx = n.x; n.fy = n.y;
    n.x = x; n.y = y;
    n.mt = 0;
    n.moving = true;
  }

  function advance(n, dt) {
    if (!n.moving) return;
    n.mt = Math.min(1, n.mt + dt * n.speed);
    n.px = (n.fx + (n.x - n.fx) * n.mt) * T;
    n.py = (n.fy + (n.y - n.fy) * n.mt) * T;
    if (n.mt >= 1) {
      n.moving = false;
      n.parity ^= 1;
    }
  }

  // Follows n.path one tile at a time. Returns true once the path is done.
  function followPath(n, passable) {
    if (n.moving) return false;
    if (!n.path.length) return true;
    const nx = n.path[0][0], ny = n.path[0][1];
    if (!passable(nx, ny)) {
      n.path = [];
      n.blocked = true;
      return true;
    }
    n.path.shift();
    stepTo(n, nx, ny);
    return false;
  }

  // ---------- Elsa walks between the bar and the tables ----------
  const SPOTS = {
    bar: { x: 6, y: 5, face: 'left' },
    tableA: { x: 10, y: 8, face: 'left' },
    tableB: { x: 12, y: 7, face: 'right' },
    tableC: { x: 10, y: 11, face: 'left' }
  };

  function elsaPassable(x, y) {
    return !World.solid(x, y) && hooks.isFree(x, y, byId.elsa);
  }

  function sendElsa(spot) {
    const e = byId.elsa;
    e.queued = spot;
    if (e.state !== 'walk') e.wait = Math.min(e.wait, 0.4);
  }

  function updateElsa(e, dt, t) {
    advance(e, dt);
    if (t < e.talkUntil) return;
    if (e.state === 'walk') {
      if (!followPath(e, elsaPassable)) return;
      if (e.blocked) {
        e.blocked = false;
        e.state = 'wait';
        e.wait = 0.7;
        return;
      }
      const spot = SPOTS[e.target];
      e.dir = spot.face;
      e.at = e.target;
      e.state = 'wait';
      e.wait = between(3, 6);
      onArrive(e.target);
      return;
    }
    e.wait -= dt;
    if (e.wait > 0) return;
    let target = e.queued;
    e.queued = null;
    if (!target) {
      if (e.at !== 'bar') target = 'bar';
      else target = ['tableA', 'tableB', 'tableC'][Math.floor(rand() * 3)];
    }
    if (e.at === target) { e.wait = between(2, 4); return; }
    const spot = SPOTS[target];
    const path = World.findPath(e.x, e.y, function (x, y) { return x === spot.x && y === spot.y; }, elsaPassable);
    if (!path) { e.wait = 1; e.queued = target; return; }
    e.at = null;
    e.target = target;
    e.path = path;
    e.state = 'walk';
  }

  // ---------- Brom paces behind the bar ----------
  function bromPassable(x, y) {
    return World.tile(x, y) === 'b' && y === 4 && hooks.isFree(x, y, byId.brom);
  }

  function updateBrom(b, dt, t) {
    advance(b, dt);
    if (!followPath(b, bromPassable)) return;
    if (!b.moving) b.dir = 'down';
    if (t < b.talkUntil) return;
    b.wait -= dt;
    // Step over to meet the player when they walk up to the bar.
    const p = hooks.player();
    const nearBar = p.y === 6 && p.x <= 5;
    if (nearBar && b.x !== Math.max(1, Math.min(4, p.x)) && b.wait > 0.3) b.wait = 0.3;
    if (b.wait > 0) return;
    b.wait = between(4, 9);
    const goal = nearBar ? Math.max(1, Math.min(4, p.x)) : 1 + Math.floor(rand() * 4);
    if (goal === b.x) return;
    const path = World.findPath(b.x, b.y, function (x, y) { return x === goal && y === 4; }, bromPassable);
    if (path) b.path = path;
  }

  // ---------- Pip's lute ----------
  const SCALE = [293.66, 329.63, 369.99, 440, 493.88, 587.33, 659.25];
  const notes = [];
  const pip = { playing: false, until: between(3, 6), next: 0, step: 3 };

  function updatePip(n, dt, t) {
    if (t > pip.until) {
      pip.playing = !pip.playing;
      pip.until = t + (pip.playing ? between(6, 11) : between(6, 14));
    }
    if (!pip.playing || t < pip.next) return;
    pip.next = t + (rand() < 0.25 ? 0.6 : 0.32);
    pip.step = Math.max(0, Math.min(SCALE.length - 1, pip.step + Math.floor(between(-2, 3))));
    if (window.Sound) window.Sound.pluck(SCALE[pip.step], panFor(n));
    if (rand() < 0.5) notes.push({ x: n.px + 2, y: n.py + 4, born: t });
  }

  function panFor(n) { return Math.max(-0.85, Math.min(0.85, (n.px + 8) / 160 - 1)); }

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
    { lines: [['durgin', 'To Brom, finest barkeep in the realm!'], ['hilda', 'To Brom!'], ['brom', 'Flattery won\'t cover your tab.']], clink: true, laugh: true },
    { lines: [['brom', 'Elsa, check on Fenwick. He\'s been on that page an hour.'], ['elsa', 'On my way.']], after: function () { sendElsa('tableC'); } },
    { at: 'tableA', lines: [['elsa', 'Top you off?'], ['durgin', 'Now you\'re speaking my language!']], clink: true },
    { at: 'tableB', lines: [['elsa', 'Pip, play something cheerful.'], ['pip', 'Every song is cheerful if you drink enough.']], laugh: true },
    { at: 'tableB', lines: [['elsa', 'Tobias? Tobias. ...He\'s fine.']] },
    { at: 'tableC', lines: [['elsa', 'Good book?'], ['fenwick', 'A dragon just ate the hero. On page twelve.']], laugh: true }
  ];
  const banter = { scene: null, idx: 0, lineEnd: 0, nextAt: 5, last: null };

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
        if (s.clink && window.Sound) window.Sound.clink(panFor(last), 3);
        if (s.laugh && window.Sound) window.Sound.laugh(panFor(last), true);
        if (s.after) s.after();
        banter.scene = null;
        banter.nextAt = t + between(8, 15);
        return;
      }
      const line = s.lines[banter.idx];
      const dur = 1.8 + line[1].length * 0.045;
      say(byId[line[0]], line[1], dur, t);
      banter.lineEnd = t + dur + 0.25;
      return;
    }
    if (paused || t < banter.nextAt) return;
    const options = SCENES.filter(function (sc) { return !sc.at && sc !== banter.last; });
    startScene(options[Math.floor(rand() * options.length)], t);
  }

  // ---------- Speech bubbles ----------
  function say(n, text, dur, t) {
    if (!layer || !n) return;
    if (n.bubble) n.bubble.remove();
    const el = document.createElement('div');
    el.className = 'bubble';
    el.textContent = text;
    layer.appendChild(el);
    n.bubble = el;
    n.bubbleUntil = t + dur;
    requestAnimationFrame(function () { el.classList.add('show'); });
  }

  function layoutBubbles(scale, stageW) {
    list.forEach(function (n) {
      if (!n.bubble) return;
      if (now > n.bubbleUntil) {
        const el = n.bubble;
        n.bubble = null;
        el.classList.remove('show');
        setTimeout(function () { el.remove(); }, 250);
        return;
      }
      const w = n.bubble.offsetWidth;
      let left = (n.px + 8) * scale;
      left = Math.max(w / 2 + 4, Math.min(stageW - w / 2 - 4, left));
      n.bubble.style.left = left + 'px';
      n.bubble.style.top = (n.py + (n.seated ? SEAT : 0) - 1) * scale + 'px';
    });
  }

  // ---------- Update ----------
  function update(dt, t, paused) {
    now = t;
    list.forEach(function (n) {
      if (t > n.nextBlink) {
        n.blinkUntil = t + 0.13;
        n.nextBlink = t + between(2.5, 6);
      }
      if (n.idle === 'drink' && t > n.nextMug) {
        n.mugUntil = t + 0.9;
        n.nextMug = t + between(4, 10);
      }
      if (n.cat) n.tail = Math.sin(t * 1.6) > 0.7 ? 1 : 0;
    });
    updateElsa(byId.elsa, dt, t);
    updateBrom(byId.brom, dt, t);
    updatePip(byId.pip, dt, t);
    updateBanter(t, paused);
    for (let i = notes.length - 1; i >= 0; i--) if (t - notes[i].born > 2) notes.splice(i, 1);
  }

  // ---------- Drawing ----------
  function px(c, color, x, y, w, h) { c.fillStyle = color; c.fillRect(x, y, w || 1, h || 1); }

  function drawMug(c, x, y, flip) {
    px(c, '#9aa0a8', x, y, 3, 4);
    px(c, '#f0ead8', x, y, 3, 1);
    px(c, '#9aa0a8', flip ? x - 1 : x + 3, y + 1, 1, 2);
  }

  function draw(c, n, t) {
    const x = Math.round(n.px), y = Math.round(n.py);
    if (n.cat) {
      c.drawImage(Sprites.cat(n.tail), x, y + 2);
      return;
    }
    const sleeping = n.idle === 'sleep';
    const closed = sleeping || t < n.blinkUntil;
    const frame = n.moving ? (n.parity ? 1 : 2) : 0;
    const img = Sprites.get(n.sprite, n.dir, frame, closed);
    const breathe = !n.moving && Math.sin(t * (sleeping ? 1.6 : 2.2) + n.phase) > 0.5 ? 1 : 0;
    if (n.seated) {
      const sy = y + SEAT + breathe + (sleeping ? 1 : 0);
      c.drawImage(img, 0, 0, 16, 13, x, sy, 16, 13);
      drawProps(c, n, t, x, y + SEAT);
    } else {
      c.drawImage(img, x, y);
      drawProps(c, n, t, x, y);
    }
  }

  function drawProps(c, n, t, x, y) {
    const raised = t < n.mugUntil;
    if (n.idle === 'drink') {
      if (n.dir === 'right') drawMug(c, x + 11, y + (raised ? 5 : 9), false);
      else if (n.dir === 'left') drawMug(c, x + 2, y + (raised ? 5 : 9), true);
      else if (n.dir === 'up' && raised) drawMug(c, x + 12, y + 4, false);
    } else if (n.idle === 'wipe' && !n.moving && n.dir === 'down') {
      drawMug(c, x + 6, y + 9, false);
      px(c, '#ece6d6', x + 5 + Math.round(Math.sin(t * 6) * 2), y + 12, 3, 2);
    } else if (n.idle === 'lute') {
      const strum = pip.playing && Math.sin(t * 18) > 0 ? 1 : 0;
      px(c, '#5a3418', x - 3, y + 8, 5, 1);
      px(c, '#2a1a0c', x - 4, y + 7, 2, 2);
      px(c, '#a8703a', x + 1, y + 8, 5, 5);
      px(c, '#c88a4a', x + 2, y + 9, 3, 3);
      px(c, '#2a1a0c', x + 3, y + 10, 1, 1);
      px(c, '#f2c8a0', x + 4, y + 9 + strum, 2, 2);
    } else if (n.idle === 'read') {
      px(c, '#6a2a1a', x + 10, y + 8, 5, 4);
      px(c, '#efe6cc', x + 11, y + 8, 3, 3);
      if (Math.sin(t * 0.4 + n.phase) > 0.97) px(c, '#ffffff', x + 12, y + 7, 2, 4);
    }
  }

  // Drawn after the lighting pass so they read in the dark.
  function drawGlows(c, t) {
    const s = byId.stranger;
    if (t >= s.blinkUntil) {
      const ex = Math.round(s.px) + 5, ey = Math.round(s.py) + SEAT + 5;
      c.fillStyle = 'rgba(255,216,74,0.25)';
      c.fillRect(ex - 1, ey - 1, 3, 3);
      c.fillStyle = '#ffe680';
      c.fillRect(ex, ey, 1, 1);
    }
    const tob = byId.tobias;
    for (let k = 0; k < 3; k++) {
      const ph = (t * 0.45 + k / 3) % 1;
      const zx = Math.round(tob.px + 11 + ph * 6), zy = Math.round(tob.py - 1 - ph * 10);
      c.globalAlpha = 1 - ph;
      c.fillStyle = '#e8ecff';
      c.fillRect(zx, zy, 3, 1);
      c.fillRect(zx + 1, zy + 1, 1, 1);
      c.fillRect(zx, zy + 2, 3, 1);
    }
    notes.forEach(function (nt) {
      const age = t - nt.born;
      const nx = Math.round(nt.x - age * 4 + Math.sin(age * 4) * 2), ny = Math.round(nt.y - age * 9);
      c.globalAlpha = Math.max(0, 1 - age / 2);
      c.fillStyle = '#ffe680';
      c.fillRect(nx, ny + 3, 2, 2);
      c.fillRect(nx + 1, ny, 1, 3);
      c.fillRect(nx + 2, ny, 1, 1);
    });
    c.globalAlpha = 1;
  }

  window.NPCs = {
    list: list,
    byId: byId,
    at: at,
    init: function (opts) {
      hooks = Object.assign(hooks, opts);
      layer = opts.layer;
    },
    update: update,
    draw: draw,
    drawGlows: drawGlows,
    layoutBubbles: layoutBubbles,
    say: function (n, text, dur) { say(n, text, dur, now); },
    panFor: panFor
  };
})();

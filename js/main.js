/*
 * Game loop, the player, input (keyboard, mouse, touch), dialog boxes,
 * and the menu and section windows.
 */
(function () {
  'use strict';

  if (new URLSearchParams(location.search).get('view') === 'page') {
    document.body.classList.add('page-mode');
    return;
  }

  const W = World.W, H = World.H, T = World.TILE;
  const $ = function (id) { return document.getElementById(id); };
  const canvas = $('screen');
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const stage = $('stage');
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
  const isTouch = window.matchMedia('(hover: none) and (pointer: coarse)').matches;

  const SECTIONS = { about: 'About me', work: 'Work experience', interests: 'Interests', other: 'Other' };
  const LOOK_LINES = {
    work: ['The quest board is crowded with notices.', 'Several are marked COMPLETE in a familiar hand.'],
    interests: ['Trophies and keepsakes crowd the mantel, and the shelf beside it is full of well-worn books.', 'Each one has a story.']
  };
  const FLAVOR = {
    window: 'Rain lashes the glass. Somewhere out there is a road. In here, there is a fire.',
    door: 'It\'s pouring out there. Best stay by the fire a while.',
    barrel: 'Dwarven stout, by the smell of it. The good stuff.',
    table: 'A sturdy table, ringed with years of mug stains.'
  };
  const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  const KEYS = { arrowup: 'up', w: 'up', arrowdown: 'down', s: 'down', arrowleft: 'left', a: 'left', arrowright: 'right', d: 'right' };
  const ACTION_KEYS = [' ', 'enter', 'z', 'e'];

  let mode = 'play'; // play | dialog | menu | panel
  let clock = 0;
  let scale = 3;
  const visited = {};
  const held = [];
  let tapMark = null;

  const player = {
    x: 9, y: 13, fx: 9, fy: 13, px: 9 * T, py: 13 * T,
    dir: 'up', moving: false, mt: 0, parity: 0, speed: 6.5,
    path: [], pending: null, blinkUntil: 0, nextBlink: 3
  };

  // ---------- Layout ----------
  function resize() {
    const vw = document.documentElement.clientWidth;
    const vh = window.visualViewport ? window.visualViewport.height : window.innerHeight;
    const availW = vw - 16;
    const availH = vh - 110;
    let s = Math.min(availW / W, availH / H);
    if (s >= 2) s = Math.floor(s);
    s = Math.max(0.8, s);
    scale = s;
    stage.style.width = Math.round(W * s) + 'px';
    stage.style.height = Math.round(H * s) + 'px';
    document.documentElement.style.setProperty('--s', s);
  }
  window.addEventListener('resize', resize);
  resize();

  // ---------- Helpers ----------
  function dirFrom(dx, dy) {
    if (Math.abs(dx) >= Math.abs(dy)) return dx > 0 ? 'right' : 'left';
    return dy > 0 ? 'down' : 'up';
  }
  function manhattan(ax, ay, bx, by) { return Math.abs(ax - bx) + Math.abs(ay - by); }

  function playerPassable(x, y) {
    return !World.solid(x, y) && !NPCs.at(x, y);
  }

  NPCs.init({
    layer: $('overlay-layer'),
    isFree: function (x, y, who) {
      if (player.x === x && player.y === y) return false;
      const other = NPCs.at(x, y);
      return !other || other === who;
    },
    player: function () { return { x: player.x, y: player.y }; }
  });

  function dismissTitle() {
    if (!titleCard.classList.contains('hide')) titleCard.classList.add('hide');
  }
  setTimeout(dismissTitle, 4500);

  // ---------- Player ----------
  function tryStep(dir) {
    player.dir = dir;
    const nx = player.x + DIRS[dir][0], ny = player.y + DIRS[dir][1];
    if (!playerPassable(nx, ny)) return false;
    player.fx = player.x; player.fy = player.y;
    player.x = nx; player.y = ny;
    player.mt = 0;
    player.moving = true;
    dismissTitle();
    return true;
  }

  function updatePlayer(dt) {
    if (clock > player.nextBlink) {
      player.blinkUntil = clock + 0.13;
      player.nextBlink = clock + 2.5 + Math.random() * 4;
    }
    if (player.moving) {
      player.mt = Math.min(1, player.mt + dt * player.speed);
      player.px = (player.fx + (player.x - player.fx) * player.mt) * T;
      player.py = (player.fy + (player.y - player.fy) * player.mt) * T;
      if (player.mt < 1) return;
      player.moving = false;
      player.parity ^= 1;
    }
    if (mode !== 'play') return;
    if (held.length) {
      tryStep(held[held.length - 1]);
      return;
    }
    if (player.path.length) {
      const next = player.path[0];
      if (tryStep(dirFrom(next[0] - player.x, next[1] - player.y))) {
        player.path.shift();
      } else {
        player.path = [];
        player.pending = null;
      }
      return;
    }
    if (player.pending) {
      const p = player.pending;
      player.pending = null;
      player.dir = dirFrom(p.x - player.x, p.y - player.y);
      interact();
    }
  }

  function facingTile() {
    return { x: player.x + DIRS[player.dir][0], y: player.y + DIRS[player.dir][1] };
  }

  // ---------- Interaction ----------
  function interact() {
    const f = facingTile();
    const npc = NPCs.at(f.x, f.y);
    if (npc) return talkTo(npc);
    const hs = World.hotspotAt(f.x, f.y);
    if (!hs) return;
    if (hs.npc) return talkTo(NPCs.byId[hs.npc]);
    if (hs.kind === 'section') {
      openDialog(null, LOOK_LINES[hs.id], function () { openSection(hs.id); });
    } else if (hs.kind === 'flavor') {
      openDialog(null, [FLAVOR[hs.key]]);
    }
  }

  const OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' };
  let talkingTo = null;

  function talkTo(n) {
    talkingTo = n;
    n.talkUntil = Infinity;
    if (n.id === 'brom') n.dir = 'down';
    else if (!n.seated && !n.cat && !n.moving) n.dir = OPPOSITE[player.dir];
    if (n.cat && window.Sound) Sound.meow(NPCs.panFor(n));
    if (n.section) {
      openDialog(n.name, n.intro, function () { openSection(n.section); });
    } else {
      const line = n.lines[n.lineIdx % n.lines.length];
      n.lineIdx++;
      openDialog(n.name, [line]);
    }
  }

  // ---------- Dialog box ----------
  const dlg = { lines: [], idx: 0, shown: 0, full: '', onDone: null };

  function openDialog(name, lines, onDone) {
    mode = 'dialog';
    held.length = 0;
    dlg.lines = lines;
    dlg.idx = 0;
    dlg.onDone = onDone || null;
    nameEl.textContent = name || '';
    nameEl.style.display = name ? '' : 'none';
    dialogEl.hidden = false;
    promptEl.classList.remove('show');
    showLine();
    if (window.Sound) Sound.blip(false);
  }

  function showLine() {
    dlg.full = dlg.lines[dlg.idx];
    dlg.shown = World.reduceMotion ? dlg.full.length : 0;
    textEl.textContent = World.reduceMotion ? dlg.full : '';
    dialogEl.classList.toggle('done', World.reduceMotion);
    srLive.textContent = (nameEl.textContent ? nameEl.textContent + ': ' : '') + dlg.full;
  }

  function updateDialog(dt) {
    if (mode !== 'dialog' || dlg.shown >= dlg.full.length) return;
    dlg.shown = Math.min(dlg.full.length, dlg.shown + dt * 55);
    textEl.textContent = dlg.full.slice(0, Math.floor(dlg.shown));
    if (dlg.shown >= dlg.full.length) dialogEl.classList.add('done');
  }

  function advanceDialog() {
    if (dlg.shown < dlg.full.length) {
      dlg.shown = dlg.full.length;
      textEl.textContent = dlg.full;
      dialogEl.classList.add('done');
      return;
    }
    if (window.Sound) Sound.blip(false);
    dlg.idx++;
    if (dlg.idx < dlg.lines.length) showLine();
    else closeDialog();
  }

  function closeDialog() {
    dialogEl.hidden = true;
    mode = 'play';
    if (talkingTo) {
      talkingTo.talkUntil = clock + 0.8;
      talkingTo = null;
    }
    const done = dlg.onDone;
    dlg.onDone = null;
    if (done) done();
  }

  dialogEl.addEventListener('click', function (e) {
    e.stopPropagation();
    advanceDialog();
  });

  // ---------- Menu and section windows ----------
  const scrim = document.createElement('div');
  scrim.id = 'scrim';
  scrim.hidden = true;
  document.body.appendChild(scrim);
  scrim.addEventListener('click', closeModal);
  let returnFocus = null;

  function openModal(el, focusEl) {
    if (mode === 'play' || mode === 'dialog') returnFocus = document.activeElement;
    if (mode === 'dialog') { dialogEl.hidden = true; talkingTo = null; }
    menuEl.hidden = true;
    panelEl.hidden = true;
    held.length = 0;
    player.path = [];
    player.pending = null;
    el.hidden = false;
    scrim.hidden = false;
    mode = el === menuEl ? 'menu' : 'panel';
    promptEl.classList.remove('show');
    (focusEl || el.querySelector('button')).focus();
  }

  function closeModal() {
    menuEl.hidden = true;
    panelEl.hidden = true;
    scrim.hidden = true;
    mode = 'play';
    if (returnFocus && returnFocus !== document.body && document.contains(returnFocus)) returnFocus.focus();
    else if (document.activeElement) document.activeElement.blur();
    returnFocus = null;
  }

  function openMenu() {
    dismissTitle();
    if (window.Sound) Sound.blip(true);
    openModal(menuEl);
  }

  function openSection(id) {
    const src = document.querySelector('#content [data-section="' + id + '"]');
    if (!src) return;
    const heading = src.querySelector('h2');
    panelTitle.textContent = heading ? heading.textContent : SECTIONS[id];
    panelBody.innerHTML = '';
    Array.prototype.forEach.call(src.children, function (child) {
      if (child !== heading) panelBody.appendChild(child.cloneNode(true));
    });
    visited[id] = true;
    if (window.Sound) Sound.blip(true);
    openModal(panelEl, panelTitle);
    panelEl.scrollTop = 0;
  }

  menuBtn.addEventListener('click', function (e) {
    if (mode === 'menu') closeModal();
    else openMenu();
    if (e.detail) menuBtn.blur();
  });
  menuEl.addEventListener('click', function (e) {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.section) openSection(b.dataset.section);
    else if (b.hasAttribute('data-close')) closeModal();
  });
  panelEl.querySelector('[data-close]').addEventListener('click', closeModal);

  soundBtn.addEventListener('click', function (e) {
    const on = window.Sound ? Sound.toggle() : false;
    soundBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
    soundBtn.setAttribute('aria-label', on ? 'Turn sound off' : 'Turn sound on');
    soundBtn.querySelector('.sound-label').textContent = on ? 'Sound on' : 'Sound off';
    if (e.detail) soundBtn.blur();
  });

  function trapFocus(e, el) {
    const items = el.querySelectorAll('button, a[href], [tabindex="0"]');
    if (!items.length) return;
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
  document.addEventListener('keydown', function (e) {
    const k = e.key.toLowerCase();
    if (mode === 'menu' || mode === 'panel') {
      if (k === 'escape') { e.preventDefault(); closeModal(); }
      else if (k === 'tab') trapFocus(e, mode === 'menu' ? menuEl : panelEl);
      return;
    }
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const onControl = e.target.closest && e.target.closest('button, a');
    if (onControl && (k === ' ' || k === 'enter')) return;
    if (mode === 'dialog') {
      if (ACTION_KEYS.indexOf(k) !== -1) { e.preventDefault(); if (!e.repeat) advanceDialog(); }
      else if (k === 'escape') { e.preventDefault(); closeDialog(); }
      return;
    }
    if (k === 'escape') { e.preventDefault(); openMenu(); return; }
    const dir = KEYS[k];
    if (dir) {
      e.preventDefault();
      dismissTitle();
      if (held.indexOf(dir) === -1) held.push(dir);
      player.path = [];
      player.pending = null;
      return;
    }
    if (ACTION_KEYS.indexOf(k) !== -1) {
      e.preventDefault();
      dismissTitle();
      if (!e.repeat && !player.moving) interact();
    }
  });
  document.addEventListener('keyup', function (e) {
    const dir = KEYS[e.key.toLowerCase()];
    const i = held.indexOf(dir);
    if (i !== -1) held.splice(i, 1);
  });
  window.addEventListener('blur', function () { held.length = 0; });

  // ---------- Mouse and touch ----------
  function resolveTap(tx, ty) {
    if (ty <= 2 && tx >= 9 && tx <= 11) return { x: tx, y: 3 }; // chimney means hearth
    if (ty === 1) ty = 2;
    const n = NPCs.at(tx, ty);
    if (n && n.id === 'brom') return { x: n.x, y: 5 }; // talk across the counter
    return { x: tx, y: ty };
  }

  canvas.addEventListener('pointerdown', function (e) {
    dismissTitle();
    if (mode === 'dialog') { advanceDialog(); return; }
    if (mode !== 'play') return;
    const r = canvas.getBoundingClientRect();
    const tx = Math.floor(((e.clientX - r.left) / r.width) * W / T);
    const ty = Math.floor(((e.clientY - r.top) / r.height) * H / T);
    const target = resolveTap(tx, ty);
    const interactive = NPCs.at(target.x, target.y) || World.hotspotAt(target.x, target.y);
    if (interactive) {
      if (manhattan(player.x, player.y, target.x, target.y) === 1) {
        player.path = [];
        if (player.moving) { player.pending = target; return; }
        player.dir = dirFrom(target.x - player.x, target.y - player.y);
        interact();
        return;
      }
      const path = World.findPath(player.x, player.y, function (x, y) {
        return manhattan(x, y, target.x, target.y) === 1;
      }, playerPassable);
      if (path) {
        player.path = path;
        player.pending = target;
        const end = path[path.length - 1];
        tapMark = { x: end[0], y: end[1], t: clock };
      }
      return;
    }
    if (!playerPassable(target.x, target.y)) return;
    const path = World.findPath(player.x, player.y, function (x, y) {
      return x === target.x && y === target.y;
    }, playerPassable);
    if (path) {
      player.path = path;
      player.pending = null;
      tapMark = { x: target.x, y: target.y, t: clock };
    }
  });

  // ---------- Prompt label over whatever you're facing ----------
  function anchorFor(tx, ty, npc, hs) {
    if (npc) return { x: npc.px + 8, y: npc.py + (npc.seated ? 2 : 0) - 2 };
    if (hs && hs.npc) { const b = NPCs.byId[hs.npc]; return { x: b.px + 8, y: b.py - 2 }; }
    if (World.tile(tx, ty) === 'F') return { x: 168, y: 30 };
    if (World.tile(tx, ty) === 'Q') return { x: 48, y: 178 };
    return { x: tx * T + 8, y: ty * T };
  }

  function updatePrompt() {
    if (mode !== 'play' || player.moving || player.path.length) {
      promptEl.classList.remove('show');
      return;
    }
    const f = facingTile();
    const npc = NPCs.at(f.x, f.y);
    const hs = npc ? null : World.hotspotAt(f.x, f.y);
    let label = null;
    if (npc && npc.section) label = SECTIONS[npc.section];
    else if (npc) label = 'Talk to ' + (npc.short || npc.name);
    else if (hs && hs.kind === 'section') label = SECTIONS[hs.id];
    else if (hs && hs.npc) label = SECTIONS[NPCs.byId[hs.npc].section];
    else if (hs) label = 'Look';
    if (!label) { promptEl.classList.remove('show'); return; }
    const a = anchorFor(f.x, f.y, npc, hs);
    promptEl.textContent = '▶ ' + label + (isTouch ? '' : '  [Space]');
    promptEl.classList.add('show');
    const half = promptEl.offsetWidth / 2;
    const stageW = stage.clientWidth;
    promptEl.style.left = Math.max(half + 4, Math.min(stageW - half - 4, a.x * scale)) + 'px';
    promptEl.style.top = a.y * scale + 'px';
  }

  // ---------- Rendering ----------
  const PLAYER_ACTOR = { isPlayer: true };

  function drawPlayer() {
    const frame = player.moving ? (player.parity ? 1 : 2) : 0;
    const img = Sprites.get('player', player.dir, frame, clock < player.blinkUntil);
    ctx.drawImage(img, Math.round(player.px), Math.round(player.py));
  }

  function drawMarkers() {
    const bob = Math.round(Math.sin(clock * 4) * 1.5);
    const spots = [];
    const brom = NPCs.byId.brom, stranger = NPCs.byId.stranger;
    if (!visited.about) spots.push([brom.px + 8, brom.py - 4]);
    if (!visited.work) spots.push([48, 174]);
    if (!visited.interests) spots.push([168, 8]);
    if (!visited.other) spots.push([stranger.px + 8, stranger.py - 2]);
    spots.forEach(function (s) {
      const x = Math.round(s[0]) - 1, y = Math.round(s[1]) - 8 + bob;
      ctx.fillStyle = '#1a1010';
      ctx.fillRect(x - 1, y - 1, 4, 7);
      ctx.fillRect(x - 1, y + 6, 4, 4);
      ctx.fillStyle = '#ffd84a';
      ctx.fillRect(x, y, 2, 5);
      ctx.fillRect(x, y + 7, 2, 2);
    });
  }

  function drawTapMark() {
    if (!tapMark) return;
    const age = clock - tapMark.t;
    if (age > 0.6) { tapMark = null; return; }
    const cx = tapMark.x * T + 8, cy = tapMark.y * T + 12;
    const r = Math.round(2 + age * 8);
    ctx.globalAlpha = 1 - age / 0.6;
    ctx.fillStyle = '#ffe680';
    ctx.fillRect(cx - r, cy, 2, 1);
    ctx.fillRect(cx + r - 1, cy, 2, 1);
    ctx.fillRect(cx, cy - Math.round(r / 2), 1, 1);
    ctx.fillRect(cx, cy + Math.round(r / 2), 1, 1);
    ctx.globalAlpha = 1;
  }

  function render(dt) {
    World.drawBackground(ctx);
    World.drawAnimated(ctx, clock, dt);
    drawTapMark();
    const actors = NPCs.list.slice();
    actors.push(PLAYER_ACTOR);
    actors.sort(function (a, b) {
      const ay = a.isPlayer ? player.py : a.py + (a.seated ? 2 : 0);
      const by = b.isPlayer ? player.py : b.py + (b.seated ? 2 : 0);
      return ay - by;
    });
    actors.forEach(function (a) {
      if (a.isPlayer) drawPlayer();
      else NPCs.draw(ctx, a, clock);
    });
    World.drawLighting(ctx, clock);
    NPCs.drawGlows(ctx, clock);
    drawMarkers();
  }

  let last = performance.now();
  function frame(ts) {
    const dt = Math.min(0.05, Math.max(0, (ts - last) / 1000));
    last = ts;
    clock += dt;
    World.update(dt, clock);
    NPCs.update(dt, clock, mode !== 'play');
    updatePlayer(dt);
    updateDialog(dt);
    render(dt);
    NPCs.layoutBubbles(scale, stage.clientWidth);
    updatePrompt();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();

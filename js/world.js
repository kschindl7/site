/*
 * The tavern: its map, the static art (drawn once), and everything that
 * moves on its own (rain at the windows, the fire, candles, lightning,
 * and the lighting pass that makes it night).
 */
(function () {
  'use strict';

  const TILE = 16;
  const COLS = 20;
  const ROWS = 15;
  const W = COLS * TILE;
  const H = ROWS * TILE;

  // #  wall top        W  wall face      .  floor
  // b  behind the bar  B  bar counter    F  hearth
  // K  barrels         T  table          t  small table
  // s  stool           Q  quest board    D  door
  const MAP = [
    '####################',
    '#WWWWWWWWWWWWWWWWWW#',
    '#WWWWWWWWWWWWWWWWWW#',
    '#bbbbB...FFF......K#',
    '#bbbbB............K#',
    '#BBBBB.............#',
    '#s.s...............#',
    '#......sTTs..TTs...#',
    '#.......TT..sTT....#',
    '#..................#',
    '#..................#',
    '#......sTT.........#',
    '#.QQ....TTs......ts#',
    '#..................#',
    '#########DD#########'
  ];
  const SOLID = '#WbBFKTtsQD';

  function tile(x, y) {
    if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return '#';
    return MAP[y][x];
  }
  function solid(x, y) { return SOLID.indexOf(tile(x, y)) !== -1; }

  // What a tile means when you face it and press Space.
  function hotspotAt(x, y) {
    const c = tile(x, y);
    if (c === 'B') return { kind: 'section', id: 'about', npc: 'brom' };
    if (c === 'Q') return { kind: 'section', id: 'work' };
    if (c === 'F') return { kind: 'section', id: 'interests' };
    if (c === 'W' && y === 2 && (x === 16 || x === 17)) return { kind: 'section', id: 'interests' };
    if (c === 't') return { kind: 'npc', npc: 'stranger' };
    if (c === 'W' && y === 2 && [6, 7, 13, 14, 18].indexOf(x) !== -1) return { kind: 'flavor', key: 'window' };
    if (c === 'D') return { kind: 'flavor', key: 'door' };
    if (c === 'K') return { kind: 'flavor', key: 'barrel' };
    if (c === 'T') return { kind: 'flavor', key: 'table' };
    return null;
  }

  // Breadth-first path on the tile grid. Returns tiles after the start,
  // or null when the goal can't be reached.
  function findPath(sx, sy, isGoal, passable) {
    const key = function (x, y) { return y * COLS + x; };
    const prev = new Map();
    prev.set(key(sx, sy), -1);
    const queue = [[sx, sy]];
    while (queue.length) {
      const cur = queue.shift();
      if (isGoal(cur[0], cur[1]) && !(cur[0] === sx && cur[1] === sy)) {
        const out = [];
        let k = key(cur[0], cur[1]);
        while (k !== key(sx, sy)) {
          out.unshift([k % COLS, Math.floor(k / COLS)]);
          k = prev.get(k);
        }
        return out;
      }
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
        const nx = cur[0] + d[0];
        const ny = cur[1] + d[1];
        const k = key(nx, ny);
        if (prev.has(k)) return;
        if (!passable(nx, ny)) return;
        prev.set(k, key(cur[0], cur[1]));
        queue.push([nx, ny]);
      });
    }
    return null;
  }

  // Seeded random so the static art is the same on every visit.
  function seeded(seed) {
    return function () {
      seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function rect(c, color, x, y, w, h) {
    c.fillStyle = color;
    c.fillRect(x, y, w, h);
  }

  function ellipse(c, color, cx, cy, rx, ry) {
    c.fillStyle = color;
    for (let dy = -ry; dy <= ry; dy++) {
      const half = Math.round(rx * Math.sqrt(1 - (dy * dy) / (ry * ry)));
      c.fillRect(cx - half, cy + dy, half * 2, 1);
    }
  }

  // ---------- Static art ----------
  function drawFloor(c, R) {
    const shades = ['#6e4a2c', '#664429', '#744f2f', '#5f3f25'];
    for (let y = 48; y < 224; y += 4) {
      const off = ((y / 4) * 11) % 24;
      for (let x = -off; x < W; x += 24) {
        rect(c, shades[Math.floor(R() * shades.length)], x, y, 24, 4);
        rect(c, '#3e2816', x, y, 1, 4);
        rect(c, 'rgba(0,0,0,0.2)', x, y + 3, 24, 1);
        if (R() < 0.1) rect(c, '#4a301b', x + 4 + Math.floor(R() * 16), y + 1, 2, 1);
      }
    }
    // Flagstones behind the bar.
    rect(c, '#4a443f', 16, 48, 64, 32);
    for (let y = 48; y < 80; y += 8) {
      const off = (y / 8) % 2 ? 6 : 0;
      for (let x = 16 - off; x < 80; x += 12) {
        rect(c, R() < 0.5 ? '#57504a' : '#504943', x + 1, y + 1, 10, 6);
      }
    }
  }

  function drawRug(c) {
    const x = 176, y = 160, w = 80, h = 48;
    rect(c, '#2a0e10', x - 1, y - 1, w + 2, h + 2);
    rect(c, '#7d1f26', x, y, w, h);
    rect(c, '#c79a3e', x + 3, y + 3, w - 6, 1);
    rect(c, '#c79a3e', x + 3, y + h - 4, w - 6, 1);
    rect(c, '#c79a3e', x + 3, y + 3, 1, h - 6);
    rect(c, '#c79a3e', x + w - 4, y + 3, 1, h - 6);
    for (let i = 0; i < 4; i++) {
      const cx = x + 16 + i * 16, cy = y + h / 2;
      for (let d = 0; d < 6; d++) {
        rect(c, '#a8343a', cx - d, cy - 6 + d, d * 2 + 1, 1);
        rect(c, '#a8343a', cx - d, cy + 6 - d, d * 2 + 1, 1);
      }
      rect(c, '#c79a3e', cx, cy, 1, 1);
    }
    // Fringe.
    for (let i = x + 1; i < x + w; i += 3) {
      rect(c, '#d8c8a0', i, y - 3, 1, 2);
      rect(c, '#d8c8a0', i, y + h + 1, 1, 2);
    }
  }

  function drawWalls(c, R) {
    // Wall face: plaster above, wood wainscot below, timber framing.
    rect(c, '#b49c76', 16, 16, 288, 32);
    for (let i = 0; i < 260; i++) {
      rect(c, R() < 0.5 ? '#a68f69' : '#c0a982', 16 + Math.floor(R() * 288), 20 + Math.floor(R() * 18), 1, 1);
    }
    rect(c, '#5a3920', 16, 38, 288, 10);
    for (let x = 16; x < 304; x += 12) rect(c, '#4a2e19', x, 39, 1, 8);
    rect(c, '#6e4829', 16, 38, 288, 1);
    rect(c, '#3f2716', 16, 16, 288, 4);
    [80, 128, 192, 240].forEach(function (x) { rect(c, '#3f2716', x - 1, 20, 3, 18); });
    // Shadow where wall meets floor.
    rect(c, 'rgba(0,0,0,0.35)', 16, 48, 288, 2);
    rect(c, 'rgba(0,0,0,0.15)', 16, 50, 288, 2);

    // Wall tops: back, sides, front.
    rect(c, '#1d1411', 0, 0, W, 16);
    rect(c, '#1d1411', 0, 0, 16, H);
    rect(c, '#1d1411', W - 16, 0, 16, H);
    rect(c, '#1d1411', 0, 224, W, 16);
    for (let i = 0; i < 120; i++) {
      const edge = Math.floor(R() * 4);
      const color = R() < 0.5 ? '#261b16' : '#17100d';
      if (edge === 0) rect(c, color, Math.floor(R() * W), Math.floor(R() * 14), 3, 1);
      if (edge === 1) rect(c, color, Math.floor(R() * 14), Math.floor(R() * H), 3, 1);
      if (edge === 2) rect(c, color, W - 16 + Math.floor(R() * 14), Math.floor(R() * H), 3, 1);
      if (edge === 3) rect(c, color, Math.floor(R() * W), 226 + Math.floor(R() * 12), 3, 1);
    }
    rect(c, '#3a2a22', 15, 16, 1, 208);
    rect(c, '#3a2a22', W - 16, 16, 1, 208);
    rect(c, '#3a2a22', 16, 224, 128, 1);
    rect(c, '#3a2a22', 176, 224, 128, 1);
  }

  function drawShelves(c, R) {
    rect(c, '#2e1c10', 18, 18, 60, 28);
    rect(c, '#3b2414', 20, 20, 56, 24);
    [29, 41].forEach(function (py) {
      rect(c, '#7a5230', 18, py, 60, 2);
      rect(c, '#4a2e19', 18, py + 2, 60, 1);
      for (let x = 21; x < 74;) {
        if (R() < 0.22) {
          // A pewter mug.
          rect(c, '#9aa0a8', x, py - 4, 3, 4);
          rect(c, '#c8ccd2', x, py - 4, 3, 1);
          rect(c, '#9aa0a8', x + 3, py - 3, 1, 2);
          x += 6;
          continue;
        }
        const color = ['#2f7a44', '#9b5a1a', '#7a1f2a', '#2a4f8a', '#c8a040', '#4a6a2a'][Math.floor(R() * 6)];
        const h = 5 + Math.floor(R() * 3);
        rect(c, color, x, py - h + 2, 3, h - 2);
        rect(c, color, x + 1, py - h, 1, 2);
        rect(c, 'rgba(255,255,255,0.35)', x, py - h + 3, 1, 2);
        x += 4 + Math.floor(R() * 2);
      }
    });
  }

  function drawBookshelf(c, R) {
    rect(c, '#2a180c', 256, 17, 32, 31);
    rect(c, '#3e2614', 258, 19, 28, 27);
    [27, 36, 45].forEach(function (py) {
      rect(c, '#6e4829', 257, py, 30, 2);
      for (let x = 259; x < 285;) {
        const w = 2 + Math.floor(R() * 2);
        const h = 6 + Math.floor(R() * 2);
        if (x + w > 285) break;
        const color = ['#7a1f2a', '#2a4f8a', '#2f6a3a', '#8a6a2a', '#5a2a6a', '#3a3a3a'][Math.floor(R() * 6)];
        rect(c, color, x, py - h, w, h);
        rect(c, 'rgba(255,230,160,0.35)', x, py - h + 2, w, 1);
        x += w + (R() < 0.15 ? 2 : 0);
      }
    });
  }

  function drawFireplace(c, R) {
    // Chimney breast.
    rect(c, '#555250', 144, 16, 48, 40);
    for (let y = 16; y < 56; y += 5) {
      const off = (y / 5) % 2 ? 4 : 0;
      for (let x = 144 - off; x < 192; x += 8) {
        rect(c, R() < 0.3 ? '#6a6662' : '#5f5c59', Math.max(144, x + 1), y + 1, Math.min(7, 192 - Math.max(144, x + 1)), 4);
      }
    }
    rect(c, '#3a3836', 143, 16, 1, 40);
    rect(c, '#3a3836', 192, 16, 1, 40);
    // Opening with an arched top.
    rect(c, '#140c0a', 152, 33, 32, 25);
    rect(c, '#140c0a', 154, 31, 28, 2);
    rect(c, '#140c0a', 157, 30, 22, 1);
    rect(c, '#2a1a14', 153, 34, 1, 23);
    rect(c, '#2a1a14', 182, 34, 1, 23);
    // Mantel.
    rect(c, '#4a2c18', 140, 26, 56, 4);
    rect(c, '#6e4829', 140, 26, 56, 1);
    rect(c, 'rgba(0,0,0,0.35)', 142, 30, 52, 1);
    // Trophy: a shield over crossed swords.
    for (let i = 0; i < 12; i++) {
      rect(c, '#b8bcc4', 160 + i, 15 + i, 1, 1);
      rect(c, '#b8bcc4', 176 - i, 15 + i, 1, 1);
    }
    rect(c, '#6a4a2a', 159, 14, 2, 2);
    rect(c, '#6a4a2a', 175, 14, 2, 2);
    rect(c, '#d4a838', 163, 16, 11, 7);
    rect(c, '#d4a838', 164, 23, 9, 1);
    rect(c, '#d4a838', 166, 24, 5, 1);
    rect(c, '#8a2020', 164, 17, 9, 6);
    rect(c, '#8a2020', 166, 23, 5, 1);
    rect(c, '#d4a838', 168, 17, 1, 7);
    // Mantel candles (flames are animated).
    rect(c, '#e8e0c8', 146, 22, 2, 4);
    rect(c, '#e8e0c8', 188, 22, 2, 4);
    // Hearth.
    rect(c, '#6e6a66', 144, 56, 48, 6);
    rect(c, '#827d78', 144, 56, 48, 1);
    rect(c, '#4a4744', 144, 62, 48, 2);
    for (let x = 150; x < 192; x += 10) rect(c, '#5a5652', x, 57, 1, 5);
    // Iron fire dogs.
    rect(c, '#222', 156, 52, 2, 5);
    rect(c, '#222', 178, 52, 2, 5);
    // Log basket by the hearth.
    rect(c, '#4a2c18', 136, 50, 7, 7);
    rect(c, '#7a5230', 136, 48, 3, 3);
    rect(c, '#6a4426', 139, 47, 3, 3);
  }

  function drawBar(c, R) {
    // Long counter (row 5) and the short return (x 5, rows 3 and 4).
    rect(c, '#2e1c10', 16, 80, 80, 16);
    rect(c, '#8a5a34', 16, 80, 80, 10);
    rect(c, '#a8744a', 16, 80, 80, 1);
    rect(c, '#4e301a', 16, 90, 80, 6);
    for (let x = 22; x < 96; x += 14) rect(c, '#3a2212', x, 91, 1, 5);
    rect(c, '#2e1c10', 80, 48, 16, 34);
    rect(c, '#8a5a34', 81, 48, 14, 34);
    rect(c, '#a8744a', 81, 48, 1, 34);
    rect(c, '#5e3a20', 94, 48, 1, 34);
    for (let i = 0; i < 18; i++) {
      rect(c, '#7a4e2c', 16 + Math.floor(R() * 78), 82 + Math.floor(R() * 7), 4, 1);
    }
    // Taps.
    [56, 64].forEach(function (y) {
      rect(c, '#c8a040', 85, y, 5, 2);
      rect(c, '#8a6a20', 87, y + 2, 1, 2);
      rect(c, '#2a1a10', 86, y - 3, 3, 3);
    });
    // Mugs and a bottle on the counter.
    [[24, 82], [60, 83]].forEach(function (p) {
      rect(c, '#9aa0a8', p[0], p[1], 3, 4);
      rect(c, '#f0ead8', p[0], p[1], 3, 1);
      rect(c, '#9aa0a8', p[0] + 3, p[1] + 1, 1, 2);
    });
    rect(c, '#2f7a44', 42, 80, 3, 5);
    rect(c, '#2f7a44', 43, 78, 1, 2);
    // Hanging lantern over the bar (flame is animated).
    rect(c, '#2a2420', 47, 40, 1, 8);
    rect(c, '#3a3028', 44, 48, 7, 8);
    rect(c, '#f7d27a', 45, 49, 5, 6);
  }

  function drawStool(c, cx, cy) {
    ellipse(c, 'rgba(0,0,0,0.3)', cx, cy + 4, 5, 2);
    rect(c, '#3a2414', cx - 4, cy, 1, 4);
    rect(c, '#3a2414', cx + 3, cy, 1, 4);
    ellipse(c, '#4a2e19', cx, cy, 5, 3);
    ellipse(c, '#7a5230', cx, cy - 1, 4, 2);
  }

  function drawTable(c, cx, cy, rx, ry, R) {
    ellipse(c, 'rgba(0,0,0,0.35)', cx, cy + ry + 2, rx, 3);
    rect(c, '#3a2414', cx - 2, cy + 2, 4, ry + 2);
    ellipse(c, '#3e2614', cx, cy + 1, rx, ry);
    ellipse(c, '#7a4f2c', cx, cy, rx - 1, ry - 1);
    ellipse(c, '#8a5c34', cx - 1, cy - 1, rx - 4, ry - 3);
    for (let i = 0; i < 4; i++) rect(c, '#6a4426', cx - rx + 4 + Math.floor(R() * (rx * 2 - 8)), cy - ry + 3 + Math.floor(R() * (ry * 2 - 5)), 4, 1);
  }

  function drawMug(c, x, y) {
    rect(c, '#9aa0a8', x, y, 3, 4);
    rect(c, '#f0ead8', x, y, 3, 1);
    rect(c, '#9aa0a8', x + 3, y + 1, 1, 2);
  }

  function drawFurniture(c, R) {
    drawStool(c, 24, 106);
    drawStool(c, 56, 106);
    // Table A (8-9, 7-8), B (13-14, 7-8), C (8-9, 11-12).
    drawTable(c, 144, 127, 14, 10, R);
    drawTable(c, 224, 127, 14, 10, R);
    drawTable(c, 144, 191, 14, 10, R);
    drawStool(c, 120, 122); drawStool(c, 168, 122);
    drawStool(c, 200, 138); drawStool(c, 248, 122);
    drawStool(c, 120, 186); drawStool(c, 168, 202);
    // Stranger's small table and stool.
    drawTable(c, 280, 200, 7, 5, R);
    drawStool(c, 296, 202);
    // Table settings.
    drawMug(c, 134, 124); drawMug(c, 151, 127);
    drawMug(c, 216, 128); drawMug(c, 229, 122);
    drawMug(c, 137, 190);
    rect(c, '#e8dcb0', 148, 188, 6, 4);
    rect(c, '#8a7a5a', 149, 189, 4, 1);
    // Candle bodies (flames are animated).
    [[143, 121], [223, 121], [143, 185], [279, 194]].forEach(function (p) {
      rect(c, '#3a3028', p[0] - 1, p[1] + 4, 4, 1);
      rect(c, '#e8e0c8', p[0], p[1], 2, 4);
    });
    // Barrels in the corner.
    [48, 64].forEach(function (y) {
      rect(c, '#2a180c', 289, y + 1, 14, 15);
      rect(c, '#6a4426', 290, y + 1, 12, 14);
      rect(c, '#7e5532', 292, y + 1, 3, 14);
      rect(c, '#33333a', 290, y + 4, 12, 1);
      rect(c, '#33333a', 290, y + 11, 12, 1);
      ellipse(c, '#8a5c34', 296, y + 2, 6, 2);
    });
  }

  function drawQuestBoard(c) {
    rect(c, '#2e1c10', 34, 186, 2, 22);
    rect(c, '#2e1c10', 60, 186, 2, 22);
    rect(c, '#2e1c10', 31, 181, 34, 20);
    rect(c, '#8a5a32', 33, 183, 30, 16);
    rect(c, '#9c6a3c', 33, 183, 30, 1);
    rect(c, '#4a2c18', 31, 179, 34, 3);
    [[35, 185, 8, 9], [45, 184, 7, 7], [54, 186, 7, 8], [45, 192, 9, 6]].forEach(function (n, i) {
      rect(c, '#e8dcb0', n[0], n[1], n[2], n[3]);
      for (let ly = n[1] + 2; ly < n[1] + n[3] - 1; ly += 2) rect(c, '#9a8a6a', n[0] + 1, ly, n[2] - 2, 1);
      rect(c, i === 1 ? '#a02020' : '#3a3a40', n[0] + Math.floor(n[2] / 2), n[1], 1, 1);
    });
    rect(c, 'rgba(0,0,0,0.3)', 30, 208, 36, 2);
  }

  function drawDoor(c) {
    rect(c, '#140c08', 144, 224, 32, 16);
    rect(c, '#5a3a20', 146, 225, 28, 15);
    for (let x = 150; x < 174; x += 5) rect(c, '#3e2614', x, 225, 1, 15);
    rect(c, '#2a2a30', 146, 228, 28, 1);
    rect(c, '#2a2a30', 146, 235, 28, 1);
    rect(c, '#c8a040', 170, 231, 2, 2);
    // Welcome mat.
    rect(c, '#5a2e22', 148, 214, 24, 8);
    rect(c, '#7a4432', 149, 215, 22, 6);
    for (let x = 151; x < 170; x += 3) rect(c, '#5a2e22', x, 217, 1, 2);
    // Wall sconce near the quest board.
    rect(c, '#2a2420', 16, 174, 3, 2);
    rect(c, '#2a2420', 17, 168, 2, 6);
    rect(c, '#e8e0c8', 17, 165, 2, 3);
  }

  let bg = null;
  function buildStatic() {
    bg = document.createElement('canvas');
    bg.width = W;
    bg.height = H;
    const c = bg.getContext('2d');
    const R = seeded(1337);
    drawFloor(c, R);
    drawRug(c);
    drawWalls(c, R);
    drawShelves(c, R);
    drawBookshelf(c, R);
    drawFireplace(c, R);
    drawBar(c, R);
    drawFurniture(c, R);
    drawQuestBoard(c);
    drawDoor(c);
  }

  // ---------- Windows and rain ----------
  const WINDOWS = [
    { x: 98, y: 19, w: 28, h: 22, curtains: true },
    { x: 210, y: 19, w: 28, h: 22, curtains: true },
    { x: 291, y: 20, w: 10, h: 16, curtains: false }
  ];
  WINDOWS.forEach(function (win, i) {
    const R = seeded(77 + i);
    win.rain = [];
    win.beads = [];
    const n = Math.round(win.w * win.h / 30);
    for (let k = 0; k < n; k++) {
      win.rain.push({ x: R() * (win.w + 8), y: R() * win.h, sp: 110 + R() * 70, len: 2 + Math.floor(R() * 3) });
    }
    for (let k = 0; k < Math.max(2, Math.round(win.w / 7)); k++) {
      win.beads.push({ x: Math.floor(R() * win.w), y: R() * win.h, vy: 0, wait: R() * 4 });
    }
    // Distant ridge line and a lit cottage window far off.
    win.ridge = [];
    let h = 4 + R() * 4;
    for (let x = 0; x < win.w; x++) {
      h = Math.max(2, Math.min(9, h + (R() - 0.5) * 2));
      win.ridge.push(Math.round(h));
    }
    win.cottage = R() < 0.8 ? Math.floor(3 + R() * (win.w - 6)) : -1;
  });

  const lightning = { next: 6 + Math.random() * 10, flashes: [], level: 0 };
  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function updateWeather(dt, t) {
    WINDOWS.forEach(function (win) {
      win.rain.forEach(function (d) {
        d.y += d.sp * dt;
        d.x -= d.sp * 0.22 * dt;
        if (d.y > win.h + 3 || d.x < -3) {
          d.y -= win.h + 6;
          d.x = Math.random() * (win.w + 8);
        }
      });
      win.beads.forEach(function (b) {
        if (b.wait > 0) { b.wait -= dt; return; }
        b.vy = Math.min(10, b.vy + dt * 6);
        b.y += b.vy * dt;
        if (b.y > win.h) {
          b.y = Math.random() * win.h * 0.4;
          b.x = Math.floor(Math.random() * win.w);
          b.vy = 0;
          b.wait = 1 + Math.random() * 4;
        }
      });
    });

    lightning.next -= dt;
    if (lightning.next <= 0) {
      lightning.next = 14 + Math.random() * 22;
      const n = 1 + Math.floor(Math.random() * 3);
      for (let i = 0; i < n; i++) lightning.flashes.push({ at: t + i * 0.14 + Math.random() * 0.05, dur: 0.07 });
      if (window.Sound) window.Sound.thunder(0.6 + Math.random() * 1.8);
    }
    lightning.level = 0;
    lightning.flashes = lightning.flashes.filter(function (f) {
      if (t >= f.at && t <= f.at + f.dur) lightning.level = 1;
      return t <= f.at + f.dur;
    });
  }

  function drawWindow(c, win, t) {
    const flash = reduceMotion ? 0 : lightning.level;
    c.save();
    c.beginPath();
    c.rect(win.x, win.y, win.w, win.h);
    c.clip();
    // Night sky.
    for (let y = 0; y < win.h; y++) {
      const k = y / win.h;
      const r = Math.round(10 + 14 * k + flash * 130);
      const g = Math.round(14 + 18 * k + flash * 150);
      const b = Math.round(36 + 30 * k + flash * 190);
      rect(c, 'rgb(' + r + ',' + g + ',' + b + ')', win.x, win.y + y, win.w, 1);
    }
    // Ridge and cottage.
    const ridgeColor = flash ? '#3a4470' : '#060914';
    win.ridge.forEach(function (h, x) { rect(c, ridgeColor, win.x + x, win.y + win.h - h, 1, h); });
    if (win.cottage >= 0) {
      const glow = 0.75 + 0.25 * Math.sin(t * 1.3 + win.x);
      rect(c, 'rgba(255,200,90,' + glow.toFixed(2) + ')', win.x + win.cottage, win.y + win.h - 4, 1, 1);
    }
    // Falling rain.
    c.fillStyle = flash ? 'rgba(230,236,255,0.9)' : 'rgba(130,150,205,0.75)';
    win.rain.forEach(function (d) {
      for (let i = 0; i < d.len; i++) c.fillRect(Math.round(win.x + d.x + i * 0.22), Math.round(win.y + d.y - i), 1, 1);
    });
    // Beads running down the glass.
    win.beads.forEach(function (b) {
      rect(c, 'rgba(180,195,235,0.8)', win.x + b.x, Math.round(win.y + b.y), 1, 1);
      if (b.vy > 2) rect(c, 'rgba(180,195,235,0.35)', win.x + b.x, Math.round(win.y + b.y) - 1, 1, 1);
    });
    c.restore();
    // Frame, mullions, and sill.
    const fx = win.x - 2, fy = win.y - 2, fw = win.w + 4, fh = win.h + 4;
    rect(c, '#3a2414', fx, fy, fw, 2);
    rect(c, '#3a2414', fx, fy + fh - 2, fw, 2);
    rect(c, '#3a2414', fx, fy, 2, fh);
    rect(c, '#3a2414', fx + fw - 2, fy, 2, fh);
    rect(c, '#3a2414', win.x + Math.floor(win.w / 2) - 1, win.y, 2, win.h);
    rect(c, '#3a2414', win.x, win.y + Math.floor(win.h / 2), win.w, 1);
    rect(c, '#6a4426', fx - 1, fy + fh, fw + 2, 2);
    rect(c, '#8a5c34', fx - 1, fy + fh, fw + 2, 1);
    if (win.curtains) {
      [fx - 4, fx + fw].forEach(function (x, side) {
        rect(c, '#6a1a22', x, fy - 1, 4, fh + 1);
        rect(c, '#8a2a32', x + (side ? 1 : 2), fy - 1, 1, fh + 1);
        rect(c, '#c79a3e', x, fy + 12, 4, 1);
      });
      rect(c, '#2a1a10', fx - 5, fy - 2, fw + 10, 1);
    }
  }

  // ---------- Fire and candles ----------
  const embers = [];
  function n1(t, s) { return Math.sin(t * 7.1 + s) * 0.5 + Math.sin(t * 13.7 + s * 2.3) * 0.3 + Math.sin(t * 3.3 + s * 0.7) * 0.2; }

  function drawFire(c, t, dt) {
    const base = 54;
    rect(c, '#3a2414', 157, 52, 22, 3);
    rect(c, '#2a180c', 160, 50, 16, 2);
    rect(c, '#ff7a1a', 158, 54, 20, 1);
    for (let i = 0; i < 9; i++) {
      const x = 158 + i * 2.2;
      const center = 1 - Math.abs(i - 4) / 5;
      const h = Math.max(2, Math.round(6 + 12 * center + 4 * n1(t, i * 1.9)));
      rect(c, '#b8261a', Math.round(x), base - h, 3, h);
      rect(c, '#ff7a1a', Math.round(x), base - Math.round(h * 0.72), 2, Math.round(h * 0.72));
      rect(c, '#ffd65a', Math.round(x) + 1, base - Math.round(h * 0.4), 1, Math.round(h * 0.4));
    }
    if (Math.random() < dt * 6) embers.push({ x: 160 + Math.random() * 16, y: 46, life: 1 });
    for (let i = embers.length - 1; i >= 0; i--) {
      const e = embers[i];
      e.y -= dt * 14;
      e.x += Math.sin(t * 5 + i) * dt * 6;
      e.life -= dt * 0.9;
      if (e.life <= 0 || e.y < 32) { embers.splice(i, 1); continue; }
      rect(c, e.life > 0.5 ? '#ffd65a' : '#ff7a1a', Math.round(e.x), Math.round(e.y), 1, 1);
    }
  }

  const FLAMES = [
    [143, 121], [223, 121], [143, 185], [279, 194],
    [146, 22], [188, 22], [17, 165], [47, 50]
  ];
  function drawFlames(c, t) {
    FLAMES.forEach(function (p, i) {
      const tall = n1(t * 1.4, i * 3.1) > 0.25 ? 1 : 0;
      rect(c, '#ff9a2a', p[0], p[1] - 2 - tall, 2, 2 + tall);
      rect(c, '#fff0b0', p[0] + (i % 2), p[1] - 1 - tall, 1, 1);
    });
  }

  // ---------- Lighting ----------
  const LIGHTS = [
    { x: 168, y: 48, r: 124, a: 1, warm: 0.22 },
    { x: 48, y: 54, r: 66, a: 0.95, warm: 0.12 },
    { x: 144, y: 118, r: 46, a: 0.9, warm: 0.12 },
    { x: 224, y: 118, r: 46, a: 0.9, warm: 0.12 },
    { x: 144, y: 182, r: 46, a: 0.9, warm: 0.12 },
    { x: 280, y: 195, r: 24, a: 0.6, warm: 0.06 },
    { x: 18, y: 168, r: 56, a: 0.9, warm: 0.1 },
    { x: 147, y: 22, r: 22, a: 0.7, warm: 0.06 },
    { x: 189, y: 22, r: 22, a: 0.7, warm: 0.06 }
  ];
  let lightCanvas = null;

  function drawLighting(c, t) {
    if (!lightCanvas) {
      lightCanvas = document.createElement('canvas');
      lightCanvas.width = W;
      lightCanvas.height = H;
    }
    const l = lightCanvas.getContext('2d');
    l.globalCompositeOperation = 'source-over';
    l.clearRect(0, 0, W, H);
    l.fillStyle = 'rgba(8,8,30,0.66)';
    l.fillRect(0, 0, W, H);
    l.globalCompositeOperation = 'destination-out';
    LIGHTS.forEach(function (L, i) {
      const r = L.r * (1 + 0.04 * n1(t * 0.9, i * 2.7));
      const g = l.createRadialGradient(L.x, L.y, 0, L.x, L.y, r);
      g.addColorStop(0, 'rgba(0,0,0,' + L.a + ')');
      g.addColorStop(0.5, 'rgba(0,0,0,' + (L.a * 0.55) + ')');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      l.fillStyle = g;
      l.fillRect(L.x - r, L.y - r, r * 2, r * 2);
    });
    c.drawImage(lightCanvas, 0, 0);

    // Warm glow on top.
    c.save();
    c.globalCompositeOperation = 'lighter';
    LIGHTS.forEach(function (L, i) {
      const r = L.r * 0.8 * (1 + 0.06 * n1(t, i * 1.3));
      const g = c.createRadialGradient(L.x, L.y, 0, L.x, L.y, r);
      g.addColorStop(0, 'rgba(255,140,50,' + L.warm + ')');
      g.addColorStop(1, 'rgba(255,140,50,0)');
      c.fillStyle = g;
      c.fillRect(L.x - r, L.y - r, r * 2, r * 2);
    });
    // Cool spill from the windows, brighter in a lightning flash.
    const flash = reduceMotion ? 0 : lightning.level;
    WINDOWS.forEach(function (win) {
      const cx = win.x + win.w / 2, cy = win.y + win.h + 10;
      const r = win.w * 1.3 + flash * 30;
      const g = c.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, 'rgba(90,110,200,' + (0.1 + flash * 0.35) + ')');
      g.addColorStop(1, 'rgba(90,110,200,0)');
      c.fillStyle = g;
      c.fillRect(cx - r, cy - r, r * 2, r * 2);
    });
    if (flash) {
      c.fillStyle = 'rgba(120,140,255,0.08)';
      c.fillRect(0, 0, W, H);
    }
    c.restore();
  }

  window.World = {
    TILE: TILE, COLS: COLS, ROWS: ROWS, W: W, H: H,
    tile: tile,
    solid: solid,
    hotspotAt: hotspotAt,
    findPath: findPath,
    update: updateWeather,
    drawBackground: function (c) {
      if (!bg) buildStatic();
      c.drawImage(bg, 0, 0);
    },
    drawAnimated: function (c, t, dt) {
      WINDOWS.forEach(function (win) { drawWindow(c, win, t); });
      drawFire(c, t, dt);
      drawFlames(c, t);
    },
    drawLighting: drawLighting,
    reduceMotion: reduceMotion
  };
})();

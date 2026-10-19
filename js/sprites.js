/*
 * Character sprites, drawn from text templates and palette swaps.
 * Each template is 16x16. Side templates face right; left is a mirror.
 *
 * Palette keys:
 *   o outline   h hair   H hair shade   s skin   S skin shade   e eye
 *   c clothes   C clothes shade   b belt/boots   p pants   d beard   w apron
 */
(function () {
  'use strict';

  const HEAD = {
    down: [
      '......oooo......',
      '....oohhhhoo....',
      '...ohhhhhhhho...',
      '..ohhhhhhhhhho..',
      '..ohhsssssshho..',
      '..ohsessssesho..',
      '..ohssssssssho..',
      '...osssSSssso...',
      '....oossssoo....'
    ],
    up: [
      '......oooo......',
      '....oohhhhoo....',
      '...ohhhhhhhho...',
      '..ohhhhhhhhhho..',
      '..ohhhhhhhhhho..',
      '..ohhhhHHhhhho..',
      '..oHhhhhhhhhHo..',
      '...oHHhhhhHHo...',
      '....oossssoo....'
    ],
    side: [
      '......oooo......',
      '....oohhhhoo....',
      '...ohhhhhhhho...',
      '..ohhhhhhhhhho..',
      '..ohhhhhssssso..',
      '..ohhhhsssseso..',
      '..ohhhhssssssoo.',
      '...ohhhsssSSo...',
      '....oossssoo....'
    ]
  };

  const TORSO = {
    down: [
      '...occcccccco...',
      '..osccccccccso..',
      '..osCccbbccCso..',
      '...oCccccccCo...',
      '...oppppppppo...'
    ],
    up: [
      '...occcccccco...',
      '..osccccccccso..',
      '..osCccccccCso..',
      '...oCccccccCo...',
      '...oppppppppo...'
    ],
    side: [
      '....occcccco....',
      '....occccsco....',
      '....oCcbbbco....',
      '....oCcccCco....',
      '....oppppppo....'
    ]
  };

  // [stand, walk A, walk B]
  const LEGS = {
    down: [
      ['...opppoopppo...', '...obbboobbbo...'],
      ['...opppooppo....', '...obbbo.ooo....'],
      ['....oppoopppo...', '....ooo.obbbo...']
    ],
    side: [
      ['.....oppppo.....', '.....obbbbo.....'],
      ['....opp..ppo....', '...obbo..obbo...'],
      ['.....oppppo.....', '......obbo......']
    ]
  };
  LEGS.up = LEGS.down;

  const OVERLAYS = {
    apron: {
      down: {
        9: '...occwwwwcco...',
        10: '..oscwwwwwwcso..',
        11: '..osCwwwwwwCso..',
        12: '...oCwwwwwwCo...'
      },
      side: {
        10: '....ocwwwsco....',
        11: '....oCwwwwco....',
        12: '....oCwwwwco....'
      }
    },
    beard: {
      down: {
        6: '..ohdssssssdho..',
        7: '...oddsSSsddo...',
        8: '....oddddddo....',
        9: '...ocddddddco...',
        10: '..oscddddddcso..'
      },
      side: {
        6: '..ohhhhsdddddoo.',
        7: '...ohhhsddddo...',
        8: '....oodddddo....',
        9: '....occddddo....'
      }
    }
  };

  const BASE_PALETTE = {
    o: '#1a1010',
    e: '#1f1a2e',
    w: '#ece6d6',
    b: '#3c2414',
    p: '#3b2a1e'
  };

  const defs = {};
  const cache = {};

  function define(name, palette, features) {
    const pal = Object.assign({}, BASE_PALETTE, palette);
    if (!pal.H) pal.H = pal.h;
    if (!pal.S) pal.S = pal.s;
    if (!pal.C) pal.C = pal.c;
    if (!pal.d) pal.d = pal.h;
    defs[name] = { pal: pal, feat: features || {} };
  }

  function rowsFor(name, view, frame) {
    let rows = HEAD[view].concat(TORSO[view], LEGS[view][frame]);
    const feat = defs[name].feat;
    ['apron', 'beard'].forEach(function (key) {
      const over = feat[key] && OVERLAYS[key][view];
      if (!over) return;
      rows = rows.slice();
      Object.keys(over).forEach(function (i) { rows[+i] = over[i]; });
    });
    return rows;
  }

  function render(rows, pal, mirror) {
    const cv = document.createElement('canvas');
    cv.width = 16;
    cv.height = 16;
    const c = cv.getContext('2d');
    for (let y = 0; y < 16; y++) {
      const row = rows[y];
      for (let x = 0; x < 16; x++) {
        const color = pal[row[x]];
        if (!color) continue;
        c.fillStyle = color;
        c.fillRect(mirror ? 15 - x : x, y, 1, 1);
      }
    }
    return cv;
  }

  // dir: down | up | left | right. frame: 0 stand, 1 and 2 walking.
  function get(name, dir, frame, eyesClosed) {
    const key = name + '|' + dir + '|' + frame + '|' + (eyesClosed ? 1 : 0);
    if (cache[key]) return cache[key];
    const def = defs[name];
    const view = dir === 'left' || dir === 'right' ? 'side' : dir;
    let pal = def.pal;
    if (eyesClosed) pal = Object.assign({}, pal, { e: pal.S });
    cache[key] = render(rowsFor(name, view, frame || 0), pal, dir === 'left');
    return cache[key];
  }

  // ---- Cast ----
  define('player', { h: '#7a4521', H: '#53290f', s: '#f2c79a', S: '#d39b6b', c: '#2f5fb3', C: '#1f3f7a', p: '#40311f' });
  define('brom', { h: '#c4561c', H: '#8f3b10', d: '#d8692a', s: '#e8b48a', S: '#c48a5e', c: '#6b4426', C: '#4a2c17' }, { beard: true, apron: true });
  define('elsa', { h: '#ecc65a', H: '#b9902f', s: '#f5d0ae', S: '#dba67e', c: '#9c2b3e', C: '#6c1a2a', p: '#9c2b3e', b: '#4a1a22' }, { apron: true });
  define('durgin', { h: '#3b3230', H: '#221c1a', d: '#5a504c', s: '#e2a982', S: '#b97f58', c: '#5b6d2e', C: '#3c4a1c' }, { beard: true });
  define('hilda', { h: '#b9452a', H: '#82291a', s: '#f4c9a4', S: '#d49c74', c: '#6c4b8e', C: '#48305f' });
  define('tobias', { h: '#cfcfd4', H: '#9a9aa2', d: '#e2e2e6', s: '#e8bc98', S: '#c4906c', c: '#5c4a38', C: '#3e3124' }, { beard: true });
  define('pip', { h: '#d9a94f', H: '#a47828', s: '#f2c8a0', S: '#d19b72', c: '#2e8a5a', C: '#1c5e3c', p: '#5a3a64' });
  define('mara', { h: '#2b1a10', H: '#1a0f08', s: '#c99069', S: '#a06c48', c: '#8b94a2', C: '#5c6472', b: '#3a3f4a', p: '#4a505c' });
  define('fenwick', { h: '#584a78', H: '#3a2f54', s: '#efc39c', S: '#cd9570', c: '#2c3b6e', C: '#1b2549', p: '#2c3b6e' });
  define('stranger', { o: '#08070c', h: '#2c2939', H: '#1a1824', s: '#09080d', S: '#09080d', e: '#ffd84a', c: '#2c2939', C: '#1a1824', p: '#2c2939', b: '#121018' });

  // Curled-up cat, drawn by hand. frame 0 or 1 moves the tail tip.
  function cat(frame) {
    const key = 'cat|' + frame;
    if (cache[key]) return cache[key];
    const rows = [
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '....o.o.........',
      '...oggogoooo....',
      '...ogggggGGGo...',
      '...oggggGGGGGo..',
      '....ooGGGGGGGo..',
      '......oGGGGGo' + (frame ? 'oo.' : '...'),
      '.......ooooo' + (frame ? 'GGo.' : 'oGGo'),
      '............' + (frame ? 'oo..' : '.oo.'),
      '................',
      '................'
    ];
    cache[key] = render(rows, { o: '#151012', g: '#7c6f68', G: '#5a4e48' }, false);
    return cache[key];
  }

  window.Sprites = { get: get, cat: cat };
})();

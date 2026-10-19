/*
 * The art manifest. Every model the tavern uses is named here by the role it
 * plays, so swapping in a different art pack means editing this file, not the
 * scene code. See assets/CREDITS.md for where each model came from.
 */

const PROP_DIR = 'assets/props/';
const FURN_DIR = 'assets/furniture/';

// Role -> model file. Scale and yOffset correct for packs built at a
// different size or with a different floor height.
export const PROPS = {
  floor: { file: PROP_DIR + 'floor_wood_large.glb' },
  floorDark: { file: PROP_DIR + 'floor_wood_large_dark.glb' },
  wall: { file: PROP_DIR + 'wall.glb' },
  wallWindow: { file: PROP_DIR + 'wall_window_open.glb' },
  wallDoor: { file: PROP_DIR + 'wall_doorway.glb' },
  wallCorner: { file: PROP_DIR + 'wall_corner.glb' },
  pillar: { file: PROP_DIR + 'pillar.glb' },
  tableLong: { file: PROP_DIR + 'table_long.glb' },
  table: { file: PROP_DIR + 'table_medium.glb' },
  tableSmall: { file: PROP_DIR + 'table_small.glb' },
  stool: { file: PROP_DIR + 'stool.glb' },
  chair: { file: PROP_DIR + 'chair.glb' },
  keg: { file: PROP_DIR + 'keg.glb' },
  kegFancy: { file: PROP_DIR + 'keg_decorated.glb' },
  barrel: { file: PROP_DIR + 'barrel_large.glb' },
  barrelSmall: { file: PROP_DIR + 'barrel_small.glb' },
  barrelStack: { file: PROP_DIR + 'barrel_small_stack.glb' },
  crates: { file: PROP_DIR + 'crates_stacked.glb' },
  boxes: { file: PROP_DIR + 'box_stacked.glb' },
  wallShelves: { file: PROP_DIR + 'shelves.glb' },
  shelfCandles: { file: PROP_DIR + 'shelf_small_candles.glb' },
  bottleBrown: { file: PROP_DIR + 'bottle_A_brown.glb' },
  bottleGreen: { file: PROP_DIR + 'bottle_A_green.glb' },
  bottleTall: { file: PROP_DIR + 'bottle_B_green.glb' },
  bottleRound: { file: PROP_DIR + 'bottle_C_brown.glb' },
  candle: { file: PROP_DIR + 'candle_lit.glb' },
  candles: { file: PROP_DIR + 'candle_triple.glb' },
  torch: { file: PROP_DIR + 'torch_mounted.glb' },
  plateA: { file: PROP_DIR + 'plate_food_A.glb' },
  plateB: { file: PROP_DIR + 'plate_food_B.glb' },
  banner: { file: PROP_DIR + 'banner_patternA_red.glb' },
  bannerShield: { file: PROP_DIR + 'banner_shield_brown.glb' },
  trophy: { file: PROP_DIR + 'sword_shield.glb' },
  mug: { file: PROP_DIR + 'mug.glb' },
  books: { file: FURN_DIR + 'book_set.gltf' },
  armchair: { file: FURN_DIR + 'armchair.gltf' },
  rug: { file: FURN_DIR + 'rug_rectangle_stripes_A.gltf' },
  painting: { file: FURN_DIR + 'pictureframe_large_A.gltf' }
};

// Rigged characters. `clips` maps what the scene asks for (idle, walk, sit)
// to each pack's own animation names, and `hide` lists the weapons and extras
// the pack ships attached to the rig that a tavern regular wouldn't carry.
const KAYKIT_CLIPS = {
  idle: 'Unarmed_Idle',
  walk: 'Walking_A',
  run: 'Running_A',
  sit: 'Sit_Chair_Idle',
  cheer: 'Cheer',
  talk: 'Interact',
  use: 'Use_Item'
};

export const CHARACTERS = {
  knight: {
    file: 'assets/chars/knight.glb',
    clips: KAYKIT_CLIPS,
    hide: ['1H_Sword_Offhand', 'Badge_Shield', 'Rectangle_Shield', 'Round_Shield', 'Spike_Shield', '1H_Sword', '2H_Sword']
  },
  barbarian: {
    file: 'assets/chars/barbarian.glb',
    clips: KAYKIT_CLIPS,
    hide: ['1H_Axe_Offhand', 'Barbarian_Round_Shield', '1H_Axe', '2H_Axe', 'Mug']
  },
  mage: {
    file: 'assets/chars/mage.glb',
    clips: KAYKIT_CLIPS,
    hide: ['Spellbook', 'Spellbook_open', '1H_Wand', '2H_Staff']
  },
  rogue: {
    file: 'assets/chars/rogue.glb',
    clips: KAYKIT_CLIPS,
    hide: ['Knife_Offhand', '1H_Crossbow', '2H_Crossbow', 'Knife', 'Throwable']
  },
  hooded: {
    file: 'assets/chars/rogue_hooded.glb',
    clips: KAYKIT_CLIPS,
    hide: ['Knife_Offhand', '1H_Crossbow', '2H_Crossbow', 'Knife', 'Throwable']
  }
};

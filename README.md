# The Wayward Lantern

Kyle's personal site: a pixel-art fantasy tavern you walk around to read about Kyle.

| Spot in the inn | Section |
|---|---|
| Brom, the dwarf barkeep | About me |
| Quest board by the door | Work experience |
| Fireplace and bookshelf | Interests |
| Hooded stranger in the corner | Other |

There is no build step. Everything is plain HTML, CSS, and JavaScript, and all art and sound are generated in code.

## Editing content

All text lives in the `<main id="content">` block of `index.html`. Each `<section data-section="...">` is one section. The game windows, the Menu, and the plain-page version (`?view=page`) all read from that block, so edit it once and every view updates.

NPC chatter and the lines they say to visitors are in `js/npcs.js` (`DEFS` and `SCENES`).

## Running locally

Open `index.html` in a browser, or serve the folder:

```
python3 -m http.server 8000
```

## Files

- `js/world.js`: tavern map, static art, rain, fire, and lighting
- `js/npcs.js`: characters, idle animations, walking, and banter
- `js/sprites.js`: character sprite templates and palettes
- `js/audio.js`: synthesized ambience (rain, fire, crowd, laughter, clinks, thunder, lute)
- `js/main.js`: game loop, player movement, input, dialog, and menus

## 3D prototype

`3d/` holds a separate 3D version of the tavern in a classic MMO style, built
with [three.js](https://threejs.org) (vendored in `3d/vendor/`, no build step).
It lives at `/3d/` and leaves the pixel-art version untouched.

- Walk with WASD or the arrow keys, drag to look around, scroll or pinch to zoom, and press E or Space to talk. On phones, tap to walk or talk.
- Section text is read from this repo's `index.html`, so both versions stay in sync. Sound reuses `js/audio.js`.
- Models are free CC0 KayKit packs. See `3d/assets/CREDITS.md`, and `3d/js/manifest.js` for swapping in other art.
- Stairs along the north wall lead to a second floor with a hallway, two small bedrooms, and a large bedroom with a canopy bed. The upstairs only shows while you're on it.
- `3d/js/world.js`: taproom, fireplace, quest board, lighting, rain. `3d/js/upstairs.js`: stairs and bedrooms. `3d/js/cast.js`: characters and banter. `3d/js/main.js`: camera, controls, dialog, menus.
- Performance: `3d/js/quality.js` renders at 1x with an FXAA pass and steps the resolution down on slow devices. Add `?pr=1.5` (or any ratio) to the URL to pin a pixel ratio for testing. The scene uses only three point lights, which move upstairs with the player, and identical textures are shared after loading.

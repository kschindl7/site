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

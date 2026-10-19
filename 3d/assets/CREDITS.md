# Art credits

All 3D models in this folder are from Kay Lousberg's KayKit packs, released under
[CC0](http://creativecommons.org/publicdomain/zero/1.0/) (free for any use, no
attribution required). Thanks, Kay: [kaylousberg.com](https://www.kaylousberg.com).

| Folder | Pack | Source |
|---|---|---|
| `chars/` | KayKit: Adventurers Character Pack 1.0 | [GitHub](https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0) |
| `props/` | KayKit: Dungeon Remastered 1.0 (plus the mug from the Adventurers pack) | [GitHub](https://github.com/KayKit-Game-Assets/KayKit-Dungeon-Remastered-1.0), [itch.io](https://kaylousberg.itch.io/kaykit-dungeon-remastered) |
| `furniture/` | KayKit: Furniture Bits 1.0 | [GitHub](https://github.com/KayKit-Game-Assets/KayKit-Furniture-Bits-1.0) |

The character files were trimmed to the animations the tavern uses (idle, walk,
run, sit, cheer, interact, use item) to cut each file from about 3.6 MB to 0.6 MB.

The fireplace, bar counter, quest board, lanterns, lute, cat, rain, and all
sound are made in code.

## Swapping in different art

Every model is listed by role in `../js/manifest.js`. To use another pack, drop
its glTF/GLB files here, point the roles at them, and adjust `scale`,
`yOffset`, or a character's `clips` (its animation names) and `hide` list.

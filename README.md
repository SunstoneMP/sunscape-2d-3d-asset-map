# sunscape-2d-3d-asset-map

2D layout image filenames paired with 3D .glb model filenames by category — working sheet for Sunscape 2D↔3D sync.

## Files

- **`Sunscape_Asset_Library.csv`**: the current map. One row per product, grouped by **base cabinet item number**, with the organized path of its 2D elevation, 3D model and photo in the `sunscape-ai` repo (`public/assets/<group>/<category>/<BASE>/{2d,3d,photo}/`). Regenerate it from `public/assets/manifest.json` after adding files.
- `Sunscape_2D_3D_Two_Columns.csv`: the original flat matching sheet, kept for reference.

## Status values

| Status | Meaning |
|---|---|
| COMPLETE | Has both a 2D elevation and a 3D model |
| MISSING 2D IMAGE | Model exists; needs a front-elevation `.webp` |
| MISSING 3D MODEL | Elevation exists; needs a `.glb` |

The `.glb` files currently in `sunscape-ai` are placeholders. The 3D configurator renders those products procedurally until real models are dropped into the same paths.

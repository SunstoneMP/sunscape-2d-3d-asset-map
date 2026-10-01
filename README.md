# sunscape-2d-3d-asset-map

2D layout image filenames paired with 3D .glb model filenames by category — working sheet for Sunscape 2D↔3D sync.

## Files

- **`Sunscape_Asset_Library.csv`**: the current map. One row per product, grouped by **base cabinet item number**, with the organized path of its 2D elevation, 3D model and photo in the `sunscape-ai` repo (`public/assets/<group>/<category>/<BASE>/{2d,3d,photo}/`). Regenerate it from `public/assets/manifest.json` after adding files.
- `Sunscape_2D_3D_Two_Columns.csv`: the original flat matching sheet, kept for reference.

## Status values

`3D_Model` is `real` for Sunstone's delivered models and `placeholder` for the stand-in boxes, which the 3D configurator replaces with procedural cabinets.

| Status | Meaning |
|---|---|
| COMPLETE | Real 3D model and a 2D elevation |
| NEEDS 2D IMAGE | Real model; needs a front-elevation `.webp` |
| NEEDS 3D MODEL | Elevation exists; model is still a placeholder |
| NEEDS 2D + 3D | Neither yet |

To add models, run `node scripts/assets/import-models.mjs <zip-or-folder> [category|auto] --optimize` in `sunscape-ai`, then `node scripts/assets/build-manifest.mjs`.

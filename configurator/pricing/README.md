# 2D configurator pricing audit — 2026 MAP (9 Oct 2026)

Source sheets: `2026Base_Wall_Cabinets_Contractor.xls` (MAP PRICE column) and
`2026_ContractorPrice_Grills_components.xls` (MAP column). Only item numbers, descriptions and
MAP are kept in this repo (`data/map-2026.json`); contractor cost is not.

**Rule:** a module's image name is its parts — the cabinet item number, then any insert (grill,
sink, burner, fridge …). Its price = the sum of the parts' MAP. `tools/map_audit.py` does this
and writes `map-audit.csv`.

Insert codes in image names map to sheet item numbers: BRBC14 → B-RBC14, BIC14 → B-IC14,
BPS21 → B-PS21, BSK34 → B-SK34, AIC → A-IC, ASS17 → A-SS17 (17" sink), SAPWD30PRO → SAP30WDPRO
(x2 = two drawers), KAMADO_RAIL → SCC30KB-SPRAIL speed rail. The kamado grill itself is not a
Sunstone item, so KAMADO_SHELF / KAMADO_OPEN are priced as the SAC30KBDC cabinet alone.

## Result

- **Before:** 8 of 85 modules matched MAP (`map-audit.before-fix.csv`). Combos were priced far
  below their parts (SAC33PBDC_SUN24PCB $1,380 vs $7,521.25; SBC18FSDL_ASS17 $550 vs $1,686.75),
  single cabinets were rounded to whole dollars, and the SCC3SP90 corner pieces were above MAP.
- **Changed in the store:** 71 prices (`map-price-changes.csv`, with old and new prices for
  rollback): 49 configurator combos in "2D Layout Configurator" and the single cabinets.
- **After:** 79 of 85 match MAP exactly. The configurator shows cents and its built-in
  fallback prices were refreshed.

## Needs a decision (not changed)

| Module | Store price | Why |
| --- | --- | --- |
| SAC34CGDC_SUNCHSZ30 | $5,313.00 | SUNCHSZ30 isn't on the 2026 sheet (closest: SUNCHSZ30IR $3,872.50, SUNCHSZ28 $2,735.00). SAC34CGDC is $2,189.00. |
| SAC46CGDC_SUNCHDZ42 | $8,085.00 | SUNCHDZ42 isn't on the sheet (closest: EMCHDZ42 Emerald 42" $6,185.00). SAC46CGDC is $3,536.25. |
| SBC34FDD_BSK34 | $1,360.00 | No SBC34FDD on the sheet (only 24/30/36"). B-SK34 is $747.50. |
| SCC21SPE | $613.00 | Not on the sheet (SCC15SPE $350.00 and SCC25SPE $687.50 are). |
| SCC4SPEL_LEFT | $150.00 | The sheet sells SCC4SPEL/SCC4SPER as a left + right pair for $1,497.50; this module is the left panel only. |
| SCCSPER_RIGHT | $150.00 | No SCCSPER on the sheet; probably the right half of the SCC4SPER pair above. |

Also check: SAC46GLPCD_RUBY5BIR is now $7,495.00 but still **inactive** in the store, so it
shows "Call to order" and can't be added to the cart. The SCC3SP90 modules are drawn as 11.5"
corner return panels, but the sheet lists SCC3SP90 as a 3" x 3" spacer ($186.25), the price now used.

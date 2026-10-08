# 2D Island Configurator (Hubbase)

The drag-and-drop cabinet configurator on
[hubbase.app/s/austin/configurator](https://hubbase.app/s/austin/configurator?draft=1).
The page iframes `/s/austin/apps/island-configurator`, and **Add to Cart** sends the
layout to the Hubbase cart.

**Upload this file to Hubbase:** [`dist/island-configurator.html`](dist/island-configurator.html)
(one self-contained file with all 85 cabinet renders inlined). Replace the
`island-configurator` app's HTML with it.

## Layout

| Path | What it is |
| --- | --- |
| `src/island-configurator.html` | The app code (HTML/CSS/JS), with placeholders for the data below |
| `data/catalog.json` | The 85 modules: SKU, name, width, category, default price, store slug |
| `data/cart-id-map.json` | Module SKU → store product `ref` used by Add to Cart |
| `data/images.json` | The 2D renders as base64 WebP data URLs (400px tall) |
| `data/store-products.snapshot.json` | Hubbase store records the catalog was rebuilt from |
| `data/catalog.original.json` | The catalog as it was before this fix, for reference |
| `tools/fix_catalog.py` | Rebuilds `catalog.json` from the original catalog + store snapshot |
| `tools/import_images.py` | Converts the release PNGs into `data/images.json` |
| `tools/build.py` | Inlines the data and writes `dist/island-configurator.html` |

Module images come from the `2dconfigurator-assets` release of SunstoneMP/shared-files
(`2D.Configurator.Image.Files.zip`, 950px PNGs). To refresh them, unzip that file and run
`python3 -I configurator/tools/import_images.py "<unzipped folder>"`. In the October 2026
release, `SAC34DWC.png` is an empty file, and SCC15SPE, SCC21SPE and SCC25SPE have no render,
so those four modules still use the old low-res images.

After you edit anything, rebuild:

```sh
python3 -I configurator/tools/fix_catalog.py   # only if the store snapshot changed
python3 -I configurator/tools/build.py
```

Test before uploading (41 checks: rendering with the Hubbase price injection, prices,
widths, click/drag, undo, cart hand-off, links, all five shapes, CSV, share links,
autosave, bad files and phone layout):

```sh
npm i --no-save playwright && node configurator/test/mock-hubbase.mjs &   # SANDBOX=1 for hubbase.app mode
node configurator/test/e2e.mjs
```

## Where Hubbase keeps it

The app is the site doc `app_island-configurator` on Austin (`site_affv5holph`), shaped
`{ html, priceRefs }`. `priceRefs` maps each module to its store product ref, and the `/apps/`
route uses it to inject `SUNSTONE_PRICE_MAP`. Hubbase's "Island Configurator (classic)" option
(Admin → Configurators, `island-classic`) copies this doc to any site that adds it, so updating
Austin's doc updates that option everywhere it is added afterwards. A doc update is live
immediately (`PUT /api/sites/site_affv5holph/docs/app_island-configurator`, owner/admin);
keep `priceRefs` and replace only `html`. The doc as it was before this fix is saved in
`data/austin-app-doc.before-fix.json` for rollback.

On hubbase.app the app is served sandboxed (origin `"null"`). It can't read the parent page
or use storage there, so autosave is off and Share shows the link to copy (pointing at the
app itself). Prices, store links and Add to Cart work. `SANDBOX=1` runs the mock and the test
that way.

## How it ties into the store

- **Prices**: when the app loads it asks `/api/public/products` for every module, so
  the quote shows what the cart will charge. Hubbase's injected `SUNSTONE_PRICE_MAP`
  is also applied. If both fail (for example, the file is opened from disk), it uses
  the prices in `catalog.json`, which come from the store snapshot.
- **Add to Cart** posts `SUNSTONE_ADD_TO_CART` with `{productId, sku, quantity}` to
  the parent page. Hubbase's runtime looks each item up by `ref`, then by `sku`.
  Modules the store doesn't sell are flagged **CALL** and are left out of the cart
  with a clear message, instead of failing silently.
- **Quote lines** link to the store product page (`/s/austin/products/<slug>`).

> **Never put a literal closing `body`, `html` or `script` tag inside the JS**
> (write `<\/body>`). Hubbase injects its price script before the first closing
> `body` tag it finds. One inside a JS string is what blanked the live
> configurator. `build.py` refuses to build if there is more than one.

## Version 2 interface (October 2026)

A rebuilt interface that matches the Austin site (Montserrat, blue accent, white panels):

- **Starter layouts**: six one-click designs (grill run, compact station, kamado & pizza
  corner, entertainer's L, two-sided island, chef's U), all real modules at store prices.
- **Space per run**: enter the space you have; a meter shows what's left or how far over you are,
  and "Only modules that fit" filters the catalog.
- **Swap**: replace a placed cabinet with its other versions (insert, handing, style) and see
  the price difference.
- **Module details**: large image, SKU, width, includes, buy-online status, store link.
- **Selection and keyboard**: click a cabinet, then ←/→ move, D duplicates, Delete removes,
  Esc deselects; Ctrl+Z / Ctrl+Y undo and redo.
- **File menu**: save/open a design file, share link, print, parts list as CSV or a printable
  PDF with the layout picture, photo-real render request, clear.
- **Phones**: bottom tabs for Catalog, Layout (with module count) and Quote (with total).
- The unused "direct" cart mode, which called the old sunscape.ai cart, was removed.

## Store hand-off contract (island app side)

`2D-CONFIGURATOR-HANDOFF.md` (from the Hubbase cart chat) defines what the store accepts. The island
app now follows it:

| Hand-off item | Island app |
| --- | --- |
| A3 saved files can't change prices | done (prices in files are ignored) |
| A5 gas type | asks Natural gas / Propane once per design before Add to Cart; sent as `options.gasType` on gas lines; shown in the quote |
| A6 dead direct cart mode | removed |
| A7 skipped modules | named, with "Request a quote for these" (pre-fills the quote form) |
| B1 / C1 one cart message | sends `HB_ADD_TO_CART` v2, `tool: "island-classic"`, no prices |
| B2 design with the order | sends `design` (layout, name, picture under 600 KB) |
| B4 open a saved design | handles `SUNSCAPE_LOAD_2D_DESIGN` and `SUNSTONE_LOAD_DESIGN` |
| B6 analytics | posts `HB_CONFIGURATOR_EVENT`: design_started, design_saved, design_shared, design_printed, quote_sent |
| B7 / C3 map, live and dealer prices | reads `/api/public/configurator/map` first, falls back to the products API; dealer prices win |
| C1 reply | reads `HB_CART_RESULT` and reports what was added and what was missing |

The store side of C1–C4 isn't deployed on hubbase.app yet (the map endpoint answers 401), so for now
the app falls back and the cart ignores `gasType` and `design`. Nothing breaks either way.

## What was fixed (October 2026)

- **Blank configurator.** No cabinets, runs or quote were rendering. The PDF-export
  template contained a closing `body` tag, so Hubbase's price script was injected
  inside it and cut the main script in half (`Unexpected end of input`).
- **Prices didn't match the cart.** About 35 base cabinets showed roughly half
  their store price (for example, SAC20CSDL showed $630; the cart charges $1,574).
  Prices now come from the store.
- **Wrong widths.** SAC30KBDC Kamado bases showed as 11" instead of 30", SAC33PBDC
  as 12" instead of 33", SBC34FDD_BSK34 as 13" instead of 34", SBC12SLS as 14"
  instead of 12", and SCC4SPEL as 1.5" instead of 4". These threw off run lengths.
- **Wrong names.** Base cabinets now use the store's product description (for
  example, SAC34DWC is a *Double Warming Drawer Cabinet*, not a "Double Door
  Cabinet"). Each card also shows the SKU.
- `updateQuote is not defined` error when prices arrived from the host page.
- The install checkbox unticked itself, and the tax field lost focus after every
  keystroke.
- The CSV export broke columns on `$1,574` and on the inch marks in names.
- The plan-view schematic drew "Double" as one straight line and drew the L-shape's
  second leg off-screen. It also used undefined colors.
- Loading a saved file or a shared link with an unknown module crashed the page.
  Old saved files could also override the real prices. Both are fixed.
- On phones the panels overlapped and the page couldn't scroll.
- The run "Preview" button covered the run totals, and the ruler's total covered
  the module widths.

## What was added

- **Undo / Redo** (toolbar buttons, plus Ctrl+Z and Ctrl+Y). **Clear** can now be
  undone.
- **Autosave.** A visitor's design survives a page reload.
- **Share links open the store page itself** (`/s/austin/configurator#design=…`),
  not the bare iframe URL.
- A **Duplicate** button on each placed cabinet.
- Clicking a run badge on the schematic makes that run active. Schematic lengths
  follow the real run widths.
- The cart button shows how many modules it will add.
- Catalog cards can be added from the keyboard (Tab, then Enter).
- The empty "Wall Cabinets" tab is hidden.

## Store data to check (can't be fixed from this repo)

1. **SAC46GLPCD_RUBY5BIR** (46" Gas Grill Base + RUBY5BIR) isn't in the store.
   Cart ref `30153` doesn't resolve. It shows **CALL** until it's added.
2. **Package product names in the store have the wrong widths.** For example,
   SAC20CSDL_BRBC14 is listed as *7" Corner Sink & Drawer Cabinet*, and
   SAC34GLPCD_RUBY3B as *12.5" Grill Locker Pull-Out Cabinet*. The configurator
   uses corrected names, but the cart and product pages show the store's names.
3. **SBC18CSDR** (right-hand) is titled "Left Swing Door Cabinet" in the store.
4. **These cabinet + insert packages cost less than the bare cabinet.** Please
   confirm their prices:

   | Package | Price | Bare cabinet | Price |
   | --- | --- | --- | --- |
   | SAC20CSDL_SUN13VDB | $1,490 | SAC20CSDL | $1,574 |
   | SAC20CSDR_SUN13VDB | $1,490 | SAC20CSDR | $1,574 |
   | SAC34SWC_SAPWD30PRO | $2,308 | SAC34SWC | $2,369 |
   | SBC18FSDL_ASS17 | $550 | SBC18FSDL | $1,399 |
   | SBC18FSDL_BIC14 | $998 | SBC18FSDL | $1,399 |
   | SBC18FSDL_SUN13VSB | $1,049 | SBC18FSDL | $1,399 |
   | SBC18FSDR_ASS17 | $550 | SBC18FSDR | $1,399 |
   | SBC18FSDR_BIC14 | $998 | SBC18FSDR | $1,399 |
   | SBC18FSDR_SUN13VSB | $1,049 | SBC18FSDR | $1,399 |
   | SBC24CDD_BPS21 | $1,543 | SBC24CDD | $1,774 |
   | SBC24FDD_BPS21 | $1,543 | SBC24FDD | $1,711 |
   | SBC30CDD_BPS21 | $1,713 | SBC30CDD | $2,061 |
   | SBC30CDD_BSK34 | $1,638 | SBC30CDD | $2,061 |
   | SBC30FDD_BPS21 | $1,713 | SBC30FDD | $1,911 |
   | SBC36CDD_AIC | $2,060 | SBC36CDD | $2,449 |
   | SBC36CDD_BPS21 | $1,923 | SBC36CDD | $2,449 |

5. **Widths I couldn't confirm from the SKU.** Please check SBC3C45 (8.5"),
   SCC31BP90 and SCC3SP90 (11.5"), and SCCSPER_RIGHT (1.5"). Change them in
   `tools/fix_catalog.py` (`WIDTH_FIX`) and rebuild.
6. Only 85 of the 2D renders exist. The asset map
   (`../Sunscape_2D_3D_Two_Columns.csv`) lists 165 products marked
   `MISSING 2D IMAGE`, including all wall cabinets and island modules. To add one,
   put its webp in `data/images.json`, add a catalog entry, and rebuild.

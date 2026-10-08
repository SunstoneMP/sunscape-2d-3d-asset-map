# 2D Configurator — hand-off to the chat that owns the planner

From: the Hubbase cart / Austin Outdoor Kitchens chat · 8 Oct 2026 · repo `SunstoneMP/hubbase` main.

**Who owns what.** You own the 2D planner and its files: `public/sunscape/legacy-2d/**`, `src/sunscape-legacy.js`,
the `sunscape_planner_2d` block in `public/shared/sunscape-site-blocks.js`, and the planner/island entries in
`public/shared/configurators-core.js`. This chat owns the store side: the cart bridge in `public/shared/runtime.js`
(`[data-hbk-cfg]`), the cart drawer and checkout, `src/public-api.js`, orders, and the admin Configurators screen.
This chat will not edit your files. Section C is the contract between the two sides.

The combo products (store refs 180001+, flagged `configuratorOnly`) belong to the planner only. They are not
regular store items and are not part of this hand-off's naming fixes.

---

## A. Errors in the planner (yours to fix)

Found by reading main @ `00cfb62` and comparing against the Austin catalog. Not tested live.

1. **Add to Cart does nothing on Hubbase sites.** `addDesignToCart()` posts `SUNSTONE_ADD_TO_CART` to the parent
   and shows "Sent N items to your cart". The `sunscape_planner_2d` block renders a bare `<iframe>`, and the site
   only listens for that message inside a `[data-hbk-cfg]` box (runtime.js), so nothing is added.
   **Fix:** render the planner inside the same wrapper the `configurator` block uses (`render-store.js` ~line 1744):
   a `div[data-hbk-cfg]` with a `[data-cfg-fs]` full-screen button and the iframe inside. The listener checks
   `e.source === iframe.contentWindow` and same origin, which the `/_hb/sunscape/legacy-2d/` iframe satisfies.

2. **Prices are stale.** Prices are hard-coded in `CATALOG` inside `two-d-configurator/index.html`. 37 of the 85
   modules differ from the store's web price. Examples: SAC20CSDL shows $630 against a web price of $1,574,
   SAC34GLPCD $1,440 against $2,774, SAC46CGDC $1,900 against $3,536. The planner has no `SUNSTONE_PRICE_MAP`
   listener, and `sunscape-legacy.js` injects none.
   **Fix:** listen for `SUNSTONE_PRICE_MAP` and set `state.prices[module] = price`, as the island app does.
   Get the prices from `GET /api/public/configurator/map` (section C3) on load, or inject them the way the
   `/apps/<name>` route in `src/sites.js` does. Show nothing (or "Call for price") for modules with no live price,
   rather than the built-in number.

3. **Loaded design files can change prices.** `loadDesign` merges `data.prices` from a saved JSON file into
   `state.prices`, so an edited file changes the prices shown and the quote total.
   **Fix:** ignore `prices` in loaded files and always use live prices.

4. **Quote totals are trusted from the browser.** `send-quote` in `src/sunscape-api.js` stores `b.total` as sent,
   and it goes to the inbox and to dealers.
   **Fix:** send the layout (`b.layout`), recompute the total on the server from the layout and the price map,
   and store the server total. Keep the client total only as `clientTotal` for comparison.

5. **Gas type is never asked for.** Combos holding a gas appliance (`*_RUBY3B`, `*_RUBY4B`, `*_RUBY5BIR`,
   `*_SUNCHSZ30`, `*_SUNCHDZ42`, `*_SUN13VDB`, `*_SUN13CPRO`, `*_SUN24PCB*`) go to the cart without NG/LP.
   **Fix:** ask for the gas type (Natural Gas / Propane) once per design in the planner, before Add to Cart,
   and send it on each line (section C1). The store side will also prompt in the cart for any line that is still
   missing it (C1), so nothing breaks if a line arrives without it.

6. **Dead "direct" cart mode.** `CONFIG.cartIntegrationMode = "directApi"` calls the old sunscape.ai
   `/api/trpc/cart.get` / `cart.update`, which do not exist on Hubbase. Remove `addToCartDirectApi()` and the
   option, and keep `postMessage` only.

7. **Skipped modules leave the shopper stuck.** Modules with no `CART_ID_MAP` entry show "N module(s) skipped".
   **Fix:** name the skipped modules and offer "Request a quote for these", which opens the quote form pre-filled
   with them. Today all 85 modules are mapped, so this is a guard for new modules.

## B. 2D-configurator features (yours, with the store side noted)

1. **One cart message for every configurator.** Send the v2 message in C1 from the planner and the island app.
   The store side already accepts it.
2. **Save the design with the order.** Send `design` in the add-to-cart message (C1). The store saves it, links
   it to every cart line from that design, and shows it on the order (admin order view) and in abandoned-cart
   follow-ups.
3. **Linked-products map in the admin.** Stop hard-coding `CART_ID_MAP`: read the map from
   `GET /api/public/configurator/map` (C3). The owner edits it in Admin → Configurators → Linked products, with
   unlinked modules listed and bulk fix. It is seeded from today's `CART_ID_MAP` / island `priceRefs`, which are
   identical (85 modules).
4. **Quote → cart.** The store side adds an "Open design" link to quote inbox items and abandoned-cart drafts:
   `<configurator page>?design=<ref>&t=<token>`. The store page fetches the design (C4) and posts
   `SUNSCAPE_LOAD_2D_DESIGN` to the configurator iframe. The planner already handles that message
   (`host-bridge.js` → `SUNSTONE_LOAD_DESIGN`); make sure the island app handles `SUNSTONE_LOAD_DESIGN` too.
5. **Dealer drop-in.** If the configurator page URL has `?dealer=<code>`, the store side tags the cart and order
   with that dealer. Also send `dealer` in quote requests (send-quote already routes by `b.dealer`).
6. **Analytics events.** Post `HB_CONFIGURATOR_EVENT` (C2) when a design is started (first module placed), a
   quote is sent, a design is saved or printed. The store side records add-to-cart and orders itself.
   Admin → Configurators shows the funnel and the most-used modules.
7. **Live price display.** Covered by A2. When a signed-in dealer views the planner, C3 returns that dealer's
   prices, so show them with a "Your dealer price" label.

## C. Contract (built by the store side)

### C1. Add to cart: configurator → page (`postMessage`, same origin)

```js
parent.postMessage({
  type: "HB_ADD_TO_CART",            // "SUNSTONE_ADD_TO_CART" still accepted
  v: 2,
  tool: "planner-2d",                // or "island-classic"
  items: [{ productId: 30127, sku: "SAC34CGDC", quantity: 1, options: { gasType: "NG" } }],  // gasType: "NG" | "LP", only for gas items
  design: {                          // optional; saved with the cart and the order
    name: "Smith backyard",
    layout: { shape: "l", runs: [{ id: "r1", items: [{ id: "x1", catId: "SAC34CGDC" }] }] },
    image: "data:image/jpeg;base64,…"   // optional, ≤ 600 KB
  },
  dealer: "abc-patio"                // optional
}, location.origin);
```

- The store looks up each line by `productId` (store ref), then by `sku`. **Prices always come from the store.**
  Any `price` sent is ignored.
- Lines whose product needs a gas type and arrive without `options.gasType` get a "Choose gas type" picker in the
  cart. Checkout stays blocked until every line has one.
- `configuratorOnly` combo products are accepted here; they stay hidden everywhere else in the store.
- Reply to the configurator: `{ type: "HB_CART_RESULT", added: n, missing: [productId|sku …], designRef }`.

### C2. Events: configurator → page

```js
parent.postMessage({ type: "HB_CONFIGURATOR_EVENT", tool: "planner-2d", event: "design_started", data: { modules: 3 } }, location.origin);
// events: design_started | quote_sent | design_saved | design_printed | design_shared
```

### C3. Map and live prices

`GET /api/public/configurator/map?siteId=<id>&tool=planner-2d`
→ `{ map: { SAC34CGDC: 30127, … }, prices: { SAC34CGDC: 2189, … }, gas: ["SAC34GLPCD_RUBY3B", …], dealer: false }`

- `prices` are web prices in dollars. A signed-in approved dealer gets their level's prices, with `dealer: true`.
- `gas` lists the modules whose product needs a gas type.
- The site URL is the page's own origin, so the call carries the visitor's session (same origin).

### C4. Load a saved design

`GET /api/public/configurator/design/<ref>?siteId=<id>&t=<token>` → `{ name, tool, layout, image }`

The store page does this itself when it sees `?design=…&t=…` and posts `SUNSCAPE_LOAD_2D_DESIGN` with
`config: layout` to the iframe.

---

## D. Already fine (no action)

- The island app on Austin (`/apps/island-configurator`) gets live prices (`SUNSTONE_PRICE_MAP`) and its
  add-to-cart works through `[data-hbk-cfg]`.
- All 85 planner modules map to an existing store product.
- Quote requests land in the site inbox and route to dealers by `dealer` code.

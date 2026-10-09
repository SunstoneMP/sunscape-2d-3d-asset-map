// End-to-end check of the built configurator inside a mock Hubbase page.
//   node configurator/test/mock-hubbase.mjs &   then   node configurator/test/e2e.mjs
// Needs the playwright package; set CHROMIUM_PATH to use an existing Chromium.
import { chromium } from 'playwright';
const base = 'http://127.0.0.1:8765';
const sandbox = process.env.SANDBOX === '1'; // match the mock: app served like hubbase.app
const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true, permissions: ['clipboard-read','clipboard-write'] });
const p = await ctx.newPage();
let lastPrompt = '';
p.on('dialog', d => { if (d.type() === 'prompt') lastPrompt = d.defaultValue(); d.accept(); });
const errs = [];
p.on('pageerror', e => errs.push('pageerror: ' + e.message));
p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
let fails = 0;
const ok = (c, msg) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + msg); };
await p.goto(base + '/s/austin/configurator');
const f = await (await p.waitForSelector('#f')).contentFrame();
await f.waitForSelector('.cab-card');
await p.waitForTimeout(800);
const cards = await f.$$eval('.cab-card', els => els.length);
ok(cards === 85, 'catalog renders 85 cards: ' + cards);
const tabs = await f.$$eval('.cat-tab', els => els.map(e => e.textContent.trim()));
ok(!tabs.some(t => t.startsWith('Wall')), 'empty Wall Cabinets tab hidden: ' + tabs.join(' | '));
// price from store/injection: SAC20CSDL should be $1,574
const price = await f.$eval('.cab-card[data-cat-id="SAC20CSDL"] .price', e => e.textContent);
ok(price === '$1,573.75', 'SAC20CSDL price matches store (MAP): ' + price);
const kam = await f.$eval('.cab-card[data-cat-id="SAC30KBDC_KAMADO_RAIL"] .w', e => e.textContent);
ok(kam === '30"', 'Kamado width fixed: ' + kam);
const call = await f.$$eval('.badge-call', els => els.map(e => e.closest('.cab-card').dataset.catId));
ok(call.length === 1 && call[0] === 'SAC46GLPCD_RUBY5BIR', 'call-to-order badge only on unsellable module: ' + call);
// click to add 3 modules
for (const id of ['SAC34GLPCD', 'SBC18STD', 'SBC18STD']) await f.click(`.cab-card[data-cat-id="${id}"]`);
let placed = await f.$$eval('.placed', els => els.length);
ok(placed === 3, 'click adds modules: ' + placed);
const total = await f.$eval('[data-t="subtotal"]', e => e.textContent);
ok(total === '$6,396.25', 'subtotal 2773.75 + 1811.25 x 2: ' + total);
// drag & drop a catalog card into the lane at the start
await f.dragAndDrop('.cab-card[data-cat-id="SBC12SSRD"]', '.lane', { targetPosition: { x: 5, y: 100 } });
const first = await f.$eval('.placed img', e => e.alt);
ok(/Spice Rack/.test(first), 'drag-drop inserts at start: ' + first);
// undo / redo
await f.click('#btnUndo'); placed = await f.$$eval('.placed', els => els.length); ok(placed === 3, 'undo: ' + placed);
await f.click('#btnRedo'); placed = await f.$$eval('.placed', els => els.length); ok(placed === 4, 'redo: ' + placed);
// install toggle persists and tax field keeps focus
await f.check('#installToggle'); await f.click('.cab-card[data-cat-id="SBC6SPEL"]');
ok(await f.$eval('#installToggle', e => e.checked), 'install toggle stays checked after re-render');
await f.fill('#taxRateInput', ''); await f.type('#taxRateInput', '6.25');
ok(await f.$eval('#taxRateInput', e => e.value === '6.25' && document.activeElement === e), 'tax input keeps focus while typing');
// add the unsellable module, then add to cart
await f.click('.cab-card[data-cat-id="SAC46GLPCD_RUBY5BIR"]');
const btnTxt = await f.$eval('#btnCart', e => e.textContent); ok(btnTxt === 'Add 6 modules to Cart', 'cart button count: ' + btnTxt);
await f.click('#btnCart'); await p.waitForTimeout(600);
const cart = await p.evaluate(() => window.CART);
ok(cart.length === 4 && cart.find(c => c.sku === 'SBC18STD').qty === 2, 'parent cart got items: ' + JSON.stringify(cart));
const status = await f.$eval('#cartStatus', e => e.textContent); ok(/(5 modules sent|4 items added to your cart).*SAC46GLPCD_RUBY5BIR/.test(status), 'cart status honest: ' + status);
const sent = await p.evaluate(() => window.LAST_CART);
ok(sent && sent.type === 'HB_ADD_TO_CART' && sent.v === 2 && sent.tool === 'island-classic' && sent.design && sent.design.layout.runs[0].items.length === 6 && /^data:image\/jpeg/.test(sent.design.image || ''), 'cart message is v2 with the design and its picture');
ok(sent.items.every(i => !('price' in i)), 'cart lines carry no price (the store prices them)');
const evs = await p.evaluate(() => window.TOASTS.filter(t => t.startsWith('event:')));
ok(evs.includes('event:design_started'), 'design_started event sent: ' + evs.join(','));
// Gas appliance: asked once, then sent on the line
await p.evaluate(() => { window.CART = []; window.MISSING = []; });
await f.click('.cab-card[data-cat-id="SAC34GLPCD_RUBY3B"]');
await f.click('#btnCart');
ok(await f.isVisible('#gasModalBg.show'), 'gas type is asked before adding a gas grill');
await f.click('#gasModalBg [data-gas="LP"]'); await p.waitForTimeout(600);
const gasLine = (await p.evaluate(() => window.CART)).find(c => c.sku === 'SAC34GLPCD_RUBY3B');
ok(gasLine && gasLine.gas === 'LP', 'the gas grill line carries gasType LP');
ok(/Propane/.test(await f.$eval('.gas-row', e => e.textContent)), 'quote shows the gas choice');
await f.click('#btnCart'); await p.waitForTimeout(300);
ok(!(await f.isVisible('#gasModalBg.show')), 'gas type is not asked twice');
await f.click('#btnUndo');
const link = await f.$eval('.qline-name a', e => e.getAttribute('href')); ok(link.startsWith('/s/austin/products/'), 'store link: ' + link);
// schematic shapes
for (const shape of ['L', 'U', 'Double', 'V', 'Straight']) {
  await f.click(`.shape-btn:has-text("${shape}")`).catch(()=>{});
  if (await f.$('.modal-bg.show')) {}
}
for (const [label, n] of [['L-Shape', 2], ['U-Shape', 3], ['V-Shape', 2], ['Double', 2]]) {
  await f.click(`.shape-btn:has(span:text-is("${label.split(' ')[0]}"))`);
  const info = await f.$eval('#schematicSvg svg', s => { const r = s.getBBox(); return { b: [r.x, r.y, r.width, r.height].map(Math.round), runs: document.querySelectorAll('.run').length, title: document.querySelector('#shapeTitle').textContent }; });
  const [x, y, w, h] = info.b;
  ok(info.runs === n && x >= 0 && y >= 0 && x + w <= 190 && y + h <= 110, `${info.title}: ${n} runs, schematic fits view ${info.b}`);
}
await f.click('.schem-run[data-run="1"]');
ok(await f.$eval('.run.active .tag', e => e.textContent) === 'B', 'clicking schematic badge activates Run B');
// New: space available + fit filter on Run B (currently active)
await f.fill('.run.active .space input', '30'); await f.press('.run.active .space input', 'Enter');
await f.waitForSelector('#fitRow:not([hidden])');
await f.check('#fitToggle');
const fitW = await f.$$eval('.cab-card .w', els => els.map(e => parseFloat(e.textContent)));
ok(fitW.length > 0 && fitW.every(w => w <= 30), `fit filter shows only modules <= 30": ${fitW.length} cards`);
await f.uncheck('#fitToggle');
await f.click('.cab-card[data-cat-id="SBC36CDD"]');
ok(/too long/.test(await f.$eval('.run.active .meter .state', e => e.textContent)), 'meter warns when a run is longer than its space');
// New: swap a placed module for another version, keyboard delete, details
await f.click('.run.active .placed:last-child');
await f.click('.run.active .placed.selected .swap');
const swapTo = await f.$eval('.swap-opt', e => e.dataset.id);
await f.click('.swap-opt');
ok(await f.$eval('.run.active .placed:last-child img', (e, id) => e.alt.length > 0, swapTo) && (await f.evaluate(() => document.querySelector('.run.active .placed.selected') !== null)), 'swap replaces the module with ' + swapTo);
const before = await f.$$eval('.run.active .placed', e => e.length);
await f.focus('.run.active .placed.selected'); await p.keyboard.press('Delete');
ok((await f.$$eval('.run.active .placed', e => e.length)) === before - 1, 'Delete key removes the selected module');
await f.click('#btnUndo');
await f.click('.cab-card[data-cat-id="SBC18STD"] .info-btn');
ok(/SBC18STD/.test(await f.$eval('#detailTitle', e => e.textContent)) && /\$1,811\.25/.test(await f.$eval('#detailBody', e => e.textContent)), 'details dialog shows SKU and store price');
await f.click('#detailClose');
// CSV
const [dl] = await Promise.all([p.waitForEvent('download'), (async () => { await f.click('#btnMore'); await f.click('#exportCSVBtn'); })()]);
const csv = await (await import('node:fs')).promises.readFile(await dl.path(), 'utf8');
const rows = csv.trim().split('\r\n').map(r => r.match(/"([^"]|"")*"/g).length);
ok(rows.every(n => n === 8), 'CSV rows all 8 columns: ' + csv.split('\r\n')[1]);
// share link round trip via parent URL + autosave on reload
const placedNow = await f.$$eval('.placed', e => e.length);
await f.click('#btnMore'); await f.click('#btnShare'); await p.waitForTimeout(300);
// In the sandbox the clipboard is blocked and the app shows the link in a prompt instead.
const shareUrl = (await p.evaluate(() => navigator.clipboard.readText()).catch(() => '')) || lastPrompt;
if (!sandbox) {
  ok(shareUrl.startsWith(base + '/s/austin/configurator#design='), 'share link points at store page: ' + shareUrl.slice(0, 70));
  await p.reload(); const f2 = await (await p.waitForSelector('#f')).contentFrame(); await f2.waitForSelector('.placed');
  ok((await f2.$$eval('.placed', e => e.length)) === placedNow, `autosave restored all ${placedNow} modules after reload`);
  await f2.click('#btnMore'); await f2.click('#btnClear');
} else {
  ok(shareUrl.startsWith(base + '/s/austin/apps/island-configurator#design='), 'sandboxed share link opens the app itself: ' + shareUrl.slice(0, 70));
}
const p2 = await ctx.newPage(); await p2.goto(shareUrl);
const f3 = sandbox ? p2.mainFrame() : await (await p2.waitForSelector('#f')).contentFrame(); await f3.waitForSelector('.placed');
ok((await f3.$$eval('.placed', e => e.length)) === placedNow, `shared link loads all ${placedNow} modules`);
// bad design file
await f3.setInputFiles('#loadFile', { name: 'x.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ shape: 'l', runs: [{ items: [{ catId: 'NOPE' }, { catId: 'SBC18STD' }] }] })) });
await p2.waitForTimeout(300);
ok((await f3.$$eval('.placed', e => e.length)) === 1, 'unknown module ids dropped from loaded file without crashing');
// mobile
const m = await b.newPage({ viewport: { width: 390, height: 844 } });
m.on('pageerror', e => errs.push('mobile pageerror: ' + e.message));
await m.goto(base + '/s/austin/apps/island-configurator'); await m.waitForSelector('.cab-card');
await m.click('.cab-card[data-cat-id="SBC24STD"]');
await m.click('#tabbar button[data-view="layout"]');
ok(await m.isVisible('.run'), 'mobile tab bar switches to the layout');
await m.click('#btnMore'); await m.click('#btnClear');
await m.click('.tpl');
ok((await m.$$eval('.placed', e => e.length)) === 4, 'starter layout loads 4 modules');
const ov = await m.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
ok(ov <= 0, 'mobile: no horizontal page overflow: ' + ov);
console.log(errs.length ? errs.join('\n') : 'no page errors');
await b.close();
process.exit(fails || errs.some(x => x.includes('pageerror')) ? 1 : 0);

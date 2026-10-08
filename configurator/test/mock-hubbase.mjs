// Stand-in for Hubbase: the store page with its cart listener, the /apps route (which
// injects the price map before the first </body>, like Hubbase does) and the products API.
import http from 'node:http'; import fs from 'node:fs';
const here = new URL('..', import.meta.url).pathname;
const distPath = here + 'dist/island-configurator.html';
const products = JSON.parse(fs.readFileSync(here + 'data/store-products.snapshot.json', 'utf8'));
const port = +(process.argv[2] || 8765);
// SANDBOX=1 serves the app the way hubbase.app does: CSP sandbox, so its origin is "null".
const sandbox = process.env.SANDBOX === '1';
const prices = Object.fromEntries(products.map(p => [p.sku, p.price / 100]));
const inj = '<script>window.addEventListener("load",function(){window.postMessage({type:"SUNSTONE_PRICE_MAP",prices:' + JSON.stringify(prices) + '},"*")});</script>';
const parent = `<!doctype html><html><head><title>Parent</title></head><body>
<script>window.HB={siteId:"site_affv5holph",base:"/s/austin",api:""};window.CART=[];window.MISSING=[];window.TOASTS=[];</script>
<div data-hbk-cfg><iframe id="f" src="/s/austin/apps/island-configurator" style="width:1400px;height:860px;border:0"></iframe></div>
<script>
var frame=document.getElementById('f');
window.addEventListener("message",function(e){
  if (e.source!==frame.contentWindow || (e.origin!==location.origin && e.origin!=="null")) return; var m=e.data||{};
  if (m.type==="SUNSTONE_ADD_TO_CART" || m.type==="HB_ADD_TO_CART"){
    var its=(m.items||[]).filter(function(x){return x&&(x.productId||x.ref||x.sku)});
    var refs=its.map(function(x){return x.productId||""}).join(","),skus=its.map(function(x){return x.sku||""}).join(",");
    fetch("/api/public/products?siteId="+HB.siteId+"&refs="+refs+"&skus="+skus).then(r=>r.json()).then(function(d){
      var rs=d.results||[];its.forEach(function(it){var hit=rs.find(function(p){return String(p.ref)===String(it.productId)})||rs.find(function(p){return String(p.sku).toLowerCase()===String(it.sku||"").toLowerCase()});
      if(hit) CART.push({sku:hit.sku,price:hit.price,qty:it.quantity,gas:(it.options||{}).gasType||null}); else MISSING.push(it.productId||it.sku);});
      window.LAST_CART=m; frame.contentWindow.postMessage({type:"HB_CART_RESULT",added:CART.length,missing:MISSING},"*");
    });
  }
  if (m.type) TOASTS.push(m.type === "HB_CONFIGURATOR_EVENT" ? "event:" + m.event : m.type);
});
</script></body></html>`;
http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/s/austin/configurator') { res.writeHead(200, {'content-type':'text/html'}); return res.end(parent); }
  if (u.pathname === '/s/austin/apps/island-configurator') {
    // mimic Hubbase: inject the price map before the first </body>
    const html = fs.readFileSync(distPath, 'utf8').replace(/<\/body>/i, inj + '</body>');
    const headers = {'content-type':'text/html'};
    if (sandbox) headers['content-security-policy'] = 'sandbox allow-scripts allow-forms allow-popups allow-modals allow-downloads';
    res.writeHead(200, headers); return res.end(html);
  }
  if (u.pathname === '/api/public/products') { res.writeHead(200, {'content-type':'application/json', 'access-control-allow-origin':'*'}); return res.end(JSON.stringify({ results: products })); }
  // Store hand-off C3: module -> product map, live prices (dollars) and the modules that need a gas type.
  if (u.pathname === '/api/public/configurator/map') {
    const map = JSON.parse(fs.readFileSync(here + 'data/cart-id-map.json', 'utf8'));
    const bySku = Object.fromEntries(products.map(p => [p.sku, p.price / 100]));
    const prices = Object.fromEntries(Object.keys(map).filter(k => bySku[k]).map(k => [k, bySku[k]]));
    const gas = Object.keys(map).filter(k => /_(RUBY3B|RUBY4B|RUBY5BIR|SUNCHSZ30|SUNCHDZ42|SUN13VDB|SUN13CPRO|SUN24PCB)/.test(k));
    res.writeHead(200, { 'content-type': 'application/json', 'access-control-allow-origin': '*' });
    return res.end(JSON.stringify({ map, prices, gas, dealer: false }));
  }
  if (u.pathname === '/favicon.ico') { res.writeHead(204); return res.end(); }
  res.writeHead(404); res.end();
}).listen(port, '127.0.0.1', () => console.log('mock hubbase on http://127.0.0.1:' + port));

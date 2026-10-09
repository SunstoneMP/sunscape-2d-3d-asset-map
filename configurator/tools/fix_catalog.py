"""Rebuild configurator/data/catalog.json from the original catalog + a store snapshot.

Why: the configurator's built-in catalog drifted from the Hubbase store, so the
on-screen quote disagreed with what the cart charged, and several cabinets had the
wrong width (e.g. the 30" Kamado base was listed as 11").

    python3 -I configurator/tools/fix_catalog.py

Refresh the store snapshot first (prices are in cents):
    curl -s "https://hubbase.app/api/public/products?siteId=site_affv5holph&skus=<comma list>" \
      | python3 -c "import json,sys;print(json.dumps(sorted(json.load(sys.stdin)['results'],key=lambda p:p['sku']),indent=1))" \
      > configurator/data/store-products.snapshot.json
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"

catalog = json.loads((DATA / "catalog.original.json").read_text())
cart_ids = json.loads((DATA / "cart-id-map.json").read_text())
store = json.loads((DATA / "store-products.snapshot.json").read_text())
by_sku = {p["sku"].lower(): p for p in store}
by_ref = {str(p["ref"]): p for p in store}

# Widths the original catalog got wrong. The SKU encodes the cabinet width
# (SAC30KBDC = 30", SAC33PBDC = 33" ...), and the image pixel widths agree.
WIDTH_FIX = {
    "SAC30KBDC_KAMADO_RAIL": 30,
    "SAC30KBDC_KAMADO_SHELF": 30,
    "SAC30KBDC_SUN24PCB-GD": 30,
    "SAC30KBDC_SUN24PCB-PB": 30,
    "SAC3OKBDC_KAMADO_OPEN": 30,
    "SAC33PBDC_SUN24PCB": 33,
    "SBC34FDD_BSK34": 34,
    "SBC12SLS_RIGHT": 12,
    "SCC4SPEL_LEFT": 4,
}


def store_hit(item):
    return by_ref.get(str(cart_ids.get(item["id"]))) or by_sku.get(item["id"].lower())


def clean_store_name(name, sku, handed):
    """'34" Sunstone Gas Grill Base Cabinet - Item No. SAC34GLPCD' -> 'Gas Grill Base Cabinet'."""
    n = re.sub(r"\s*-\s*(Item No\.\s*)?" + re.escape(sku) + r"\s*$", "", name, flags=re.I)
    n = re.sub(r'^\s*[\d.]+"\s*', "", n)
    n = re.sub(r"^Sunstone\s+", "", n)
    n = re.sub(r"\s+", " ", n).strip()
    # The store lists SBC18CSDR (right-hand) as "Left Swing" — keep the handing honest.
    if handed == "R":
        n = n.replace("Left Swing", "Right Swing")
    if handed == "L":
        n = n.replace("Right Swing", "Left Swing")
    return n


# Insert codes in image names -> how they read on the 2026 MAP sheets.
INSERT_LABEL = {
    "BRBC14": "B-RBC14 bar center", "BIC14": "B-IC14 ice chest", "BPS21": "B-PS21 sink", "BSK34": "B-SK34 sink",
    "AIC": "A-IC ice chest", "ASS17": "A-SS17 sink", "SAPWD30PROx2": "2 x SAP30WDPRO warming drawers",
    "SAPWD30PRO": "SAP30WDPRO warming drawer", "SAPFR21PRO": "SAPFR21PRO refrigerator",
}


def fmt_w(w):
    return f"{w:g}"


# Pass 1: base cabinets (no insert, no style variant) take their description from the store.
base_desc = {}
for it in catalog:
    if it["variant"] or it["styleVariant"]:
        continue
    hit = store_hit(it)
    if hit and re.search(re.escape(it["id"]) + r"\s*$", hit["name"]):
        base_desc[it["id"]] = clean_store_name(hit["name"], it["id"], it["handed"])

# Cabinet descriptions from the 2026 MAP sheet where the store has no plain product for the base cabinet.
SHEET_DESC = {
    "SAC30KBDC": "Kamado Hybrid Grill Base Cabinet",
    "SAC33PBDC": "Power Burner Cabinet",
    "SBC12SLS": "90 Degree Corner Cabinet w/Lazy Susan",
}
# MAP totals from the price audit (pricing/map-audit.json), used when a module isn't in the public store feed.
audit_path = ROOT / "pricing" / "map-audit.json"
map_total = {r["module"]: r["map_total"] for r in json.loads(audit_path.read_text())} if audit_path.exists() else {}

out = []
for it in catalog:
    it = dict(it)
    w = WIDTH_FIX.get(it["id"], it["widthIn"])
    it["widthIn"] = it["w"] = w

    hit = store_hit(it)
    if hit:
        it["price"] = round(hit["price"] / 100, 2)
        it["slug"] = hit.get("slug")
        it["inStore"] = True
    else:
        it["slug"] = None
        it["inStore"] = False
        if map_total.get(it["id"]):
            it["price"] = map_total[it["id"]]

    base_id = it["id"].split("_")[0]
    if it["handed"] and it["id"].endswith(("_LEFT", "_RIGHT")):
        base_id = it["id"]  # corner pieces: handing is part of the SKU
    desc = base_desc.get(it["id"]) or base_desc.get(base_id) or SHEET_DESC.get(it["id"].split("_")[0].replace("SAC3OKBDC", "SAC30KBDC"))
    if desc:
        it["code"] = desc
    hand = f' [{it["handed"]}]' if it["handed"] else ""
    # "ASS17" is the A-SS17 17" sink insert (it was read as a door style before).
    variant = it["variant"] or ("ASS17" if "_ASS17" in it["id"] else None)
    if "_ASS17" in it["id"]:
        it["variant"], it["styleVariant"] = "ASS17", False
    insert = f' + {INSERT_LABEL.get(variant, variant.replace("+", " / "))}' if variant else ""
    it["name"] = f'{fmt_w(w)}" {it["code"]}{insert}{hand}'
    out.append(it)

(DATA / "catalog.json").write_text(json.dumps(out, indent=1, ensure_ascii=False) + "\n")
missing = [i["id"] for i in out if not i["inStore"]]
print(f"{len(out)} modules, {len(base_desc)} store descriptions, not in store: {missing}")

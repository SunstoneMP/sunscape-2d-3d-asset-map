"""Audit 2D configurator prices against the 2026 MAP price sheets.

    python3 -I configurator/tools/map_audit.py <map.json> <products.json>

map.json: item number -> MAP rows, built from the two contractor price sheets (MAP PRICE / MAP column).
products.json: GET /api/sites/site_affv5holph/products.
Each module's image name is its parts: the cabinet item number, then any insert(s) (grill, sink, burner ...).
Expected price = sum of the parts' MAP prices. Writes pricing/map-audit.csv and pricing/map-audit.json.
"""
import csv, json, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
mp = json.loads(Path(sys.argv[1]).read_text())
prods = json.loads(Path(sys.argv[2]).read_text())
prods = prods.get("products", prods) if isinstance(prods, dict) else prods
catalog = json.loads((ROOT / "data" / "catalog.json").read_text())
refs = json.loads((ROOT / "data" / "cart-id-map.json").read_text())
by_ref = {str(p.get("ref")): p for p in prods}
by_sku = {str(p.get("sku") or "").upper(): p for p in prods}

# Insert codes in image names -> item numbers in the price sheets.
ALIAS = {
    "BRBC14": "B-RBC14", "BIC14": "B-IC14", "BPS21": "B-PS21", "BSK34": "B-SK34", "AIC": "A-IC",
    "ASS17": "A-SS17", "SAPWD30PRO": "SAP30WDPRO", "SAPFR21PRO": "SAPFR21PRO",
}
# Parts the sheets don't list under that number; flagged for a person to decide.
UNPRICED = {
    "SUNCHSZ30": "not on the 2026 sheet (closest: SUNCHSZ30IR $3,872.50, SUNCHSZ28 $2,735.00)",
    "SUNCHDZ42": "not on the 2026 sheet (closest: EMCHDZ42 Emerald 42\" $6,185.00)",
    "KAMADO": "the kamado grill itself is a third-party grill, not a Sunstone item",
    "SBC34FDD": "no SBC34FDD on the 2026 sheet (sheet has SBC24FDD, SBC30FDD, SBC36FDD)",
    "SCCSPER": "no SCCSPER on the sheet (SCC4SPER/SCC4SPEL is a $1,497.50 left+right pair)",
}
# Kamado options: RAIL = speed rail SCC30KB-SPRAIL; SHELF / OPEN have no sheet item.
KAMADO_OPTS = {"RAIL": "SCC30KB-SPRAIL"}

def map_of(code):
    rows = mp.get(code.upper())
    return rows[0]["map"] if rows else None

def parts_of(mod_id):
    toks = mod_id.upper().split("_")
    toks = [t for t in toks if t not in ("LEFT", "RIGHT")]
    base = toks[0].replace("SAC3OKBDC", "SAC30KBDC")
    out, notes = [(base, 1)], []
    rest = toks[1:]
    if rest[:1] == ["KAMADO"]:
        notes.append("KAMADO: " + UNPRICED["KAMADO"])
        opt = rest[1] if len(rest) > 1 else ""
        if opt in KAMADO_OPTS: out.append((KAMADO_OPTS[opt], 1))
        elif opt: notes.append(f"{opt}: no item number on the sheet for this kamado option")
        rest = []
    for t in rest:
        q = 1
        m = re.match(r"(.+)X(\d)$", t)
        if m: t, q = m.group(1), int(m.group(2))
        out.append((ALIAS.get(t, t), q))
    return out, notes

rows = []
for it in catalog:
    parts, notes = parts_of(it["id"])
    priced, total, ok = [], 0.0, True
    for code, q in parts:
        key = re.sub(r"[^A-Z0-9-]", "", code)
        m = map_of(key)
        if m is None:
            ok = False
            notes.append(f"{code}: " + UNPRICED.get(code.split("-")[0] if code not in UNPRICED else code, "not found on the MAP sheets"))
            priced.append(f"{code} = ?")
        else:
            total += m * q
            priced.append(f"{'%d x ' % q if q > 1 else ''}{code} ${m:,.2f}")
    p = by_ref.get(str(refs.get(it["id"]))) or by_sku.get(it["id"].upper())
    store = p["price"] / 100 if p else None
    expected = round(total, 2) if ok else None
    status = ("OK" if store is not None and expected is not None and abs(store - expected) < 0.005
              else "WRONG" if expected is not None and store is not None
              else "NOT IN STORE" if store is None else "NEEDS DECISION")
    rows.append({"module": it["id"], "parts": " + ".join(priced), "map_total": expected,
                 "store_price": store, "configurator_price": it["price"], "status": status,
                 "store_product_id": p["id"] if p else None, "store_ref": p.get("ref") if p else None,
                 "store_active": p.get("active") if p else None, "notes": "; ".join(notes)})

out = ROOT / "pricing"
out.mkdir(exist_ok=True)
(out / "map-audit.json").write_text(json.dumps(rows, indent=1))
with open(out / "map-audit.csv", "w", newline="") as f:
    w = csv.DictWriter(f, fieldnames=list(rows[0]))
    w.writeheader(); w.writerows(rows)
from collections import Counter
print(Counter(r["status"] for r in rows))

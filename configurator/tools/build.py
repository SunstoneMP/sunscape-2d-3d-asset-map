"""Build the single-file configurator that gets uploaded to Hubbase.

    python3 -I configurator/tools/build.py

Inlines data/catalog.json, data/cart-id-map.json and data/images.json (base64 webp
renders) into src/island-configurator.html and writes dist/island-configurator.html.
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
src = (ROOT / "src" / "island-configurator.html").read_text()
catalog = json.loads((ROOT / "data" / "catalog.json").read_text())
cart_ids = json.loads((ROOT / "data" / "cart-id-map.json").read_text())
images = json.loads((ROOT / "data" / "images.json").read_text())

missing = [c["file"] for c in catalog if c["file"] not in images]
if missing:
    raise SystemExit(f"catalog references images that are not in images.json: {missing}")


def js(value):
    # "</" would let a module name end the <script> element early.
    return json.dumps(value, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")


out = src
for token, value in (("CATALOG", catalog), ("CART_ID_MAP", cart_ids), ("IMAGES", images)):
    pattern = f"/*@@{token}@@*/" + ("[]" if token == "CATALOG" else "{}")
    if out.count(pattern) != 1:
        raise SystemExit(f"placeholder for {token} not found exactly once")
    out = out.replace(pattern, js(value))

# Hubbase injects its price map before the first closing body tag, so there must be
# exactly one, at the real end of the document (see the note at the top of the script).
if len(re.findall(r"</body>", out, re.I)) != 1:
    raise SystemExit("found more than one </body> - escape the one inside JS as <\\/body>")

dist = ROOT / "dist" / "island-configurator.html"
dist.write_text(out)
print(f"wrote {dist.relative_to(ROOT.parent)} ({len(out) // 1024} KB, {len(catalog)} modules)")

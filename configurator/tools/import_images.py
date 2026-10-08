"""Replace the configurator's module images with the high-res renders from the
`2dconfigurator-assets` release of SunstoneMP/shared-files (2D.Configurator.Image.Files.zip).

    python3 -I configurator/tools/import_images.py "<unzipped folder of PNGs>"

The renders are 950px tall PNGs; they are resized to IMAGE_HEIGHT (sharp on retina at the
190px the run lanes show them) and stored as WebP data URLs in data/images.json.
Modules without a usable render keep their current image.
"""
import base64
import io
import json
import sys
from pathlib import Path

from PIL import Image

IMAGE_HEIGHT = 400
QUALITY = 80

# Files in the release whose names were clipped when they were exported.
# Each was confirmed by comparing pixels against the module's existing image.
ALIASES = {
    "BC3C45_LEFT": "SBC3C45_LEFT",
    "BC3C45_RIGHT": "SBC3C45_RIGHT",
    "CC3SPF": "SCC3SPF",
    "CC6SPF": "SCC6SPF",
    "IGHT": "SCCSPER_RIGHT",
    "LEFT": "SCC4SPEL_LEFT",
}

ROOT = Path(__file__).resolve().parent.parent
src = Path(sys.argv[1])
images_path = ROOT / "data" / "images.json"
images = json.loads(images_path.read_text())
catalog = json.loads((ROOT / "data" / "catalog.json").read_text())
wanted = {c["file"].rsplit(".", 1)[0]: c["file"] for c in catalog}

updated, skipped = [], []
for png in sorted(src.glob("*.png")):
    module = ALIASES.get(png.stem, png.stem)
    if module not in wanted:
        skipped.append(f"{png.name} (no such module)")
        continue
    if png.stat().st_size == 0:
        skipped.append(f"{png.name} (empty file)")
        continue
    im = Image.open(png).convert("RGBA")
    w = max(1, round(im.size[0] * IMAGE_HEIGHT / im.size[1]))
    buf = io.BytesIO()
    im.resize((w, IMAGE_HEIGHT), Image.LANCZOS).save(buf, "WEBP", quality=QUALITY, method=4)
    images[wanted[module]] = "data:image/webp;base64," + base64.b64encode(buf.getvalue()).decode()
    updated.append(module)

images_path.write_text(json.dumps(images, indent=0, sort_keys=True))
kept = sorted(set(wanted) - set(updated))
print(f"updated {len(updated)} images; kept the old image for {len(kept)}: {kept}")
for s in skipped:
    print("skipped", s)

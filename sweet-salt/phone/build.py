"""Build the phone menu from menu.json, its photos and a QR code.

Usage:
  python3 build.py <url for the QR code>               one self-contained file in dist/ (photos embedded)
  python3 build.py <url for the QR code> --site <dir>  a static site: index.html, img/*.webp, qr-code.png

Needs Pillow and segno. Photos are cached in ~/.cache/sweet-salt.
"""
import base64, hashlib, io, json, pathlib, sys, urllib.request

import segno
from PIL import Image

HERE = pathlib.Path(__file__).resolve().parent
CACHE = pathlib.Path.home() / ".cache" / "sweet-salt"


def photo(url):
    path = CACHE / (hashlib.md5(url.encode()).hexdigest() + ".webp")
    if not path.exists():
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        path.write_bytes(urllib.request.urlopen(req).read())
    im = Image.open(path).convert("RGB")
    im.thumbnail((820, 820))
    buf = io.BytesIO()
    im.save(buf, "WEBP", quality=58)
    return buf.getvalue()


def main(qr_url, site=None):
    CACHE.mkdir(parents=True, exist_ok=True)
    out_dir = pathlib.Path(site) if site else HERE / "dist"
    if site:
        (out_dir / "img").mkdir(parents=True, exist_ok=True)
        (out_dir / ".nojekyll").touch()
    else:
        out_dir.mkdir(exist_ok=True)

    menu = json.loads((HERE.parent / "menu.json").read_text())
    imgs = {}
    for s in menu["sections"]:
        for c in s["categories"]:
            for i in c["items"]:
                url = i.pop("imgBig")
                i["img"] = None
                if url:
                    key = hashlib.md5(url.encode()).hexdigest()[:8]
                    if key not in imgs:
                        data = photo(url)
                        if site:
                            (out_dir / "img" / f"{key}.webp").write_bytes(data)
                            imgs[key] = f"img/{key}.webp"
                        else:
                            imgs[key] = "data:image/webp;base64," + base64.b64encode(data).decode()
                    i["img"] = key

    qr = segno.make(qr_url, error="m")
    qr_svg = qr.svg_inline(border=0, omitsize=True, dark="#111c26")
    qr.save(out_dir / "qr-code.png" if site else HERE.parent / "qr-code.png", scale=24, border=4, dark="#111c26")

    data = (f"const MENU={json.dumps(menu, ensure_ascii=False)};\n"
            f"const IMGS={json.dumps(imgs)};\n"
            f"const QR_URL={json.dumps(qr_url)};\n"
            f"const QR_SVG={json.dumps(qr_svg)};\n")
    out = out_dir / ("index.html" if site else "sweet-salt-menu.html")
    head = ('<!DOCTYPE html>\n<html lang="pt">\n<head>\n<meta charset="utf-8">\n'
            '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
            '<style>:root { padding-top: env(safe-area-inset-top, 0px); padding-bottom: env(safe-area-inset-bottom, 0px); }'
            ' body { margin: 0; } img { max-width: 100%; }</style>\n')
    page = (HERE / "template.html").read_text().replace("/*DATA*/", data)
    # The template's <title>, fonts and styles belong in <head>; everything from <header> on is the body.
    split = page.index('<header class="cover"')
    out.write_text(head + page[:split] + "</head>\n<body>\n" + page[split:] + "</body>\n</html>\n")
    print(out, out.stat().st_size // 1024, "KB")


if __name__ == "__main__":
    args = sys.argv[1:]
    site = args[args.index("--site") + 1] if "--site" in args else None
    main(args[0], site)

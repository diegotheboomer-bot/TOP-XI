"""Write docs/templates/menu.json: the menu every template reads.

Photos are the ones build.py --site already wrote to docs/img (same md5 keys).
Usage: python3 sweet-salt/templates/make_data.py
"""
import hashlib, json, pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2]
menu = json.loads((ROOT / "sweet-salt" / "menu.json").read_text())

# The templates leave out the custom-cakes section (it has no dishes) and don't show sold-out marks.
menu["sections"] = [s for s in menu["sections"] if s["id"] != "bolos-por-encomenda"]

for s in menu["sections"]:
    for c in s["categories"]:
        for i in c["items"]:
            i.pop("soldOut", None)
            url = i.pop("imgBig")
            i.pop("img", None)
            key = hashlib.md5(url.encode()).hexdigest()[:8] if url else None
            i["img"] = f"img/{key}.webp" if key and (ROOT / "docs" / "img" / f"{key}.webp").exists() else None

# Restaurant details shown by the templates. Hours: Sunday first, as on the original site.
menu["info"] = {
    "name": "Sweet & Salt",
    # Optional: templates show this logo, or the restaurant's initials when it is missing.
    "logo": "img/logo.png" if (ROOT / "docs" / "img" / "logo.png").exists() else None,
    "address": "Avenida Miguel Bombarda 9, 8500-643 Portimão",
    "phone": "282 419 549",
    "instagram": "https://www.instagram.com/sweetsalt.pt/",
    "maps": "https://maps.google.com/?q=Sweet+%26+Salt+Avenida+Miguel+Bombarda+9+Portim%C3%A3o",
    "hours": [["10:00", "22:00"]] * 5 + [["10:00", "22:30"]] * 2,
}

out = ROOT / "docs" / "templates" / "menu.json"
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(json.dumps(menu, ensure_ascii=False))
print(out, out.stat().st_size // 1024, "KB")

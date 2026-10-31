"""Pull the current menu (Portuguese + English) from sweet-salt.choiceqr.com into menu.json."""
import json, re, urllib.request, pathlib

BASE = "https://sweet-salt.choiceqr.com/{lang}menu/section:"
SECTIONS = ["brunch", "menu", "sobremesas", "bolos-por-encomenda", "drinks", "vinhos"]


def app_data(slug, lang=""):
    req = urllib.request.Request(BASE.format(lang=lang) + slug, headers={"User-Agent": "Mozilla/5.0"})
    html = urllib.request.urlopen(req).read().decode()
    raw = re.search(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', html, re.S).group(1)
    return json.loads(raw)["props"]["app"]


def image(item):
    if not item["media"]:
        return None
    m = item["media"][0]
    return (m.get("webp") or m)["medium"], (m.get("webp") or m)["big"]


out = {"sections": []}
for slug in SECTIONS:
    app = app_data(slug)
    en = app_data(slug, "en/")
    sec = next(s for s in app["sections"] if s["hurl"] == "section:" + slug)
    sec_en = next(s for s in en["sections"] if s["_id"] == sec["_id"])
    cat_en = {c["_id"]: c for c in en["categories"]}
    item_en = {i["_id"]: i for i in en["menu"]}
    cats = []
    for c in app["categories"]:
        items = sorted((i for i in app["menu"] if i["category"] == c["_id"]), key=lambda i: i["position"])
        cats.append({
            "id": c["hurl"],
            "name": c["name"].strip(),
            "en": {"name": cat_en[c["_id"]]["name"].strip()},
            "items": [{
                "name": i["name"].strip(),
                "desc": (i["description"] or "").strip(),
                "price": i["price"] / 100,
                "img": (image(i) or (None, None))[0],
                "imgBig": (image(i) or (None, None))[1],
                "soldOut": "SOLD_OUT" in i["attributes"],
                "labels": [l["name"] if l["custom"] else l["type"] for l in i["menu_labels"]],
                "volume": i["weight"] or "",
                "en": {"name": item_en[i["_id"]]["name"].strip(), "desc": (item_en[i["_id"]]["description"] or "").strip()},
            } for i in items],
        })
    out["sections"].append({
        "id": slug,
        "name": sec["name"],
        "desc": sec.get("description") or "",
        "info": sec.get("menuInfo") or "",
        "en": {"name": sec_en["name"], "desc": sec_en.get("description") or "", "info": sec_en.get("menuInfo") or ""},
        "categories": cats,
    })
    print(slug, sum(len(c["items"]) for c in cats), "items")

path = pathlib.Path(__file__).resolve().parent.parent / "menu.json"
path.write_text(json.dumps(out, ensure_ascii=False, indent=1))

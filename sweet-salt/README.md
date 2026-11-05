# Sweet & Salt — menu

A cleaner remake of https://sweet-salt.choiceqr.com/menu.

```
cd sweet-salt
python3 -m http.server 8000
```

Open http://localhost:8000. Links work like the original, e.g. `#brunch/ovos-mais`.

To refresh prices and dishes from the live site: `python3 scripts/fetch_menu.py`

## Phone version

`phone/` holds the single-file, photo-led version (Portuguese/English, QR code) published at
https://claude.ai/artifact/CN9HWNeqrKppbdGVwvhbpA. Rebuild it after refreshing `menu.json`:

```
pip install pillow segno
python3 phone/build.py https://claude.ai/artifact/CN9HWNeqrKppbdGVwvhbpA
```

This writes `phone/dist/sweet-salt-menu.html` and `qr-code.png` (printable QR for the URL).

## Website (GitHub Pages)

The live site at https://diegotheboomer-bot.github.io/TOP-XI/ is served from `docs/`. Rebuild it with:

```
python3 sweet-salt/phone/build.py https://diegotheboomer-bot.github.io/TOP-XI/ --site docs
```

## Menu templates

Ten different menu designs live in `docs/templates/` and are previewed at
https://diegotheboomer-bot.github.io/TOP-XI/templates/. They all read `docs/templates/menu.json`
(written by `python3 sweet-salt/templates/make_data.py`) through the shared `docs/templates/core.js`,
which handles Portuguese/English, sections, opening hours and the dish popup.

For a new restaurant: copy `core.js`, the chosen template folder and a `menu.json` in the same shape
(sections → categories → items, plus an `info` block with name, address, phone, maps link and hours).

// Shared engine for the menu templates: data, language, sections, opening hours and the dish sheet.
// A template calls Menu.start({ render, onItem? }) and builds its own markup from the helpers below.
(() => {
  const ROOT = new URL("../", document.currentScript.src);

  const STRINGS = {
    pt: {
      soldOut: "Esgotado", new: "Novo", recommended: "Recomendado", search: "Procurar no menu",
      openUntil: (t) => `Aberto até às ${t}`, closedOpens: (t) => `Fechado · abre às ${t}`,
      hours: "Horário", address: "Morada", phone: "Telefone", map: "Ver no mapa", close: "Fechar",
      empty: "Sem itens nesta secção.", none: "Nada encontrado.", photo: "Ver foto", lang: "EN",
      days: ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"],
    },
    en: {
      soldOut: "Sold out", new: "New", recommended: "Recommended", search: "Search the menu",
      openUntil: (t) => `Open until ${t}`, closedOpens: (t) => `Closed · opens at ${t}`,
      hours: "Opening hours", address: "Address", phone: "Phone", map: "Open in maps", close: "Close",
      empty: "No items in this section.", none: "Nothing found.", photo: "See photo", lang: "PT",
      days: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
    },
  };

  const store = {
    get() { try { return localStorage.getItem("menu-lang"); } catch { return null; } },
    set(v) { try { localStorage.setItem("menu-lang", v); } catch {} },
  };

  const registry = [];
  let opts = {};

  const Menu = {
    data: null, info: null, section: null, lang: "pt", t: STRINGS.pt,

    esc: (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])),
    price: (n) => new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(n),
    img: (path) => (path ? new URL(path, ROOT).href : null),

    // Text in the current language; English lives under `en` and falls back to Portuguese.
    tx: (o, key) => (Menu.lang === "en" && o.en && o.en[key]) || o[key] || "",
    name: (o) => Menu.tx(o, "name"),
    desc: (o) => Menu.tx(o, "desc"),
    title: (s) => { const n = Menu.tx(s, "name"); return n.charAt(0) + n.slice(1).toLowerCase(); },

    categories: (s = Menu.section) => s.categories.filter((c) => c.items.length),
    badges(item) {
      const out = item.labels.filter((l) => Menu.t[l]).map((l) => ({ cls: l, text: Menu.t[l] }));
      if (item.soldOut) out.push({ cls: "sold", text: Menu.t.soldOut });
      return out;
    },
    featured: (s = Menu.section) => s.categories.flatMap((c) => c.items).filter((i) => i.labels.includes("recommended") && i.img && !i.soldOut),

    // Every item rendered through ref() gets a data-item id, so taps open it.
    ref(item) { registry.push(item); return `data-item="${registry.length - 1}"`; },

    search(q) {
      q = q.trim().toLowerCase();
      if (!q) return [];
      const hits = [];
      for (const s of Menu.data.sections) for (const c of s.categories) for (const i of c.items)
        if ([i.name, i.desc, i.en?.name, i.en?.desc].join(" ").toLowerCase().includes(q)) hits.push({ section: s, category: c, item: i });
      return hits;
    },

    now() { return new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Lisbon" })); },
    status() {
      const h = Menu.info.hours, now = Menu.now(), day = now.getDay(), hm = now.toTimeString().slice(0, 5);
      const [from, till] = h[day];
      const open = hm >= from && hm < till;
      return { open, text: open ? Menu.t.openUntil(till) : Menu.t.closedOpens(hm < from ? from : h[(day + 1) % 7][0]) };
    },
    week() {
      const today = Menu.now().getDay();
      return [1, 2, 3, 4, 5, 6, 0].map((d) => ({ day: Menu.t.days[d], from: Menu.info.hours[d][0], till: Menu.info.hours[d][1], today: d === today }));
    },

    go(id) { location.hash = id; },
    setLang(l) {
      Menu.lang = l; Menu.t = STRINGS[l]; store.set(l);
      document.documentElement.lang = l;
      Menu.render();
    },
    toggleLang() { Menu.setLang(Menu.lang === "pt" ? "en" : "pt"); },

    // Dish details in a <dialog>. Templates style #m-sheet and its parts.
    detail(item) {
      const desc = Menu.desc(item);
      return `${item.img ? `<img class="m-photo" src="${Menu.img(item.img)}" alt="">` : ""}
        <div class="m-body">
          <h2 class="m-name">${Menu.esc(Menu.name(item))}</h2>
          ${desc ? `<p class="m-desc">${Menu.esc(desc)}</p>` : ""}
          <div class="m-meta"><span class="m-price">${Menu.price(item.price)}</span>${item.volume ? `<span class="m-badge vol">${Menu.esc(item.volume)}</span>` : ""}${Menu.badges(item).map((b) => `<span class="m-badge ${b.cls}">${b.text}</span>`).join("")}</div>
        </div>`;
    },
    sheet(html) {
      let d = document.getElementById("m-sheet");
      if (!d) {
        d = document.createElement("dialog");
        d.id = "m-sheet";
        d.addEventListener("click", (e) => { if (e.target === d || e.target.closest("[data-close]")) d.close(); });
        document.body.append(d);
      }
      d.innerHTML = `<button class="m-close" data-close aria-label="${Menu.t.close}">×</button>${html}`;
      d.showModal();
    },

    render() {
      registry.length = 0;
      opts.render();
      document.querySelectorAll("[data-lang-label]").forEach((el) => (el.textContent = Menu.t.lang));
    },

    async start(o) {
      opts = o;
      Menu.data = await (await fetch(new URL("templates/menu.json", ROOT))).json();
      Menu.info = Menu.data.info;
      const saved = store.get();
      Menu.lang = saved || ((navigator.language || "").toLowerCase().startsWith("pt") ? "pt" : "en");
      Menu.t = STRINGS[Menu.lang];
      document.documentElement.lang = Menu.lang;
      const route = () => {
        Menu.section = Menu.data.sections.find((s) => s.id === location.hash.slice(1)) || Menu.data.sections[0];
        Menu.render();
        o.onRoute?.();
      };
      document.addEventListener("click", (e) => {
        const el = e.target.closest("[data-item]");
        if (el && !e.target.closest("#m-sheet")) {
          const item = registry[el.dataset.item];
          (o.onItem || ((i) => Menu.sheet(Menu.detail(i))))(item, el);
        }
        if (e.target.closest("[data-lang-toggle]")) Menu.toggleLang();
        const sec = e.target.closest("[data-section]");
        if (sec) Menu.go(sec.dataset.section);
      });
      window.addEventListener("hashchange", route);
      route();
    },
  };
  window.Menu = Menu;
})();

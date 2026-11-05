// Shared engine for the menu templates: data, language, sections, category jumps, opening hours and the dish sheet.
// A template calls Menu.start({ render, onItem? }) and builds its own markup from the helpers below.
(() => {
  const ROOT = new URL("../", document.currentScript.src);

  // On a computer, show the menu inside a phone-sized frame instead of stretching it across the screen.
  // Inside the frame (or any iframe) the template renders normally.
  const FRAMED = window.top === window && window.matchMedia("(min-width: 700px)").matches && !new URLSearchParams(location.search).has("full");

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
  let firstRoute = true;

  const Menu = {
    data: null, info: null, section: null, lang: "pt", t: STRINGS.pt,

    esc: (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])),
    price: (n) => new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(n),
    img: (path) => (path ? new URL(path, ROOT).href : null),

    // Text in the current language; English lives under `en` and falls back to Portuguese.
    tx: (o, key) => (Menu.lang === "en" && o.en && o.en[key]) || o[key] || "",
    name: (o) => Menu.tx(o, "name"),
    desc: (o) => Menu.tx(o, "desc"),
    title: (s) => { const n = Menu.tx(s, "name").trim(); return n.charAt(0) + n.slice(1).toLowerCase(); },

    categories: (s = Menu.section) => s.categories.filter((c) => c.items.length),
    badges(item) {
      const out = item.labels.filter((l) => Menu.t[l]).map((l) => ({ cls: l, text: Menu.t[l] }));
      return out;
    },
    featured: (s = Menu.section) => s.categories.flatMap((c) => c.items).filter((i) => i.labels.includes("recommended") && i.img && !i.soldOut),
    // Up to n photos for headers and collages: recommended dishes first, then the rest of the section.
    // Sections without photos borrow from the whole menu.
    photos(s = Menu.section, n = 8) {
      const ok = (i) => i.img && !i.soldOut;
      let pool = s.categories.flatMap((c) => c.items).filter(ok);
      if (!pool.length) pool = Menu.data.sections.flatMap((x) => x.categories.flatMap((c) => c.items)).filter(ok);
      return [...pool.filter((i) => i.labels.includes("recommended")), ...pool.filter((i) => !i.labels.includes("recommended"))].slice(0, n);
    },

    // Navigation markup. Templates style the buttons; core handles taps and highlighting.
    catId: (c) => "cat-" + c.id,
    sectionsNav: (cls = "") => Menu.data.sections.map((x) => `<button class="${cls}" data-section="${x.id}" aria-current="${x === Menu.section}">${Menu.esc(Menu.title(x))}</button>`).join(""),
    catsNav: (cls = "") => {
      const cats = Menu.categories();
      return cats.length > 1 ? cats.map((c) => `<button class="${cls}" data-cat="${Menu.catId(c)}">${Menu.esc(Menu.title(c))}</button>`).join("") : "";
    },

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

    // Height covered by the sticky bar, so jumps land just below it.
    // Measured as the bar's stuck height, since before scrolling it still sits lower on the page.
    offset() { const s = document.querySelector("[data-sticky]"); return s ? (parseFloat(getComputedStyle(s).top) || 0) + s.offsetHeight : 0; },
    jump(id) {
      const el = document.getElementById(id);
      if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - Menu.offset() - 8, behavior: "smooth" });
    },
    // Highlight the category chip for the section under the sticky bar.
    spy() {
      const chips = [...document.querySelectorAll("[data-cat]")];
      if (!chips.length) return;
      const line = Menu.offset() + 24;
      let active = chips[0];
      for (const c of chips) { const t = document.getElementById(c.dataset.cat); if (t && t.getBoundingClientRect().top <= line) active = c; }
      if (active.getAttribute("aria-current") === "true") return;
      chips.forEach((c) => c.setAttribute("aria-current", c === active));
      const row = active.parentElement;
      row.scrollTo({ left: active.offsetLeft - (row.clientWidth - active.offsetWidth) / 2, behavior: "smooth" });
    },

    render() {
      registry.length = 0;
      opts.render();
      document.querySelectorAll("[data-lang-label]").forEach((el) => (el.textContent = Menu.t.lang));
      Menu.spy();
    },

    frame() {
      const style = document.createElement("style");
      style.textContent = `
        html.m-desktop, html.m-desktop body { margin: 0 !important; padding: 0 !important; height: 100% !important; overflow: hidden !important; background: #e8e6e1 !important; }
        html.m-desktop body > :not(.m-device-wrap) { display: none !important; }
        .m-device-wrap { position: fixed; inset: 0; display: grid; place-items: center; gap: 14px; align-content: center; font: 500 14px system-ui, sans-serif; color: #444; }
        .m-device { width: 390px; height: min(844px, calc(100vh - 90px)); border: 12px solid #111; border-radius: 48px; overflow: hidden; background: #fff; box-shadow: 0 30px 80px rgba(0,0,0,.25); }
        .m-device iframe { width: 100%; height: 100%; border: 0; display: block; }
        .m-device-wrap a { color: #444; }`;
      document.head.append(style);
      document.documentElement.classList.add("m-desktop");
      const wrap = document.createElement("div");
      wrap.className = "m-device-wrap";
      const full = new URL(location.href); full.searchParams.set("full", "");
      wrap.innerHTML = `<div class="m-device"><iframe src="${Menu.esc(location.href)}" title="Menu"></iframe></div><span><a href="../">← Templates</a> · <a href="${Menu.esc(full.href)}">Open full width</a></span>`;
      document.body.append(wrap);
    },

    async start(o) {
      if (FRAMED) return Menu.frame();
      opts = o;
      // A light press effect on every tappable dish.
      const press = document.createElement("style");
      press.textContent = "[data-item]{transition:transform .15s ease}[data-item]:active{transform:scale(.97)}@media (prefers-reduced-motion:reduce){[data-item]{transition:none}[data-item]:active{transform:none}}";
      document.head.append(press);
      Menu.data = await (await fetch(new URL("templates/menu.json", ROOT))).json();
      Menu.info = Menu.data.info;
      const saved = store.get();
      Menu.lang = saved || ((navigator.language || "").toLowerCase().startsWith("pt") ? "pt" : "en");
      Menu.t = STRINGS[Menu.lang];
      document.documentElement.lang = Menu.lang;
      const route = () => {
        Menu.section = Menu.data.sections.find((s) => s.id === location.hash.slice(1)) || Menu.data.sections[0];
        Menu.render();
        // Switching section keeps the navigation in view instead of jumping back to the top of the page.
        const top = document.querySelector("[data-top]");
        if (!firstRoute && top && window.scrollY > top.offsetTop) window.scrollTo(0, top.offsetTop);
        firstRoute = false;
        document.querySelectorAll('[data-section][aria-current="true"]').forEach((b) => { const row = b.parentElement; row.scrollTo?.({ left: b.offsetLeft - (row.clientWidth - b.offsetWidth) / 2 }); });
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
        const cat = e.target.closest("[data-cat]");
        if (cat) Menu.jump(cat.dataset.cat);
      });
      window.addEventListener("scroll", () => requestAnimationFrame(Menu.spy), { passive: true });
      window.addEventListener("hashchange", route);
      route();
    },
  };
  window.Menu = Menu;
})();

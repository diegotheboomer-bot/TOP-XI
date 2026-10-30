// Opening hours from the original site, Sunday = 0.
const HOURS = [
  ["10:00", "22:00"], ["10:00", "22:00"], ["10:00", "22:00"], ["10:00", "22:00"],
  ["10:00", "22:00"], ["10:00", "22:30"], ["10:00", "22:30"],
];
const LABELS = { new: "Novo", recommended: "Recomendado" };

const $ = (sel) => document.querySelector(sel);
const euro = new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" });
const esc = (s) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

let menu, current, observer;

function openStatus() {
  // The restaurant is in Portimão; Lisbon time applies.
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Lisbon" }));
  const [from, till] = HOURS[now.getDay()];
  const hm = now.toTimeString().slice(0, 5);
  const open = hm >= from && hm < till;
  const el = $("#open-status");
  el.textContent = open ? `Aberto · fecha às ${till}` : `Fechado · abre às ${from}`;
  el.classList.toggle("open", open);
}

function itemCard(item) {
  const badges = [
    ...item.labels.map((l) => `<span class="badge ${esc(l)}">${esc(LABELS[l] || l)}</span>`),
    item.soldOut ? `<span class="badge sold">Esgotado</span>` : "",
  ].join("");
  const cls = ["item", item.soldOut && "sold-out", !item.img && "no-img"].filter(Boolean).join(" ");
  return `
    <button class="${cls}" data-item='${esc(JSON.stringify(item))}'>
      ${item.img ? `<img src="${esc(item.img)}" alt="" loading="lazy">` : ""}
      <span class="text">
        <strong class="name">${esc(item.name)}</strong>
        ${item.desc ? `<span class="desc">${esc(item.desc)}</span>` : ""}
        <span class="row">
          <span class="price">${euro.format(item.price)}${item.volume ? ` <span class="vol">· ${esc(item.volume)}</span>` : ""}</span>
          ${badges}
        </span>
      </span>
    </button>`;
}

function renderTabs() {
  $("#tabs").innerHTML = menu.sections
    .map((s) => `<button class="tab" role="tab" data-id="${s.id}" aria-selected="${s.id === current.id}">${esc(s.name)}</button>`)
    .join("");
}

function render() {
  const q = $("#search").value.trim().toLowerCase();
  const sections = q ? menu.sections : [current];
  let html = "";

  for (const s of sections) {
    if (!q) {
      if (s.desc) html += `<p class="section-desc">${esc(s.desc)}</p>`;
      if (s.info) html += `<div class="info">${esc(s.info)}</div>`;
    }
    for (const c of s.categories) {
      const items = c.items.filter((i) => !q || (i.name + " " + i.desc).toLowerCase().includes(q));
      if (!items.length) continue;
      html += `
        <section class="category" id="${s.id}--${c.id}">
          <h2>${esc(c.name.toLowerCase())}${q ? `<small>${esc(s.name.toLowerCase())}</small>` : ""}</h2>
          <div class="grid">${items.map(itemCard).join("")}</div>
        </section>`;
    }
  }

  if (!html) html = `<p class="empty">${q ? "Nenhum resultado." : "Sem itens nesta secção."}</p>`;
  $("#content").innerHTML = html;

  const cats = q ? [] : current.categories.filter((c) => c.items.length);
  $("#chips").innerHTML = cats.length > 1
    ? cats.map((c) => `<a class="chip" href="#${current.id}/${c.id}" data-target="${current.id}--${c.id}">${esc(c.name.toLowerCase())}</a>`).join("")
    : "";
  spyOnCategories();
}

// Highlight the chip for the category currently in view.
function spyOnCategories() {
  observer?.disconnect();
  const chips = [...document.querySelectorAll(".chip")];
  if (!chips.length) return;
  chips[0].classList.add("active");
  observer = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      chips.forEach((c) => {
        const on = c.dataset.target === e.target.id;
        c.classList.toggle("active", on);
        if (on) c.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
      });
    }
  }, { rootMargin: "-140px 0px -65% 0px" });
  document.querySelectorAll(".category").forEach((el) => observer.observe(el));
}

// URLs mirror the original: #brunch/ovos-mais
function route() {
  const [sec, cat] = location.hash.slice(1).split("/");
  const next = menu.sections.find((s) => s.id === sec) || menu.sections[0];
  if (next !== current) {
    current = next;
    $("#search").value = "";
    renderTabs();
    render();
  }
  const target = cat && document.getElementById(`${current.id}--${cat}`);
  if (target) target.scrollIntoView();
  else if (!cat) window.scrollTo({ top: 0 });
}

function showDish(item) {
  if (!item.img) return;
  const d = $("#dish");
  d.querySelector("img").src = item.imgBig || item.img;
  d.querySelector("h2").textContent = item.name;
  d.querySelector(".desc").textContent = item.desc;
  d.querySelector(".price").textContent = euro.format(item.price) + (item.soldOut ? " · Esgotado" : "");
  d.showModal();
}

$("#tabs").addEventListener("click", (e) => {
  const tab = e.target.closest(".tab");
  if (tab) location.hash = tab.dataset.id;
});
$("#content").addEventListener("click", (e) => {
  const card = e.target.closest(".item");
  if (card) showDish(JSON.parse(card.dataset.item));
});
$("#search").addEventListener("input", render);
$("#dish").addEventListener("click", (e) => {
  if (e.target === e.currentTarget || e.target.closest(".close")) e.currentTarget.close();
});
window.addEventListener("hashchange", route);

fetch("menu.json")
  .then((r) => r.json())
  .then((data) => {
    menu = data;
    openStatus();
    setInterval(openStatus, 60_000);
    route();
  });

// Data menu (harga dalam ribuan rupiah). [nama, M, L] atau [nama, harga]
let MENU = [
  { c: "Ice Drink", i: [["Milo",10,12],["Taro",10,15],["Coklat",10,12],["Milk Oreo",10,15],["Brown Sugar",10,15]] },
  { c: "Choco Series", i: [["Choco (biskuit/caramel/hazelnut)",10,15],["Taro",10,15],["Nutella",15,18]] },
  { c: "Coffee Series", i: [["Moccachino",10,15],["Ice Kopi Susu",15,18],["Ice Kopi Gula Aren",15,18]] },
  { c: "Tea Series", i: [["Thai Tea",10,12],["Green Tea",10,12],["Lemon",10,12],["Cheese Tea",10,12]] },
  { c: "Hot Drink", i: [["Kopi Susu",10],["Kopi Hitam",10],["Coklat",10]] },
  { c: "Topping", i: [["Oreo",2],["Regal",2],["Boba",2],["Cincau",2],["Cheese Cream",2]] },
  { c: "Snacks", i: [["French Fries",15],["Croissant",15],["Sandwich",15],["Beef Toast",15]] },
];
const $ = (s) => document.querySelector(s);
const rp = (k) => "Rp" + (k * 1000).toLocaleString("id-ID");
let tab = "Semua", query = "";
const cart = new Map();

/* ---------- Menu ---------- */
function renderTabs() {
  $("#tabs").innerHTML = ["Semua", ...MENU.map((m) => m.c)]
    .map((t) => `<button class="${t === tab ? "on" : ""}" data-tab="${t}">${t}</button>`).join("");
}
function renderMenu() {
  let html = "", n = 0;
  MENU.forEach((m) => {
    if (tab !== "Semua" && tab !== m.c) return;
    m.i.forEach(([name, a, b, id]) => {
      if (query && !(name + " " + m.c).toLowerCase().includes(query)) return;
      n++;
      const btns = b
        ? `<button data-add="${name}|M|${a}|${m.c}|${id || ""}">M · ${rp(a)}</button><button data-add="${name}|L|${b}|${m.c}|${id || ""}">L · ${rp(b)}</button>`
        : `<button data-add="${name}||${a}|${m.c}|${id || ""}">+ ${rp(a)}</button>`;
      html += `<div class="item reveal in"><small>${m.c}</small><h4>${name}</h4><div class="opts">${btns}</div></div>`;
    });
  });
  $("#menu-grid").innerHTML = html;
  $("#empty").hidden = n > 0;
}
$("#tabs").onclick = (e) => {
  const t = e.target.closest("[data-tab]");
  if (!t) return;
  tab = t.dataset.tab; renderTabs(); renderMenu();
};

/* ---------- Keranjang ---------- */
function toast(msg) {
  const t = $("#toast"); t.textContent = msg; t.classList.add("show");
  clearTimeout(toast.id); toast.id = setTimeout(() => t.classList.remove("show"), 1800);
}
function renderCart() {
  let total = 0, count = 0;
  $("#cart-list").innerHTML = [...cart.entries()].map(([k, it]) => {
    total += it.p * it.q; count += it.q;
    return `<li><span>${it.n}${it.s ? " (" + it.s + ")" : ""}<br><small>${rp(it.p)}</small></span>
      <span class="q"><button data-q="${k}|-1">−</button>${it.q}<button data-q="${k}|1">+</button></span></li>`;
  }).join("") || '<li style="color:#aaa">Keranjang masih kosong.</li>';
  $("#total").textContent = rp(total);
  $("#cart-count").textContent = count;
}
$("#menu-grid").onclick = (e) => {
  const b = e.target.closest("[data-add]");
  if (!b) return;
  const [n, s, p, c, id] = b.dataset.add.split("|");
  const k = c + n + s; // kunci unik (ada nama sama di kategori berbeda, mis. Taro)
  const it = cart.get(k) || { n, s, p: +p, id: +id || 0, q: 0 };
  it.q++; cart.set(k, it); renderCart(); toast(n + (s ? " (" + s + ")" : "") + " ditambahkan");
};
$("#cart-list").onclick = (e) => {
  const b = e.target.closest("[data-q]");
  if (!b) return;
  const [k, d] = b.dataset.q.split("|"), it = cart.get(k);
  it.q += +d; if (it.q <= 0) cart.delete(k); renderCart();
};
$("#clear-cart").onclick = () => { cart.clear(); renderCart(); };
const WA = "6285765658888";
const openWA = (text) => window.open("https://wa.me/" + WA + "?text=" + encodeURIComponent(text), "_blank", "noopener");
$("#wa-order").onclick = async () => {
  if (!cart.size) return toast("Keranjang masih kosong");
  const nama = $("#buyer").value.trim();
  if (!nama) { $("#buyer").focus(); return toast("Isi nama pemesan dulu ya"); }
  const items = [...cart.values()];
  let code = "";
  if (items.every((i) => i.id)) { // simpan pesanan ke database lewat API; kalau server mati, tetap lanjut ke WhatsApp
    try {
      const r = await fetch("/api/orders", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ buyer: nama, items: items.map((i) => ({ id: i.id, size: i.s, qty: i.q })) }) });
      const d = await r.json();
      if (!r.ok) return toast(d.error || "Pesanan gagal disimpan");
      code = d.code;
    } catch {}
  }
  const lines = items.map((i) => `- ${i.q}x ${i.n}${i.s ? " (" + i.s + ")" : ""} = ${rp(i.p * i.q)}`);
  openWA(`Halo KopiKita, saya mau pesan:\n${lines.join("\n")}\n\nTotal: ${$("#total").textContent}\nNama: ${nama}${code ? "\nKode pesanan: " + code : ""}`);
  cart.clear(); renderCart(); $("#drawer").classList.remove("open");
};
$("#cart-btn").onclick = () => $("#drawer").classList.add("open");
$("#close-cart").onclick = () => $("#drawer").classList.remove("open");

/* ---------- Navbar & pencarian ---------- */
$("#burger").onclick = () => $("#nav-links").classList.toggle("open");
$("#nav-links").onclick = (e) => e.target.matches("a") && $("#nav-links").classList.remove("open");
$("#search-btn").onclick = () => { $("#search-bar").classList.toggle("open"); $("#search-box").focus(); };
$("#search-box").oninput = (e) => {
  query = e.target.value.trim().toLowerCase();
  tab = "Semua"; renderTabs(); renderMenu();
  if (query) $("#menu").scrollIntoView();
};
document.addEventListener("click", (e) => {
  if (!e.target.closest(".navbar")) $("#search-bar").classList.remove("open");
  if (!e.target.closest("#drawer, #cart-btn, .item")) $("#drawer").classList.remove("open");
});

/* ---------- Lightbox menu cetak ---------- */
document.querySelectorAll("[data-zoom]").forEach((img) => {
  img.onclick = () => { const l = $("#lightbox"); l.querySelector("img").src = img.src; l.classList.add("open"); };
});
$("#lightbox").onclick = () => $("#lightbox").classList.remove("open");

/* ---------- Form kontak (validasi sisi klien) ---------- */
$("#form").onsubmit = (e) => {
  e.preventDefault();
  const f = e.target, msg = $("#form-msg");
  if (!f.nama.value.trim() || !f.pesan.value.trim() || !f.email.validity.valid || !f.email.value) {
    msg.style.color = "#ff8a80"; msg.textContent = "Lengkapi nama, email yang valid, dan pesan ya."; return;
  }
  msg.style.color = "#9be7a5"; msg.textContent = "Membuka WhatsApp...";
  openWA(`Halo KopiKita, saya ${f.nama.value.trim()} (${f.email.value.trim()}).\n${f.pesan.value.trim()}`);
  f.reset();
};

/* ---------- Animasi muncul saat scroll ---------- */
const io = new IntersectionObserver((es) => es.forEach((x) => x.isIntersecting && (x.target.classList.add("in"), io.unobserve(x.target))), { threshold: 0.15 });
document.querySelectorAll(".reveal").forEach((el) => io.observe(el));

renderTabs(); renderMenu(); renderCart(); feather.replace();
// Ambil menu terbaru dari database; kalau API tidak ada (mis. hosting statis), pakai data bawaan di atas
fetch("/api/menu").then((r) => r.ok ? r.json() : Promise.reject()).then((d) => { MENU = d; renderTabs(); renderMenu(); }).catch(() => {});

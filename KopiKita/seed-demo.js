// Mengisi database dengan DATA CONTOH (demo) supaya dashboard admin tidak kosong.
// Semua pesanan berkode "DEMO-xxxx" dan nama pemesannya fiktif. Bukan transaksi asli.
// Pakai:  node seed-demo.js           -> tambah data contoh
//         node seed-demo.js --reset   -> hapus data contoh saja (pesanan asli aman)
const path = require("path");
const { DatabaseSync } = require("node:sqlite");
const db = new DatabaseSync(process.env.DB_PATH || path.join(__dirname, "kopikita.db"));

db.exec("DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE code LIKE 'DEMO-%'); DELETE FROM orders WHERE code LIKE 'DEMO-%';");
if (process.argv.includes("--reset")) { console.log("Data contoh dihapus."); process.exit(); }

const menu = db.prepare("SELECT * FROM menu").all();
if (!menu.length) { console.log("Menu kosong. Jalankan server sekali (npm start) dulu, lalu ulangi."); process.exit(1); }
const drinks = menu.filter((m) => !["Topping"].includes(m.category));
const toppings = menu.filter((m) => m.category === "Topping");

let seed = 7; const rnd = (n) => (seed = (seed * 16807) % 2147483647) % n; // acak tetap (selalu sama)
const names = ["Aulia","Rizky","Dinda","Fajar","Nabila","Bagas","Salsa","Dimas","Putri","Raka","Ayu","Yoga","Intan","Farhan","Zahra","Arga","Mita","Rafi","Citra","Haikal","Nanda","Bima","Laras","Reza","Tika","Galih","Sinta","Fikri"];
const days = ["2025-08-25","2025-08-26","2025-08-27","2025-08-28"];
const ordO = db.prepare("INSERT INTO orders(code,buyer,total,status,created_at) VALUES(?,?,?,?,?)");
const ordI = db.prepare("INSERT INTO order_items(order_id,menu_id,name,size,price,qty) VALUES(?,?,?,?,?,?)");

db.exec("BEGIN");
names.forEach((n, i) => {
  const lines = []; let total = 0;
  for (let k = 0, c = 1 + rnd(3); k < c; k++) {
    const m = drinks[rnd(drinks.length)], size = m.price_l && rnd(2) ? "L" : m.price_l ? "M" : "";
    const price = size === "L" ? m.price_l : m.price_m, qty = 1 + (rnd(4) === 0);
    lines.push([m.id, m.name, size, price, qty]); total += price * qty;
    if (m.category.includes("Drink") || m.category.includes("Series")) if (rnd(3) === 0) { const t = toppings[rnd(toppings.length)]; lines.push([t.id, t.name, "", t.price_m, 1]); total += t.price_m; }
  }
  const day = days[Math.floor(i / 7)], jam = String(9 + rnd(8)).padStart(2, "0"), mnt = String(rnd(60)).padStart(2, "0");
  const status = i === 11 ? "batal" : "selesai";
  const { lastInsertRowid: id } = ordO.run("DEMO-" + String(i + 1).padStart(4, "0"), n + " (Maba)", total, status, `${day} ${jam}:${mnt}:00`);
  lines.forEach((l) => ordI.run(id, ...l));
});
db.exec("COMMIT");
console.log(names.length + " pesanan contoh ditambahkan (kode DEMO-xxxx). Buka /admin.html lalu klik Masuk.");

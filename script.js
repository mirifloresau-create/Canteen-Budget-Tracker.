/* ---------- Settings ---------- */
const USERS = { mark: "1234", staff: "1234" };
const KEY = "canteenTracker.v1";
const peso = n => (n < 0 ? "₱-" : "₱") + Math.abs(n).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const today = () => new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

/* ---------- State ---------- */
const DEFAULT_PRODUCTS = [
  { name: "Chicken meal", cost: 35, price: 50 },
  { name: "Rice meal",    cost: 30, price: 45 },
  { name: "Drinks",       cost: 12, price: 20 },
  { name: "Snack",        cost: 15, price: 25 }
];
let stored = null;
try { stored = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) { stored = null; }
let db = stored || { loggedIn: false, capital: 100, nextId: 1 };
db.queue    = db.queue    || [];
db.sales    = db.sales    || [];
db.history  = db.history  || [];
db.expenses = db.expenses || [];
db.products = db.products || DEFAULT_PRODUCTS;
if (typeof db.capital !== "number") db.capital = 100;
if (!db.nextId) db.nextId = 1;
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) {} };

let tab = "home", search = "", sortMode = "queue";

const total = () => db.sales.reduce((s, x) => s + x.qty * x.price, 0);
const productProfit = () => db.sales.reduce((s, x) => s + x.qty * (x.price - (x.cost || 0)), 0);
const totalExpenses = () => db.expenses.reduce((s, x) => s + x.amount, 0);
const profit = () => productProfit() - totalExpenses();
const tone = n => (n < 0 ? "bad" : "good");   // add .bad { color:#b00020 } in your CSS

/* ---------- Helpers ---------- */
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function itemRow(t, front) {
  return '<div class="item ' + (t.status === "Served" ? "served" : "") + " " + (front ? "front" : "") + '">' +
    "<span>" + t.id + " " + esc(t.name) + "</span><span>x" + t.qty + "</span>" +
    "<span>" + peso(t.qty * t.price) + "</span><span>" + t.status + "</span></div>";
}

/* ---------- Views ---------- */
function render() {
  $("#login").classList.toggle("hidden", db.loggedIn);
  $("#main").classList.toggle("hidden", !db.loggedIn);
  if (!db.loggedIn) return;
  document.querySelectorAll("#nav button").forEach(b => b.classList.toggle("on", b.dataset.tab === tab));
  ({ home: viewHome, sale: viewSale, queue: viewQueue, products: viewProducts, report: viewReport })[tab]();
}

function viewHome() {
  const recent = [...db.queue].reverse().slice(0, 3);
  let recentHtml = '<p class="sub">No sales yet. Record one in the Sale tab.</p>';
  if (recent.length) recentHtml = recent.map(t => itemRow(t)).join("");
  $("#view").innerHTML =
    "<h2>Good Day</h2>" +
    '<div class="grid">' +
      '<div class="stat">Starting capital<b>' + peso(db.capital) + "</b></div>" +
      '<div class="stat">Total sales<b>' + peso(total()) + "</b></div>" +
      '<div class="stat wide">Product profit<b>' + peso(productProfit()) + "</b></div>" +
      '<div class="stat">Expenses<b>' + peso(totalExpenses()) + "</b></div>" +
      '<div class="stat">Net profit<b class="' + tone(profit()) + '">' + peso(profit()) + "</b></div>" +
    "</div>" +
    '<label for="cap">Set starting capital</label>' +
    '<div class="row">' +
      '<input id="cap" type="number" min="0" step="any" placeholder="' + db.capital + '">' +
      '<button class="btn small" id="setCap">Set</button>' +
    "</div>" +
    '<div class="list-title">Recent transactions</div>' + recentHtml;
  $("#setCap").onclick = () => {
    const v = parseFloat($("#cap").value);
    if (isNaN(v) || v < 0) return alert("Enter a starting capital of 0 or more.");
    db.capital = v; save(); render();
  };
}

function viewSale() {
  const options = db.products.map(p => '<option value="' + esc(p.name) + '">').join("");
  $("#view").innerHTML =
    "<h2>Record sale</h2>" +
    '<label for="item">Item name</label>' +
    '<input id="item" list="plist" placeholder="Chicken meal">' +
    '<datalist id="plist">' + options + "</datalist>" +
    '<div class="two">' +
      '<div><label for="qty">Quantity</label><input id="qty" type="number" min="1" value="1"></div>' +
      '<div><label for="price">Price per item</label><input id="price" type="number" min="0" step="any" placeholder="50"></div>' +
    "</div>" +
    '<label for="cost">Cost per item</label>' +
    '<input id="cost" type="number" min="0" step="any" placeholder="35">' +
    '<p class="note" id="liveProfit" style="margin:10px 0 0"></p>' +
    '<label for="notes">Notes (optional)</label>' +
    '<input id="notes" placeholder="Lunch order">' +
    '<div class="err" id="saleErr"></div>' +
    '<button class="btn" id="addSale">Add to queue</button>';

  const live = () => {
    const q = parseInt($("#qty").value, 10) || 0;
    const pr = parseFloat($("#price").value);
    const c = parseFloat($("#cost").value) || 0;
    if (isNaN(pr)) { $("#liveProfit").innerHTML = ""; return; }
    $("#liveProfit").innerHTML = 'Profit on this sale: <span class="' + tone(q * (pr - c)) + '">' +
      peso(q * (pr - c)) + "</span> (" + peso(pr - c) + " each)";
  };
  $("#item").addEventListener("input", () => {
    const p = db.products.find(x => x.name.toLowerCase() === $("#item").value.trim().toLowerCase());
    if (p) { $("#price").value = p.price; $("#cost").value = p.cost; }
    live();
  });
  ["qty", "price", "cost"].forEach(id => $("#" + id).addEventListener("input", live));

  $("#addSale").onclick = () => {
    const name = $("#item").value.trim();
    const qty = parseInt($("#qty").value, 10);
    const price = parseFloat($("#price").value);
    const cost = parseFloat($("#cost").value) || 0;
    if (!name) return ($("#saleErr").textContent = "Enter an item name.");
    if (!(qty >= 1)) return ($("#saleErr").textContent = "Quantity must be at least 1.");
    if (isNaN(price) || price < 0) return ($("#saleErr").textContent = "Enter a price per item.");
    if (cost < 0) return ($("#saleErr").textContent = "Cost cannot be negative.");
    const sale = { id: db.nextId++, name, qty, price, cost, notes: $("#notes").value.trim() };
    db.queue.push({ ...sale, status: "Waiting" });   // separate copies, safe after reload
    db.sales.push(sale);
    save(); tab = "queue"; render();
  };
}

function viewQueue() {
  let list = db.queue.filter(t => t.name.toLowerCase().includes(search.toLowerCase()));
  const labels = { queue: "queue order", name: "name", price: "price" };
  if (sortMode === "name") list = [...list].sort((a, b) => a.name.localeCompare(b.name));
  if (sortMode === "price") list = [...list].sort((a, b) => b.qty * b.price - a.qty * a.price);
  const front = db.queue.find(t => t.status === "Waiting");
  const frontId = front ? front.id : null;
  let listHtml = '<p class="sub">Nothing in the queue.</p>';
  if (list.length) listHtml = list.map(t => itemRow(t, t.id === frontId)).join("");
  $("#view").innerHTML =
    "<h2>Transaction queue (FIFO)</h2>" +
    '<p class="sub">Oldest sale stays at the front. New sales join the end.</p>' +
    '<div class="row">' +
      '<input id="search" placeholder="Search item" value="' + esc(search) + '">' +
      '<button class="btn small" id="sort" style="padding:0 18px;font-size:18px">Sort: ' + labels[sortMode] + "</button>" +
    "</div>" +
    '<div style="margin-top:14px">' + listHtml + "</div>" +
    '<button class="btn" id="serve" style="margin-top:6px">Serve front of queue</button>';
  const s = $("#search");
  s.oninput = () => {
    search = s.value;
    const p = s.selectionStart;
    viewQueue();
    $("#search").focus();
    $("#search").setSelectionRange(p, p);
  };
  $("#sort").onclick = () => {
    sortMode = sortMode === "queue" ? "name" : sortMode === "name" ? "price" : "queue";
    viewQueue();
  };
  $("#serve").onclick = () => {
    const f = db.queue.find(t => t.status === "Waiting");
    if (!f) return alert("No one is waiting.");
    f.status = "Served"; save(); viewQueue();
  };
}

function productCard(p) {
  const margin = p.price ? Math.round((p.price - p.cost) / p.price * 100) : 0;
  return '<div class="prod">' +
    '<div class="top"><span>' + esc(p.name) + '</span><span class="' + tone(p.price - p.cost) + '">' + peso(p.price - p.cost) + " profit</span></div>" +
    '<div class="sub2"><span>Cost ' + peso(p.cost) + " · Price " + peso(p.price) + " · " + margin + '% margin</span>' +
    '<button class="del" data-name="' + esc(p.name) + '">Delete</button></div></div>';
}

function viewProducts() {
  let cards = '<p class="sub">No products yet. Add one below.</p>';
  if (db.products.length) cards = db.products.map(productCard).join("");
  $("#view").innerHTML =
    "<h2>Products</h2>" +
    '<p class="sub">Profit per item = selling price - cost.</p>' + cards +
    '<div class="list-title" style="margin-top:24px">Add or update a product</div>' +
    '<label for="pname">Product name</label>' +
    '<input id="pname" placeholder="Chicken meal">' +
    '<div class="two">' +
      '<div><label for="pcost">Cost</label><input id="pcost" type="number" min="0" step="any" placeholder="35"></div>' +
      '<div><label for="pprice">Selling price</label><input id="pprice" type="number" min="0" step="any" placeholder="50"></div>' +
    "</div>" +
    '<div class="err" id="pErr"></div>' +
    '<button class="btn" id="saveProd">Save product</button>';
  document.querySelectorAll(".del").forEach(b => b.onclick = () => {
    db.products = db.products.filter(p => p.name !== b.dataset.name);
    save(); viewProducts();
  });
  $("#saveProd").onclick = () => {
    const name = $("#pname").value.trim(), cost = parseFloat($("#pcost").value), price = parseFloat($("#pprice").value);
    if (!name) return ($("#pErr").textContent = "Enter a product name.");
    if (isNaN(cost) || cost < 0 || isNaN(price) || price < 0) return ($("#pErr").textContent = "Enter a cost and a selling price.");
    const old = db.products.find(x => x.name.toLowerCase() === name.toLowerCase());
    if (old) { old.cost = cost; old.price = price; } else db.products.push({ name, cost, price });
    save(); viewProducts();
  };
}

function viewReport() {
  let hist = '<p class="sub">No finalized days yet.</p>';
  if (db.history.length) {
    hist = db.history.slice(0, 30).map(h =>
      '<div class="rep" style="font-size:18px"><span>' + esc(h.date) + "</span><span>Net profit " + peso(h.profit || 0) + "</span></div>"
    ).join("");
  }
  let exp = '<p class="sub">No expenses yet.</p>';
  if (db.expenses.length) {
    exp = db.expenses.map((x, i) =>
      '<div class="rep" style="font-size:18px"><span>' + esc(x.name) + "</span><span>" + peso(x.amount) + "</span>" +
      '<button class="delExp" data-i="' + i + '" style="border:0;background:none;color:#b00020;font-size:16px;cursor:pointer">Delete</button></div>'
    ).join("");
  }
  $("#view").innerHTML =
    "<h2>Daily financial report</h2>" +
    '<div class="rep"><span>Date</span><span>' + today() + "</span></div>" +
    '<div class="rep"><span>Starting capital</span><span>' + peso(db.capital) + "</span></div>" +
    '<div class="rep"><span>Total sales</span><span>' + peso(total()) + "</span></div>" +
    '<div class="rep"><span>Product profit</span><span class="' + tone(productProfit()) + '">' + peso(productProfit()) + "</span></div>" +
    '<div class="rep"><span>Expenses</span><span>-' + peso(totalExpenses()) + "</span></div>" +
    '<div class="rep"><span>Net profit</span><span class="' + tone(profit()) + '">' + peso(profit()) + "</span></div>" +
    '<div class="list-title" style="margin-top:20px">Add expense</div>' +
    '<label for="ename">Expense name</label>' +
    '<input id="ename" placeholder="Gas">' +
    '<label for="eamount">Amount</label>' +
    '<input id="eamount" type="number" min="0" step="any" placeholder="20">' +
    '<div class="err" id="eErr"></div>' +
    '<button class="btn" id="addExp" style="margin-top:10px">Add expense</button>' +
    '<div class="list-title" style="margin-top:20px">Today\'s expenses</div>' + exp +
    '<button class="btn" id="final" style="margin-top:6px">Finalize day</button>' +
    '<p class="note">Product profit = total sales - cost of items sold<br>Net profit = product profit - expenses</p>' +
    '<div class="list-title" style="margin-top:20px">History (30 days)</div>' + hist;

  $("#addExp").onclick = () => {
    const name = $("#ename").value.trim(), amount = parseFloat($("#eamount").value);
    if (!name) return ($("#eErr").textContent = "Enter an expense name.");
    if (isNaN(amount) || amount <= 0) return ($("#eErr").textContent = "Enter an amount greater than 0.");
    db.expenses.push({ name, amount });
    save(); viewReport();
  };
  document.querySelectorAll(".delExp").forEach(b => b.onclick = () => {
    db.expenses.splice(+b.dataset.i, 1); save(); viewReport();
  });
  $("#final").onclick = () => {
    if (!db.sales.length && !confirm("No sales today. Finalize anyway?")) return;
    if (db.queue.some(t => t.status === "Waiting") && !confirm("Some orders are still waiting. Finalize anyway?")) return;
    db.history.unshift({ date: today(), capital: db.capital, sales: total(), productProfit: productProfit(), expenses: totalExpenses(), profit: profit() });
    db.queue = []; db.sales = []; db.expenses = []; db.nextId = 1;
    save(); render();
  };
}

/* ---------- Events ---------- */
$("#loginBtn").onclick = () => {
  const u = $("#user").value.trim().toLowerCase(), p = $("#pass").value;
  if (USERS[u] && USERS[u] === p) { db.loggedIn = true; $("#loginErr").textContent = ""; save(); tab = "home"; render(); }
  else $("#loginErr").textContent = "Wrong username or password.";
};
$("#pass").addEventListener("keydown", e => e.key === "Enter" && $("#loginBtn").click());
$("#logout").onclick = () => { db.loggedIn = false; save(); $("#pass").value = ""; render(); };
document.querySelectorAll("#nav button").forEach(b => b.onclick = () => { tab = b.dataset.tab; render(); });

render();
/* ================= CONSTANTS ================= */
const DEFAULT_CATEGORIES = ["Food","Shopping","Transport","Bills","Entertainment","Health","Salary","Freelancing","Other"];
const KEYS = {
  transactions: "pfd_transactions",
  theme: "pfd_theme",
  user: "pfd_user",
  customCategories: "pfd_custom_categories",
  currency: "pfd_currency",
};

let transactions = [];
let editingId = null;
let pieChart = null;
let barChart = null;
let trendChart = null;

/* ================= STORAGE HELPERS ================= */
function loadTransactions() {
  try {
    const raw = localStorage.getItem(KEYS.transactions);
    return raw ? JSON.parse(raw) : seedData();
  } catch (e) { console.error(e); return []; }
}
function saveTransactions() {
  try { localStorage.setItem(KEYS.transactions, JSON.stringify(transactions)); }
  catch (e) { console.error(e); showToast("Couldn't save data locally.", "danger"); }
}
function seedData() {
  const today = new Date();
  const iso = (d) => d.toISOString().slice(0, 10);
  return [
    { id: crypto.randomUUID(), type: "income", description: "Monthly Salary", category: "Salary", amount: 45000, date: iso(today) },
    { id: crypto.randomUUID(), type: "expense", description: "Groceries", category: "Food", amount: 2200, date: iso(today) },
    { id: crypto.randomUUID(), type: "expense", description: "Electricity Bill", category: "Bills", amount: 1400, date: iso(today) },
    { id: crypto.randomUUID(), type: "expense", description: "Movie Night", category: "Entertainment", amount: 600, date: iso(today) },
  ];
}

function getCustomCategories() {
  try { return JSON.parse(localStorage.getItem(KEYS.customCategories)) || []; }
  catch (e) { return []; }
}
function saveCustomCategories(list) {
  localStorage.setItem(KEYS.customCategories, JSON.stringify(list));
}
function getAllCategories() {
  return [...DEFAULT_CATEGORIES, ...getCustomCategories()];
}

function getCurrency() { return localStorage.getItem(KEYS.currency) || "₹"; }
function setCurrency(symbol) { localStorage.setItem(KEYS.currency, symbol); }

function getUser() {
  try { return JSON.parse(localStorage.getItem(KEYS.user)); }
  catch (e) { return null; }
}
function setUser(user) { localStorage.setItem(KEYS.user, JSON.stringify(user)); }
function clearUser() { localStorage.removeItem(KEYS.user); }

/* ================= INIT ================= */
document.addEventListener("DOMContentLoaded", () => {
  try {
    transactions = loadTransactions();
    applySavedTheme();
    initNavbar();
    bindGlobalEvents();
  } catch (err) {
    console.error("Core init failed:", err);
  }

  const page = document.body.dataset.page;
  try {
    if (page === "login") initLoginPage();
    if (page === "dashboard") initDashboardPage();
    if (page === "transactions") initTransactionsPage();
    if (page === "analytics") initAnalyticsPage();
    if (page === "settings") initSettingsPage();
  } catch (err) {
    console.error(`Page init failed for "${page}":`, err);
  }
});

/* ================= NAVBAR (shared across pages) ================= */
function initNavbar() {
  const path = location.pathname.split("/").pop() || "dashboard.html";
  document.querySelectorAll(".navbar-nav .nav-link").forEach(link => {
    if (link.getAttribute("href") === path) link.classList.add("active");
  });

  const user = getUser();
  const greetingEl = document.getElementById("userGreeting");
  const loginLink = document.getElementById("loginLink");
  const logoutLink = document.getElementById("logoutLink");
  if (greetingEl) greetingEl.textContent = user?.name || "Guest";
  if (loginLink) loginLink.style.display = user ? "none" : "block";
  if (logoutLink) {
    logoutLink.style.display = user ? "block" : "none";
    logoutLink.addEventListener("click", (e) => {
      e.preventDefault();
      clearUser();
      showToast("Logged out.", "secondary");
      setTimeout(() => location.href = "login.html", 600);
    });
  }
}

function bindGlobalEvents() {
  const themeBtn = document.getElementById("themeToggle");
  if (themeBtn) themeBtn.addEventListener("click", toggleTheme);
}

/* ================= THEME ================= */
function applySavedTheme() {
  const saved = localStorage.getItem(KEYS.theme) || "light";
  document.documentElement.setAttribute("data-bs-theme", saved);
  updateThemeIcon(saved);
}
function toggleTheme() {
  const current = document.documentElement.getAttribute("data-bs-theme");
  const next = current === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-bs-theme", next);
  localStorage.setItem(KEYS.theme, next);
  updateThemeIcon(next);
}
function updateThemeIcon(theme) {
  document.querySelectorAll("#themeToggle i").forEach(icon => {
    icon.className = theme === "dark" ? "bi bi-sun-fill" : "bi bi-moon-stars-fill";
  });
}

/* ================= LOGIN PAGE ================= */
function initLoginPage() {
  const form = document.getElementById("loginForm");
  const guestBtn = document.getElementById("guestBtn");

  if (getUser()) { location.href = "dashboard.html"; return; }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = document.getElementById("loginName").value.trim();
    if (!name) return;
    setUser({ name });
    location.href = "dashboard.html";
  });

  guestBtn.addEventListener("click", () => {
    clearUser();
    location.href = "dashboard.html";
  });
}

/* ================= CATEGORY DROPDOWNS ================= */
function populateCategorySelect(selectEl, includeAllOption = false) {
  if (!selectEl) return;
  selectEl.innerHTML = includeAllOption ? `<option value="all">All Categories</option>` : "";
  getAllCategories().forEach(cat => {
    selectEl.insertAdjacentHTML("beforeend", `<option value="${cat}">${cat}</option>`);
  });
}

/* ================= FORMAT ================= */
function fmt(n) {
  return getCurrency() + Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

/* ================= TRANSACTION CRUD (shared) ================= */
function bindTransactionForm() {
  const form = document.getElementById("transactionForm");
  if (!form) return;
  populateCategorySelect(document.getElementById("category"));
  document.getElementById("date").value = new Date().toISOString().slice(0, 10);
  form.addEventListener("submit", handleFormSubmit);
  const modalEl = document.getElementById("transactionModal");
  if (modalEl) modalEl.addEventListener("hidden.bs.modal", resetForm);
  const addBtn = document.getElementById("addTransactionBtn");
  if (addBtn) addBtn.addEventListener("click", () => openModal());
}

function handleFormSubmit(e) {
  e.preventDefault();
  const data = {
    type: document.querySelector('input[name="type"]:checked').value,
    description: document.getElementById("description").value.trim(),
    amount: parseFloat(document.getElementById("amount").value),
    date: document.getElementById("date").value,
    category: document.getElementById("category").value,
  };
  if (!data.description || isNaN(data.amount) || data.amount <= 0) {
    showToast("Please fill all fields correctly.", "danger");
    return;
  }
  if (editingId) {
    const idx = transactions.findIndex(t => t.id === editingId);
    transactions[idx] = { ...transactions[idx], ...data };
    showToast("Transaction updated.", "success");
  } else {
    transactions.push({ id: crypto.randomUUID(), ...data });
    showToast("Transaction added.", "success");
  }
  saveTransactions();
  refreshCurrentPage();
  bootstrap.Modal.getInstance(document.getElementById("transactionModal")).hide();
}

function openModal(transaction = null) {
  const modalTitle = document.getElementById("modalTitle");
  if (transaction) {
    editingId = transaction.id;
    modalTitle.textContent = "Edit Transaction";
    document.getElementById("description").value = transaction.description;
    document.getElementById("amount").value = transaction.amount;
    document.getElementById("date").value = transaction.date;
    document.getElementById("category").value = transaction.category;
    document.getElementById(transaction.type === "income" ? "typeIncome" : "typeExpense").checked = true;
  } else {
    editingId = null;
    modalTitle.textContent = "Add Transaction";
  }
  new bootstrap.Modal(document.getElementById("transactionModal")).show();
}

function deleteTransaction(id) {
  if (!confirm("Delete this transaction?")) return;
  transactions = transactions.filter(t => t.id !== id);
  saveTransactions();
  refreshCurrentPage();
  showToast("Transaction deleted.", "secondary");
}

function editTransactionById(id) {
  const t = transactions.find(t => t.id === id);
  if (t) openModal(t);
}

function resetForm() {
  const form = document.getElementById("transactionForm");
  if (!form) return;
  form.reset();
  document.getElementById("date").value = new Date().toISOString().slice(0, 10);
  editingId = null;
}

function refreshCurrentPage() {
  const page = document.body.dataset.page;
  if (page === "dashboard") renderDashboard();
  if (page === "transactions") renderTransactionsTable();
  if (page === "analytics") renderAnalytics();
}

/* ================= DASHBOARD PAGE ================= */
function initDashboardPage() {
  bindTransactionForm();
  renderDashboard();
}

function renderDashboard() {
  renderSummaryCards();
  renderMonthlySummary();
  renderChart("categoryPieChart", "pie");
  renderChart("monthlyBarChart", "bar");
  renderRecentTransactions();
}

function renderSummaryCards() {
  const income = transactions.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const expense = transactions.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const balance = income - expense;
  const savingsRate = income > 0 ? Math.round(((income - expense) / income) * 100) : 0;

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set("totalBalance", fmt(balance));
  set("totalIncome", fmt(income));
  set("totalExpenses", fmt(expense));
  set("totalSavings", savingsRate + "%");
}

function renderMonthlySummary() {
  const container = document.getElementById("monthlySummary");
  if (!container) return;
  const byMonth = groupByMonth();
  const months = Object.keys(byMonth).sort().reverse().slice(0, 4);
  if (months.length === 0) { container.innerHTML = `<p class="text-secondary mb-0">No data yet.</p>`; return; }
  container.innerHTML = months.map(m => {
    const { income, expense } = byMonth[m];
    const label = new Date(m + "-01").toLocaleDateString("en-US", { month: "short", year: "numeric" });
    return `<div class="col-6 col-md-3"><div class="month-chip">
      <div class="label">${label}</div>
      <div class="val amount-income">+${fmt(income)}</div>
      <div class="val amount-expense">-${fmt(expense)}</div>
    </div></div>`;
  }).join("");
}

function renderRecentTransactions() {
  const tbody = document.getElementById("recentTransactionsBody");
  if (!tbody) return;
  const recent = [...transactions].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);
  if (recent.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="text-center text-secondary py-4">No transactions yet.</td></tr>`;
    return;
  }
  tbody.innerHTML = recent.map(t => `
    <tr>
      <td>${new Date(t.date).toLocaleDateString("en-US", { day:"2-digit", month:"short" })}</td>
      <td>${escapeHtml(t.description)}</td>
      <td><span class="badge text-bg-secondary-subtle text-body badge-category">${t.category}</span></td>
      <td class="text-end ${t.type === 'income' ? 'amount-income' : 'amount-expense'}">${t.type === 'income' ? '+' : '-'}${fmt(t.amount)}</td>
    </tr>`).join("");
}

/* ================= TRANSACTIONS PAGE ================= */
function initTransactionsPage() {
  bindTransactionForm();
  populateCategorySelect(document.getElementById("categoryFilter"), true);
  ["searchInput","typeFilter","categoryFilter","sortOrder"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener(el.tagName === "SELECT" ? "change" : "input", renderTransactionsTable);
  });
  const exportBtn = document.getElementById("exportCsvBtn");
  if (exportBtn) exportBtn.addEventListener("click", exportCsv);
  renderTransactionsTable();
}

function getFilteredTransactions() {
  const search = (document.getElementById("searchInput")?.value || "").toLowerCase();
  const typeFilter = document.getElementById("typeFilter")?.value || "all";
  const categoryFilter = document.getElementById("categoryFilter")?.value || "all";
  const sortOrder = document.getElementById("sortOrder")?.value || "desc";

  let result = transactions.filter(t => {
    const matchesSearch = t.description.toLowerCase().includes(search) || t.category.toLowerCase().includes(search);
    const matchesType = typeFilter === "all" || t.type === typeFilter;
    const matchesCategory = categoryFilter === "all" || t.category === categoryFilter;
    return matchesSearch && matchesType && matchesCategory;
  });
  result.sort((a, b) => sortOrder === "asc" ? new Date(a.date) - new Date(b.date) : new Date(b.date) - new Date(a.date));
  return result;
}

function renderTransactionsTable() {
  const list = getFilteredTransactions();
  const tbody = document.getElementById("transactionsBody");
  const emptyState = document.getElementById("emptyState");
  if (!tbody) return;

  if (list.length === 0) {
    tbody.innerHTML = "";
    if (emptyState) emptyState.classList.remove("d-none");
    return;
  }
  if (emptyState) emptyState.classList.add("d-none");

  tbody.innerHTML = list.map(t => `
    <tr>
      <td>${new Date(t.date).toLocaleDateString("en-US", { day:"2-digit", month:"short", year:"numeric" })}</td>
      <td>${escapeHtml(t.description)}</td>
      <td><span class="badge text-bg-secondary-subtle text-body badge-category">${t.category}</span></td>
      <td><span class="badge ${t.type === 'income' ? 'text-bg-success-subtle text-success' : 'text-bg-danger-subtle text-danger'} text-capitalize">${t.type}</span></td>
      <td class="text-end ${t.type === 'income' ? 'amount-income' : 'amount-expense'}">${t.type === 'income' ? '+' : '-'}${fmt(t.amount)}</td>
      <td class="text-end">
        <button class="btn btn-sm btn-icon" onclick="editTransactionById('${t.id}')" title="Edit"><i class="bi bi-pencil"></i></button>
        <button class="btn btn-sm btn-icon text-danger" onclick="deleteTransaction('${t.id}')" title="Delete"><i class="bi bi-trash"></i></button>
      </td>
    </tr>`).join("");
}

function exportCsv() {
  if (transactions.length === 0) { showToast("No transactions to export.", "secondary"); return; }
  const header = ["Date", "Description", "Category", "Type", "Amount"];
  const rows = transactions.map(t => [t.date, t.description, t.category, t.type, t.amount]);
  const csv = [header, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `transactions_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast("CSV exported.", "success");
}

/* ================= ANALYTICS PAGE ================= */
function initAnalyticsPage() {
  renderAnalytics();
}

function groupByMonth() {
  const byMonth = {};
  transactions.forEach(t => {
    const key = t.date.slice(0, 7);
    if (!byMonth[key]) byMonth[key] = { income: 0, expense: 0 };
    byMonth[key][t.type] += t.amount;
  });
  return byMonth;
}

function renderAnalytics() {
  renderChart("categoryPieChart", "pie");
  renderChart("monthlyBarChart", "bar");
  renderTrendChart();
  renderTopCategories();
  renderAnalyticsStats();
}

function renderTrendChart() {
  const canvas = document.getElementById("trendChart");
  if (!canvas) return;
  const byMonth = groupByMonth();
  const months = Object.keys(byMonth).sort();
  let running = 0;
  const balances = months.map(m => { running += byMonth[m].income - byMonth[m].expense; return running; });
  const labels = months.map(m => new Date(m + "-01").toLocaleDateString("en-US", { month: "short", year: "2-digit" }));

  if (trendChart) trendChart.destroy();
  trendChart = new Chart(canvas, {
    type: "line",
    data: { labels, datasets: [{ label: "Balance", data: balances, borderColor: "#4361ee", backgroundColor: "rgba(67,97,238,0.15)", fill: true, tension: 0.3 }] },
    options: { responsive: true, plugins: { legend: { display: false } } }
  });
}

function renderTopCategories() {
  const container = document.getElementById("topCategoriesList");
  if (!container) return;
  const byCategory = {};
  transactions.filter(t => t.type === "expense").forEach(t => { byCategory[t.category] = (byCategory[t.category] || 0) + t.amount; });
  const total = Object.values(byCategory).reduce((a, b) => a + b, 0);
  const sorted = Object.entries(byCategory).sort((a, b) => b[1] - a[1]).slice(0, 6);

  if (sorted.length === 0) { container.innerHTML = `<p class="text-secondary mb-0">No expenses recorded yet.</p>`; return; }

  container.innerHTML = sorted.map(([cat, amt]) => {
    const pct = total > 0 ? Math.round((amt / total) * 100) : 0;
    return `<div class="rank-row">
      <span>${cat}</span>
      <span class="text-secondary">${pct}% · ${fmt(amt)}</span>
    </div>`;
  }).join("");
}

function renderAnalyticsStats() {
  const expenses = transactions.filter(t => t.type === "expense");
  const income = transactions.filter(t => t.type === "income");
  const totalExpense = expenses.reduce((s, t) => s + t.amount, 0);
  const byMonth = groupByMonth();
  const monthCount = Object.keys(byMonth).length || 1;
  const avgMonthly = totalExpense / monthCount;
  const highest = expenses.sort((a, b) => b.amount - a.amount)[0];

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set("statAvgMonthly", fmt(avgMonthly));
  set("statHighestExpense", highest ? `${fmt(highest.amount)} · ${highest.description}` : "—");
  set("statTransactionCount", transactions.length);
  set("statIncomeCount", income.length);
}

/* ================= SHARED CHART RENDERER ================= */
function renderChart(canvasId, kind) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const wrapper = canvas.closest(".card-body");
  let emptyMsg = wrapper?.querySelector(".chart-empty-msg");

  if (transactions.length === 0) {
    canvas.style.display = "none";
    if (wrapper && !emptyMsg) {
      emptyMsg = document.createElement("p");
      emptyMsg.className = "chart-empty-msg text-secondary text-center py-5 mb-0";
      emptyMsg.innerHTML = '<i class="bi bi-bar-chart fs-2 d-block mb-2"></i>No data yet — add a transaction to see this chart.';
      wrapper.appendChild(emptyMsg);
    }
    return;
  } else {
    canvas.style.display = "block";
    if (emptyMsg) emptyMsg.remove();
  }

  if (kind === "pie") {
    const byCategory = {};
    transactions.filter(t => t.type === "expense").forEach(t => { byCategory[t.category] = (byCategory[t.category] || 0) + t.amount; });
    const labels = Object.keys(byCategory);
    const data = Object.values(byCategory);
    const colors = ["#4361ee","#f72585","#4cc9f0","#ff9f1c","#7209b7","#2ec4b6","#e63946","#ffbe0b","#8d99ae"];
    if (pieChart) pieChart.destroy();
    pieChart = new Chart(canvas, {
      type: "pie",
      data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 0 }] },
      options: { responsive: true, plugins: { legend: { position: "bottom", labels: { boxWidth: 12 } } } }
    });
  }

  if (kind === "bar") {
    const byMonth = groupByMonth();
    const months = Object.keys(byMonth).sort();
    const labels = months.map(m => new Date(m + "-01").toLocaleDateString
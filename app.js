const storageKey = "saha-defteri-v1";
const settingsKey = "saha-defteri-settings-v1";
const spreadsheetId = "1xfp9vUbdJpq39P1fZgYVb5rHqGr5b9HPKfujuai4YaM";

const initialState = {
  sites: [],
  reports: [],
  orders: [],
  issues: []
};

let state = loadState();
let settings = loadSettings();
let syncTimer = null;
let isSyncing = false;

const views = {
  overview: "Genel Bakış",
  sites: "Şantiyeler",
  reports: "Günlük Rapor",
  orders: "Siparişler",
  issues: "Sorunlar",
  sheets: "Sheets Bağlantısı"
};

const today = new Date().toISOString().slice(0, 10);

document.querySelectorAll('input[type="date"]').forEach((input) => {
  input.value = today;
});

document.getElementById("todayLabel").textContent = formatDate(today);

document.querySelectorAll(".nav-button").forEach((button) => {
  button.addEventListener("click", () => switchView(button.dataset.view));
});

document.getElementById("quickReport").addEventListener("click", () => switchView("reports"));
document.getElementById("seedData").addEventListener("click", seedExampleData);
document.getElementById("exportJson").addEventListener("click", exportJson);
document.getElementById("clearData").addEventListener("click", clearAllData);
document.getElementById("exportReports").addEventListener("click", exportReportsCsv);
document.getElementById("pushSheets").addEventListener("click", pushToSheets);
document.getElementById("pullSheets").addEventListener("click", pullFromSheets);

document.getElementById("scriptUrl").value = settings.scriptUrl || "";
document.getElementById("settingsForm").addEventListener("submit", (event) => {
  event.preventDefault();
  settings.scriptUrl = document.getElementById("scriptUrl").value.trim();
  saveSettings();
  setSyncStatus("Bağlantı kaydedildi.");
  autoPullFromSheets();
});

bindForm("siteForm", (data) => {
  state.sites.push({
    id: crypto.randomUUID(),
    name: data.name,
    location: data.location,
    chief: data.chief,
    status: data.status,
    note: data.note
  });
});

bindForm("reportForm", (data) => {
  state.reports.unshift({
    id: crypto.randomUUID(),
    date: data.date,
    site: data.site,
    work: data.work,
    crew: data.crew,
    plan: data.plan,
    note: data.note
  });
});

bindForm("orderForm", (data) => {
  state.orders.unshift({
    id: crypto.randomUUID(),
    date: data.date,
    site: data.site,
    type: data.type,
    detail: data.detail,
    amount: data.amount,
    status: data.status
  });
});

bindForm("issueForm", (data) => {
  state.issues.unshift({
    id: crypto.randomUUID(),
    site: data.site,
    location: data.location,
    description: data.description,
    priority: data.priority,
    status: data.status
  });
});

render();
autoPullFromSheets();

function bindForm(id, onSubmit) {
  const form = document.getElementById(id);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    onSubmit(data);
    saveState();
    form.reset();
    form.querySelectorAll('input[type="date"]').forEach((input) => {
      input.value = today;
    });
    render();
    scheduleAutoSync();
  });
}

function switchView(viewId) {
  document.querySelectorAll(".view").forEach((view) => {
    view.classList.toggle("active", view.id === viewId);
  });
  document.querySelectorAll(".nav-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === viewId);
  });
  document.getElementById("pageTitle").textContent = views[viewId];
}

function loadState() {
  const saved = localStorage.getItem(storageKey);
  if (!saved) return structuredClone(initialState);
  try {
    return { ...structuredClone(initialState), ...JSON.parse(saved) };
  } catch {
    return structuredClone(initialState);
  }
}

function saveState() {
  localStorage.setItem(storageKey, JSON.stringify(state));
}

function loadSettings() {
  const saved = localStorage.getItem(settingsKey);
  if (!saved) return { scriptUrl: "", spreadsheetId };
  try {
    return { scriptUrl: "", spreadsheetId, ...JSON.parse(saved) };
  } catch {
    return { scriptUrl: "", spreadsheetId };
  }
}

function saveSettings() {
  localStorage.setItem(settingsKey, JSON.stringify(settings));
}

function render() {
  renderSiteSelects();
  renderMetrics();
  renderSites();
  renderReports();
  renderOrders();
  renderIssues();
  renderOverview();
}

function renderSiteSelects() {
  document.querySelectorAll('select[name="site"]').forEach((select) => {
    const current = select.value;
    select.innerHTML = "";
    if (!state.sites.length) {
      select.append(new Option("Önce şantiye ekle", ""));
      select.disabled = true;
      return;
    }
    select.disabled = false;
    state.sites.forEach((site) => select.append(new Option(site.name, site.name)));
    if (current) select.value = current;
  });
}

function renderMetrics() {
  document.getElementById("metricSites").textContent = state.sites.filter((site) => site.status !== "Tamamlandı").length;
  document.getElementById("metricIssues").textContent = state.issues.filter((issue) => issue.status !== "Çözüldü").length;
  document.getElementById("metricOrders").textContent = state.orders.filter((order) => order.status !== "Teslim alındı").length;
  document.getElementById("metricReports").textContent = state.reports.filter((report) => report.date.slice(0, 7) === today.slice(0, 7)).length;
}

function renderSites() {
  document.getElementById("siteCount").textContent = `${state.sites.length} kayıt`;
  const tbody = document.getElementById("siteTable");
  tbody.innerHTML = "";
  state.sites.forEach((site) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td><strong>${escapeHtml(site.name)}</strong><br><span class="empty">${escapeHtml(site.chief || "Şef girilmedi")}</span></td>
      <td>${escapeHtml(site.location || "-")}</td>
      <td><span class="badge">${escapeHtml(site.status)}</span></td>
      <td><button class="tiny-button" title="Sil" data-delete="sites" data-id="${site.id}">x</button></td>
    `;
    tbody.append(row);
  });
}

function renderReports() {
  const list = document.getElementById("reportList");
  list.innerHTML = "";
  if (!state.reports.length) return renderEmpty(list, "Henüz günlük rapor yok.");
  state.reports.forEach((report) => {
    list.append(itemCard({
      title: `${report.site} - ${formatDate(report.date)}`,
      meta: report.crew || "Ekip bilgisi yok",
      body: report.work,
      foot: report.plan ? `Sonraki plan: ${report.plan}` : "",
      collection: "reports",
      id: report.id
    }));
  });
}

function renderOrders() {
  document.getElementById("orderCount").textContent = `${state.orders.length} kayıt`;
  const list = document.getElementById("orderList");
  list.innerHTML = "";
  if (!state.orders.length) return renderEmpty(list, "Henüz sipariş girilmedi.");
  state.orders.forEach((order) => {
    list.append(itemCard({
      title: `${order.type}: ${order.detail}`,
      meta: `${order.site} / ${formatDate(order.date)}`,
      body: order.amount || "Miktar girilmedi",
      badge: order.status,
      collection: "orders",
      id: order.id
    }));
  });
}

function renderIssues() {
  document.getElementById("issueCount").textContent = `${state.issues.length} kayıt`;
  const list = document.getElementById("issueList");
  list.innerHTML = "";
  if (!state.issues.length) return renderEmpty(list, "Henüz sorun veya eksik yok.");
  state.issues.forEach((issue) => {
    list.append(itemCard({
      title: issue.location ? `${issue.site} / ${issue.location}` : issue.site,
      meta: issue.status,
      body: issue.description,
      badge: issue.priority,
      collection: "issues",
      id: issue.id
    }));
  });
}

function renderOverview() {
  const todayList = document.getElementById("todayList");
  todayList.innerHTML = "";
  const todayReports = state.reports.filter((report) => report.date === today).slice(0, 5);
  const pendingOrders = state.orders.filter((order) => order.status !== "Teslim alındı").slice(0, 3);

  [...todayReports, ...pendingOrders].forEach((entry) => {
    if (entry.work) {
      todayList.append(itemCard({
        title: entry.site,
        meta: "Bugünkü rapor",
        body: entry.work,
        collection: "reports",
        id: entry.id
      }));
    } else {
      todayList.append(itemCard({
        title: entry.detail,
        meta: `${entry.site} / ${entry.status}`,
        body: entry.amount || entry.type,
        collection: "orders",
        id: entry.id
      }));
    }
  });
  if (!todayList.children.length) renderEmpty(todayList, "Bugün için kayıt yok.");

  const priority = document.getElementById("priorityIssues");
  priority.innerHTML = "";
  state.issues
    .filter((issue) => issue.status !== "Çözüldü")
    .sort((a, b) => priorityScore(a.priority) - priorityScore(b.priority))
    .slice(0, 5)
    .forEach((issue) => {
      priority.append(itemCard({
        title: issue.location ? `${issue.site} / ${issue.location}` : issue.site,
        meta: issue.priority,
        body: issue.description,
        badge: issue.status,
        collection: "issues",
        id: issue.id
      }));
    });
  if (!priority.children.length) renderEmpty(priority, "Açık sorun yok.");
}

function itemCard({ title, meta, body, foot, badge, collection, id }) {
  const card = document.createElement("article");
  card.className = "item";
  const badgeClass = badge === "Yüksek" || badge === "Açık" ? "danger" : badge === "Orta" || badge === "Takipte" ? "warn" : "";
  card.innerHTML = `
    <div class="item-top">
      <div>
        <strong>${escapeHtml(title)}</strong>
        <p>${escapeHtml(meta || "")}</p>
      </div>
      <div class="item-actions">
        ${badge ? `<span class="badge ${badgeClass}">${escapeHtml(badge)}</span>` : ""}
        <button class="tiny-button" title="Sil" data-delete="${collection}" data-id="${id}">x</button>
      </div>
    </div>
    <p>${escapeHtml(body || "")}</p>
    ${foot ? `<p>${escapeHtml(foot)}</p>` : ""}
  `;
  return card;
}

function renderEmpty(target, text) {
  const empty = document.createElement("p");
  empty.className = "empty";
  empty.textContent = text;
  target.append(empty);
}

document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-delete]");
  if (!button) return;
  const collection = button.dataset.delete;
  state[collection] = state[collection].filter((item) => item.id !== button.dataset.id);
  saveState();
  render();
  scheduleAutoSync();
});

function seedExampleData() {
  if (state.sites.length || state.reports.length || state.orders.length || state.issues.length) return;
  state = {
    sites: [
      { id: crypto.randomUUID(), name: "Merkez Blok A", location: "Kadıköy / İstanbul", chief: "Elif Esra", status: "Aktif", note: "Kaba inşaat devam ediyor." }
    ],
    reports: [
      { id: crypto.randomUUID(), date: today, site: "Merkez Blok A", work: "Aks 3-5 arası kolon demirleri bağlandı. Kalıp kontrolü yapıldı.", crew: "3 demirci, 2 kalıpçı", plan: "Kolon kalıpları kapatılacak.", note: "" }
    ],
    orders: [
      { id: crypto.randomUUID(), date: today, site: "Merkez Blok A", type: "Beton", detail: "C30", amount: "32 m3", status: "Sipariş verildi" }
    ],
    issues: [
      { id: crypto.randomUUID(), site: "Merkez Blok A", location: "Bodrum kat", description: "Perde kalıbında aks kayması kontrol edilecek.", priority: "Yüksek", status: "Açık" }
    ]
  };
  saveState();
  render();
  scheduleAutoSync();
}

function exportJson() {
  downloadFile(`saha-defteri-${today}.json`, JSON.stringify(state, null, 2), "application/json");
}

function exportReportsCsv() {
  const rows = [["Tarih", "Şantiye", "Yapılan işler", "Ekip", "Sonraki plan", "Not"]];
  state.reports.forEach((report) => {
    rows.push([report.date, report.site, report.work, report.crew, report.plan, report.note]);
  });
  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\n");
  downloadFile(`gunluk-raporlar-${today}.csv`, csv, "text/csv");
}

function clearAllData() {
  const confirmed = confirm("Tüm kayıtları silmek istediğine emin misin?");
  if (!confirmed) return;
  state = structuredClone(initialState);
  saveState();
  render();
  scheduleAutoSync();
}

async function pushToSheets() {
  if (!requireScriptUrl()) return;
  setSyncStatus("Sheets'e gönderiliyor...");
  try {
    await saveSheetsData(state);
    setSyncStatus("Gönderim yapıldı. Google Sheets sayfasını yenileyip kayıtları kontrol edebilirsin.");
  } catch (error) {
    setSyncStatus(`Gönderme hatası: ${error.message}`);
  }
}

function scheduleAutoSync() {
  if (!settings.scriptUrl) return;
  window.clearTimeout(syncTimer);
  setSyncStatus("Değişiklik kaydedildi. Sheets'e otomatik gönderilecek...");
  syncTimer = window.setTimeout(() => autoPushToSheets(), 900);
}

async function autoPushToSheets() {
  if (!settings.scriptUrl || isSyncing) return;
  isSyncing = true;
  try {
    setSyncStatus("Sheets'e otomatik gönderiliyor...");
    await saveSheetsData(state);
    setSyncStatus(`Otomatik senkronize edildi: ${formatTime(new Date())}`);
  } catch (error) {
    setSyncStatus(`Otomatik gönderme hatası: ${error.message}`);
  } finally {
    isSyncing = false;
  }
}

async function autoPullFromSheets() {
  if (!settings.scriptUrl || isSyncing) return;
  isSyncing = true;
  try {
    setSyncStatus("Sheets'ten son veri alınıyor...");
    const response = await loadSheetsData();
    state = normalizeRemoteState(response.data || {});
    saveState();
    render();
    setSyncStatus(`Sheets'ten son veri alındı: ${formatTime(new Date())}`);
  } catch (error) {
    setSyncStatus(`Otomatik çekme hatası: ${error.message}`);
  } finally {
    isSyncing = false;
  }
}

async function pullFromSheets() {
  if (!requireScriptUrl()) return;
  setSyncStatus("Sheets'ten veri çekiliyor...");
  try {
    const response = await loadSheetsData();
    state = normalizeRemoteState(response.data || {});
    saveState();
    render();
    setSyncStatus("Sheets verisi uygulamaya alındı.");
  } catch (error) {
    setSyncStatus(`Çekme hatası: ${error.message}`);
  }
}

async function saveSheetsData(data) {
  await fetch(settings.scriptUrl, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action: "save", spreadsheetId, data })
  });
}

function loadSheetsData() {
  return new Promise((resolve, reject) => {
    const callbackName = `sahaDefteriCallback_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const script = document.createElement("script");
    const url = new URL(settings.scriptUrl);

    url.searchParams.set("action", "load");
    url.searchParams.set("spreadsheetId", spreadsheetId);
    url.searchParams.set("callback", callbackName);

    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error("Sheets yanıtı zaman aşımına uğradı."));
    }, 15000);

    window[callbackName] = (result) => {
      cleanup();
      if (!result.ok) {
        reject(new Error(result.error || "Bilinmeyen hata"));
        return;
      }
      resolve(result);
    };

    script.onerror = () => {
      cleanup();
      reject(new Error("Apps Script URL'si yüklenemedi."));
    };

    function cleanup() {
      window.clearTimeout(timeout);
      delete window[callbackName];
      script.remove();
    }

    script.src = url.toString();
    document.body.append(script);
  });
}

function normalizeRemoteState(remote) {
  return {
    sites: Array.isArray(remote.sites) ? remote.sites : [],
    reports: Array.isArray(remote.reports) ? remote.reports : [],
    orders: Array.isArray(remote.orders) ? remote.orders : [],
    issues: Array.isArray(remote.issues) ? remote.issues : []
  };
}

function requireScriptUrl() {
  settings.scriptUrl = document.getElementById("scriptUrl").value.trim();
  saveSettings();
  if (settings.scriptUrl) return true;
  setSyncStatus("Önce Apps Script web app URL'sini girmen gerekiyor.");
  switchView("sheets");
  return false;
}

function setSyncStatus(message) {
  document.getElementById("syncStatus").textContent = message;
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function csvCell(value = "") {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function formatDate(value) {
  return new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "long", year: "numeric" }).format(new Date(`${value}T12:00:00`));
}

function formatTime(value) {
  return new Intl.DateTimeFormat("tr-TR", { hour: "2-digit", minute: "2-digit" }).format(value);
}

function priorityScore(priority) {
  return { "Yüksek": 1, "Orta": 2, "Düşük": 3 }[priority] || 4;
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

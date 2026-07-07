const storageKey = "saha-defteri-v1";
const settingsKey = "saha-defteri-settings-v1";
const spreadsheetId = "1xfp9vUbdJpq39P1fZgYVb5rHqGr5b9HPKfujuai4YaM";

const initialState = {
  sites: [],
  reports: [],
  plans: [],
  orders: [],
  issues: []
};

let state = loadState();
let settings = loadSettings();
let syncTimer = null;
let isSyncing = false;
let activeSiteId = state.sites[0]?.id || "";
let editingReportId = "";
let activeWeekStart;
let activeReportModalId = "";

const views = {
  overview: "Genel Bakış",
  sites: "Şantiyeler",
  reports: "Günlük Rapor",
  planning: "Planlama",
  orders: "Siparişler",
  issues: "Sorunlar",
  sheets: "Sheets Bağlantısı"
};

const today = new Date().toISOString().slice(0, 10);
activeWeekStart = getWeekStart(today);

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
document.getElementById("addCrewRow").addEventListener("click", () => addCrewRow());
document.getElementById("cancelReportEdit").addEventListener("click", cancelReportEdit);
document.getElementById("addPlanCrewRow").addEventListener("click", () => addCrewRow("planCrewBuilder"));
document.getElementById("prevWeek").addEventListener("click", () => changeWeek(-7));
document.getElementById("nextWeek").addEventListener("click", () => changeWeek(7));
document.getElementById("closeReportModal").addEventListener("click", closeReportModal);
document.getElementById("downloadReport").addEventListener("click", downloadActiveReport);
document.getElementById("editReportFromModal").addEventListener("click", editActiveReportFromModal);
document.getElementById("reportModal").addEventListener("click", (event) => {
  if (event.target.id === "reportModal") closeReportModal();
});

document.getElementById("scriptUrl").value = settings.scriptUrl || "";
document.getElementById("settingsForm").addEventListener("submit", (event) => {
  event.preventDefault();
  settings.scriptUrl = document.getElementById("scriptUrl").value.trim();
  saveSettings();
  setSyncStatus("Bağlantı kaydedildi. Yeni kayıtlar ilgili Sheets sayfasına otomatik yazılacak.");
});

bindForm("siteForm", "sites", "push", (data) => ({
    id: crypto.randomUUID(),
    name: data.name,
    location: data.location,
    chief: data.chief,
    status: data.status,
    note: data.note
}));

bindReportForm();
bindPlanForm();

bindForm("orderForm", "orders", "unshift", (data) => ({
    id: crypto.randomUUID(),
    date: data.date,
    site: data.site,
    type: data.type,
    detail: data.detail,
    amount: data.amount,
    status: data.status
}));

bindForm("issueForm", "issues", "unshift", (data) => ({
    id: crypto.randomUUID(),
    site: data.site,
    location: data.location,
    description: data.description,
    priority: data.priority,
    status: data.status
}));

render();

function bindForm(id, collection, insertMethod, buildItem) {
  const form = document.getElementById(id);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    const item = buildItem(data);
    state[collection][insertMethod](item);
    if (collection === "sites" && !activeSiteId) activeSiteId = item.id;
    saveState();
    form.reset();
    form.querySelectorAll('input[type="date"]').forEach((input) => {
      input.value = today;
    });
    render();
    appendRecordToSheets(collection, item);
  });
}

function bindReportForm() {
  const form = document.getElementById("reportForm");
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    const crews = collectCrewRows();
    if (!crews.length) {
      alert("En az bir ekip adı veya ekip notu girmen gerekiyor.");
      return;
    }

    const item = {
      id: editingReportId || crypto.randomUUID(),
      date: data.date,
      site: data.site,
      crews,
      crew: crews.map((crew) => crew.name).filter(Boolean).join(", "),
      work: crews.map((crew) => `${crew.name || "Ekip"}: ${crew.text}`).join(" | "),
      plan: "",
      note: data.note
    };

    if (editingReportId) {
      state.reports = state.reports.map((report) => report.id === editingReportId ? item : report);
    } else {
      state.reports.unshift(item);
    }
    saveState();
    form.reset();
    form.querySelectorAll('input[type="date"]').forEach((input) => {
      input.value = today;
    });
    resetCrewRows();
    const wasEditing = Boolean(editingReportId);
    editingReportId = "";
    updateReportFormMode();
    render();
    if (wasEditing) {
      upsertRecordToSheets("reports", item);
    } else {
      appendRecordToSheets("reports", item);
    }
  });
}

function bindPlanForm() {
  const form = document.getElementById("planForm");
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    const crews = collectCrewRows("planCrewBuilder");
    if (!crews.length) {
      alert("En az bir ekip adı veya planlama notu girmen gerekiyor.");
      return;
    }

    const item = {
      id: crypto.randomUUID(),
      date: data.date,
      site: data.site,
      title: data.title,
      crews,
      crew: crews.map((crew) => crew.name).filter(Boolean).join(", "),
      detail: crews.map((crew) => `${crew.name || "Ekip"}: ${crew.text}`).join(" | "),
      note: data.note
    };

    state.plans.unshift(item);
    saveState();
    form.reset();
    form.querySelectorAll('input[type="date"]').forEach((input) => {
      input.value = today;
    });
    resetCrewRows("planCrewBuilder");
    activeWeekStart = getWeekStart(item.date);
    render();
    appendRecordToSheets("plans", item);
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
    return normalizeState({ ...structuredClone(initialState), ...JSON.parse(saved) });
  } catch {
    return structuredClone(initialState);
  }
}

function normalizeState(value) {
  return {
    sites: Array.isArray(value.sites) ? value.sites : [],
    reports: Array.isArray(value.reports) ? value.reports : [],
    plans: Array.isArray(value.plans) ? value.plans : [],
    orders: Array.isArray(value.orders) ? value.orders : [],
    issues: Array.isArray(value.issues) ? value.issues : []
  };
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
  if (!state.sites.some((site) => site.id === activeSiteId)) {
    activeSiteId = state.sites[0]?.id || "";
  }
  renderSiteSelects();
  renderMetrics();
  renderSites();
  renderReports();
  renderPlans();
  renderOrders();
  renderIssues();
  renderOverview();
  renderSiteDetail();
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
  const tabs = document.getElementById("siteTabs");
  tabs.innerHTML = "";
  state.sites.forEach((site) => {
    const tab = document.createElement("button");
    tab.type = "button";
    tab.className = `site-tab ${site.id === activeSiteId ? "active" : ""}`;
    tab.textContent = site.name;
    tab.addEventListener("click", () => {
      activeSiteId = site.id;
      renderSites();
      renderSiteDetail();
    });
    tabs.append(tab);
  });

  const tbody = document.getElementById("siteTable");
  tbody.innerHTML = "";
  state.sites.forEach((site) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td><strong>${escapeHtml(site.name)}</strong><br><span class="empty">${escapeHtml(site.chief || "Şef girilmedi")}</span></td>
      <td>${escapeHtml(site.location || "-")}</td>
      <td><span class="badge">${escapeHtml(site.status)}</span></td>
      <td>
        <button class="tiny-button" title="Aç" data-open-site="${site.id}">→</button>
        <button class="tiny-button" title="Sil" data-delete="sites" data-id="${site.id}">x</button>
      </td>
    `;
    tbody.append(row);
  });
}

function renderSiteDetail() {
  const target = document.getElementById("siteDetail");
  target.innerHTML = "";
  if (!state.sites.length) return;

  const site = state.sites.find((item) => item.id === activeSiteId) || state.sites[0];
  if (!site) return;

  const reports = state.reports.filter((report) => report.site === site.name);
  const plans = state.plans.filter((plan) => plan.site === site.name);
  const orders = state.orders.filter((order) => order.site === site.name);
  const issues = state.issues.filter((issue) => issue.site === site.name);

  target.innerHTML = `
    <section class="panel">
      <div class="site-detail-header">
        <div>
          <h2>${escapeHtml(site.name)}</h2>
          <p class="helper-text">${escapeHtml(site.location || "Konum girilmedi")} / ${escapeHtml(site.status || "Durum yok")}</p>
        </div>
        <span class="badge">${reports.length} rapor / ${plans.length} plan / ${orders.length} sipariş / ${issues.length} sorun</span>
      </div>
    </section>
    <div class="site-detail-grid">
      <section class="panel">
        <div class="panel-header"><h2>Günlük Raporlar</h2><span>${reports.length} kayıt</span></div>
        <div class="list" id="siteReports"></div>
      </section>
      <section class="panel">
        <div class="panel-header"><h2>Planlamalar</h2><span>${plans.length} kayıt</span></div>
        <div class="list" id="sitePlans"></div>
      </section>
      <section class="panel">
        <div class="panel-header"><h2>Siparişler</h2><span>${orders.length} kayıt</span></div>
        <div class="list" id="siteOrders"></div>
      </section>
      <section class="panel">
        <div class="panel-header"><h2>Sorunlar</h2><span>${issues.length} kayıt</span></div>
        <div class="list" id="siteIssues"></div>
      </section>
    </div>
  `;

  const reportList = document.getElementById("siteReports");
  const planList = document.getElementById("sitePlans");
  const orderList = document.getElementById("siteOrders");
  const issueList = document.getElementById("siteIssues");

  if (!reports.length) renderEmpty(reportList, "Bu şantiye için rapor yok.");
  reports.forEach((report) => reportList.append(reportCard(report)));

  if (!plans.length) renderEmpty(planList, "Bu şantiye için planlama yok.");
  plans.forEach((plan) => planList.append(planCard(plan)));

  if (!orders.length) renderEmpty(orderList, "Bu şantiye için sipariş yok.");
  orders.forEach((order) => {
    orderList.append(itemCard({
      title: `${order.type}: ${order.detail}`,
      meta: formatDate(order.date),
      body: order.amount || "Miktar girilmedi",
      badge: order.status,
      collection: "orders",
      id: order.id
    }));
  });

  if (!issues.length) renderEmpty(issueList, "Bu şantiye için sorun yok.");
  issues.forEach((issue) => {
    issueList.append(itemCard({
      title: issue.location || "Konum girilmedi",
      meta: issue.status,
      body: issue.description,
      badge: issue.priority,
      collection: "issues",
      id: issue.id
    }));
  });
}

function renderReports() {
  const list = document.getElementById("reportList");
  list.innerHTML = "";
  if (!state.reports.length) return renderEmpty(list, "Henüz günlük rapor yok.");
  state.reports.forEach((report) => {
    list.append(reportCard(report));
  });
}

function renderPlans() {
  renderPlanningCalendar();
  const list = document.getElementById("planList");
  if (!list) return;
  list.innerHTML = "";
  document.getElementById("planCount").textContent = `${state.plans.length} kayıt`;
  if (!state.plans.length) return renderEmpty(list, "Henüz planlama yok.");
  state.plans.forEach((plan) => {
    list.append(planCard(plan));
  });
}

function renderPlanningCalendar() {
  const calendar = document.getElementById("weekCalendar");
  if (!calendar) return;
  calendar.innerHTML = "";
  const weekDays = Array.from({ length: 7 }, (_, index) => addDays(activeWeekStart, index));
  document.getElementById("weekLabel").textContent = `${formatDate(weekDays[0])} - ${formatDate(weekDays[6])}`;

  weekDays.forEach((day) => {
    const dateKey = toDateKey(day);
    const dayPlans = state.plans.filter((plan) => plan.date === dateKey);
    const column = document.createElement("section");
    column.className = `day-column ${dateKey === today ? "today" : ""}`;
    column.innerHTML = `
      <div class="day-head">
        <strong>${new Intl.DateTimeFormat("tr-TR", { weekday: "long" }).format(day)}</strong>
        <span class="day-number">${new Intl.DateTimeFormat("tr-TR", { day: "2-digit" }).format(day)}</span>
        <span>${new Intl.DateTimeFormat("tr-TR", { month: "long", year: "numeric" }).format(day)}</span>
      </div>
    `;
    if (!dayPlans.length) {
      const empty = document.createElement("p");
      empty.className = "empty";
      empty.textContent = "Plan yok";
      column.append(empty);
    }
    dayPlans.forEach((plan) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "plan-chip";
      chip.dataset.openPlan = plan.id;
      chip.innerHTML = `<strong>${escapeHtml(plan.title || "Plan")}</strong><span>${escapeHtml(plan.site)}</span>`;
      chip.addEventListener("click", () => openPlanDetails(plan.id));
      column.append(chip);
    });
    calendar.append(column);
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
      todayList.append(reportCard(entry));
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

function reportCard(report) {
  const card = document.createElement("article");
  card.className = "report-summary";
  card.innerHTML = `
    <div class="item-top">
      <button class="report-open" type="button">
        <strong>${escapeHtml(report.site)}</strong>
        <p>${formatDate(report.date)}</p>
      </button>
      <div class="item-actions">
        <button class="tiny-button" title="Detay" type="button">☰</button>
        <button class="tiny-button" title="Düzenle" type="button">✎</button>
        <button class="tiny-button" title="İndir" type="button">↓</button>
        <button class="tiny-button" title="Sil" data-delete="reports" data-id="${report.id}">x</button>
      </div>
    </div>
  `;
  const [detailButton, editButton, downloadButton] = card.querySelectorAll(".item-actions .tiny-button");
  card.querySelector(".report-open").addEventListener("click", () => openReportModal(report.id));
  detailButton.addEventListener("click", () => openReportModal(report.id));
  editButton.addEventListener("click", () => editReport(report.id));
  downloadButton.addEventListener("click", () => downloadReportById(report.id));
  return card;
}

function planCard(plan) {
  const card = document.createElement("details");
  card.className = "item";
  card.dataset.planCard = plan.id;
  const crews = getReportCrews(plan);
  const crewHtml = crews.length
    ? crews.map((crew) => `
        <div class="item-section">
          <strong>${escapeHtml(crew.name || "Ekip")}</strong>
          <p>${escapeHtml(crew.text || "Plan girilmedi")}</p>
        </div>
      `).join("")
    : `<p>${escapeHtml(plan.detail || "Plan detayı yok")}</p>`;

  card.innerHTML = `
    <summary class="item-top">
      <div>
        <strong>${escapeHtml(plan.title || "Plan")} - ${formatDate(plan.date)}</strong>
        <p>${escapeHtml(plan.site)} / ${escapeHtml(plan.crew || "Ekip bilgisi yok")}</p>
      </div>
      <div class="item-actions">
        <button class="tiny-button" title="Sil" data-delete="plans" data-id="${plan.id}">x</button>
      </div>
    </summary>
    ${crewHtml}
    ${plan.note ? `<p>${escapeHtml(plan.note)}</p>` : ""}
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
  const reportButton = event.target.closest("[data-open-report]");
  if (reportButton) {
    event.preventDefault();
    event.stopPropagation();
    openReportModal(reportButton.dataset.openReport);
    return;
  }

  const downloadReportButton = event.target.closest("[data-download-report]");
  if (downloadReportButton) {
    event.preventDefault();
    event.stopPropagation();
    downloadReportById(downloadReportButton.dataset.downloadReport);
    return;
  }

  const editReportButton = event.target.closest("[data-edit-report]");
  if (editReportButton) {
    event.preventDefault();
    event.stopPropagation();
    editReport(editReportButton.dataset.editReport);
    return;
  }

  const planButton = event.target.closest("[data-open-plan]");
  if (planButton) {
    openPlanDetails(planButton.dataset.openPlan);
    return;
  }

  const siteButton = event.target.closest("[data-open-site]");
  if (siteButton) {
    activeSiteId = siteButton.dataset.openSite;
    switchView("sites");
    renderSites();
    renderSiteDetail();
    return;
  }

  const button = event.target.closest("[data-delete]");
  if (!button) return;
  event.preventDefault();
  event.stopPropagation();
  const collection = button.dataset.delete;
  state[collection] = state[collection].filter((item) => item.id !== button.dataset.id);
  saveState();
  render();
  scheduleAutoSync();
});

function editReport(id) {
  closeReportModal();
  const report = state.reports.find((item) => item.id === id);
  if (!report) return;
  editingReportId = id;
  switchView("reports");
  const form = document.getElementById("reportForm");
  form.elements.date.value = report.date;
  form.elements.site.value = report.site;
  form.elements.note.value = report.note || "";
  resetCrewRows("crewBuilder", getReportCrews(report));
  updateReportFormMode();
  form.scrollIntoView({ behavior: "smooth", block: "start" });
}

function openReportModal(id) {
  const report = state.reports.find((item) => item.id === id);
  if (!report) return;
  activeReportModalId = id;
  document.getElementById("reportModalTitle").textContent = report.site;
  document.getElementById("reportModalMeta").textContent = formatDate(report.date);
  document.getElementById("reportModalBody").innerHTML = reportDetailHtml(report);
  document.getElementById("reportModal").hidden = false;
}

function closeReportModal() {
  activeReportModalId = "";
  document.getElementById("reportModal").hidden = true;
}

function editActiveReportFromModal() {
  if (!activeReportModalId) return;
  editReport(activeReportModalId);
}

function downloadActiveReport() {
  downloadReportById(activeReportModalId);
}

function downloadReportById(id) {
  const report = state.reports.find((item) => item.id === id);
  if (!report) return;
  const filename = `${slugify(report.site)}-${report.date}-gunluk-rapor.txt`;
  downloadFile(filename, reportText(report), "text/plain;charset=utf-8");
}

function reportDetailHtml(report) {
  const crews = getReportCrews(report);
  const crewHtml = crews.length
    ? crews.map((crew) => `
        <div class="item-section">
          <strong>${escapeHtml(crew.name || "Ekip")}</strong>
          <p>${escapeHtml(crew.text || "Not girilmedi")}</p>
        </div>
      `).join("")
    : `<p>${escapeHtml(report.work || "Rapor detayı yok")}</p>`;

  return `
    ${crewHtml}
    ${report.note ? `<div class="item-section"><strong>Risk / olay / not</strong><p>${escapeHtml(report.note)}</p></div>` : ""}
  `;
}

function reportText(report) {
  const crews = getReportCrews(report)
    .map((crew) => `${crew.name || "Ekip"}\n${crew.text || "Not girilmedi"}`)
    .join("\n\n");
  return [
    `Şantiye: ${report.site}`,
    `Tarih: ${formatDate(report.date)}`,
    "",
    crews || report.work || "Rapor detayı yok",
    report.note ? `\nNot: ${report.note}` : ""
  ].join("\n");
}

function cancelReportEdit() {
  editingReportId = "";
  const form = document.getElementById("reportForm");
  form.reset();
  form.querySelectorAll('input[type="date"]').forEach((input) => {
    input.value = today;
  });
  resetCrewRows("crewBuilder");
  updateReportFormMode();
}

function updateReportFormMode() {
  document.getElementById("reportFormTitle").textContent = editingReportId ? "Günlük Raporu Düzenle" : "Günlük Rapor Gir";
  document.getElementById("cancelReportEdit").hidden = !editingReportId;
}

function openPlanDetails(id) {
  const detail = document.querySelector(`[data-plan-card="${CSS.escape(id)}"]`);
  if (!detail) return;
  detail.open = true;
  detail.scrollIntoView({ behavior: "smooth", block: "center" });
}

function changeWeek(offset) {
  activeWeekStart = addDays(activeWeekStart, offset);
  renderPlans();
}

function seedExampleData() {
  if (state.sites.length || state.reports.length || state.orders.length || state.issues.length) return;
  state = {
    sites: [
      { id: crypto.randomUUID(), name: "Merkez Blok A", location: "Kadıköy / İstanbul", chief: "Elif Esra", status: "Aktif", note: "Kaba inşaat devam ediyor." }
    ],
    reports: [
      {
        id: crypto.randomUUID(),
        date: today,
        site: "Merkez Blok A",
        crews: [{ name: "Demir ekibi", text: "Aks 3-5 arası kolon demirleri bağlandı." }, { name: "Kalıp ekibi", text: "Kalıp kontrolü yapıldı." }],
        work: "Demir ekibi: Aks 3-5 arası kolon demirleri bağlandı. | Kalıp ekibi: Kalıp kontrolü yapıldı.",
        crew: "Demir ekibi, Kalıp ekibi",
        plan: "",
        note: ""
      }
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
  const rows = [["Tarih", "Şantiye", "Ekipler", "Yapılan işler", "Not"]];
  state.reports.forEach((report) => {
    rows.push([report.date, report.site, report.crew, report.work, report.note]);
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
    const response = await saveSheetsData(state);
    setSyncStatus(`Sheets'e kaydedildi. ${response.totalRows || 0} satır yazıldı.`);
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
    const response = await saveSheetsData(state);
    setSyncStatus(`Otomatik senkronize edildi: ${response.totalRows || 0} satır / ${formatTime(new Date())}`);
  } catch (error) {
    setSyncStatus(`Otomatik gönderme hatası: ${error.message}`);
  } finally {
    isSyncing = false;
  }
}

async function appendRecordToSheets(collection, item) {
  if (!settings.scriptUrl) {
    setSyncStatus("Kayıt cihazda saklandı. Sheets için önce Apps Script URL'sini kaydet.");
    return;
  }
  try {
    appendSheetsRecord(collection, item);
    setSyncStatus("Kayıt Sheets'e gönderildi.");
  } catch (error) {
    setSyncStatus(`Sheets'e yazma hatası: ${error.message}`);
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
  return callSheetsJsonp("save", data);
}

function appendSheetsRecord(collection, item) {
  const url = new URL(settings.scriptUrl);
  url.searchParams.set("action", "append");
  url.searchParams.set("spreadsheetId", spreadsheetId);
  url.searchParams.set("collection", collection);
  url.searchParams.set("item", JSON.stringify(item));

  const beacon = new Image();
  beacon.referrerPolicy = "no-referrer";
  beacon.src = url.toString();
}

function upsertRecordToSheets(collection, item) {
  if (!settings.scriptUrl) return;
  const url = new URL(settings.scriptUrl);
  url.searchParams.set("action", "upsert");
  url.searchParams.set("spreadsheetId", spreadsheetId);
  url.searchParams.set("collection", collection);
  url.searchParams.set("item", JSON.stringify(item));

  const beacon = new Image();
  beacon.referrerPolicy = "no-referrer";
  beacon.src = url.toString();
}

function loadSheetsData() {
  return callSheetsJsonp("load");
}

function callSheetsJsonp(action, data = null) {
  return new Promise((resolve, reject) => {
    const callbackName = `sahaDefteriCallback_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const script = document.createElement("script");
    const url = new URL(settings.scriptUrl);

    url.searchParams.set("action", action);
    url.searchParams.set("spreadsheetId", spreadsheetId);
    url.searchParams.set("callback", callbackName);
    if (data) {
      url.searchParams.set("payload", JSON.stringify(data));
    }

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
      reject(new Error("Apps Script URL'si yüklenemedi. Web app URL /exec ile bitmeli ve erişim ayarı Anyone olmalı."));
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

function submitSheetsForm(fields) {
  return new Promise((resolve, reject) => {
    const requestId = `sheets_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const iframeName = `${requestId}_target`;
    const iframe = document.createElement("iframe");
    iframe.name = iframeName;
    iframe.hidden = true;

    const form = document.createElement("form");
    form.method = "POST";
    form.action = settings.scriptUrl;
    form.target = iframeName;
    form.hidden = true;

    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error("Apps Script yanıt vermedi. Kod güncel deploy edilmiş mi ve URL /exec ile mi bitiyor?"));
    }, 15000);

    function handleMessage(event) {
      const message = event.data || {};
      if (!message || message.requestId !== requestId) return;
      cleanup();
      if (!message.ok) {
        reject(new Error(message.error || "Bilinmeyen Apps Script hatası"));
        return;
      }
      resolve(message);
    }

    function cleanup() {
      window.clearTimeout(timeout);
      window.removeEventListener("message", handleMessage);
      form.remove();
      iframe.remove();
    }

    window.addEventListener("message", handleMessage);

    Object.entries({ ...fields, requestId }).forEach(([name, value]) => {
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = name;
      input.value = value;
      form.append(input);
    });

    document.body.append(iframe, form);
    form.submit();
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

function addCrewRow(builderId = "crewBuilder", name = "", text = "") {
  const builder = document.getElementById(builderId);
  const row = document.createElement("div");
  row.className = "crew-row";
  row.innerHTML = `
    <div class="crew-row-header">
      <strong>Ekip</strong>
      <button class="tiny-button" type="button" title="Ekibi kaldır">x</button>
    </div>
    <label>Ekip adı<input name="crewName" placeholder="Örn. Kalıp ekibi" value="${escapeHtml(name)}" /></label>
    <label>Ekip notu<textarea name="crewText" rows="4" placeholder="Bu ekibin yaptığı işler">${escapeHtml(text)}</textarea></label>
  `;
  row.querySelector("button").addEventListener("click", () => {
    if (builder.querySelectorAll(".crew-row").length > 1) {
      row.remove();
    }
  });
  builder.append(row);
}

function resetCrewRows(builderId = "crewBuilder", crews = [{ name: "", text: "" }]) {
  const builder = document.getElementById(builderId);
  builder.innerHTML = "";
  const rows = crews.length ? crews : [{ name: "", text: "" }];
  rows.forEach((crew) => addCrewRow(builderId, crew.name, crew.text));
}

function collectCrewRows(builderId = "crewBuilder") {
  return [...document.querySelectorAll(`#${builderId} .crew-row`)]
    .map((row) => ({
      name: row.querySelector('[name="crewName"]')?.value.trim() || "",
      text: row.querySelector('[name="crewText"]')?.value.trim() || ""
    }))
    .filter((crew) => crew.name || crew.text);
}

function getReportCrews(report) {
  if (Array.isArray(report.crews)) return report.crews;
  if (!report.crew && !report.work && !report.detail) return [];
  return [{ name: report.crew || "Ekip", text: report.work || report.detail || "" }];
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

function slugify(value = "") {
  return String(value)
    .toLowerCase()
    .replaceAll("ğ", "g")
    .replaceAll("ü", "u")
    .replaceAll("ş", "s")
    .replaceAll("ı", "i")
    .replaceAll("ö", "o")
    .replaceAll("ç", "c")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "rapor";
}

function formatDate(value) {
  return new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "long", year: "numeric" }).format(new Date(`${value}T12:00:00`));
}

function formatTime(value) {
  return new Intl.DateTimeFormat("tr-TR", { hour: "2-digit", minute: "2-digit" }).format(value);
}

function toDateKey(value) {
  const date = value instanceof Date ? value : new Date(`${value}T12:00:00`);
  return date.toISOString().slice(0, 10);
}

function addDays(value, amount) {
  const date = value instanceof Date ? new Date(value) : new Date(`${value}T12:00:00`);
  date.setDate(date.getDate() + amount);
  return date;
}

function getWeekStart(value) {
  const date = value instanceof Date ? new Date(value) : new Date(`${value}T12:00:00`);
  const day = date.getDay() || 7;
  date.setDate(date.getDate() - day + 1);
  return date;
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

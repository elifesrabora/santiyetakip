const storageKey = "saha-defteri-v1";
const backupStorageKey = "saha-defteri-v1-backup";
const settingsKey = "saha-defteri-settings-v1";
const spreadsheetId = "1xfp9vUbdJpq39P1fZgYVb5rHqGr5b9HPKfujuai4YaM";
const defaultScriptUrl = "https://script.google.com/macros/s/AKfycbwgbTxClE3WYngGg_mb3OMPK4Krjpb6wobNMdqEIBGWWUNvGdYU2OHH1Q3oPmubmQW8/exec";

const initialState = {
  sites: [],
  reports: [],
  plans: [],
  prePlans: [],
  concreteProgress: {
    projectName: "",
    progressNo: "",
    date: "",
    rows: []
  },
  steelProgress: {
    projectName: "",
    progressNo: "",
    date: "",
    prices: {},
    rows: []
  },
  wallProgress: {
    projectName: "",
    progressNo: "",
    date: "",
    unitPrice: "",
    rows: []
  },
  plasterProgress: {
    projectName: "",
    progressNo: "",
    date: "",
    prices: {},
    groups: {}
  },
  drywallProgress: {
    projectName: "",
    progressNo: "",
    date: "",
    prices: {},
    groups: {}
  },
  orders: [],
  issues: []
};

let state = loadState();
let settings = loadSettings();
let syncTimer = null;
let isSyncing = false;
let isRestoringFromSheets = false;
let activeSiteId = state.sites[0]?.id || "";
let editingReportId = "";
let editingPlanId = "";
let editingPrePlanId = "";
let editingOrderId = "";
let activeWeekStart;
let activeReportModalId = "";

const rebarDiameters = [
  { diameter: "Ø8", kgm: 0.395 },
  { diameter: "Ø10", kgm: 0.617 },
  { diameter: "Ø12", kgm: 0.888 },
  { diameter: "Ø14", kgm: 1.208 },
  { diameter: "Ø16", kgm: 1.578 },
  { diameter: "Ø18", kgm: 1.998 },
  { diameter: "Ø20", kgm: 2.466 },
  { diameter: "Ø22", kgm: 2.984 },
  { diameter: "Ø25", kgm: 3.853 },
  { diameter: "Ø28", kgm: 4.83 },
  { diameter: "Ø32", kgm: 6.313 }
];

const areaProgressModules = {
  wallProgress: {
    type: "single",
    totalsId: "wallProgressTotals",
    groups: [{ key: "wall", title: "Duvar", rowsId: "wallProgressRows" }]
  },
  plasterProgress: {
    type: "grouped",
    totalsId: "plasterProgressTotals",
    groups: [
      { key: "rough", title: "Kara sıva", rowsId: "plasterRoughRows" },
      { key: "gypsum", title: "Alçı sıva", rowsId: "plasterGypsumRows" }
    ]
  },
  drywallProgress: {
    type: "grouped",
    totalsId: "drywallProgressTotals",
    groups: [
      { key: "ceiling", title: "Alt tavan", rowsId: "drywallCeilingRows" },
      { key: "vertical", title: "Düşey yüzler", rowsId: "drywallVerticalRows" },
      { key: "partition", title: "Bölme duvar", rowsId: "drywallPartitionRows" }
    ]
  }
};

const views = {
  overview: "Genel Bakış",
  records: "Kayıt",
  sites: "Şantiyeler",
  reports: "Günlük Rapor",
  planning: "Planlama",
  preplans: "Plan Öncesi",
  progress: "Hakediş",
  orders: "Siparişler",
  issues: "Sorunlar",
  sheets: "Sheets Bağlantısı"
};

const today = new Date().toISOString().slice(0, 10);
activeWeekStart = getWeekStart(state.plans[0]?.date || today);

document.querySelectorAll('input[type="date"]').forEach((input) => {
  input.value = today;
});

document.getElementById("todayLabel").textContent = formatDate(today);

document.querySelectorAll(".nav-button").forEach((button) => {
  button.addEventListener("click", () => switchView(button.dataset.view));
});

document.getElementById("quickReport").addEventListener("click", () => {
  switchView("records");
  switchRecordPanel("reportRecord");
});
document.getElementById("seedData").addEventListener("click", seedExampleData);
document.getElementById("exportJson").addEventListener("click", exportJson);
document.getElementById("clearData").addEventListener("click", clearAllData);
document.getElementById("exportReports").addEventListener("click", exportReportsCsv);
document.getElementById("addCrewRow").addEventListener("click", () => addCrewRow());
document.getElementById("cancelReportEdit").addEventListener("click", cancelReportEdit);
document.getElementById("addPlanCrewRow").addEventListener("click", () => addCrewRow("planCrewBuilder"));
document.getElementById("cancelPlanEdit").addEventListener("click", cancelPlanEdit);
document.getElementById("addPrepTaskRow").addEventListener("click", () => addPrepTaskRow());
document.getElementById("cancelPrePlanEdit").addEventListener("click", cancelPrePlanEdit);
document.querySelectorAll("[data-cancel-order-edit]").forEach((button) => {
  button.addEventListener("click", cancelOrderEdit);
});
document.querySelectorAll("[data-record-panel]").forEach((button) => {
  button.addEventListener("click", () => switchRecordPanel(button.dataset.recordPanel));
});
document.querySelectorAll("[data-order-panel]").forEach((button) => {
  button.addEventListener("click", () => switchOrderPanel(button.dataset.orderPanel));
});
document.getElementById("prevWeek").addEventListener("click", () => changeWeek(-7));
document.getElementById("nextWeek").addEventListener("click", () => changeWeek(7));
document.getElementById("addConcreteProgressRow").addEventListener("click", addConcreteProgressRow);
document.getElementById("concreteProgressRows").addEventListener("input", handleConcreteProgressInput);
document.getElementById("concreteProgressRows").addEventListener("click", handleConcreteProgressClick);
document.querySelectorAll("#concreteProgressPanel [id^='progress']").forEach((input) => {
  input.addEventListener("input", handleConcreteProgressMetaInput);
});
document.querySelectorAll("[data-progress-panel]").forEach((button) => {
  button.addEventListener("click", () => switchProgressPanel(button.dataset.progressPanel));
});
document.getElementById("addSteelProgressRow").addEventListener("click", addSteelProgressRow);
document.getElementById("steelProgressRows").addEventListener("input", handleSteelProgressInput);
document.getElementById("steelProgressRows").addEventListener("click", handleSteelProgressClick);
document.getElementById("steelPriceCards").addEventListener("input", handleSteelPriceInput);
document.querySelectorAll("#steelProgressPanel [id^='steelProgress']").forEach((input) => {
  input.addEventListener("input", handleSteelProgressMetaInput);
});
document.querySelectorAll("[data-area-progress-meta]").forEach((input) => {
  input.addEventListener("input", handleAreaProgressMetaInput);
});
document.querySelectorAll("[data-area-price]").forEach((input) => {
  input.addEventListener("input", handleAreaProgressPriceInput);
});
document.querySelectorAll("[data-area-rows]").forEach((tbody) => {
  tbody.addEventListener("input", handleAreaProgressRowInput);
  tbody.addEventListener("click", handleAreaProgressRowClick);
});
document.querySelectorAll("[data-add-area-row]").forEach((button) => {
  button.addEventListener("click", () => addAreaProgressRow(button.dataset.addAreaRow, button.dataset.areaGroup));
});
document.getElementById("closeReportModal").addEventListener("click", closeReportModal);
document.getElementById("downloadReport").addEventListener("click", downloadActiveReport);
document.getElementById("editReportFromModal").addEventListener("click", editActiveReportFromModal);
document.getElementById("reportModal").addEventListener("click", (event) => {
  if (event.target.id === "reportModal") closeReportModal();
});
document.getElementById("openProgressCalculator").addEventListener("click", openCalculatorModal);
document.getElementById("closeCalculatorModal").addEventListener("click", closeCalculatorModal);
document.getElementById("calculatorModal").addEventListener("click", (event) => {
  if (event.target.id === "calculatorModal") closeCalculatorModal();
});
document.querySelectorAll("[data-calculator-panel]").forEach((button) => {
  button.addEventListener("click", () => switchCalculatorPanel(button.dataset.calculatorPanel));
});
document.querySelectorAll("[data-calculator-input]").forEach((input) => {
  input.addEventListener("input", updateCalculatorResult);
  input.addEventListener("change", updateCalculatorResult);
});
document.getElementById("clearCalculator").addEventListener("click", clearCalculator);

document.getElementById("scriptUrl").value = settings.scriptUrl || "";
document.getElementById("settingsForm").addEventListener("submit", (event) => {
  event.preventDefault();
  settings.scriptUrl = document.getElementById("scriptUrl").value.trim() || defaultScriptUrl;
  document.getElementById("scriptUrl").value = settings.scriptUrl;
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
bindPrePlanForm();
bindOrderForms();

bindForm("issueForm", "issues", "unshift", (data) => ({
    id: crypto.randomUUID(),
    site: data.site,
    location: data.location,
    description: data.description,
    priority: data.priority,
    status: data.status
}));

render();
restoreFromSheetsIfLocalDataMissing();

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
    if (id === "rebarOrderForm") resetRebarRows();
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
      id: editingPlanId || crypto.randomUUID(),
      date: data.date,
      site: data.site,
      title: data.title,
      crews,
      crew: crews.map((crew) => crew.name).filter(Boolean).join(", "),
      detail: crews.map((crew) => `${crew.name || "Ekip"}: ${crew.text}`).join(" | "),
      note: data.note
    };

    const wasEditing = Boolean(editingPlanId);
    if (wasEditing) {
      state.plans = state.plans.map((plan) => plan.id === editingPlanId ? item : plan);
    } else {
      state.plans.unshift(item);
    }
    saveState();
    form.reset();
    form.querySelectorAll('input[type="date"]').forEach((input) => {
      input.value = today;
    });
    resetCrewRows("planCrewBuilder");
    editingPlanId = "";
    updatePlanFormMode();
    activeWeekStart = getWeekStart(item.date);
    render();
    if (wasEditing) {
      upsertRecordToSheets("plans", item);
    } else {
      appendRecordToSheets("plans", item);
    }
  });
}

function bindPrePlanForm() {
  const form = document.getElementById("prePlanForm");
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    const plan = state.plans.find((item) => item.id === data.planId);
    const tasks = collectPrepTaskRows();
    if (!plan) {
      alert("Önce bağlı bir plan seçmen gerekiyor.");
      return;
    }
    if (!tasks.length) {
      alert("En az bir yapılacak iş girmen gerekiyor.");
      return;
    }

    const item = {
      id: editingPrePlanId || crypto.randomUUID(),
      planId: plan.id,
      planTitle: plan.title || "Plan",
      date: plan.date,
      site: plan.site,
      tasks,
      summary: tasks.map((task) => `${task.title} (${task.status})`).join(" | "),
      note: data.note
    };

    const wasEditing = Boolean(editingPrePlanId);
    if (wasEditing) {
      state.prePlans = state.prePlans.map((prePlan) => prePlan.id === editingPrePlanId ? item : prePlan);
    } else {
      state.prePlans.unshift(item);
    }
    saveState();
    form.reset();
    resetPrepTaskRows();
    editingPrePlanId = "";
    updatePrePlanFormMode();
    render();
    if (wasEditing) {
      upsertRecordToSheets("prePlans", item);
    } else {
      appendRecordToSheets("prePlans", item);
    }
  });
}

function bindOrderForms() {
  resetRebarRows();
  document.getElementById("addRebarRow").addEventListener("click", () => addRebarRow());

  bindOrderForm("concreteOrderForm", (data) => ({
    id: editingOrderId || crypto.randomUUID(),
    date: data.date,
    site: data.site,
    type: "Beton",
    concreteClass: data.concreteClass,
    volume: data.volume,
    unit: "m3",
    detail: data.concreteClass,
    amount: `${data.volume} m3`,
    pourLocation: data.pourLocation,
    company: data.company,
    status: data.status
  }));

  bindOrderForm("rebarOrderForm", (data) => {
    const items = collectRebarRows();
    return {
      id: editingOrderId || crypto.randomUUID(),
      date: data.date,
      site: data.site,
      type: "Demir",
      company: data.company,
      rebarItems: items,
      detail: items.map((item) => `${item.diameter} - ${item.quantity}`).join(" | "),
      amount: items.map((item) => item.quantity).join(" + "),
      status: data.status
    };
  });

  bindOrderForm("otherOrderForm", (data) => ({
    id: editingOrderId || crypto.randomUUID(),
    date: data.date,
    site: data.site,
    type: "Diğer",
    product: data.product,
    detail: data.product,
    amount: data.amount,
    company: data.company,
    status: data.status
  }));
}

function bindOrderForm(id, buildItem) {
  const form = document.getElementById(id);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    const item = buildItem(data);
    const wasEditing = Boolean(editingOrderId);
    if (wasEditing) {
      state.orders = state.orders.map((order) => order.id === editingOrderId ? item : order);
    } else {
      state.orders.unshift(item);
    }
    saveState();
    resetOrderForms();
    render();
    if (wasEditing) {
      upsertRecordToSheets("orders", item);
    } else {
      appendRecordToSheets("orders", item);
    }
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

function switchRecordPanel(panelId) {
  document.querySelectorAll("[data-record-panel]").forEach((button) => {
    button.classList.toggle("active", button.dataset.recordPanel === panelId);
  });
  document.querySelectorAll(".record-panel").forEach((panel) => {
    panel.classList.toggle("active", panel.id === panelId);
  });
}

function switchOrderPanel(panelId) {
  document.querySelectorAll("[data-order-panel]").forEach((button) => {
    button.classList.toggle("active", button.dataset.orderPanel === panelId);
  });
  document.querySelectorAll(".order-form-panel").forEach((panel) => {
    panel.classList.toggle("active", panel.id === panelId);
  });
}

function switchProgressPanel(panelId) {
  document.querySelectorAll("[data-progress-panel]").forEach((button) => {
    button.classList.toggle("active", button.dataset.progressPanel === panelId);
  });
  document.querySelectorAll(".progress-panel").forEach((panel) => {
    panel.classList.toggle("active", panel.id === panelId);
  });
}

function loadState() {
  const saved = localStorage.getItem(storageKey);
  const backup = localStorage.getItem(backupStorageKey);
  if (!saved && backup) return parseStoredState(backup);
  if (!saved) return structuredClone(initialState);
  const parsed = parseStoredState(saved);
  if (hasAnyLocalData(parsed)) return parsed;
  if (backup) {
    const backupParsed = parseStoredState(backup);
    if (hasAnyLocalData(backupParsed)) return backupParsed;
  }
  return parsed;
}

function parseStoredState(saved) {
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
    prePlans: Array.isArray(value.prePlans) ? value.prePlans : [],
    concreteProgress: normalizeConcreteProgress(value.concreteProgress),
    steelProgress: normalizeSteelProgress(value.steelProgress),
    wallProgress: normalizeSingleAreaProgress(value.wallProgress),
    plasterProgress: normalizeGroupedAreaProgress(value.plasterProgress, areaProgressModules.plasterProgress.groups),
    drywallProgress: normalizeGroupedAreaProgress(value.drywallProgress, areaProgressModules.drywallProgress.groups),
    orders: Array.isArray(value.orders) ? value.orders : [],
    issues: Array.isArray(value.issues) ? value.issues : []
  };
}

function normalizeConcreteProgress(value = {}) {
  return {
    projectName: value.projectName || "",
    progressNo: value.progressNo || "",
    date: value.date || "",
    rows: Array.isArray(value.rows) ? value.rows.map(normalizeConcreteProgressRow) : []
  };
}

function normalizeConcreteProgressRow(row = {}) {
  return {
    id: row.id || crypto.randomUUID(),
    element: row.element || "Kolon",
    floor: row.floor || "",
    concreteClass: row.concreteClass || "C30",
    count: row.count || "",
    width: row.width || "",
    length: row.length || "",
    height: row.height || "",
    deduction: row.deduction || "",
    previous: row.previous || "",
    unitPrice: row.unitPrice || ""
  };
}

function normalizeSteelProgress(value = {}) {
  return {
    projectName: value.projectName || "",
    progressNo: value.progressNo || "",
    date: value.date || "",
    prices: rebarDiameters.reduce((prices, item) => {
      prices[item.diameter] = value.prices?.[item.diameter] || "";
      return prices;
    }, {}),
    rows: Array.isArray(value.rows) ? value.rows.map(normalizeSteelProgressRow) : []
  };
}

function normalizeSteelProgressRow(row = {}) {
  return {
    id: row.id || crypto.randomUUID(),
    element: row.element || "Kolon",
    floor: row.floor || "",
    diameter: row.diameter || "Ø12",
    count: row.count || "",
    length: row.length || "",
    deduction: row.deduction || "",
    previous: row.previous || ""
  };
}

function normalizeSingleAreaProgress(value = {}) {
  return {
    projectName: value.projectName || "",
    progressNo: value.progressNo || "",
    date: value.date || "",
    unitPrice: value.unitPrice || "",
    rows: Array.isArray(value.rows) ? value.rows.map(normalizeAreaProgressRow) : []
  };
}

function normalizeGroupedAreaProgress(value = {}, groups = []) {
  return {
    projectName: value.projectName || "",
    progressNo: value.progressNo || "",
    date: value.date || "",
    prices: groups.reduce((prices, group) => {
      prices[group.key] = value.prices?.[group.key] || "";
      return prices;
    }, {}),
    groups: groups.reduce((items, group) => {
      items[group.key] = Array.isArray(value.groups?.[group.key]) ? value.groups[group.key].map(normalizeAreaProgressRow) : [];
      return items;
    }, {})
  };
}

function normalizeAreaProgressRow(row = {}) {
  return {
    id: row.id || crypto.randomUUID(),
    location: row.location || "",
    floor: row.floor || "",
    width: row.width || "",
    length: row.length || "",
    deduction: row.deduction || "",
    previous: row.previous || ""
  };
}

function saveState() {
  const existing = localStorage.getItem(storageKey);
  if (existing) localStorage.setItem(backupStorageKey, existing);
  localStorage.setItem(storageKey, JSON.stringify(state));
}

function loadSettings() {
  const saved = localStorage.getItem(settingsKey);
  if (!saved) return { scriptUrl: defaultScriptUrl, spreadsheetId };
  try {
    return { scriptUrl: defaultScriptUrl, spreadsheetId, ...JSON.parse(saved) };
  } catch {
    return { scriptUrl: defaultScriptUrl, spreadsheetId };
  }
}

function saveSettings() {
  localStorage.setItem(settingsKey, JSON.stringify(settings));
}

function render() {
  if (!state.sites.some((site) => site.id === activeSiteId)) {
    activeSiteId = state.sites[0]?.id || "";
  }
  renderSafely("Şantiye seçimleri", renderSiteSelects);
  renderSafely("Plan seçimleri", renderPlanSelects);
  renderSafely("Genel metrikler", renderMetrics);
  renderSafely("Şantiyeler", renderSites);
  renderSafely("Günlük raporlar", renderReports);
  renderSafely("Planlama", renderPlans);
  renderSafely("Plan öncesi", renderPrePlans);
  renderSafely("Siparişler", renderOrders);
  renderSafely("Sorunlar", renderIssues);
  renderSafely("Genel bakış", renderOverview);
  renderSafely("Malzeme özeti", renderMaterialSummary);
  renderSafely("Beton hakediş", renderConcreteProgress);
  renderSafely("Demir hakediş", renderSteelProgress);
  renderSafely("Duvar hakediş", () => renderAreaProgress("wallProgress"));
  renderSafely("Sıva hakediş", () => renderAreaProgress("plasterProgress"));
  renderSafely("Alçıpan hakediş", () => renderAreaProgress("drywallProgress"));
  renderSafely("Şantiye detayı", renderSiteDetail);
}

function renderSafely(label, renderer) {
  try {
    renderer();
  } catch (error) {
    console.error(`${label} bölümü yüklenemedi`, error);
  }
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

function renderPlanSelects() {
  document.querySelectorAll('select[name="planId"]').forEach((select) => {
    const current = select.value;
    select.innerHTML = "";
    if (!state.plans.length) {
      select.append(new Option("Önce planlama kaydı ekle", ""));
      select.disabled = true;
      return;
    }
    select.disabled = false;
    state.plans.forEach((plan) => select.append(new Option(planLabel(plan), plan.id)));
    if (current && state.plans.some((plan) => plan.id === current)) select.value = current;
  });
}

function renderMetrics() {
  document.getElementById("metricSites").textContent = state.sites.filter((site) => site.status !== "Tamamlandı").length;
  document.getElementById("metricIssues").textContent = state.issues.filter((issue) => issue.status !== "Çözüldü").length;
  document.getElementById("metricOrders").textContent = state.orders.filter((order) => order.status !== "Teslim alındı").length;
  document.getElementById("metricReports").textContent = state.reports.filter((report) => toDateKey(report.date).slice(0, 7) === today.slice(0, 7)).length;
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
  const prePlans = state.prePlans.filter((prePlan) => prePlan.site === site.name);
  const orders = state.orders.filter((order) => order.site === site.name);
  const issues = state.issues.filter((issue) => issue.site === site.name);

  target.innerHTML = `
    <section class="panel">
      <div class="site-detail-header">
        <div>
          <h2>${escapeHtml(site.name)}</h2>
          <p class="helper-text">${escapeHtml(site.location || "Konum girilmedi")} / ${escapeHtml(site.status || "Durum yok")}</p>
        </div>
        <span class="badge">${reports.length} rapor / ${plans.length} plan / ${prePlans.length} hazırlık / ${orders.length} sipariş / ${issues.length} sorun</span>
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
        <div class="panel-header"><h2>Plan Öncesi</h2><span>${prePlans.length} kayıt</span></div>
        <div class="list" id="sitePrePlans"></div>
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
  const prePlanList = document.getElementById("sitePrePlans");
  const orderList = document.getElementById("siteOrders");
  const issueList = document.getElementById("siteIssues");

  if (!reports.length) renderEmpty(reportList, "Bu şantiye için rapor yok.");
  reports.forEach((report) => reportList.append(reportCard(report)));

  if (!plans.length) renderEmpty(planList, "Bu şantiye için planlama yok.");
  plans.forEach((plan) => planList.append(planCard(plan)));

  if (!prePlans.length) renderEmpty(prePlanList, "Bu şantiye için plan öncesi hazırlık yok.");
  prePlans.forEach((prePlan) => prePlanList.append(prePlanCard(prePlan)));

  if (!orders.length) {
    renderEmpty(orderList, "Bu şantiye için sipariş yok.");
  } else {
    renderOrderGroups(orderList, orders);
  }

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

function renderPrePlans() {
  const list = document.getElementById("prePlanList");
  if (!list) return;
  list.innerHTML = "";
  document.getElementById("prePlanCount").textContent = `${state.prePlans.length} kayıt`;
  if (!state.prePlans.length) return renderEmpty(list, "Henüz plan öncesi hazırlık yok.");
  state.prePlans.forEach((prePlan) => {
    list.append(prePlanCard(prePlan));
  });
}

function renderPlanningCalendar() {
  const calendar = document.getElementById("weekCalendar");
  if (!calendar) return;
  if (!isValidDate(activeWeekStart)) activeWeekStart = getWeekStart(today);
  calendar.innerHTML = "";
  const weekDays = Array.from({ length: 7 }, (_, index) => addDays(activeWeekStart, index));
  document.getElementById("weekLabel").textContent = `${formatDate(weekDays[0])} - ${formatDate(weekDays[6])}`;

  weekDays.forEach((day) => {
    const dateKey = toDateKey(day);
    const dayPlans = state.plans.filter((plan) => toDateKey(plan.date) === dateKey);
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
  renderOrderGroups(list, state.orders, true);
}

function renderOrderGroups(target, orders, showSite = false) {
  [
    { type: "Beton", title: "Beton" },
    { type: "Demir", title: "Demir" },
    { type: "Diğer", title: "Diğerleri" }
  ].forEach((group) => {
    const groupOrders = orders.filter((order) => normalizeOrderType(order.type) === group.type);
    const section = document.createElement("section");
    section.className = "order-group";
    section.innerHTML = `
      <div class="order-group-header">
        <h3>${group.title}</h3>
        <span>${groupOrders.length} kayıt</span>
      </div>
    `;
    const groupList = document.createElement("div");
    groupList.className = "list";
    if (!groupOrders.length) {
      renderEmpty(groupList, `${group.title} siparişi yok.`);
    } else {
      groupOrders.forEach((order) => groupList.append(orderCard(order, showSite)));
    }
    section.append(groupList);
    target.append(section);
  });
}

function orderCard(order, showSite = false) {
  return itemCard({
    title: `${normalizeOrderType(order.type)}: ${orderTitle(order)}`,
    meta: showSite ? `${order.site} / ${formatDate(order.date)}` : formatDate(order.date),
    body: orderBody(order),
    badge: order.status,
    collection: "orders",
    id: order.id
  });
}

function normalizeOrderType(type = "") {
  if (type === "Beton") return "Beton";
  if (type === "Demir") return "Demir";
  return "Diğer";
}

function orderTitle(order) {
  if (normalizeOrderType(order.type) === "Beton") return order.concreteClass || order.detail || "Beton";
  if (normalizeOrderType(order.type) === "Demir") return order.company || "Demir siparişi";
  return order.product || order.detail || "Diğer sipariş";
}

function orderBody(order) {
  if (normalizeOrderType(order.type) === "Beton") {
    return [
      order.amount,
      order.pourLocation ? `Dökülen yer: ${order.pourLocation}` : "",
      order.company ? `Firma: ${order.company}` : ""
    ].filter(Boolean).join(" / ") || "Beton bilgisi girilmedi";
  }
  if (normalizeOrderType(order.type) === "Demir") {
    const items = getRebarItems(order);
    const itemText = items.length ? items.map((item) => `${item.diameter} - ${item.quantity}`).join(" / ") : order.detail;
    return [itemText, order.company ? `Firma: ${order.company}` : ""].filter(Boolean).join(" / ") || "Demir bilgisi girilmedi";
  }
  return [order.amount || "Miktar girilmedi", order.company ? `Firma: ${order.company}` : ""].filter(Boolean).join(" / ");
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

function renderMaterialSummary() {
  const target = document.getElementById("materialSummary");
  if (!target) return;
  target.innerHTML = "";
  if (!state.sites.length) return renderEmpty(target, "Henüz şantiye kaydı yok.");

  state.sites.forEach((site) => {
    const siteOrders = state.orders.filter((order) => order.site === site.name);
    const concreteTotal = siteOrders
      .filter((order) => normalizeOrderType(order.type) === "Beton")
      .reduce((total, order) => total + parseConcreteVolume(order), 0);
    const rebarTotalKg = siteOrders
      .filter((order) => normalizeOrderType(order.type) === "Demir")
      .reduce((total, order) => total + getRebarItems(order).reduce((sum, item) => sum + parseWeightKg(item.quantity), 0), 0);

    const card = document.createElement("article");
    card.className = "material-card";
    card.innerHTML = `
      <strong>${escapeHtml(site.name)}</strong>
      <div>
        <span>Beton</span>
        <b>${formatNumber(concreteTotal)} m3</b>
      </div>
      <div>
        <span>Demir</span>
        <b>${formatWeight(rebarTotalKg)}</b>
      </div>
    `;
    target.append(card);
  });
}

function renderConcreteProgress() {
  const progress = state.concreteProgress;
  document.getElementById("progressProjectName").value = progress.projectName || "";
  document.getElementById("progressNo").value = progress.progressNo || "";
  document.getElementById("progressDate").value = progress.date || today;

  const tbody = document.getElementById("concreteProgressRows");
  tbody.innerHTML = "";
  const rows = progress.rows.length ? progress.rows : [createConcreteProgressRow()];
  if (!progress.rows.length) {
    state.concreteProgress.rows = rows;
    saveState();
  }
  rows.forEach((row) => tbody.append(concreteProgressRowElement(row)));
  renderConcreteProgressTotals();
}

function concreteProgressRowElement(row) {
  const tr = document.createElement("tr");
  tr.dataset.progressRow = row.id;
  tr.innerHTML = `
    <td>${selectHtml("element", ["Kolon", "Kiriş", "Döşeme", "Temel/Radye", "Perde", "Merdiven", "Diğer"], row.element)}</td>
    <td><input data-progress-field="floor" value="${escapeHtml(row.floor)}" /></td>
    <td>${selectHtml("concreteClass", ["C25", "C30", "C35", "C40"], row.concreteClass)}</td>
    <td><input data-progress-field="count" type="number" min="0" step="1" value="${escapeHtml(row.count)}" /></td>
    <td><input data-progress-field="width" type="number" min="0" step="0.01" value="${escapeHtml(row.width)}" /></td>
    <td><input data-progress-field="length" type="number" min="0" step="0.01" value="${escapeHtml(row.length)}" /></td>
    <td><input data-progress-field="height" type="number" min="0" step="0.01" value="${escapeHtml(row.height)}" /></td>
    <td><input class="calculated-input" data-progress-calc="gross" readonly /></td>
    <td><input data-progress-field="deduction" type="number" min="0" step="0.01" value="${escapeHtml(row.deduction)}" /></td>
    <td><input class="calculated-input" data-progress-calc="net" readonly /></td>
    <td><input data-progress-field="previous" type="number" min="0" step="0.01" value="${escapeHtml(row.previous)}" /></td>
    <td><input class="calculated-input" data-progress-calc="current" readonly /></td>
    <td><input data-progress-field="unitPrice" type="number" min="0" step="0.01" value="${escapeHtml(row.unitPrice)}" /></td>
    <td><input class="calculated-input currency-input" data-progress-calc="amount" readonly /></td>
    <td><button class="tiny-button" type="button" title="Satırı sil" data-delete-progress-row="${row.id}">x</button></td>
  `;
  updateConcreteProgressRowDisplay(tr, row);
  return tr;
}

function selectHtml(field, options, value) {
  return `
    <select data-progress-field="${field}">
      ${options.map((option) => `<option ${option === value ? "selected" : ""}>${option}</option>`).join("")}
    </select>
  `;
}

function createConcreteProgressRow() {
  return normalizeConcreteProgressRow({ id: crypto.randomUUID() });
}

function handleConcreteProgressMetaInput(event) {
  const map = {
    progressProjectName: "projectName",
    progressNo: "progressNo",
    progressDate: "date"
  };
  const key = map[event.target.id];
  if (!key) return;
  state.concreteProgress[key] = event.target.value;
  saveState();
}

function handleConcreteProgressInput(event) {
  const field = event.target.dataset.progressField;
  if (!field) return;
  const tr = event.target.closest("[data-progress-row]");
  const row = state.concreteProgress.rows.find((item) => item.id === tr.dataset.progressRow);
  if (!row) return;
  row[field] = event.target.value;
  saveState();
  updateConcreteProgressRowDisplay(tr, row);
  renderConcreteProgressTotals();
}

function handleConcreteProgressClick(event) {
  const button = event.target.closest("[data-delete-progress-row]");
  if (!button) return;
  state.concreteProgress.rows = state.concreteProgress.rows.filter((row) => row.id !== button.dataset.deleteProgressRow);
  if (!state.concreteProgress.rows.length) state.concreteProgress.rows.push(createConcreteProgressRow());
  saveState();
  renderConcreteProgress();
}

function addConcreteProgressRow() {
  state.concreteProgress.rows.push(createConcreteProgressRow());
  saveState();
  renderConcreteProgress();
}

function updateConcreteProgressRowDisplay(tr, row) {
  const totals = calculateConcreteProgressRow(row);
  tr.querySelector('[data-progress-calc="gross"]').value = formatNumber(totals.gross);
  tr.querySelector('[data-progress-calc="net"]').value = formatNumber(totals.net);
  tr.querySelector('[data-progress-calc="current"]').value = formatNumber(totals.current);
  tr.querySelector('[data-progress-calc="amount"]').value = formatCurrency(totals.amount);
}

function calculateConcreteProgressRow(row) {
  const gross = parseProgressNumber(row.count) * parseProgressNumber(row.width) * parseProgressNumber(row.length) * parseProgressNumber(row.height);
  const net = Math.max(gross - parseProgressNumber(row.deduction), 0);
  const current = Math.max(net - parseProgressNumber(row.previous), 0);
  const amount = current * parseProgressNumber(row.unitPrice);
  return { gross, net, current, amount };
}

function renderConcreteProgressTotals() {
  const totals = state.concreteProgress.rows.reduce((acc, row) => {
    const rowTotals = calculateConcreteProgressRow(row);
    acc.gross += rowTotals.gross;
    acc.net += rowTotals.net;
    acc.current += rowTotals.current;
    acc.amount += rowTotals.amount;
    const classTotal = acc.byClass[row.concreteClass] || { net: 0, current: 0, amount: 0 };
    classTotal.net += rowTotals.net;
    classTotal.current += rowTotals.current;
    classTotal.amount += rowTotals.amount;
    acc.byClass[row.concreteClass] = classTotal;
    return acc;
  }, { gross: 0, net: 0, current: 0, amount: 0, byClass: {} });

  document.getElementById("concreteProgressTotals").innerHTML = `
    ${summaryCardHtml("Toplam brüt m³", `${formatNumber(totals.gross)} m3`)}
    ${summaryCardHtml("Toplam net m³", `${formatNumber(totals.net)} m3`)}
    ${summaryCardHtml("Bu hakediş toplam m³", `${formatNumber(totals.current)} m3`)}
    ${summaryCardHtml("Genel toplam tutar", formatCurrency(totals.amount))}
  `;

  document.getElementById("concreteClassSummary").innerHTML = ["C25", "C30", "C35", "C40"].map((className) => {
    const item = totals.byClass[className] || { net: 0, current: 0, amount: 0 };
    return `
      <article class="progress-class-card">
        <strong>${className}</strong>
        <span>Net: ${formatNumber(item.net)} m3</span>
        <span>Bu hakediş: ${formatNumber(item.current)} m3</span>
        <b>${formatCurrency(item.amount)}</b>
      </article>
    `;
  }).join("");
}

function summaryCardHtml(label, value) {
  return `<article class="metric progress-summary-card"><span>${label}</span><strong>${value}</strong></article>`;
}

function renderSteelProgress() {
  const progress = state.steelProgress;
  document.getElementById("steelProgressProjectName").value = progress.projectName || "";
  document.getElementById("steelProgressNo").value = progress.progressNo || "";
  document.getElementById("steelProgressDate").value = progress.date || today;
  renderSteelPriceCards();

  const tbody = document.getElementById("steelProgressRows");
  tbody.innerHTML = "";
  const rows = progress.rows.length ? progress.rows : [createSteelProgressRow()];
  if (!progress.rows.length) {
    state.steelProgress.rows = rows;
    saveState();
  }
  rows.forEach((row) => tbody.append(steelProgressRowElement(row)));
  renderSteelProgressTotals();
}

function renderSteelPriceCards() {
  document.getElementById("steelPriceCards").innerHTML = rebarDiameters.map((item) => `
    <article class="rebar-price-card">
      <strong>${item.diameter}</strong>
      <span>${formatNumber(item.kgm)} kg/m</span>
      <label>₺/kg<input data-steel-price="${item.diameter}" type="number" min="0" step="0.01" value="${escapeHtml(state.steelProgress.prices[item.diameter] || "")}" /></label>
    </article>
  `).join("");
}

function steelProgressRowElement(row) {
  const tr = document.createElement("tr");
  tr.dataset.steelRow = row.id;
  tr.innerHTML = `
    <td>${steelSelectHtml("element", ["Kolon", "Kiriş", "Döşeme", "Temel/Radye", "Perde", "Merdiven", "Diğer"], row.element)}</td>
    <td><input data-steel-field="floor" value="${escapeHtml(row.floor)}" /></td>
    <td>${steelSelectHtml("diameter", rebarDiameters.map((item) => item.diameter), row.diameter)}</td>
    <td><input data-steel-field="count" type="number" min="0" step="1" value="${escapeHtml(row.count)}" /></td>
    <td><input data-steel-field="length" type="number" min="0" step="0.01" value="${escapeHtml(row.length)}" /></td>
    <td><input class="calculated-input" data-steel-calc="kgm" readonly /></td>
    <td><input class="calculated-input" data-steel-calc="gross" readonly /></td>
    <td><input data-steel-field="deduction" type="number" min="0" step="0.01" value="${escapeHtml(row.deduction)}" /></td>
    <td><input class="calculated-input" data-steel-calc="net" readonly /></td>
    <td><input data-steel-field="previous" type="number" min="0" step="0.01" value="${escapeHtml(row.previous)}" /></td>
    <td><input class="calculated-input" data-steel-calc="current" readonly /></td>
    <td><input class="calculated-input" data-steel-calc="unitPrice" readonly /></td>
    <td><input class="calculated-input currency-input" data-steel-calc="amount" readonly /></td>
    <td><button class="tiny-button" type="button" title="Satırı sil" data-delete-steel-row="${row.id}">x</button></td>
  `;
  updateSteelProgressRowDisplay(tr, row);
  return tr;
}

function steelSelectHtml(field, options, value) {
  return `
    <select data-steel-field="${field}">
      ${options.map((option) => `<option ${option === value ? "selected" : ""}>${option}</option>`).join("")}
    </select>
  `;
}

function createSteelProgressRow() {
  return normalizeSteelProgressRow({ id: crypto.randomUUID() });
}

function handleSteelProgressMetaInput(event) {
  const map = {
    steelProgressProjectName: "projectName",
    steelProgressNo: "progressNo",
    steelProgressDate: "date"
  };
  const key = map[event.target.id];
  if (!key) return;
  state.steelProgress[key] = event.target.value;
  saveState();
}

function handleSteelPriceInput(event) {
  const diameter = event.target.dataset.steelPrice;
  if (!diameter) return;
  state.steelProgress.prices[diameter] = event.target.value;
  saveState();
  renderSteelRowsOnly();
}

function handleSteelProgressInput(event) {
  const field = event.target.dataset.steelField;
  if (!field) return;
  const tr = event.target.closest("[data-steel-row]");
  const row = state.steelProgress.rows.find((item) => item.id === tr.dataset.steelRow);
  if (!row) return;
  row[field] = event.target.value;
  saveState();
  updateSteelProgressRowDisplay(tr, row);
  renderSteelProgressTotals();
}

function handleSteelProgressClick(event) {
  const button = event.target.closest("[data-delete-steel-row]");
  if (!button) return;
  state.steelProgress.rows = state.steelProgress.rows.filter((row) => row.id !== button.dataset.deleteSteelRow);
  if (!state.steelProgress.rows.length) state.steelProgress.rows.push(createSteelProgressRow());
  saveState();
  renderSteelRowsOnly();
}

function addSteelProgressRow() {
  state.steelProgress.rows.push(createSteelProgressRow());
  saveState();
  renderSteelRowsOnly();
}

function renderSteelRowsOnly() {
  const tbody = document.getElementById("steelProgressRows");
  tbody.innerHTML = "";
  state.steelProgress.rows.forEach((row) => tbody.append(steelProgressRowElement(row)));
  renderSteelProgressTotals();
}

function updateSteelProgressRowDisplay(tr, row) {
  const totals = calculateSteelProgressRow(row);
  tr.querySelector('[data-steel-calc="kgm"]').value = formatNumber(totals.kgm);
  tr.querySelector('[data-steel-calc="gross"]').value = formatNumber(totals.gross);
  tr.querySelector('[data-steel-calc="net"]').value = formatNumber(totals.net);
  tr.querySelector('[data-steel-calc="current"]').value = formatNumber(totals.current);
  tr.querySelector('[data-steel-calc="unitPrice"]').value = formatNumber(totals.unitPrice);
  tr.querySelector('[data-steel-calc="amount"]').value = formatCurrency(totals.amount);
}

function calculateSteelProgressRow(row) {
  const kgm = rebarDiameters.find((item) => item.diameter === row.diameter)?.kgm || 0;
  const unitPrice = parseProgressNumber(state.steelProgress.prices[row.diameter]);
  const gross = parseProgressNumber(row.count) * parseProgressNumber(row.length) * kgm;
  const net = Math.max(gross - parseProgressNumber(row.deduction), 0);
  const current = Math.max(net - parseProgressNumber(row.previous), 0);
  const amount = current * unitPrice;
  return { kgm, gross, net, current, unitPrice, amount };
}

function renderSteelProgressTotals() {
  const totals = state.steelProgress.rows.reduce((acc, row) => {
    const rowTotals = calculateSteelProgressRow(row);
    acc.gross += rowTotals.gross;
    acc.net += rowTotals.net;
    acc.current += rowTotals.current;
    acc.amount += rowTotals.amount;
    const diameterTotal = acc.byDiameter[row.diameter] || { net: 0, current: 0, amount: 0 };
    diameterTotal.net += rowTotals.net;
    diameterTotal.current += rowTotals.current;
    diameterTotal.amount += rowTotals.amount;
    acc.byDiameter[row.diameter] = diameterTotal;
    return acc;
  }, { gross: 0, net: 0, current: 0, amount: 0, byDiameter: {} });

  document.getElementById("steelProgressTotals").innerHTML = `
    ${summaryCardHtml("Toplam brüt kg", `${formatNumber(totals.gross)} kg`)}
    ${summaryCardHtml("Toplam net kg", `${formatNumber(totals.net)} kg`)}
    ${summaryCardHtml("Bu hakediş toplam kg", `${formatNumber(totals.current)} kg`)}
    ${summaryCardHtml("Genel toplam tutar", formatCurrency(totals.amount))}
  `;

  document.getElementById("steelDiameterSummary").innerHTML = rebarDiameters.map((item) => {
    const total = totals.byDiameter[item.diameter] || { net: 0, current: 0, amount: 0 };
    return `
      <article class="progress-class-card">
        <strong>${item.diameter}</strong>
        <span>Net: ${formatNumber(total.net)} kg</span>
        <span>Bu hakediş: ${formatNumber(total.current)} kg</span>
        <b>${formatCurrency(total.amount)}</b>
      </article>
    `;
  }).join("");
}

function renderAreaProgress(moduleKey) {
  const config = areaProgressModules[moduleKey];
  const progress = state[moduleKey];
  if (!config || !progress) return;

  setAreaMetaValue(moduleKey, "ProjectName", progress.projectName || "");
  setAreaMetaValue(moduleKey, "No", progress.progressNo || "");
  setAreaMetaValue(moduleKey, "Date", progress.date || today);

  if (config.type === "single") {
    const unitPriceInput = document.getElementById(`${moduleKey}UnitPrice`);
    if (unitPriceInput) unitPriceInput.value = progress.unitPrice || "";
  } else {
    config.groups.forEach((group) => {
      const priceInput = document.querySelector(`[data-area-price="${moduleKey}"][data-area-group="${group.key}"]`);
      if (priceInput) priceInput.value = progress.prices[group.key] || "";
    });
  }

  config.groups.forEach((group) => renderAreaProgressRows(moduleKey, group.key));
  renderAreaProgressTotals(moduleKey);
}

function setAreaMetaValue(moduleKey, suffix, value) {
  const input = document.getElementById(`${moduleKey}${suffix}`);
  if (input) input.value = value;
}

function renderAreaProgressRows(moduleKey, groupKey) {
  const rows = getAreaRows(moduleKey, groupKey);
  const tbody = document.querySelector(`[data-area-rows="${moduleKey}"][data-area-group="${groupKey}"]`);
  if (!tbody) return;
  if (!rows.length) {
    rows.push(createAreaProgressRow());
    saveState();
  }
  tbody.innerHTML = "";
  rows.forEach((row) => tbody.append(areaProgressRowElement(moduleKey, groupKey, row)));
}

function areaProgressRowElement(moduleKey, groupKey, row) {
  const tr = document.createElement("tr");
  tr.dataset.areaRow = row.id;
  tr.dataset.areaModule = moduleKey;
  tr.dataset.areaGroup = groupKey;
  tr.innerHTML = `
    <td><input data-area-field="location" placeholder="Örn. Daire 1 salon" value="${escapeHtml(row.location)}" /></td>
    <td><input data-area-field="floor" value="${escapeHtml(row.floor)}" /></td>
    <td><input data-area-field="width" type="number" min="0" step="0.01" value="${escapeHtml(row.width)}" /></td>
    <td><input data-area-field="length" type="number" min="0" step="0.01" value="${escapeHtml(row.length)}" /></td>
    <td><input class="calculated-input" data-area-calc="gross" readonly /></td>
    <td><input data-area-field="deduction" type="number" min="0" step="0.01" value="${escapeHtml(row.deduction)}" /></td>
    <td><input class="calculated-input" data-area-calc="net" readonly /></td>
    <td><input data-area-field="previous" type="number" min="0" step="0.01" value="${escapeHtml(row.previous)}" /></td>
    <td><input class="calculated-input" data-area-calc="current" readonly /></td>
    <td><input class="calculated-input currency-input" data-area-calc="amount" readonly /></td>
    <td><button class="tiny-button" type="button" title="Satırı sil" data-delete-area-row="${row.id}">x</button></td>
  `;
  updateAreaProgressRowDisplay(tr, moduleKey, groupKey, row);
  return tr;
}

function createAreaProgressRow() {
  return normalizeAreaProgressRow({ id: crypto.randomUUID() });
}

function getAreaRows(moduleKey, groupKey) {
  const config = areaProgressModules[moduleKey];
  if (config.type === "single") return state[moduleKey].rows;
  if (!state[moduleKey].groups[groupKey]) state[moduleKey].groups[groupKey] = [];
  return state[moduleKey].groups[groupKey];
}

function getAreaUnitPrice(moduleKey, groupKey) {
  const config = areaProgressModules[moduleKey];
  if (config.type === "single") return state[moduleKey].unitPrice;
  return state[moduleKey].prices[groupKey];
}

function handleAreaProgressMetaInput(event) {
  const moduleKey = event.target.dataset.areaProgressMeta;
  const field = event.target.dataset.areaMetaField;
  if (!moduleKey || !field || !state[moduleKey]) return;
  state[moduleKey][field] = event.target.value;
  saveState();
  if (field === "unitPrice") renderAreaProgressRowsOnly(moduleKey);
}

function handleAreaProgressPriceInput(event) {
  const moduleKey = event.target.dataset.areaPrice;
  const groupKey = event.target.dataset.areaGroup;
  if (!moduleKey || !groupKey || !state[moduleKey]?.prices) return;
  state[moduleKey].prices[groupKey] = event.target.value;
  saveState();
  renderAreaProgressRowsOnly(moduleKey);
}

function handleAreaProgressRowInput(event) {
  const field = event.target.dataset.areaField;
  if (!field) return;
  const tr = event.target.closest("[data-area-row]");
  const row = getAreaRows(tr.dataset.areaModule, tr.dataset.areaGroup).find((item) => item.id === tr.dataset.areaRow);
  if (!row) return;
  row[field] = event.target.value;
  saveState();
  updateAreaProgressRowDisplay(tr, tr.dataset.areaModule, tr.dataset.areaGroup, row);
  renderAreaProgressTotals(tr.dataset.areaModule);
}

function handleAreaProgressRowClick(event) {
  const button = event.target.closest("[data-delete-area-row]");
  if (!button) return;
  const tbody = event.currentTarget;
  const moduleKey = tbody.dataset.areaRows;
  const groupKey = tbody.dataset.areaGroup;
  const rows = getAreaRows(moduleKey, groupKey);
  const nextRows = rows.filter((row) => row.id !== button.dataset.deleteAreaRow);
  if (areaProgressModules[moduleKey].type === "single") {
    state[moduleKey].rows = nextRows.length ? nextRows : [createAreaProgressRow()];
  } else {
    state[moduleKey].groups[groupKey] = nextRows.length ? nextRows : [createAreaProgressRow()];
  }
  saveState();
  renderAreaProgressRows(moduleKey, groupKey);
  renderAreaProgressTotals(moduleKey);
}

function addAreaProgressRow(moduleKey, groupKey) {
  getAreaRows(moduleKey, groupKey).push(createAreaProgressRow());
  saveState();
  renderAreaProgressRows(moduleKey, groupKey);
  renderAreaProgressTotals(moduleKey);
}

function renderAreaProgressRowsOnly(moduleKey) {
  areaProgressModules[moduleKey].groups.forEach((group) => renderAreaProgressRows(moduleKey, group.key));
  renderAreaProgressTotals(moduleKey);
}

function updateAreaProgressRowDisplay(tr, moduleKey, groupKey, row) {
  const totals = calculateAreaProgressRow(row, getAreaUnitPrice(moduleKey, groupKey));
  tr.querySelector('[data-area-calc="gross"]').value = formatNumber(totals.gross);
  tr.querySelector('[data-area-calc="net"]').value = formatNumber(totals.net);
  tr.querySelector('[data-area-calc="current"]').value = formatNumber(totals.current);
  tr.querySelector('[data-area-calc="amount"]').value = formatCurrency(totals.amount);
}

function calculateAreaProgressRow(row, unitPrice) {
  const gross = parseProgressNumber(row.width) * parseProgressNumber(row.length);
  const net = Math.max(gross - parseProgressNumber(row.deduction), 0);
  const current = Math.max(net - parseProgressNumber(row.previous), 0);
  const amount = current * parseProgressNumber(unitPrice);
  return { gross, net, current, amount };
}

function renderAreaProgressTotals(moduleKey) {
  const config = areaProgressModules[moduleKey];
  const groupTotals = config.groups.map((group) => {
    const totals = getAreaRows(moduleKey, group.key).reduce((acc, row) => {
      const rowTotals = calculateAreaProgressRow(row, getAreaUnitPrice(moduleKey, group.key));
      acc.gross += rowTotals.gross;
      acc.net += rowTotals.net;
      acc.current += rowTotals.current;
      acc.amount += rowTotals.amount;
      return acc;
    }, { gross: 0, net: 0, current: 0, amount: 0 });
    return { ...group, totals };
  });

  const grand = groupTotals.reduce((acc, group) => {
    acc.gross += group.totals.gross;
    acc.net += group.totals.net;
    acc.current += group.totals.current;
    acc.amount += group.totals.amount;
    return acc;
  }, { gross: 0, net: 0, current: 0, amount: 0 });

  const target = document.getElementById(config.totalsId);
  if (!target) return;
  if (config.type === "single") {
    target.className = "progress-summary-grid";
    target.innerHTML = `
      ${summaryCardHtml("Toplam brüt m²", `${formatNumber(grand.gross)} m²`)}
      ${summaryCardHtml("Toplam net m²", `${formatNumber(grand.net)} m²`)}
      ${summaryCardHtml("Bu hakediş toplam m²", `${formatNumber(grand.current)} m²`)}
      ${summaryCardHtml("Genel toplam tutar", formatCurrency(grand.amount))}
    `;
    return;
  }

  target.className = "progress-class-summary area-total-summary";
  target.innerHTML = groupTotals.map((group) => `
    <article class="progress-class-card">
      <strong>${group.title}</strong>
      <span>Toplam net: ${formatNumber(group.totals.net)} m²</span>
      <span>Bu hakediş: ${formatNumber(group.totals.current)} m²</span>
      <b>${formatCurrency(group.totals.amount)}</b>
    </article>
  `).join("") + `
    <article class="progress-class-card total-card">
      <strong>Genel toplam</strong>
      <span>Toplam net: ${formatNumber(grand.net)} m²</span>
      <span>Bu hakediş: ${formatNumber(grand.current)} m²</span>
      <b>${formatCurrency(grand.amount)}</b>
    </article>
  `;
}

function itemCard({ title, meta, body, foot, badge, collection, id }) {
  const card = document.createElement("article");
  card.className = "item";
  const badgeClass = badge === "Yüksek" || badge === "Açık" ? "danger" : badge === "Orta" || badge === "Takipte" ? "warn" : "";
  const canEdit = ["plans", "prePlans", "orders"].includes(collection);
  card.innerHTML = `
    <div class="item-top">
      <div>
        <strong>${escapeHtml(title)}</strong>
        <p>${escapeHtml(meta || "")}</p>
      </div>
      <div class="item-actions">
        ${badge ? `<span class="badge ${badgeClass}">${escapeHtml(badge)}</span>` : ""}
        ${canEdit ? `<button class="tiny-button" title="Düzenle" data-edit="${collection}" data-id="${id}">✎</button>` : ""}
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
        <button class="tiny-button" title="Düzenle" data-edit="plans" data-id="${plan.id}">✎</button>
        <button class="tiny-button" title="Sil" data-delete="plans" data-id="${plan.id}">x</button>
      </div>
    </summary>
    ${crewHtml}
    ${plan.note ? `<p>${escapeHtml(plan.note)}</p>` : ""}
  `;
  return card;
}

function prePlanCard(prePlan) {
  const card = document.createElement("details");
  card.className = "item";
  const tasks = getPrepTasks(prePlan);
  const taskHtml = tasks.length
    ? tasks.map((task) => `
        <div class="item-section">
          <strong>${escapeHtml(task.title || "Yapılacak iş")}</strong>
          <p>${escapeHtml(task.note || "Not girilmedi")} / ${escapeHtml(task.status || "Yapılacak")}</p>
        </div>
      `).join("")
    : `<p>${escapeHtml(prePlan.summary || "Hazırlık detayı yok")}</p>`;

  card.innerHTML = `
    <summary class="item-top">
      <div>
        <strong>${escapeHtml(planLabelById(prePlan.planId, prePlan))}</strong>
        <p>${escapeHtml(prePlan.site || "Şantiye yok")}</p>
      </div>
      <div class="item-actions">
        <button class="tiny-button" title="Düzenle" data-edit="prePlans" data-id="${prePlan.id}">✎</button>
        <button class="tiny-button" title="Sil" data-delete="prePlans" data-id="${prePlan.id}">x</button>
      </div>
    </summary>
    ${taskHtml}
    ${prePlan.note ? `<p>${escapeHtml(prePlan.note)}</p>` : ""}
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

  const editButton = event.target.closest("[data-edit]");
  if (editButton) {
    event.preventDefault();
    event.stopPropagation();
    editRecord(editButton.dataset.edit, editButton.dataset.id);
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
  switchView("records");
  switchRecordPanel("reportRecord");
  const form = document.getElementById("reportForm");
  form.elements.date.value = report.date;
  form.elements.site.value = report.site;
  form.elements.note.value = report.note || "";
  resetCrewRows("crewBuilder", getReportCrews(report));
  updateReportFormMode();
  form.scrollIntoView({ behavior: "smooth", block: "start" });
}

function editRecord(collection, id) {
  if (collection === "plans") return editPlan(id);
  if (collection === "prePlans") return editPrePlan(id);
  if (collection === "orders") return editOrder(id);
}

function editPlan(id) {
  const plan = state.plans.find((item) => item.id === id);
  if (!plan) return;
  editingPlanId = id;
  switchView("records");
  switchRecordPanel("planRecord");
  const form = document.getElementById("planForm");
  form.elements.date.value = toDateKey(plan.date);
  form.elements.site.value = plan.site;
  form.elements.title.value = plan.title || "";
  form.elements.note.value = plan.note || "";
  resetCrewRows("planCrewBuilder", getReportCrews(plan));
  updatePlanFormMode();
  form.scrollIntoView({ behavior: "smooth", block: "start" });
}

function editPrePlan(id) {
  const prePlan = state.prePlans.find((item) => item.id === id);
  if (!prePlan) return;
  editingPrePlanId = id;
  switchView("records");
  switchRecordPanel("prePlanRecord");
  const form = document.getElementById("prePlanForm");
  form.elements.planId.value = prePlan.planId;
  form.elements.note.value = prePlan.note || "";
  resetPrepTaskRows(getPrepTasks(prePlan));
  updatePrePlanFormMode();
  form.scrollIntoView({ behavior: "smooth", block: "start" });
}

function editOrder(id) {
  const order = state.orders.find((item) => item.id === id);
  if (!order) return;
  editingOrderId = id;
  switchView("records");
  switchRecordPanel("orderRecord");
  resetOrderForms(false);
  const type = normalizeOrderType(order.type);
  switchOrderPanel(getOrderPanelForType(type));
  if (type === "Beton") fillConcreteOrderForm(order);
  if (type === "Demir") fillRebarOrderForm(order);
  if (type === "Diğer") fillOtherOrderForm(order);
  updateOrderFormMode(type);
  getOrderFormForType(type).scrollIntoView({ behavior: "smooth", block: "start" });
}

function fillConcreteOrderForm(order) {
  const form = document.getElementById("concreteOrderForm");
  form.elements.date.value = toDateKey(order.date);
  form.elements.site.value = order.site;
  form.elements.concreteClass.value = order.concreteClass || order.detail || "";
  form.elements.volume.value = order.volume || String(order.amount || "").replace(/[^\d.,]/g, "").replace(",", ".");
  form.elements.pourLocation.value = order.pourLocation || "";
  form.elements.company.value = order.company || "";
  form.elements.status.value = order.status || "Teslim alındı";
}

function fillRebarOrderForm(order) {
  const form = document.getElementById("rebarOrderForm");
  form.elements.date.value = toDateKey(order.date);
  form.elements.site.value = order.site;
  form.elements.company.value = order.company || "";
  form.elements.status.value = order.status || "Teslim alındı";
  resetRebarRows(getRebarItems(order));
}

function fillOtherOrderForm(order) {
  const form = document.getElementById("otherOrderForm");
  form.elements.date.value = toDateKey(order.date);
  form.elements.site.value = order.site;
  form.elements.product.value = order.product || order.detail || "";
  form.elements.amount.value = order.amount || "";
  form.elements.company.value = order.company || "";
  form.elements.status.value = order.status || "Sipariş verildi";
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

function openCalculatorModal() {
  document.getElementById("calculatorModal").hidden = false;
  updateCalculatorResult();
}

function closeCalculatorModal() {
  document.getElementById("calculatorModal").hidden = true;
}

function switchCalculatorPanel(panelId) {
  document.querySelectorAll("[data-calculator-panel]").forEach((button) => {
    button.classList.toggle("active", button.dataset.calculatorPanel === panelId);
  });
  document.querySelectorAll(".calculator-section").forEach((section) => {
    section.classList.toggle("active", section.id === panelId);
  });
  updateCalculatorResult();
}

function clearCalculator() {
  document.querySelectorAll(".calculator-section.active [data-calculator-input]").forEach((input) => {
    if (input.tagName === "SELECT") return;
    input.value = "";
  });
  updateCalculatorResult();
}

function updateCalculatorResult() {
  const activePanel = document.querySelector(".calculator-section.active");
  if (!activePanel) return;
  const result = calculateProgressHelper(activePanel.id);
  document.getElementById("calculatorResult").textContent = result;
}

function calculateProgressHelper(panelId) {
  const value = (name) => parseProgressNumber(document.querySelector(`[data-calculator-input="${name}"]`)?.value);
  if (panelId === "basicCalculator") {
    const first = value("basicA");
    const second = value("basicB");
    const operator = document.querySelector('[data-calculator-input="basicOperator"]')?.value || "+";
    const result = operator === "+" ? first + second : operator === "-" ? first - second : operator === "*" ? first * second : second ? first / second : 0;
    return formatNumber(result);
  }
  if (panelId === "areaCalculator") {
    const gross = value("areaWidth") * value("areaLength");
    return `${formatNumber(Math.max(gross - value("areaDeduction"), 0))} m²`;
  }
  if (panelId === "volumeCalculator") {
    const count = value("volumeCount") || 1;
    const gross = count * value("volumeWidth") * value("volumeLength") * value("volumeHeight");
    return `${formatNumber(Math.max(gross - value("volumeDeduction"), 0))} m³`;
  }
  if (panelId === "rebarCalculator") {
    const kgm = value("rebarDiameter");
    const gross = value("rebarCount") * value("rebarLength") * kgm;
    return `${formatNumber(Math.max(gross - value("rebarDeduction"), 0))} kg`;
  }
  if (panelId === "amountCalculator") {
    return formatCurrency(value("amountQuantity") * value("amountUnitPrice"));
  }
  return "0";
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

function cancelPlanEdit() {
  editingPlanId = "";
  const form = document.getElementById("planForm");
  form.reset();
  form.querySelectorAll('input[type="date"]').forEach((input) => {
    input.value = today;
  });
  resetCrewRows("planCrewBuilder");
  updatePlanFormMode();
}

function updatePlanFormMode() {
  document.getElementById("planFormTitle").textContent = editingPlanId ? "Planlamayı Düzenle" : "Planlama Gir";
  document.getElementById("cancelPlanEdit").hidden = !editingPlanId;
}

function cancelPrePlanEdit() {
  editingPrePlanId = "";
  const form = document.getElementById("prePlanForm");
  form.reset();
  resetPrepTaskRows();
  updatePrePlanFormMode();
}

function updatePrePlanFormMode() {
  document.getElementById("prePlanFormTitle").textContent = editingPrePlanId ? "Plan Öncesi Hazırlığı Düzenle" : "Plan Öncesi Hazırlık Gir";
  document.getElementById("cancelPrePlanEdit").hidden = !editingPrePlanId;
}

function cancelOrderEdit() {
  resetOrderForms();
}

function resetOrderForms(clearEditing = true) {
  if (clearEditing) editingOrderId = "";
  ["concreteOrderForm", "rebarOrderForm", "otherOrderForm"].forEach((id) => {
    const form = document.getElementById(id);
    form.reset();
    form.querySelectorAll('input[type="date"]').forEach((input) => {
      input.value = today;
    });
  });
  resetRebarRows();
  updateOrderFormMode();
}

function updateOrderFormMode(activeType = "") {
  const editingType = editingOrderId ? activeType : "";
  document.getElementById("concreteOrderFormTitle").textContent = editingType === "Beton" ? "Beton Siparişini Düzenle" : "Beton Siparişi";
  document.getElementById("rebarOrderFormTitle").textContent = editingType === "Demir" ? "Demir Siparişini Düzenle" : "Demir Siparişi";
  document.getElementById("otherOrderFormTitle").textContent = editingType === "Diğer" ? "Diğer Siparişi Düzenle" : "Diğer Siparişler";
  document.querySelectorAll("[data-cancel-order-edit]").forEach((button) => {
    button.hidden = !editingOrderId;
  });
}

function getOrderFormForType(type) {
  if (type === "Beton") return document.getElementById("concreteOrderForm");
  if (type === "Demir") return document.getElementById("rebarOrderForm");
  return document.getElementById("otherOrderForm");
}

function getOrderPanelForType(type) {
  if (type === "Beton") return "concreteOrderPanel";
  if (type === "Demir") return "rebarOrderPanel";
  return "otherOrderPanel";
}

function planLabel(plan) {
  return `${formatDate(plan.date)} - ${plan.site || "Şantiye yok"} - ${plan.title || "Plan"}`;
}

function planLabelById(planId, fallback = {}) {
  const plan = state.plans.find((item) => item.id === planId);
  if (plan) return planLabel(plan);
  return `${fallback.date ? formatDate(fallback.date) : "Tarih yok"} - ${fallback.site || "Şantiye yok"} - ${fallback.planTitle || "Plan"}`;
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

async function restoreFromSheetsIfLocalDataMissing() {
  if (!settings.scriptUrl || isRestoringFromSheets || hasAnyLocalData(state)) return;
  isRestoringFromSheets = true;
  try {
    setSyncStatus("Cihazda kayıt görünmüyor. Sheets'ten otomatik geri yükleme deneniyor...");
    const response = await loadSheetsData();
    const remoteState = normalizeRemoteState(response.data || {});
    if (!hasAnyLocalData(remoteState)) {
      setSyncStatus("Cihazda kayıt yok. Bağlı Sheets dosyasında da kayıt bulunamadı.");
      return;
    }
    state = { ...state, ...remoteState };
    saveState();
    render();
    setSyncStatus(`Kayıtlar Sheets'ten geri yüklendi: ${countLocalRecords(state)} kayıt.`);
  } catch (error) {
    setSyncStatus(`Otomatik geri yükleme hatası: ${error.message}`);
  } finally {
    isRestoringFromSheets = false;
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
    plans: Array.isArray(remote.plans) ? remote.plans : [],
    prePlans: Array.isArray(remote.prePlans) ? remote.prePlans : [],
    orders: Array.isArray(remote.orders) ? remote.orders : [],
    issues: Array.isArray(remote.issues) ? remote.issues : []
  };
}

function hasAnyLocalData(data) {
  return countLocalRecords(data) > 0;
}

function countLocalRecords(data) {
  return ["sites", "reports", "plans", "prePlans", "orders", "issues"].reduce((total, key) => {
    return total + (Array.isArray(data?.[key]) ? data[key].length : 0);
  }, 0);
}

function requireScriptUrl() {
  settings.scriptUrl = document.getElementById("scriptUrl").value.trim() || defaultScriptUrl;
  document.getElementById("scriptUrl").value = settings.scriptUrl;
  saveSettings();
  if (settings.scriptUrl) return true;
  setSyncStatus("Önce Apps Script web app URL'sini girmen gerekiyor.");
  switchView("sheets");
  return false;
}

function setSyncStatus(message) {
  document.getElementById("syncStatus").textContent = message;
}

function addRebarRow(diameter = "", quantity = "") {
  const builder = document.getElementById("rebarRows");
  const row = document.createElement("div");
  row.className = "line-row";
  row.innerHTML = `
    <label>Çap<input name="diameter" required placeholder="Örn. Ø12" value="${escapeHtml(diameter)}" /></label>
    <label>Miktar<input name="quantity" required placeholder="Örn. 2 ton" value="${escapeHtml(quantity)}" /></label>
    <button class="tiny-button" type="button" title="Satırı kaldır">x</button>
  `;
  row.querySelector("button").addEventListener("click", () => {
    if (builder.querySelectorAll(".line-row").length > 1) {
      row.remove();
    }
  });
  builder.append(row);
}

function resetRebarRows(items = [{ diameter: "", quantity: "" }]) {
  const builder = document.getElementById("rebarRows");
  builder.innerHTML = "";
  const rows = items.length ? items : [{ diameter: "", quantity: "" }];
  rows.forEach((item) => addRebarRow(item.diameter, item.quantity));
}

function collectRebarRows() {
  return [...document.querySelectorAll("#rebarRows .line-row")]
    .map((row) => ({
      diameter: row.querySelector('[name="diameter"]')?.value.trim() || "",
      quantity: row.querySelector('[name="quantity"]')?.value.trim() || ""
    }))
    .filter((item) => item.diameter || item.quantity);
}

function getRebarItems(order) {
  if (Array.isArray(order.rebarItems)) return order.rebarItems;
  if (!order.detail) return [];
  return String(order.detail).split("|").map((part) => {
    const [diameter = "", quantity = ""] = part.split("-").map((value) => value.trim());
    return { diameter, quantity };
  }).filter((item) => item.diameter || item.quantity);
}

function addPrepTaskRow(title = "", note = "", status = "Yapılacak") {
  const builder = document.getElementById("prepTaskBuilder");
  const row = document.createElement("div");
  row.className = "prep-task-row";
  row.innerHTML = `
    <div class="crew-row-header">
      <strong>İş</strong>
      <button class="tiny-button" type="button" title="İşi kaldır">x</button>
    </div>
    <label>Yapılacak iş<input name="taskTitle" required placeholder="Örn. Temizlik" value="${escapeHtml(title)}" /></label>
    <label>Açıklama<textarea name="taskNote" rows="3" placeholder="Kısa not">${escapeHtml(note)}</textarea></label>
    <label>Durum
      <select name="taskStatus">
        <option ${status === "Yapılacak" ? "selected" : ""}>Yapılacak</option>
        <option ${status === "Devam ediyor" ? "selected" : ""}>Devam ediyor</option>
        <option ${status === "Tamamlandı" ? "selected" : ""}>Tamamlandı</option>
      </select>
    </label>
  `;
  row.querySelector("button").addEventListener("click", () => {
    if (builder.querySelectorAll(".prep-task-row").length > 1) {
      row.remove();
    }
  });
  builder.append(row);
}

function resetPrepTaskRows(tasks = [{ title: "", note: "", status: "Yapılacak" }]) {
  const builder = document.getElementById("prepTaskBuilder");
  builder.innerHTML = "";
  const rows = tasks.length ? tasks : [{ title: "", note: "", status: "Yapılacak" }];
  rows.forEach((task) => addPrepTaskRow(task.title, task.note, task.status));
}

function collectPrepTaskRows() {
  return [...document.querySelectorAll("#prepTaskBuilder .prep-task-row")]
    .map((row) => ({
      title: row.querySelector('[name="taskTitle"]')?.value.trim() || "",
      note: row.querySelector('[name="taskNote"]')?.value.trim() || "",
      status: row.querySelector('[name="taskStatus"]')?.value || "Yapılacak"
    }))
    .filter((task) => task.title || task.note);
}

function getPrepTasks(prePlan) {
  if (Array.isArray(prePlan.tasks)) return prePlan.tasks;
  if (!prePlan.summary) return [];
  return String(prePlan.summary).split("|").map((part) => {
    const [title = "", statusPart = ""] = part.trim().split("(");
    return { title: title.trim(), note: "", status: statusPart.replace(")", "").trim() || "Yapılacak" };
  }).filter((task) => task.title);
}

function parseConcreteVolume(order) {
  return parseLocalizedNumber(order.volume || order.amount || "");
}

function parseWeightKg(value = "") {
  const text = String(value).toLowerCase();
  const amount = parseLocalizedNumber(text);
  if (!amount) return 0;
  if (text.includes("ton") || text.includes("tn")) return amount * 1000;
  if (!text.includes("kg")) return amount < 100 ? amount * 1000 : amount;
  return amount;
}

function parseLocalizedNumber(value = "") {
  const match = String(value).replace(",", ".").match(/-?\d+(\.\d+)?/);
  return match ? Number(match[0]) : 0;
}

function parseProgressNumber(value = "") {
  return Number(String(value).replace(",", ".")) || 0;
}

function formatNumber(value) {
  return new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 2 }).format(value || 0);
}

function formatCurrency(value) {
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 2 }).format(value || 0);
}

function formatWeight(valueKg) {
  if (!valueKg) return "0 ton";
  return `${formatNumber(valueKg / 1000)} ton`;
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

function parseDate(value) {
  if (value instanceof Date) return new Date(value);
  if (!value) return new Date(`${today}T12:00:00`);
  const rawValue = String(value);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(rawValue) ? new Date(`${rawValue}T12:00:00`) : new Date(rawValue);
  return isValidDate(date) ? date : new Date(`${today}T12:00:00`);
}

function isValidDate(value) {
  return value instanceof Date && !Number.isNaN(value.getTime());
}

function formatDate(value) {
  return new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "long", year: "numeric" }).format(parseDate(value));
}

function formatTime(value) {
  return new Intl.DateTimeFormat("tr-TR", { hour: "2-digit", minute: "2-digit" }).format(parseDate(value));
}

function toDateKey(value) {
  return parseDate(value).toISOString().slice(0, 10);
}

function addDays(value, amount) {
  const date = parseDate(value);
  date.setDate(date.getDate() + amount);
  return date;
}

function getWeekStart(value) {
  const date = parseDate(value);
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

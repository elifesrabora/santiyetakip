const DEFAULT_SPREADSHEET_ID = "1xfp9vUbdJpq39P1fZgYVb5rHqGr5b9HPKfujuai4YaM";

const TABLES = {
  sites: {
    sheetName: "Santiyeler",
    headers: ["id", "name", "location", "chief", "status", "note"]
  },
  reports: {
    sheetName: "Gunluk Raporlar",
    headers: ["id", "date", "site", "work", "crew", "plan", "note"]
  },
  orders: {
    sheetName: "Siparisler",
    headers: ["id", "date", "site", "type", "detail", "amount", "status"]
  },
  issues: {
    sheetName: "Sorunlar",
    headers: ["id", "site", "location", "description", "priority", "status"]
  }
};

function doPost(event) {
  try {
    const payload = JSON.parse(event.postData.contents || "{}");
    const spreadsheet = SpreadsheetApp.openById(payload.spreadsheetId || DEFAULT_SPREADSHEET_ID);
    prepareSheets(spreadsheet);

    if (payload.action === "save") {
      const totalRows = saveData(spreadsheet, payload.data || {});
      return jsonResponse({ ok: true, totalRows });
    }

    if (payload.action === "load") {
      return jsonResponse({ ok: true, data: loadData(spreadsheet) });
    }

    return jsonResponse({ ok: false, error: "Bilinmeyen action" });
  } catch (error) {
    return jsonResponse({ ok: false, error: error.message });
  }
}

function doGet(event) {
  try {
    const params = event.parameter || {};
    const spreadsheet = SpreadsheetApp.openById(params.spreadsheetId || DEFAULT_SPREADSHEET_ID);
    prepareSheets(spreadsheet);
    return response({ ok: true, data: loadData(spreadsheet) }, params.callback);
  } catch (error) {
    const callback = event && event.parameter ? event.parameter.callback : "";
    return response({ ok: false, error: error.message }, callback);
  }
}

function prepareSheets(spreadsheet) {
  Object.keys(TABLES).forEach((key) => {
    const table = TABLES[key];
    let sheet = spreadsheet.getSheetByName(table.sheetName);
    if (!sheet) sheet = spreadsheet.insertSheet(table.sheetName);
    const currentHeaders = sheet.getRange(1, 1, 1, table.headers.length).getValues()[0];
    const shouldWriteHeaders = table.headers.some((header, index) => currentHeaders[index] !== header);
    if (shouldWriteHeaders) {
      sheet.getRange(1, 1, 1, table.headers.length).setValues([table.headers]);
      sheet.setFrozenRows(1);
    }
  });
}

function saveData(spreadsheet, data) {
  let totalRows = 0;
  Object.keys(TABLES).forEach((key) => {
    const table = TABLES[key];
    const sheet = spreadsheet.getSheetByName(table.sheetName);
    const rows = Array.isArray(data[key]) ? data[key] : [];
    sheet.clearContents();
    sheet.getRange(1, 1, 1, table.headers.length).setValues([table.headers]);

    if (!rows.length) return;

    const values = rows.map((row) => table.headers.map((header) => row[header] || ""));
    sheet.getRange(2, 1, values.length, table.headers.length).setValues(values);
    totalRows += values.length;
  });
  return totalRows;
}

function loadData(spreadsheet) {
  const result = {};
  Object.keys(TABLES).forEach((key) => {
    const table = TABLES[key];
    const sheet = spreadsheet.getSheetByName(table.sheetName);
    if (!sheet || sheet.getLastRow() < 2) {
      result[key] = [];
      return;
    }

    const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, table.headers.length).getValues();
    result[key] = values
      .filter((row) => row.some((cell) => cell !== ""))
      .map((row) => {
        const item = {};
        table.headers.forEach((header, index) => {
          item[header] = normalizeCell(row[index]);
        });
        return item;
      });
  });
  return result;
}

function normalizeCell(value) {
  if (value instanceof Date) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), "yyyy-MM-dd");
  }
  return value === null || value === undefined ? "" : String(value);
}

function jsonResponse(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function response(payload, callback) {
  if (!callback) return jsonResponse(payload);
  return ContentService
    .createTextOutput(callback + "(" + JSON.stringify(payload) + ");")
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

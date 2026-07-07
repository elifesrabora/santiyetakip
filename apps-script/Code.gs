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
  plans: {
    sheetName: "Planlamalar",
    headers: ["id", "date", "site", "title", "crew", "detail", "note"]
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
    const payload = parsePostPayload(event);
    const spreadsheet = SpreadsheetApp.openById(payload.spreadsheetId || DEFAULT_SPREADSHEET_ID);
    prepareSheets(spreadsheet);

    if (payload.action === "append") {
      const item = typeof payload.item === "string" ? JSON.parse(payload.item) : payload.item || {};
      const result = appendData(spreadsheet, payload.collection, item);
      return postMessageResponse({
        ok: true,
        requestId: payload.requestId,
        sheetName: result.sheetName,
        rowNumber: result.rowNumber
      });
    }

    if (payload.action === "upsert") {
      const item = typeof payload.item === "string" ? JSON.parse(payload.item) : payload.item || {};
      const result = upsertData(spreadsheet, payload.collection, item);
      return jsonResponse({ ok: true, sheetName: result.sheetName, rowNumber: result.rowNumber });
    }

    if (payload.action === "save") {
      const totalRows = saveData(spreadsheet, payload.data || {});
      return jsonResponse({ ok: true, totalRows });
    }

    if (payload.action === "load") {
      return jsonResponse({ ok: true, data: loadData(spreadsheet) });
    }

    return postMessageResponse({ ok: false, requestId: payload.requestId, error: "Bilinmeyen action" });
  } catch (error) {
    const requestId = event && event.parameter ? event.parameter.requestId : "";
    return postMessageResponse({ ok: false, requestId: requestId, error: error.message });
  }
}

function parsePostPayload(event) {
  if (event.parameter && event.parameter.action) return event.parameter;
  return JSON.parse(event.postData.contents || "{}");
}

function doGet(event) {
  try {
    const params = event.parameter || {};
    const spreadsheet = SpreadsheetApp.openById(params.spreadsheetId || DEFAULT_SPREADSHEET_ID);
    prepareSheets(spreadsheet);

    if (params.action === "ping") {
      return jsonResponse({ ok: true, message: "Saha Defteri Apps Script calisiyor." });
    }

    if (params.action === "testAppend") {
      const result = appendData(spreadsheet, "sites", {
        id: "test-" + new Date().getTime(),
        name: "Test Santiyesi",
        location: "Baglanti testi",
        chief: "",
        status: "Aktif",
        note: "Apps Script test kaydi"
      });
      return jsonResponse({ ok: true, sheetName: result.sheetName, rowNumber: result.rowNumber });
    }

    if (params.action === "save") {
      const data = params.payload ? JSON.parse(params.payload) : {};
      const totalRows = saveData(spreadsheet, data);
      return response({ ok: true, totalRows }, params.callback);
    }

    if (params.action === "append") {
      const item = params.item ? JSON.parse(params.item) : {};
      const result = appendData(spreadsheet, params.collection, item);
      return response({ ok: true, sheetName: result.sheetName, rowNumber: result.rowNumber }, params.callback);
    }

    if (params.action === "upsert") {
      const item = params.item ? JSON.parse(params.item) : {};
      const result = upsertData(spreadsheet, params.collection, item);
      return response({ ok: true, sheetName: result.sheetName, rowNumber: result.rowNumber }, params.callback);
    }

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

function appendData(spreadsheet, collection, item) {
  const table = TABLES[collection];
  if (!table) throw new Error("Bilinmeyen tablo: " + collection);

  const sheet = spreadsheet.getSheetByName(table.sheetName);
  if (!sheet) throw new Error("Sayfa bulunamadı: " + table.sheetName);

  const values = table.headers.map((header) => item[header] || "");
  sheet.appendRow(values);

  return {
    sheetName: table.sheetName,
    rowNumber: sheet.getLastRow()
  };
}

function upsertData(spreadsheet, collection, item) {
  const table = TABLES[collection];
  if (!table) throw new Error("Bilinmeyen tablo: " + collection);

  const sheet = spreadsheet.getSheetByName(table.sheetName);
  if (!sheet) throw new Error("Sayfa bulunamadı: " + table.sheetName);

  const values = table.headers.map((header) => item[header] || "");
  const rowNumber = findRowById(sheet, item.id);
  if (rowNumber) {
    sheet.getRange(rowNumber, 1, 1, table.headers.length).setValues([values]);
    return { sheetName: table.sheetName, rowNumber: rowNumber };
  }

  sheet.appendRow(values);
  return {
    sheetName: table.sheetName,
    rowNumber: sheet.getLastRow()
  };
}

function findRowById(sheet, id) {
  if (!id || sheet.getLastRow() < 2) return 0;
  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
  for (let index = 0; index < values.length; index++) {
    if (String(values[index][0]) === String(id)) return index + 2;
  }
  return 0;
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

function postMessageResponse(payload) {
  const html = "<!doctype html><html><body><script>" +
    "window.parent.postMessage(" + JSON.stringify(payload) + ", '*');" +
    "</script></body></html>";
  return HtmlService
    .createHtmlOutput(html)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

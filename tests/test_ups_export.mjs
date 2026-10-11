// Regression checks: node tests/test_ups_export.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const exportSource = await fs.readFile(path.join(root, 'static/js/upsExportData.js'), 'utf8');
const moduleURL = `data:text/javascript;base64,${Buffer.from(exportSource).toString('base64')}`;
const { getUPSExportValue, buildUPSExportRows } = await import(moduleURL);
const appSource = await fs.readFile(path.join(root, 'app.py'), 'utf8');
const fieldOrderStr = appSource.match(/FIELD_ORDER\s*=\s*(\[[\s\S]*?\])\s*\n\s*app\s*=/)?.[1];
assert.ok(fieldOrderStr, 'FIELD_ORDER must remain defined');
const fieldOrder = JSON.parse(fieldOrderStr);
assert.equal(fieldOrder[12], 'Consignee Email', 'UPS email must stay in the original 13th column');

const records = [
  {
    'Contact Name': 'New recipient',
    'Consignee Email': 'new.recipient@example.com',
    'NR LISTU UPS': '',
    'State/Prov/Other': 'Outdated state',
    'state_prov_other': 'Current state',
    'Address 2': 'Second line',
    'QV Notif 1-Addr': 'custom.notification@example.com',
  },
  {
    'Contact Name': 'Existing shipment',
    'Consignee_Email': 'legacy@example.com',
    'NR LISTU UPS': '1ZV5358A6894985343',
  },
  {
    'Contact Name': 'Whitespace tracking',
    'Consignee Email': 'whitespace@example.com',
    'NR LISTU UPS': '   ',
  },
];

assert.equal(getUPSExportValue(records[0], 'Consignee Email'), 'new.recipient@example.com');
assert.equal(getUPSExportValue(records[1], 'Consignee Email'), 'legacy@example.com');
assert.equal(getUPSExportValue(records[0], 'State/Prov/Other'), 'Current state');
assert.equal(getUPSExportValue(records[0], 'Address 2'), 'Second line');
assert.equal(getUPSExportValue(records[0], 'QV Notif 1-Addr'), 'custom.notification@example.com');
assert.equal(getUPSExportValue(records[1], 'QV Notif 1-Addr'), 'justyna.nawrocka@chespa.eu');
assert.equal(getUPSExportValue(records[1], 'QV Notif 1-Excp'), '1');
const all = buildUPSExportRows(records, fieldOrder);
assert.equal(all.length, 3);
assert.equal(all[0].length, fieldOrder.length);
assert.equal(all[0][12], 'new.recipient@example.com');
assert.equal(all[1][12], 'legacy@example.com');
assert.equal(all[2][12], 'whitespace@example.com');
assert.equal(all[0][fieldOrder.indexOf('Address 2')], 'Second line');

const html = await fs.readFile(path.join(root, 'templates/dashboard.html'), 'utf8');
const filterBody = html.match(/headerFilterFunc:\s*function\(headerValue, rowValue\)\s*\{([\s\S]*?)\n\s*\},/)?.[1];
assert.ok(filterBody, 'UPS tracking header filter must be present');
const trackingFilter = new Function('headerValue', 'rowValue', filterBody);
for (const value of ['', ' ', null, undefined]) {
  assert.equal(trackingFilter('empty', value), true);
  assert.equal(trackingFilter('filled', value), false);
}
assert.equal(trackingFilter('empty', '1ZABC'), false);
assert.equal(trackingFilter('filled', '1ZABC'), true);
assert.equal(trackingFilter('', '1ZABC'), true);
assert.equal(trackingFilter('', ''), true);

// Test the actual event-handler export functions using a table stub that returns
// only rows that remain after the tracking header filter.
const main = await fs.readFile(path.join(root, 'static/js/main.js'), 'utf8');
const mainFuncs = main.slice(main.indexOf(' function exportSortedTableToXLSX('), main.indexOf('\ndocument.getElementById("download-sorted-xlsx")'));
const active = records.filter(row => trackingFilter('empty', row['NR LISTU UPS']));
assert.equal(active.length, 2);
let exportedWorkbook;
let downloadedBlob;
const table = {
  getData(range) {
    assert.equal(range, 'active', 'Export must use filtered data across all pages');
    return active;
  },
};
const XLSX = {
  utils: {
    aoa_to_sheet: rows => rows,
    book_new: () => ({ sheets: [] }),
    book_append_sheet: (book, sheet, name) => book.sheets.push({ name, sheet }),
  },
  writeFile: (book) => { exportedWorkbook = book; },
};
const URLmock = { createObjectURL: blob => { downloadedBlob = blob; return 'blob:test'; }, revokeObjectURL() {} };
const doc = {
  body: { appendChild() {} },
  createElement: () => ({ href: null, download: null, click() {}, remove() {} }),
};
const context = { buildUPSExportRows, table, XLSX, Blob, URL: URLmock, document: doc, setTimeout: () => {} };
vm.runInNewContext(`${mainFuncs}\nexportSortedTableToCSV(fieldOrder, 'test.csv');\nexportSortedTableToXLSX(fieldOrder, 'test.xlsx');`, {
  ...context,
  fieldOrder,
});
assert.ok(downloadedBlob, 'CSV generated');
assert.ok(exportedWorkbook, 'XLSX generated');
const csv = await downloadedBlob.text();
const csvLines = csv.split('\r\n');
assert.equal(csvLines.length, 2, 'CSV only includes untracked shipments');
assert.equal(csvLines[0].split(',')[12], '"new.recipient@example.com"');
assert.ok(csvLines[1].includes('"whitespace@example.com"'));
const xlsxRows = exportedWorkbook.sheets[0].sheet;
assert.equal(xlsxRows.length, 3, 'XLSX has one header and two filtered rows');
assert.equal(xlsxRows[0][12], 'Consignee Email');
assert.equal(xlsxRows[1][12], 'new.recipient@example.com');
assert.equal(xlsxRows[2][12], 'whitespace@example.com');
assert.equal(records[1]['QV Notif 1-Addr'], undefined, 'Export must not mutate table rows');
console.log('PASS: UPS tracking filter + CSV/XLSX email mapping + legacy data + original column order + filtered exports.');

// Run: node tests/test_keyword_search.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = await fs.readFile(path.join(root, 'static/js/keywordSearch.js'), 'utf8');
const moduleURL = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const { normalizeSearchText, matchesKeywordSearch, setupKeywordSearch } = await import(moduleURL);
const html = await fs.readFile(path.join(root, 'templates/dashboard.html'), 'utf8');
const main = await fs.readFile(path.join(root, 'static/js/main.js'), 'utf8');
assert.match(html, /id="keyword-search"/);
assert.match(html, /id="keyword-search-clear"/);
assert.match(html, /id="keyword-search-count"/);
assert.match(main, /setupKeywordSearch\(table\)/);
assert.equal(normalizeSearchText('ŁÓDŹ Żółć'), 'lodz zolc');

const records = [
  { 'Contact Name': 'Anna Kowalska', 'Company or Name': 'Danone Polska', 'NR LISTU UPS': '', 'Consignee Email': 'anna@example.com', '_private': 'secret123' },
  { 'Contact Name': 'Jan Nowak', 'Company or Name': 'Cedo Łódź', 'NR LISTU UPS': '1Z123456', 'Consignee Email': 'jan@example.com', '_private': 'secret123' },
  { 'Contact Name': 'Zoë Smith', 'Company or Name': 'Cedo', 'NR LISTU UPS': '', 'Consignee Email': 'zoe@example.com', '_private': 'secret123' },
];
const fields = ['Contact Name', 'Company or Name', 'NR LISTU UPS', 'Consignee Email'];
assert.equal(matchesKeywordSearch(records[0], { terms: ['anna', 'danone'], fields }), true);
assert.equal(matchesKeywordSearch(records[0], { terms: ['danone', 'kowalska'], fields }), true);
assert.equal(matchesKeywordSearch(records[0], { terms: ['danone', 'wrong'], fields }), false);
assert.equal(matchesKeywordSearch(records[1], { terms: ['lodz', 'cedo'], fields }), true);
assert.equal(matchesKeywordSearch(records[1], { terms: ['1z123'], fields }), true);
assert.equal(matchesKeywordSearch(records[2], { terms: ['zoe'], fields }), true);
assert.equal(matchesKeywordSearch(records[0], { terms: ['secret123'], fields }), false);
assert.equal(matchesKeywordSearch(records[1], { terms: [], fields }), true);

// Simulate the same additive behavior as Tabulator: server day/month records,
// header filters, keyword filter and getData('active') for UPS exports.
const controls = Object.fromEntries(['keyword-search', 'keyword-search-clear', 'keyword-search-count'].map(id => [id, {
  id, value: '', hidden: false, textContent: '', handlers: {},
  addEventListener(evt, callback) { this.handlers[evt] = callback; },
  focus() { this.focused = true; },
  trigger(evt) { this.handlers[evt]?.(); },
}]));
const rootMock = { getElementById: id => controls[id] };
let programFilter = null;
let programParams = null;
let trackingMode = 'all';
const eventHandlers = {};
const table = {
  getColumns: () => fields.map(field => ({ getField: () => field })),
  getData(mode) {
    if (mode !== 'active') return records;
    return records.filter(row => {
      const tracked = Boolean(row['NR LISTU UPS']?.trim());
      const matchesTracking = trackingMode === 'all' || (trackingMode === 'empty' ? !tracked : tracked);
      return matchesTracking && (!programFilter || programFilter(row, programParams));
    });
  },
  setFilter(fn, params) { programFilter = fn; programParams = params; this.emit('dataFiltered'); },
  clearFilter() { programFilter = null; programParams = null; this.emit('dataFiltered'); },
  on(name, fn) { (eventHandlers[name] ||= []).push(fn); },
  emit(name) { for (const fn of eventHandlers[name] || []) fn(); },
};
setupKeywordSearch(table, rootMock);
assert.equal(controls['keyword-search-count'].textContent, 'Showing 3 of 3 shipments');
assert.equal(controls['keyword-search-clear'].hidden, true);

const input = controls['keyword-search'];
input.value = '  CEDO   ŁÓDŹ ';
input.trigger('input');
await new Promise(resolve => setTimeout(resolve, 180));
assert.deepEqual(table.getData('active'), [records[1]], 'search all words across columns regardless of case/accents');
assert.equal(controls['keyword-search-count'].textContent, 'Showing 1 of 3 shipments');
assert.equal(controls['keyword-search-clear'].hidden, false);

trackingMode = 'empty';
table.emit('dataFiltered');
assert.deepEqual(table.getData('active'), [], 'UPS tracking empty + search must combine');
assert.equal(controls['keyword-search-count'].textContent, 'Showing 0 of 3 shipments');

input.value = 'Cedo';
input.trigger('input');
await new Promise(resolve => setTimeout(resolve, 180));
assert.deepEqual(table.getData('active'), [records[2]], 'filtered exports must contain only matching untracked rows');

controls['keyword-search-clear'].trigger('click');
assert.equal(input.value, '');
assert.equal(input.focused, true);
assert.equal(controls['keyword-search-clear'].hidden, true);
assert.deepEqual(table.getData('active'), [records[0], records[2]], 'clearing keyword must preserve tracking header filter');
assert.equal(controls['keyword-search-count'].textContent, 'Showing 2 of 3 shipments');
console.log('PASS: day/month-scoped column keyword search, multi-word AND, diacritics, UI counter, clear and UPS header-filter combinations.');

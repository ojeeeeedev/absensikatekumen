import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../apps-script/Code.js', import.meta.url), 'utf8');
const state = {};
function load() {
  const statusCell = { value: state.currentValue, getValue: vi.fn(() => statusCell.value), setValue: vi.fn((value) => { statusCell.value = value; }) };
  const sheet = {
    getLastColumn: () => 3,
    getRange: vi.fn((row) => row === 1 ? { getValues: () => [['Name', 'Topik R1', 'ID']] } : statusCell),
    getSheetByName: vi.fn(),
  };
  const ss = { getSheetByName: vi.fn((name) => name === 'Presensi' ? sheet : null) };
  const context = {
    console,
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => 'gas-secret' }) },
    CacheService: { getScriptCache: () => ({ get: () => JSON.stringify({ '1/sab/2': { r: 2, n: 'Ada', i: '' } }), put: vi.fn(), remove: vi.fn() }) },
    SpreadsheetApp: { getActiveSpreadsheet: () => ss },
    ContentService: { MimeType: { JSON: 'application/json' }, createTextOutput: (text) => ({ getContent: () => text, setMimeType: function () { return this; } }) },
  };
  vm.createContext(context); vm.runInContext(`${source}\nthis.doPost = doPost;`, context);
  return { doPost: context.doPost, statusCell };
}
function event(extra = {}) { return { postData: { contents: JSON.stringify({ api_secret: 'gas-secret', studentId: '1/SAB/2', week: 'R1', ...extra }) } }; }

describe('apps-script attendance contract', () => {
  beforeEach(() => { state.currentValue = false; });
  it('rejects an invalid GAS secret', () => {
    const { doPost } = load(); const result = JSON.parse(doPost(event({ api_secret: 'wrong' })).getContent());
    expect(result).toMatchObject({ status: 'error', message: 'Unauthorized: Invalid API secret' });
  });
  it('returns duplicate and does not set an already-attended cell', () => {
    state.currentValue = true; const { doPost, statusCell } = load(); const result = JSON.parse(doPost(event()).getContent());
    expect(result.status).toBe('duplicate'); expect(statusCell.setValue).not.toHaveBeenCalled();
  });
  it('marks an empty attendance cell and returns ok', () => {
    const { doPost, statusCell } = load(); const result = JSON.parse(doPost(event()).getContent());
    expect(result.status).toBe('ok'); expect(statusCell.setValue).toHaveBeenCalledWith(true);
  });
});

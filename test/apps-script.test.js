import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../apps-script/Code.js', import.meta.url), 'utf8');
const state = { secret: 'gas-secret' };
function load() {
  const cache = { get: vi.fn(() => JSON.stringify({ '1/sab/2': { r: 2, n: 'Ada', i: '' } })), put: vi.fn(), remove: vi.fn() };
  const statusCell = { getValue: vi.fn(() => false), setValue: vi.fn() };
  const sheet = { getLastColumn: () => 2, getRange: vi.fn((row) => row === 1 ? { getValues: () => [['Name', 'Topik R1']] } : statusCell), getSheetByName: vi.fn() };
  const ss = { getSheetByName: vi.fn((name) => name === 'Presensi' ? sheet : null) };
  const context = { console, PropertiesService: { getScriptProperties: () => ({ getProperty: () => state.secret }) }, CacheService: { getScriptCache: () => cache }, SpreadsheetApp: { getActiveSpreadsheet: () => ss }, ContentService: { MimeType: { JSON: 'application/json' }, createTextOutput: (text) => ({ getContent: () => text, setMimeType: function () { return this; } }) } };
  vm.createContext(context); vm.runInContext(`${source}\nthis.doPost = doPost; this.doGet = doGet;`, context); return { ...context, cache, statusCell };
}
const event = (extra = {}) => ({ postData: { contents: JSON.stringify({ api_secret: 'gas-secret', studentId: '1/SAB/2', week: 'R1', ...extra }) } });

describe('Apps Script GAS secret contract', () => {
  beforeEach(() => { state.secret = 'gas-secret'; });
  it('accepts the configured secret for attendance', () => { const { doPost, statusCell } = load(); const result = JSON.parse(doPost(event()).getContent()); expect(result.status).toBe('ok'); expect(statusCell.setValue).toHaveBeenCalledWith(true); });
  it('rejects doPost when the Script Property is absent without sheet mutation', () => { state.secret = undefined; const { doPost, statusCell, cache } = load(); const result = JSON.parse(doPost(event()).getContent()); expect(result.status).toBe('error'); expect(result.message).toMatch(/Unauthorized/); expect(statusCell.setValue).not.toHaveBeenCalled(); expect(cache.put).not.toHaveBeenCalled(); });
  it('rejects doPost when both the Script Property and incoming secret are absent', () => { state.secret = undefined; const { doPost, statusCell, cache } = load(); const result = JSON.parse(doPost(event({ api_secret: undefined })).getContent()); expect(result.status).toBe('error'); expect(statusCell.setValue).not.toHaveBeenCalled(); expect(cache.put).not.toHaveBeenCalled(); });
  it('rejects clear_cache when the Script Property is absent without cache mutation', () => { state.secret = ''; const { doGet, cache } = load(); const result = JSON.parse(doGet({ parameter: { action: 'clear_cache', api_secret: 'gas-secret' } }).getContent()); expect(result.status).toBe('error'); expect(result.message).toMatch(/Unauthorized/); expect(cache.remove).not.toHaveBeenCalled(); });
  it('rejects clear_cache when both the Script Property and incoming secret are absent', () => { state.secret = undefined; const { doGet, cache } = load(); const result = JSON.parse(doGet({ parameter: { action: 'clear_cache' } }).getContent()); expect(result.status).toBe('error'); expect(cache.remove).not.toHaveBeenCalled(); });
});

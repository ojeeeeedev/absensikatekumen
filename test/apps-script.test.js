import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../apps-script/Code.js', import.meta.url), 'utf8');
const state = { secret: 'gas-secret', currentValue: false, lockAcquired: true, throwOnGet: false, dataSiswaRows: null };
function load() {
  const cache = { get: vi.fn(() => JSON.stringify({ '1/sab/2': { r: 2, n: 'Ada', i: '' } })), put: vi.fn(), remove: vi.fn() };
  const events = [];
  const lock = { tryLock: vi.fn(() => { events.push('tryLock'); return state.lockAcquired; }), releaseLock: vi.fn(() => events.push('releaseLock')) };
  const statusCell = { getValue: vi.fn(() => { events.push('getValue'); if (state.throwOnGet) throw new Error('cell read failed'); return state.currentValue; }), setValue: vi.fn(() => { events.push('setValue'); }) };
  const sheet = { getLastColumn: () => 2, getRange: vi.fn((row) => row === 1 ? { getValues: () => [['Name', 'Topik R1']] } : statusCell), getSheetByName: vi.fn() };
  const dataSiswaSheet = state.dataSiswaRows ? { getDataRange: () => ({ getValues: () => state.dataSiswaRows }) } : null;
  const ss = { getSheetByName: vi.fn((name) => name === 'Presensi' ? sheet : name === 'Data Siswa' ? dataSiswaSheet : null) };
  const context = { console, LockService: { getScriptLock: () => lock }, PropertiesService: { getScriptProperties: () => ({ getProperty: () => state.secret }) }, CacheService: { getScriptCache: () => cache }, SpreadsheetApp: { getActiveSpreadsheet: () => ss, flush: vi.fn(() => events.push('flush')) }, ContentService: { MimeType: { JSON: 'application/json' }, createTextOutput: (text) => ({ getContent: () => text, setMimeType: function () { return this; } }) } };
  vm.createContext(context); vm.runInContext(`${source}\nthis.doPost = doPost; this.doGet = doGet;`, context); return { ...context, cache, statusCell, lock, events };
}
const event = (extra = {}) => ({ postData: { contents: JSON.stringify({ api_secret: 'gas-secret', studentId: '1/SAB/2', week: 'R1', ...extra }) } });

describe('Apps Script GAS secret contract', () => {
  beforeEach(() => { state.secret = 'gas-secret'; state.currentValue = false; state.lockAcquired = true; state.throwOnGet = false; state.dataSiswaRows = null; });
  it('accepts the configured secret for attendance', () => { const { doPost, statusCell } = load(); const result = JSON.parse(doPost(event()).getContent()); expect(result.status).toBe('ok'); expect(statusCell.setValue).toHaveBeenCalledWith(true); });
  it('rejects a wrong GAS secret without writing attendance', () => { const { doPost, statusCell } = load(); const result = JSON.parse(doPost(event({ api_secret: 'wrong' })).getContent()); expect(result).toMatchObject({ status: 'error', message: 'Unauthorized: Invalid API secret' }); expect(statusCell.setValue).not.toHaveBeenCalled(); });
  it('rejects doPost when the Script Property is absent without sheet mutation', () => { state.secret = undefined; const { doPost, statusCell, cache } = load(); const result = JSON.parse(doPost(event()).getContent()); expect(result.status).toBe('error'); expect(result.message).toMatch(/Unauthorized/); expect(statusCell.setValue).not.toHaveBeenCalled(); expect(cache.put).not.toHaveBeenCalled(); });
  it('rejects doPost when both the Script Property and incoming secret are absent', () => { state.secret = undefined; const { doPost, statusCell, cache } = load(); const result = JSON.parse(doPost(event({ api_secret: undefined })).getContent()); expect(result.status).toBe('error'); expect(statusCell.setValue).not.toHaveBeenCalled(); expect(cache.put).not.toHaveBeenCalled(); });
  it('rejects clear_cache when the Script Property is absent without cache mutation', () => { state.secret = ''; const { doGet, cache } = load(); const result = JSON.parse(doGet({ parameter: { action: 'clear_cache', api_secret: 'gas-secret' } }).getContent()); expect(result.status).toBe('error'); expect(result.message).toMatch(/Unauthorized/); expect(cache.remove).not.toHaveBeenCalled(); });
  it('rejects clear_cache when both the Script Property and incoming secret are absent', () => { state.secret = undefined; const { doGet, cache } = load(); const result = JSON.parse(doGet({ parameter: { action: 'clear_cache' } }).getContent()); expect(result.status).toBe('error'); expect(cache.remove).not.toHaveBeenCalled(); });
  it('acquires the lock before reading and writing the attendance cell', () => { const { doPost, events, lock, statusCell } = load(); const result = JSON.parse(doPost(event()).getContent()); expect(result.status).toBe('ok'); expect(lock.tryLock).toHaveBeenCalledWith(5000); expect(events).toEqual(['tryLock', 'getValue', 'setValue', 'flush', 'releaseLock']); expect(statusCell.setValue).toHaveBeenCalledWith(true); });
  it('returns duplicate after acquisition and releases the lock', () => { state.currentValue = true; const { doPost, events, lock, statusCell } = load(); const result = JSON.parse(doPost(event()).getContent()); expect(result.status).toBe('duplicate'); expect(events).toEqual(['tryLock', 'getValue', 'releaseLock']); expect(lock.releaseLock).toHaveBeenCalledTimes(1); expect(statusCell.setValue).not.toHaveBeenCalled(); });
  it('returns a rescan error when lock acquisition times out without releasing', () => { state.lockAcquired = false; const { doPost, events, lock, statusCell } = load(); const result = JSON.parse(doPost(event()).getContent()); expect(result.status).toBe('error'); expect(result.message).toMatch(/scan|rescan/i); expect(events).toEqual(['tryLock']); expect(lock.releaseLock).not.toHaveBeenCalled(); expect(statusCell.setValue).not.toHaveBeenCalled(); });
  it('releases an acquired lock when the cell operation throws', () => { state.throwOnGet = true; const { doPost, events, lock } = load(); const result = JSON.parse(doPost(event()).getContent()); expect(result.status).toBe('error'); expect(events).toEqual(['tryLock', 'getValue', 'releaseLock']); expect(lock.releaseLock).toHaveBeenCalledTimes(1); });
  it('returns only the selected student contact from the exact No.HP header', () => {
    state.dataSiswaRows = [
      ['Name', 'Unused', 'No.HP', '', '', '', '', '', '', '', '', 'Student ID'],
      ['Ada', '', '081234567890', '', '', '', '', '', '', '', '', '1/SAB/2'],
      ['Beda', '', '089999999999', '', '', '', '', '', '', '', '', '1/SAB/3'],
    ];
    const result = JSON.parse(load().doPost(event({ action: 'getStudentContact', week: undefined })).getContent());
    expect(result).toEqual({ status: 'ok', phone: '081234567890' });
  });
  it('fails closed when No.HP is absent or the student has no contact', () => {
    state.dataSiswaRows = [['Name', 'Unused', 'Phone', '', '', '', '', '', '', '', '', 'Student ID']];
    expect(JSON.parse(load().doPost(event({ action: 'getStudentContact', week: undefined })).getContent()).status).toBe('error');

    state.dataSiswaRows = [['Name', 'Unused', 'No.HP', '', '', '', '', '', '', '', '', 'Student ID'], ['Ada', '', '', '', '', '', '', '', '', '', '', '1/SAB/2']];
    expect(JSON.parse(load().doPost(event({ action: 'getStudentContact', week: undefined })).getContent()).status).toBe('missing_contact');
  });
});

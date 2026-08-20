import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../apps-script/Code.js', import.meta.url), 'utf8');
const state = {
  secret: 'gas-secret',
  currentValue: false,
  lockAcquired: true,
  throwOnGet: false,
  dataSiswaRows: null,
  cacheValue: null,
  cacheValues: new Map(),
  cacheServiceError: false,
  cacheReadError: false,
  cacheWriteError: false,
  cacheByteLength: null,
  sheetReadError: false,
};
function load() {
  const cache = {
    get: vi.fn((key) => {
      if (state.cacheReadError) throw new Error('cache read failed');
      if (state.cacheValues.has(key)) return state.cacheValues.get(key);
      return key === 'STUDENT_MAP_V1' ? state.cacheValue : null;
    }),
    put: vi.fn((key, value) => {
      if (state.cacheWriteError) throw new Error('cache write failed');
      state.cacheValues.set(key, value);
    }),
    remove: vi.fn(key => state.cacheValues.delete(key)),
  };
  const events = [];
  const lock = { tryLock: vi.fn(() => { events.push('tryLock'); return state.lockAcquired; }), releaseLock: vi.fn(() => events.push('releaseLock')) };
  const statusCell = { getValue: vi.fn(() => { events.push('getValue'); if (state.throwOnGet) throw new Error('cell read failed'); return state.currentValue; }), setValue: vi.fn(() => { events.push('setValue'); }) };
  const presensiRows = [
    ['', 'Name', '', '', '', '', '', '', '', '', '', 'Student ID'],
    ['', 'Ada', '', '', '', '', '', '', '', '', '', '1/SAB/2'],
  ];
  const sheet = {
    getLastColumn: () => 2,
    getRange: vi.fn((row) => row === 1 ? { getValues: () => [['Name', 'Topik R1']] } : statusCell),
    getDataRange: vi.fn(() => {
      if (state.sheetReadError) throw new Error('sheet read failed');
      return { getValues: () => presensiRows };
    }),
  };
  const dataSiswaSheet = state.dataSiswaRows ? { getDataRange: () => ({ getValues: () => state.dataSiswaRows }) } : null;
  const ss = { getSheetByName: vi.fn((name) => name === 'Presensi' ? sheet : name === 'Data Siswa' ? dataSiswaSheet : null) };
  const context = { console, LockService: { getScriptLock: () => lock }, PropertiesService: { getScriptProperties: () => ({ getProperty: () => state.secret }) }, CacheService: { getScriptCache: () => { if (state.cacheServiceError) throw new Error('cache unavailable'); return cache; } }, SpreadsheetApp: { getActiveSpreadsheet: () => ss, flush: vi.fn(() => events.push('flush')) }, Utilities: { newBlob: text => ({ getBytes: () => new Array(state.cacheByteLength ?? Buffer.byteLength(text, 'utf8')) }) }, ContentService: { MimeType: { JSON: 'application/json' }, createTextOutput: (text) => ({ getContent: () => text, setMimeType: function () { return this; } }) } };
  vm.createContext(context); vm.runInContext(`${source}\nthis.doPost = doPost; this.doGet = doGet;`, context); return { ...context, cache, sheet, statusCell, lock, events };
}
const event = (extra = {}) => ({ postData: { contents: JSON.stringify({ api_secret: 'gas-secret', studentId: '1/SAB/2', week: 'R1', ...extra }) } });

describe('Apps Script GAS secret contract', () => {
  beforeEach(() => {
    state.secret = 'gas-secret';
    state.currentValue = false;
    state.lockAcquired = true;
    state.throwOnGet = false;
    state.dataSiswaRows = null;
    state.cacheValue = JSON.stringify({ '1/sab/2': { r: 2, n: 'Ada', i: '' } });
    state.cacheValues = new Map();
    state.cacheServiceError = false;
    state.cacheReadError = false;
    state.cacheWriteError = false;
    state.cacheByteLength = null;
    state.sheetReadError = false;
  });
  it('accepts the configured secret for attendance', () => { const { doPost, statusCell } = load(); const result = JSON.parse(doPost(event()).getContent()); expect(result.status).toBe('ok'); expect(statusCell.setValue).toHaveBeenCalledWith(true); });
  it.each([
    ['cache acquisition fails', { cacheServiceError: true }],
    ['cache read fails', { cacheReadError: true }],
    ['cached JSON is malformed', { cacheValue: '{bad json' }],
    ['the cache misses', { cacheValue: null }],
    ['cache write fails', { cacheValue: null, cacheWriteError: true }],
  ])('uses Sheets when %s', (_name, overrides) => {
    Object.assign(state, overrides);
    const { doPost, cache, sheet, statusCell } = load();
    const result = JSON.parse(doPost(event()).getContent());

    expect(result.status).toBe('ok');
    expect(sheet.getDataRange).toHaveBeenCalledTimes(1);
    expect(statusCell.setValue).toHaveBeenCalledWith(true);
    if (!state.cacheServiceError) expect(cache.put).toHaveBeenCalledTimes(1);
  });
  it('rejects a wrong GAS secret without writing attendance', () => { const { doPost, statusCell } = load(); const result = JSON.parse(doPost(event({ api_secret: 'wrong' })).getContent()); expect(result).toMatchObject({ status: 'error', message: 'Unauthorized: Invalid API secret' }); expect(statusCell.setValue).not.toHaveBeenCalled(); });
  it('rejects doPost when the Script Property is absent without sheet mutation', () => { state.secret = undefined; const { doPost, statusCell, cache } = load(); const result = JSON.parse(doPost(event()).getContent()); expect(result.status).toBe('error'); expect(result.message).toMatch(/Unauthorized/); expect(statusCell.setValue).not.toHaveBeenCalled(); expect(cache.put).not.toHaveBeenCalled(); });
  it('rejects doPost when both the Script Property and incoming secret are absent', () => { state.secret = undefined; const { doPost, statusCell, cache } = load(); const result = JSON.parse(doPost(event({ api_secret: undefined })).getContent()); expect(result.status).toBe('error'); expect(statusCell.setValue).not.toHaveBeenCalled(); expect(cache.put).not.toHaveBeenCalled(); });
  it('returns only names and IDs for the staged roster view', () => {
    const { doPost } = load();
    const result = JSON.parse(doPost(event({ action: 'getStudentNames', week: undefined })).getContent());
    expect(result).toMatchObject({ status: 'ok', students: [{ studentId: '1/SAB/2', name: 'Ada' }], meta: { rosterSource: 'sheet' } });
  });
  it('serves a fresh names cache without reading Sheets', () => {
    state.cacheValues.set('PROFILE_NAMES_V1', JSON.stringify({ version: 1, cachedAt: new Date().toISOString(), students: [{ studentId: '1/SAB/2', name: 'Ada' }] }));
    const { doPost, sheet } = load();
    const result = JSON.parse(doPost(event({ action: 'getStudentNames', week: undefined })).getContent());
    expect(result.meta.rosterSource).toBe('cache');
    expect(sheet.getDataRange).not.toHaveBeenCalled();
  });
  it('writes fresh and stale names caches after a Sheet read', () => {
    const { doPost, cache } = load();
    const result = JSON.parse(doPost(event({ action: 'getStudentNames', week: undefined })).getContent());
    expect(result.meta.rosterSource).toBe('sheet');
    expect(cache.put.mock.calls.map(([key, , ttl]) => [key, ttl])).toEqual([
      ['PROFILE_NAMES_V1', 60],
      ['PROFILE_NAMES_STALE_V1', 21600],
    ]);
  });
  it.each([
    ['cache service unavailable', { cacheServiceError: true }],
    ['cache read failure', { cacheReadError: true }],
    ['cache write failure', { cacheWriteError: true }],
  ])('keeps a fresh names Sheet response when the %s', (_name, overrides) => {
    Object.assign(state, overrides);
    const result = JSON.parse(load().doPost(event({ action: 'getStudentNames', week: undefined })).getContent());
    expect(result).toMatchObject({ status: 'ok', meta: { rosterSource: 'sheet' } });
  });
  it('derives names from a valid fresh full cache without reading Sheets', () => {
    state.cacheValues.set('PROFILE_FULL_V1', JSON.stringify({ version: 1, cachedAt: new Date().toISOString(), students: [{ studentId: '1/SAB/2', name: 'Ada', dob: '', kelasKi: '', katekisKk: '' }] }));
    const { doPost, sheet } = load();
    const result = JSON.parse(doPost(event({ action: 'getStudentNames', week: undefined })).getContent());
    expect(result).toMatchObject({ status: 'ok', students: [{ studentId: '1/SAB/2', name: 'Ada' }], meta: { rosterSource: 'cache' } });
    expect(sheet.getDataRange).not.toHaveBeenCalled();
  });
  it('uses a valid stale names cache only after a Sheet failure', () => {
    state.sheetReadError = true;
    state.cacheValues.set('PROFILE_NAMES_STALE_V1', JSON.stringify({ version: 1, cachedAt: new Date().toISOString(), students: [{ studentId: '1/SAB/2', name: 'Ada' }] }));
    const result = JSON.parse(load().doPost(event({ action: 'getStudentNames', week: undefined })).getContent());
    expect(result).toMatchObject({ status: 'ok', meta: { rosterSource: 'stale-cache' } });
  });
  it.each([
    ['malformed', '{bad json'],
    ['wrong version', JSON.stringify({ version: 2, cachedAt: new Date().toISOString(), students: [] })],
    ['expired', JSON.stringify({ version: 1, cachedAt: new Date(Date.now() - 21601 * 1000).toISOString(), students: [] })],
  ])('rejects a %s fallback when Sheets also fails', (_name, value) => {
    state.sheetReadError = true;
    state.cacheValues.set('PROFILE_NAMES_STALE_V1', value);
    const result = JSON.parse(load().doPost(event({ action: 'getStudentNames', week: undefined })).getContent());
    expect(result.status).toBe('error');
  });
  it('skips oversized profile cache values without failing the Sheet response', () => {
    state.cacheByteLength = 90001;
    const { doPost, cache } = load();
    const result = JSON.parse(doPost(event({ action: 'getStudentNames', week: undefined })).getContent());
    expect(result.meta.rosterSource).toBe('sheet');
    expect(cache.put).not.toHaveBeenCalled();
  });
  it('populates full and names cache views from one full Sheet read', () => {
    const { doPost, cache, sheet } = load();
    const result = JSON.parse(doPost(event({ action: 'getStudentList', week: undefined })).getContent());
    expect(result.meta.rosterSource).toBe('sheet');
    expect(sheet.getDataRange).toHaveBeenCalledTimes(1);
    expect(cache.put.mock.calls.map(([key]) => key)).toEqual([
      'PROFILE_FULL_V1', 'PROFILE_FULL_STALE_V1', 'PROFILE_NAMES_V1', 'PROFILE_NAMES_STALE_V1',
    ]);
  });
  it('uses a valid stale full cache after a full-roster Sheet failure', () => {
    state.sheetReadError = true;
    state.cacheValues.set('PROFILE_FULL_STALE_V1', JSON.stringify({ version: 1, cachedAt: new Date().toISOString(), students: [{ studentId: '1/SAB/2', name: 'Ada', dob: '', kelasKi: '', katekisKk: '' }] }));
    const result = JSON.parse(load().doPost(event({ action: 'getStudentList', week: undefined })).getContent());
    expect(result).toMatchObject({ status: 'ok', meta: { rosterSource: 'stale-cache' } });
  });
  it('clears attendance and all profile cache keys after authentication', () => {
    const { doGet, cache } = load();
    const result = JSON.parse(doGet({ parameter: { action: 'clear_cache', api_secret: 'gas-secret' } }).getContent());
    expect(result.status).toBe('ok');
    expect(cache.remove.mock.calls.map(([key]) => key)).toEqual([
      'STUDENT_MAP_V1', 'PROFILE_NAMES_V1', 'PROFILE_NAMES_STALE_V1', 'PROFILE_FULL_V1', 'PROFILE_FULL_STALE_V1',
    ]);
  });
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

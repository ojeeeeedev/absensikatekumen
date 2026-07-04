import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import vm from 'vm';

function loadAppsScript() {
  const source = readFileSync(new URL('../apps-script/Code.js', import.meta.url), 'utf8');
  const context = {
    console,
    Utilities: {
      formatDate: () => '2026-07-04'
    },
    Session: {
      getScriptTimeZone: () => 'Asia/Jakarta'
    }
  };

  return vm.runInNewContext(`${source}\n({ getDashboardData_: getDashboardData_ });`, context);
}

function makeSheet(values) {
  return {
    getDataRange() {
      return {
        getValues() {
          return values;
        }
      };
    }
  };
}

function makeSpreadsheet(sheets) {
  return {
    getSheetByName(name) {
      return sheets[name] || null;
    }
  };
}

describe('Apps Script dashboard data reader', () => {
  it('derives active participants and topic attendance from Presensi and Data Siswa when dashboard tabs are absent', () => {
    const { getDashboardData_ } = loadAppsScript();
    const ss = makeSpreadsheet({
      Presensi: makeSheet([
        ['No', 'Nama', 'Topik 1', 'Topik 2', '', '', '', '', '', '', '', 'Student ID'],
        [1, 'Ariana', true, 'TRUE', '', '', '', '', '', '', '', '2026/SAB/001'],
        [2, 'Bima', true, '', '', '', '', '', '', '', '', '2026/SAB/002'],
        [3, 'Citra', true, true, '', '', '', '', '', '', '', '2026/SAB/003']
      ]),
      'Data Siswa': makeSheet([
        ['Nama', 'Jenis Kelamin', 'Agama', 'Status Perkawinan', '', '', '', '', '', '', '', 'Student ID', '', '', '', '', '', 'Kelas KI', 'Katekis KK'],
        ['Ariana', 'Perempuan', 'Katolik', 'Belum Kawin', '', '', '', '', '', '', '', '2026/SAB/001', '', '', '', '', '', 'KI A', 'KK A'],
        ['Bima', 'Laki-laki', 'Islam', 'Kawin', '', '', '', '', '', '', '', '2026/SAB/002', '', '', '', '', '', 'KI B', 'KK B'],
        ['Citra', 'Perempuan', 'Protestan', 'Belum Kawin', '', '', '', '', '', '', '', '2026/SAB/003', '', '', '', '', '', 'Inactive', 'Inactive']
      ])
    });

    const dashboard = getDashboardData_(ss);

    expect(dashboard.summary.total).toBe(2);
    expect(dashboard.summary.gender).toEqual([
      { label: 'Laki-laki', count: 1, rate: 50, percentage: '50.0%' },
      { label: 'Perempuan', count: 1, rate: 50, percentage: '50.0%' }
    ]);
    expect(dashboard.summary.religion.find((row) => row.label === 'Katolik').count).toBe(1);
    expect(dashboard.summary.religion.find((row) => row.label === 'Islam').count).toBe(1);
    expect(dashboard.attendance.recentTopics).toEqual([
      { topic: 'Topik 2', presentCount: 1, totalCount: 2, ratio: '1/2', rate: 50, percentage: '50.0%' },
      { topic: 'Topik 1', presentCount: 2, totalCount: 2, ratio: '2/2', rate: 100, percentage: '100.0%' }
    ]);
    expect(dashboard.attendance.riskParticipants).toEqual([
      {
        studentId: '2026/SAB/002',
        name: 'Bima',
        kelasKi: 'KI B',
        katekisKk: 'KK B',
        zone: 'Zona Merah',
        rate: 50,
        percentage: '50.0%'
      }
    ]);
  });
});

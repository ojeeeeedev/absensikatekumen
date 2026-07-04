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

  return vm.runInNewContext(`${source}\n({ getDashboardData_: getDashboardData_, touchDashboardLastUpdated_: touchDashboardLastUpdated_ });`, context);
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
      Dashboard_Metadata: makeSheet([
        ['key', 'value'],
        ['kelompok', 'Santo Sabinus'],
        ['intakeYear', '2025'],
        ['baptismYear', '2026'],
        ['priest', 'Rm. Petrus'],
        ['lastUpdated', '2026-07-03 10:00:00']
      ]),
      Presensi: makeSheet([
        ['No', 'Nama', 'Topik 1', 'Topik 2', 'Topik 3', '', '', '', '', '', '', 'Student ID'],
        [1, 'Ariana', true, 'TRUE', '', '', '', '', '', '', '', '2026/SAB/001'],
        [2, 'Bima', true, '', '', '', '', '', '', '', '', '2026/SAB/002'],
        [3, 'Citra', true, true, '', '', '', '', '', '', '', '2026/SAB/003']
      ]),
      'Data Siswa': makeSheet([
        ['Nama', 'No.HP', 'No.KTP / NIP', 'JK', 'TTL', 'Usia', 'Pendidikan Terakhir', 'Pekerjaan', 'Agama', 'Alamat', 'StudentID', 'QR->unused', 'QR Image', 'StudentIDb64', 'QRb64', 'QR image b64', 'Kelas (KI)', 'Katekis Kelompok Kecil', 'Status Perkawinan'],
        ['Ariana', '0812', '', 'Perempuan', '', '', '', '', 'Katolik', '', '2026/SAB/001', '', '', '', '', '', 'KI A', 'KK A', 'Belum Kawin'],
        ['Bima', '0813', '', 'Laki-laki', '', '', '', '', 'Islam', '', '2026/SAB/002', '', '', '', '', '', 'KI B', 'KK B', 'Kawin'],
        ['Citra', '0814', '', 'Perempuan', '', '', '', '', 'Protestan', '', '2026/SAB/003', '', '', '', '', '', 'Inactive', 'Inactive', 'Belum Kawin']
      ])
    });

    const dashboard = getDashboardData_(ss);

    expect(dashboard.metadata).toMatchObject({
      kelompok: 'Santo Sabinus',
      intakeYear: '2025',
      baptismYear: '2026',
      priest: 'Rm. Petrus',
      lastUpdated: '2026-07-03 10:00:00'
    });
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
    expect(dashboard.attendance.recentTopics.some((row) => row.topic === 'Topik 3')).toBe(false);
    expect(dashboard.attendance.latestTopic.topic).toBe('Topik 2');
    expect(dashboard.attendance.topicHistory).toHaveLength(2);
    expect(dashboard.attendance.lowAttendanceTopics[0].topic).toBe('Topik 2');
    expect(dashboard.attendance.riskParticipants).toEqual([
      {
        studentId: '2026/SAB/002',
        name: 'Bima',
        kelasKi: 'KI B',
        katekisKk: 'KK B',
        contact: '0813',
        zone: 'Zona Merah',
        rate: 50,
        percentage: '50.0%'
      }
    ]);
  });

  it('updates or creates the dashboard lastUpdated metadata row', () => {
    const { touchDashboardLastUpdated_ } = loadAppsScript();
    const values = [
      ['key', 'value'],
      ['kelompok', 'Santo Sabinus']
    ];
    const sheet = {
      getLastRow: () => values.length,
      getRange(row, col, numRows = 1, numCols = 1) {
        return {
          getValues() {
            return values.slice(row - 1, row - 1 + numRows).map((source) => source.slice(col - 1, col - 1 + numCols));
          },
          setValues(nextValues) {
            nextValues.forEach((nextRow, r) => {
              nextRow.forEach((cell, c) => {
                values[row - 1 + r][col - 1 + c] = cell;
              });
            });
          },
          setValue(value) {
            while (values.length < row) values.push([]);
            values[row - 1][col - 1] = value;
          }
        };
      }
    };
    const ss = makeSpreadsheet({ Dashboard_Metadata: sheet });

    touchDashboardLastUpdated_(ss);

    expect(values).toContainEqual(['lastUpdated', '2026-07-04']);
  });
});

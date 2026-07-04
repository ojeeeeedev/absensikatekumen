import { describe, it, expect, afterEach, vi } from 'vitest';
import jwt from 'jsonwebtoken';
import handler from '../api/dashboard-data.js';
import { createMockRequest, createMockResponse } from './helpers.js';

const JWT_SECRET = 'dashboard-secret';

function makeToken() {
  return jwt.sign({ authorized: true }, JWT_SECRET, { algorithm: 'HS256' });
}

describe('/api/dashboard-data', () => {
  const originalSecret = process.env.JWT_SECRET;
  const originalScriptMap = process.env.VERCEL_SCRIPT_MAP_JSON;
  const originalGasSecret = process.env.GAS_SECRET_KEY;
  const originalSupabaseUrl = process.env.SUPABASE_URL;
  const originalSupabaseKey = process.env.SUPABASE_KEY;

  afterEach(() => {
    process.env.JWT_SECRET = originalSecret;
    process.env.VERCEL_SCRIPT_MAP_JSON = originalScriptMap;
    process.env.GAS_SECRET_KEY = originalGasSecret;
    process.env.SUPABASE_URL = originalSupabaseUrl;
    process.env.SUPABASE_KEY = originalSupabaseKey;
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('should handle OPTIONS with 200 OK', async () => {
    const req = createMockRequest({ method: 'OPTIONS' });
    const res = createMockResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.headers['Access-Control-Allow-Origin']).toBe('*');
  });

  it('should return 401 when Authorization header is missing', async () => {
    process.env.JWT_SECRET = JWT_SECRET;
    const req = createMockRequest({ method: 'GET', query: { classCode: 'SAB' } });
    const res = createMockResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(401);
  });

  it('should reject an unknown class code', async () => {
    process.env.JWT_SECRET = JWT_SECRET;
    process.env.VERCEL_SCRIPT_MAP_JSON = JSON.stringify({ SAB: 'https://script.example/sab' });
    const req = createMockRequest({
      method: 'GET',
      query: { classCode: 'XXX' },
      headers: { authorization: `Bearer ${makeToken()}` }
    });
    const res = createMockResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe('Invalid classCode: XXX');
  });

  it('should call the class Apps Script and return normalized dashboard JSON', async () => {
    process.env.JWT_SECRET = JWT_SECRET;
    process.env.GAS_SECRET_KEY = 'gas-secret';
    process.env.VERCEL_SCRIPT_MAP_JSON = JSON.stringify({ SAB: 'https://script.example/sab' });
    process.env.SUPABASE_URL = '';
    process.env.SUPABASE_KEY = '';
    const fetchMock = vi.fn().mockResolvedValue({
      text: vi.fn().mockResolvedValue(JSON.stringify({
        status: 'ok',
        dashboard: {
          metadata: {
            kelompok: 'Santo Sabinus',
            intakeYear: '2025',
            baptismYear: '2026',
            priest: 'Rm. Petrus',
            baptis: 'Minggu Adven I 2026',
            lastUpdated: '2026-06-27 12:30:00'
          },
          summary: {
            total: 35,
            gender: [{ label: 'Perempuan', count: 21, rate: 60, percentage: '60.0%' }],
            religion: [{ label: 'Katolik', count: 1, rate: 2.9, percentage: '2.9%' }],
            maritalStatus: []
          },
          attendance: {
            zones: [{ key: 'green', label: 'Zona Hijau (Aman)', count: 16, rate: 45.7, percentage: '45.7%' }],
            latestTopic: { topic: 'Topik 27', presentCount: 29, totalCount: 35, ratio: '29/35', rate: 82.9, percentage: '82.9%' },
            topicHistory: [{ topic: 'Topik 27', presentCount: 29, totalCount: 35, ratio: '29/35', rate: 82.9, percentage: '82.9%' }],
            lowAttendanceTopics: [{ topic: 'Topik 4', presentCount: 10, totalCount: 35, ratio: '10/35', rate: 28.6, percentage: '28.6%' }],
            riskParticipants: [{ studentId: '2025/SAB/001', name: 'A', contact: '0812', zone: 'Zona Merah', rate: 50, percentage: '50.0%' }]
          }
        }
      }))
    });
    vi.stubGlobal('fetch', fetchMock);

    const req = createMockRequest({
      method: 'GET',
      query: { classCode: 'sab' },
      headers: { authorization: `Bearer ${makeToken()}` }
    });
    const res = createMockResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith('https://script.example/sab', expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'getDashboardData',
        classCode: 'SAB',
        api_secret: 'gas-secret'
      })
    }));
    expect(res.body.status).toBe('ok');
    expect(res.body.classCode).toBe('SAB');
    expect(res.body.metadata).toMatchObject({
      kelompok: 'Santo Sabinus',
      intakeYear: '2025',
      baptismYear: '2026',
      priest: 'Rm. Petrus',
      lastUpdated: '2026-06-27 12:30:00'
    });
    expect(res.body.attendance.latestTopic.type).toBe('KI');
    expect(res.body.attendance.recentTopics).toEqual(res.body.attendance.topicHistory);
    expect(res.body.attendance.attentionTopics).toEqual(res.body.attendance.lowAttendanceTopics);
    expect(res.body.attendance.riskParticipants[0].contact).toBe('0812');
  });

  it('should return 502 when Apps Script returns invalid JSON', async () => {
    process.env.JWT_SECRET = JWT_SECRET;
    process.env.VERCEL_SCRIPT_MAP_JSON = JSON.stringify({ SAB: 'https://script.example/sab' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      text: vi.fn().mockResolvedValue('<html>not json</html>')
    }));

    const req = createMockRequest({
      method: 'GET',
      query: { classCode: 'SAB' },
      headers: { authorization: `Bearer ${makeToken()}` }
    });
    const res = createMockResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(502);
    expect(res.body.message).toBe('GAS returned invalid JSON');
  });

  it('should fall back to getStudentList when dashboard action is not deployed yet', async () => {
    process.env.JWT_SECRET = JWT_SECRET;
    process.env.VERCEL_SCRIPT_MAP_JSON = JSON.stringify({ SAB: 'https://script.example/sab' });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        text: vi.fn().mockResolvedValue(JSON.stringify({
          status: 'error',
          message: 'Missing studentId or week'
        }))
      })
      .mockResolvedValueOnce({
        text: vi.fn().mockResolvedValue(JSON.stringify({
          status: 'ok',
          students: [
            { studentId: '2025/SAB/001', name: 'A', kelasKi: 'KI A', katekisKk: 'KK A' },
            { studentId: '2025/SAB/002', name: 'B', kelasKi: 'Inactive', katekisKk: 'Inactive' }
          ]
        }))
      });
    vi.stubGlobal('fetch', fetchMock);

    const req = createMockRequest({
      method: 'GET',
      query: { classCode: 'SAB' },
      headers: { authorization: `Bearer ${makeToken()}` }
    });
    const res = createMockResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.fallback).toBe(true);
    expect(res.body.message).toContain('Dashboard lengkap belum aktif');
    expect(res.body.message).toContain('deployment lama');
    expect(res.body.message).not.toContain('Apps Script dipush');
    expect(res.body.summary.total).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][1].body).toContain('"action":"getStudentList"');
  });
});

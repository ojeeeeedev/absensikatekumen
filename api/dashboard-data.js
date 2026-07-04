import jwt from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let topicTypeCache = null;
let classNameCache = null;

function buildTopicTypeMap() {
  if (topicTypeCache) return topicTypeCache;

  topicTypeCache = {};
  try {
    const topicsPath = join(__dirname, '../public/topics.js');
    const source = readFileSync(topicsPath, 'utf8');
    const match = source.match(/const\s+STATIC_TOPICS\s*=\s*(\[[\s\S]*?\])\s*;?/);
    if (!match) return topicTypeCache;

    const topics = Function(`"use strict"; return (${match[1]});`)();
    topics.forEach((topic) => {
      const week = String(topic.week || '').trim();
      const name = String(topic.name || '');
      if (!week) return;
      topicTypeCache[week.toUpperCase()] = {
        name,
        type: inferTopicType(name)
      };
    });
  } catch (err) {
    console.error("Failed to load topic type map:", err);
  }

  return topicTypeCache;
}

function inferTopicType(name) {
  if (/\(KI\)/i.test(name)) return 'KI';
  if (/\(P\)/i.test(name)) return 'Pastor';
  if (/rekoleksi|refleksi/i.test(name)) return 'Rekoleksi';
  return 'KK';
}

function enrichTopicRows(rows) {
  const topicTypes = buildTopicTypeMap();
  if (!Array.isArray(rows)) return [];

  return rows.map((row) => {
    const topicText = String(row.topic || '');
    const weekMatch = topicText.match(/(?:Topik\s*)?([A-Z]?\d+|R\d+)/i);
    const week = weekMatch ? weekMatch[1].toUpperCase() : topicText.toUpperCase();
    const topicMeta = topicTypes[week] || {};

    return {
      ...row,
      topic: row.topic || (week ? `Topik ${week}` : ''),
      topicName: row.topicName || topicMeta.name || '',
      type: row.type || topicMeta.type || 'KK'
    };
  });
}

function topicArray(primary, fallback) {
  if (Array.isArray(primary)) return enrichTopicRows(primary);
  return enrichTopicRows(fallback);
}

function normalizeDashboardPayload(payload, classCode) {
  const dashboard = payload.dashboard || payload.data || payload;
  const attendance = dashboard.attendance || {};
  const topicHistory = topicArray(attendance.topicHistory, attendance.recentTopics);
  const lowAttendanceTopics = topicArray(attendance.lowAttendanceTopics, attendance.attentionTopics);
  const latestTopic = attendance.latestTopic ? enrichTopicRows([attendance.latestTopic])[0] : topicHistory[0] || null;

  return {
    status: 'ok',
    classCode,
    metadata: {
      tahun: dashboard.metadata?.tahun || '',
      kelompok: dashboard.metadata?.kelompok || '',
      intakeYear: dashboard.metadata?.intakeYear || dashboard.metadata?.tahun || '',
      baptismYear: dashboard.metadata?.baptismYear || '',
      priest: dashboard.metadata?.priest || '',
      baptis: dashboard.metadata?.baptis || '',
      lastUpdated: dashboard.metadata?.lastUpdated || ''
    },
    summary: {
      total: Number(dashboard.summary?.total || 0),
      gender: Array.isArray(dashboard.summary?.gender) ? dashboard.summary.gender : [],
      religion: Array.isArray(dashboard.summary?.religion) ? dashboard.summary.religion : [],
      maritalStatus: Array.isArray(dashboard.summary?.maritalStatus) ? dashboard.summary.maritalStatus : []
    },
    attendance: {
      zones: Array.isArray(attendance.zones) ? attendance.zones : [],
      latestTopic,
      topicHistory,
      lowAttendanceTopics,
      recentTopics: topicHistory,
      attentionTopics: lowAttendanceTopics,
      riskParticipants: Array.isArray(attendance.riskParticipants) ? attendance.riskParticipants : []
    }
  };
}

function getClassName(classCode) {
  if (!classNameCache) {
    try {
      const classCodePath = join(__dirname, '../classcode.json');
      classNameCache = JSON.parse(readFileSync(classCodePath, 'utf8'));
    } catch (err) {
      classNameCache = {};
    }
  }

  return classNameCache[classCode] || classCode;
}

function isInactiveStudent(student) {
  const ki = String(student?.kelasKi || '').trim().toLowerCase();
  const kk = String(student?.katekisKk || '').trim().toLowerCase();
  return ki === 'inactive' || ki === 'nonaktif' || kk === 'inactive' || kk === 'nonaktif';
}

function buildCategoryRows(items, selector) {
  const counts = {};
  items.forEach((item) => {
    const label = String(selector(item) || 'Belum Diketahui').trim() || 'Belum Diketahui';
    counts[label] = (counts[label] || 0) + 1;
  });

  const total = items.length;
  return Object.keys(counts).sort().map((label) => {
    const count = counts[label];
    const rate = total > 0 ? Math.round((count / total * 100) * 10) / 10 : 0;
    return {
      label,
      count,
      rate,
      percentage: `${rate.toFixed(1)}%`
    };
  });
}

function buildFallbackDashboard(students, classCode, reason) {
  const activeStudents = Array.isArray(students) ? students.filter((student) => !isInactiveStudent(student)) : [];
  const inactiveCount = Array.isArray(students) ? students.length - activeStudents.length : 0;
  const now = new Date().toISOString().slice(0, 10);
  const activeRate = activeStudents.length > 0 ? 100 : 0;

  return {
    status: 'ok',
    classCode,
    fallback: true,
    message: reason || 'Dashboard normalized tabs are not available yet. Showing available student data.',
    metadata: {
      tahun: '',
      kelompok: getClassName(classCode),
      intakeYear: '',
      baptismYear: '',
      priest: '',
      baptis: '',
      lastUpdated: now
    },
    summary: {
      total: activeStudents.length,
      gender: buildCategoryRows(activeStudents, () => 'Belum Diketahui'),
      religion: buildCategoryRows(activeStudents, () => 'Belum Diketahui'),
      maritalStatus: buildCategoryRows(activeStudents, () => 'Belum Diketahui')
    },
    attendance: {
      zones: [
        {
          key: 'green',
          label: 'Data Dasar Tersedia',
          shortLabel: 'Aktif',
          count: activeStudents.length,
          rate: activeRate,
          percentage: `${activeRate.toFixed(1)}%`
        },
        {
          key: 'black',
          label: 'Nonaktif',
          shortLabel: 'Nonaktif',
          count: inactiveCount,
          rate: 0,
          percentage: '0.0%'
        }
      ],
      latestTopic: null,
      topicHistory: [],
      lowAttendanceTopics: [],
      recentTopics: [],
      attentionTopics: [],
      riskParticipants: []
    }
  };
}

async function attachRiskParticipantImages(dashboard, classCode) {
  const participants = dashboard?.attendance?.riskParticipants || [];
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_KEY;
  if (!SUPABASE_URL || !SUPABASE_KEY || !participants.length) return dashboard;

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  const bucketName = `pasfoto-${classCode.toLowerCase()}`;

  try {
    const { data: files, error: listError } = await supabase.storage
      .from(bucketName)
      .list('', { limit: 200 });
    if (listError || !files?.length) return dashboard;

    const fileMap = {};
    files.forEach((file) => {
      const parts = String(file.name || '').split('.');
      const ext = parts.pop()?.toLowerCase();
      const basename = parts.join('.').toLowerCase();
      if (['jpg', 'jpeg', 'png'].includes(ext)) fileMap[basename] = file.name;
    });

    const studentMatches = {};
    const pathsToSign = [];
    participants.forEach((student) => {
      const normalizedId = String(student.studentId || '').replace(/\//g, '-').toLowerCase();
      const fileName = fileMap[normalizedId];
      if (!fileName) return;
      studentMatches[student.studentId] = fileName;
      pathsToSign.push(fileName);
    });
    if (!pathsToSign.length) return dashboard;

    const { data: signedData, error: signError } = await supabase.storage
      .from(bucketName)
      .createSignedUrls(pathsToSign, 60);
    if (signError || !signedData) return dashboard;

    const signedUrlMap = {};
    signedData.forEach((item) => {
      signedUrlMap[item.path] = item.signedUrl;
    });

    participants.forEach((student) => {
      const fileName = studentMatches[student.studentId];
      if (fileName && signedUrlMap[fileName]) student.image = signedUrlMap[fileName];
    });
  } catch (err) {
    console.error("Failed to attach dashboard risk participant images:", err);
  }

  return dashboard;
}

async function fetchStudentFallback(scriptURL, classCode) {
  const gasResponse = await fetch(scriptURL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "getStudentList",
      classCode,
      api_secret: process.env.GAS_SECRET_KEY || "default_development_secret"
    })
  });

  const text = await gasResponse.text();
  const data = JSON.parse(text);
  if (data.status !== "ok" || !Array.isArray(data.students)) {
    throw new Error(data.message || "Fallback student data unavailable");
  }

  return buildFallbackDashboard(data.students, classCode);
}

function dashboardFallbackMessage(gasData) {
  const message = String(gasData?.message || '').trim();
  const base = 'Dashboard lengkap belum aktif untuk kelas ini. Data dasar peserta ditampilkan sementara.';

  if (/Missing studentId or week/i.test(message)) {
    return `${base} Apps Script Web App kemungkinan masih memakai deployment lama; redeploy Web App ke versi terbaru.`;
  }

  if (/Unauthorized/i.test(message)) {
    return `${base} Periksa kesesuaian GAS_SECRET_KEY di Vercel dan Script Properties Apps Script.`;
  }

  if (message) {
    return `${base} Respons Apps Script: ${message}`;
  }

  return base;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ status: "error", message: `Method ${req.method} not allowed` });
  }

  const JWT_SECRET = process.env.JWT_SECRET;
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ status: "error", message: "Unauthorized" });
  }

  try {
    jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
  } catch (e) {
    return res.status(401).json({ status: "error", message: "Unauthorized" });
  }

  const classCode = String(req.query.classCode || '').trim().toUpperCase();
  if (!/^[A-Z0-9]{2,5}$/.test(classCode)) {
    return res.status(400).json({ status: "error", message: "Parameter classCode tidak valid" });
  }

  let scriptMap = {};
  try {
    if (!process.env.VERCEL_SCRIPT_MAP_JSON) {
      throw new Error("VERCEL_SCRIPT_MAP_JSON is not defined");
    }
    scriptMap = JSON.parse(process.env.VERCEL_SCRIPT_MAP_JSON);
  } catch (err) {
    console.error("Error parsing VERCEL_SCRIPT_MAP_JSON:", err);
    return res.status(500).json({ status: "error", message: "Server configuration error" });
  }

  const scriptURL = scriptMap[classCode];
  if (!scriptURL) {
    return res.status(400).json({ status: "error", message: `Invalid classCode: ${classCode}` });
  }

  try {
    const gasResponse = await fetch(scriptURL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "getDashboardData",
        classCode,
        api_secret: process.env.GAS_SECRET_KEY || "default_development_secret"
      })
    });

    const text = await gasResponse.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (err) {
      console.error(`Dashboard GAS response is not JSON: ${text}`);
      return res.status(502).json({ status: "error", message: "GAS returned invalid JSON" });
    }

    if (data.status !== "ok") {
      try {
        const fallback = await fetchStudentFallback(scriptURL, classCode);
        fallback.message = dashboardFallbackMessage(data);
        return res.status(200).json(fallback);
      } catch (fallbackErr) {
        return res.status(502).json({ status: "error", message: data.message || fallbackErr.message || "Failed to fetch dashboard data" });
      }
    }

    const dashboard = normalizeDashboardPayload(data, classCode);
    return res.status(200).json(await attachRiskParticipantImages(dashboard, classCode));
  } catch (err) {
    console.error("API Error in /api/dashboard-data:", err);
    return res.status(500).json({ status: "error", message: err.message });
  }
}

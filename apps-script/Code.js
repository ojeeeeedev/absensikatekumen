function doPost(e) {
  // 1. Safety check for empty data
  if (!e || !e.postData || !e.postData.contents) {
    return buildResponse_({ status: "error", message: "No POST data received" });
  }

  try {
    const data = JSON.parse(e.postData.contents);

    // --- SECURITY VERIFICATION ---
    const scriptProperties = PropertiesService.getScriptProperties();
    const expectedSecret = scriptProperties.getProperty("GAS_SECRET_KEY") || "default_development_secret";
    if (data.api_secret !== expectedSecret) {
      return buildResponse_({ status: "error", message: "Unauthorized: Invalid API secret" });
    }

    // Handle getStudentList action
    if (data.action === "getStudentList") {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const students = getStudentList_(ss);
      return buildResponse_({ status: "ok", students: students });
    }

    if (data.action === "getDashboardData") {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const dashboard = getDashboardData_(ss);
      return buildResponse_({ status: "ok", dashboard: dashboard });
    }

    // 2. Extract Data
    const rawId = data.studentId || "";
    const weekRaw = data.week;

    if (!rawId || !weekRaw) {
      return buildResponse_({
        status: "error",
        message: "Missing studentId or week"
      });
    }

    const studentIdNormalized = String(rawId).trim().toLowerCase();
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("Presensi");

    if (!sheet) {
      return buildResponse_({ status: "error", message: "Sheet 'Presensi' not found" });
    }

    // --- OPTIMIZATION START: Cache Handling ---
    const cache = CacheService.getScriptCache();
    // Try to retrieve the student map from cache
    let studentMap = null;
    const cachedData = cache.get("STUDENT_MAP_V1"); 
    
    if (cachedData) {
      studentMap = JSON.parse(cachedData);
    } else {
      // CACHE MISS: Build the map from scratch (Expensive operation, done once every 6h)
      studentMap = buildStudentMap_(ss, sheet);
      try {
        // Cache for 6 hours (21600 seconds)
        // Note: Cache limit is 100KB. If map is huge, this might fail or need chunking.
        // For < 500 students, this is usually fine.
        cache.put("STUDENT_MAP_V1", JSON.stringify(studentMap), 21600); 
      } catch (e) {
        // If cache fails (e.g. too big), we just continue without caching
        console.log("Cache put failed: " + e.toString());
      }
    }
    // --- OPTIMIZATION END ---

    // 3. Determine Column based on Week (Must read header to be safe)
    // Optimization: We could cache headers too, but they might change.
    // Reading just the first row is very fast.
    const headerRow = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

    let headerName;
    const weekStr = String(weekRaw).trim();
    if (/^R\d+$/i.test(weekStr)) {
      headerName = "Topik " + weekStr.toUpperCase();
    } else {
      headerName = "Topik " + weekStr; 
    }

    const topikCol = headerRow.indexOf(headerName) + 1; // 1-based index

    if (topikCol < 1) {
      return buildResponse_({
        status: "error",
        message: `Kolom '${headerName}' tidak ditemukan di sheet Presensi.`
      });
    }

    // 4. Find Student using Map (O(1) Lookup)
    const studentData = studentMap[studentIdNormalized];

    if (!studentData) {
       return buildResponse_({
        status: "not found",
        message: `❌ ID ${rawId.toUpperCase()} tidak terdaftar.`
      });
    }

    // 5. Check Attendance in-memory/via Sheet (Fastest verification)
    // Optimization: If attendance status is already cached, we can bypass spreadsheet cell reads!
    // However, if the sheet gets manually altered, in-memory check might not reflect it.
    // To balance speed and correctness, we read the specific status cell but bypass full lookups.
    // Let's check the cached status if we implement checkins in cache, otherwise read cell.
    const statusCell = sheet.getRange(studentData.r, topikCol);
    const currentValue = statusCell.getValue();

    if (currentValue === true || currentValue === "TRUE") {
      return buildResponse_({
        status: "duplicate",
        studentId: rawId.toUpperCase(),
        name: studentData.n,
        message: `Kode ${rawId.toUpperCase()} sudah absen sebelumnya.`
      });
    }

    // 6. Mark Attendance
    statusCell.setValue(true);

    return buildResponse_({
      status: "ok",
      studentId: rawId.toUpperCase(),
      name: studentData.n,
      image: studentData.i, // Retrieved from map/cache
      message: `✅ ${studentData.n} hadir ${headerName}`
    });

  } catch (err) {
    return buildResponse_({
      status: "error",
      message: "Internal: " + err.toString()
    });
  }
}

/**
 * Helper to build the student map from "Presensi" and "Data Siswa"
 * Returns: { "student_id": { r: rowIndex, n: name, i: imageUrl } }
 */
function buildStudentMap_(ss, sheetPresensi) {
  const map = {};
  
  // 1. Read Presensi Data (Fast bulk read)
  const presensiData = sheetPresensi.getDataRange().getValues();
  // Start from row 1 (skip header)
  for (let i = 1; i < presensiData.length; i++) {
    const id = String(presensiData[i][11] || "").trim().toLowerCase(); // Column L (Index 11)
    if (id) {
      map[id] = {
        r: i + 1, // Store 1-based row index
        n: String(presensiData[i][1] || "").trim(), // Column B (Index 1)
        i: "" // Image placeholder
      };
    }
  }

  // 2. Read Data Siswa (for Images)
  // Optimization: Only read if we have students
  const sheetSiswa = ss.getSheetByName("Data Siswa");
  if (sheetSiswa) {
    const siswaData = sheetSiswa.getDataRange().getValues();
    for (let k = 1; k < siswaData.length; k++) {
      const sId = String(siswaData[k][11] || "").trim().toLowerCase(); // Column L
      // Only add image if student exists in Presensi map
      if (map[sId]) {
        map[sId].i = siswaData[k][19]; // Column T (Index 19)
      }
    }
  }

  return map;
}

function doGet(e) {
  // Clear cache action (useful for debugging or forced updates)
  if (e && e.parameter && e.parameter.action === "clear_cache") {
    const scriptProperties = PropertiesService.getScriptProperties();
    const expectedSecret = scriptProperties.getProperty("GAS_SECRET_KEY") || "default_development_secret";
    if (e.parameter.api_secret !== expectedSecret) {
      return buildResponse_({ status: "error", message: "Unauthorized" });
    }
    CacheService.getScriptCache().remove("STUDENT_MAP_V1");
    return buildResponse_({ status: "ok", message: "Cache cleared" });
  }
  return buildResponse_({ status: "ready", message: "Backend is running" });
}

function buildResponse_(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Retrieves all registered students with DOB (TTL) from Google Sheets
 */
function getStudentList_(ss) {
  const students = [];
  const sheetPresensi = ss.getSheetByName("Presensi");
  const sheetSiswa = ss.getSheetByName("Data Siswa");
  
  if (!sheetPresensi) return [];
  
  // Read Presensi Data (Fast bulk read)
  const presensiData = sheetPresensi.getDataRange().getValues();
  const studentMap = {};
  
  // Start from row 1 (skip header)
  for (let i = 1; i < presensiData.length; i++) {
    const id = String(presensiData[i][11] || "").trim(); // Column L (Index 11)
    const name = String(presensiData[i][1] || "").trim(); // Column B (Index 1)
    if (id) {
      studentMap[id.toLowerCase()] = {
        studentId: id,
        name: name,
        dob: "", // Default empty
        kelasKi: "", // Default empty
        katekisKk: "" // Default empty
      };
    }
  }
  
  // Read Data Siswa (for TTL in Column F - Index 5, Kelas KI in Column R - Index 17, Katekis KK in Column S - Index 18)
  if (sheetSiswa) {
    const siswaData = sheetSiswa.getDataRange().getValues();
    for (let k = 1; k < siswaData.length; k++) {
      const sId = String(siswaData[k][11] || "").trim().toLowerCase(); // Column L
      if (studentMap[sId]) {
        studentMap[sId].dob = String(siswaData[k][5] || "").trim(); // Column F (TTL)
        studentMap[sId].kelasKi = String(siswaData[k][17] || "").trim(); // Column R (Index 17)
        studentMap[sId].katekisKk = String(siswaData[k][18] || "").trim(); // Column S (Index 18)
      }
    }
  }
  
  // Convert map to array
  for (const key in studentMap) {
    students.push(studentMap[key]);
  }
  
  return students;
}

function getDashboardData_(ss) {
  const metadata = readDashboardMetadata_(ss);
  const participants = readDashboardParticipants_(ss);
  const topicRows = readDashboardTopicRows_(ss, participants);
  const attendanceProfiles = readAttendanceProfiles_(ss, participants);
  const total = participants.length;

  const zones = buildZoneSummary_(attendanceProfiles, total);
  const recentTopics = topicRows.slice(0, 5);
  const attentionTopics = topicRows
    .filter(function(row) { return row.rate <= 70; })
    .sort(function(a, b) { return a.rate - b.rate; })
    .slice(0, 5);
  const riskParticipants = attendanceProfiles
    .filter(function(profile) { return profile.zone === "Zona Merah" || profile.zone === "Zona Hitam"; })
    .sort(function(a, b) { return a.rate - b.rate; })
    .slice(0, 20)
    .map(function(profile) {
      return {
        studentId: profile.studentId,
        name: profile.name,
        kelasKi: profile.kelasKi,
        katekisKk: profile.katekisKk,
        zone: profile.zone,
        rate: round1_(profile.rate),
        percentage: formatPercent_(profile.rate)
      };
    });

  return {
    metadata: metadata,
    summary: {
      total: total,
      gender: buildCategorySummary_(participants, "gender", total),
      religion: buildCategorySummary_(participants, "religion", total, ["Islam", "Katolik", "Protestan", "Buddha", "Konghucu", "Hindu", "YME", "Belum Diketahui"]),
      maritalStatus: buildCategorySummary_(participants, "maritalStatus", total, ["Belum Kawin", "Kawin", "Cerai", "Belum Diketahui"])
    },
    attendance: {
      zones: zones,
      recentTopics: recentTopics,
      attentionTopics: attentionTopics,
      riskParticipants: riskParticipants
    }
  };
}

function readDashboardMetadata_(ss) {
  const defaults = {
    tahun: "",
    kelompok: "",
    baptis: "",
    lastUpdated: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd")
  };
  const sheet = ss.getSheetByName("Dashboard_Metadata");
  if (!sheet) return defaults;

  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    const key = String(values[i][0] || "").trim();
    if (!key) continue;
    defaults[key] = String(values[i][1] || "").trim();
  }
  return defaults;
}

function readDashboardParticipants_(ss) {
  const sheet = ss.getSheetByName("Dashboard_Peserta");
  if (!sheet) return readParticipantsFromSourceSheets_(ss);

  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return readParticipantsFromSourceSheets_(ss);

  const headers = buildHeaderIndex_(values[0]);
  const participants = [];
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const studentId = getCell_(row, headers, "studentid");
    const name = getCell_(row, headers, "name");
    if (!studentId && !name) continue;

    const activeRaw = getCell_(row, headers, "active");
    const active = activeRaw === "" ? true : !/^(false|no|tidak|inactive|nonaktif|0)$/i.test(activeRaw);
    if (!active) continue;

    participants.push({
      studentId: studentId,
      name: name,
      gender: getCell_(row, headers, "gender") || "Belum Diketahui",
      religion: getCell_(row, headers, "religion") || "Belum Diketahui",
      maritalStatus: getCell_(row, headers, "maritalstatus") || "Belum Diketahui",
      kelasKi: getCell_(row, headers, "kelaski"),
      katekisKk: getCell_(row, headers, "katekiskk")
    });
  }
  return participants.length ? participants : readParticipantsFromSourceSheets_(ss);
}

function readParticipantsFromSourceSheets_(ss) {
  const presensiSheet = ss.getSheetByName("Presensi");
  if (!presensiSheet) return [];

  const presensiValues = presensiSheet.getDataRange().getValues();
  if (presensiValues.length < 2) return [];

  const presensiHeaders = buildHeaderIndex_(presensiValues[0]);
  const participantsById = {};
  const order = [];

  for (let i = 1; i < presensiValues.length; i++) {
    const row = presensiValues[i];
    const studentId = getCellAny_(row, presensiHeaders, ["studentid", "idpeserta", "idsiswa", "id"], 11);
    const name = getCellAny_(row, presensiHeaders, ["name", "nama", "namalengkap"], 1);
    if (!studentId && !name) continue;

    const key = String(studentId || name).trim().toLowerCase();
    if (!key) continue;

    participantsById[key] = {
      studentId: studentId,
      name: name,
      gender: "Belum Diketahui",
      religion: "Belum Diketahui",
      maritalStatus: "Belum Diketahui",
      kelasKi: "",
      katekisKk: ""
    };
    order.push(key);
  }

  const siswaSheet = ss.getSheetByName("Data Siswa");
  if (siswaSheet) {
    const siswaValues = siswaSheet.getDataRange().getValues();
    if (siswaValues.length > 1) {
      const siswaHeaders = buildHeaderIndex_(siswaValues[0]);
      for (let j = 1; j < siswaValues.length; j++) {
        const row = siswaValues[j];
        const studentId = getCellAny_(row, siswaHeaders, ["studentid", "idpeserta", "idsiswa", "id"], 11);
        const key = String(studentId || "").trim().toLowerCase();
        const participant = participantsById[key];
        if (!participant) continue;

        participant.name = getCellAny_(row, siswaHeaders, ["name", "nama", "namalengkap"], -1) || participant.name;
        participant.gender = getCellAny_(row, siswaHeaders, ["gender", "jeniskelamin", "kelamin"], -1) || participant.gender;
        participant.religion = getCellAny_(row, siswaHeaders, ["religion", "agama"], -1) || participant.religion;
        participant.maritalStatus = getCellAny_(row, siswaHeaders, ["maritalstatus", "statusperkawinan", "statuskawin", "perkawinan"], -1) || participant.maritalStatus;
        participant.kelasKi = getCellAny_(row, siswaHeaders, ["kelaski"], 17) || participant.kelasKi;
        participant.katekisKk = getCellAny_(row, siswaHeaders, ["katekiskk", "katekiskelaskecil", "katekiskelcil", "katekiskecil"], 18) || participant.katekisKk;
      }
    }
  }

  return order
    .map(function(key) { return participantsById[key]; })
    .filter(function(participant) { return !isInactiveParticipant_(participant); });
}

function readDashboardTopicRows_(ss, participants) {
  const sheet = ss.getSheetByName("Dashboard_Presensi");
  if (!sheet) return readTopicRowsFromPresensi_(ss, participants);

  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return readTopicRowsFromPresensi_(ss, participants);

  const headers = buildHeaderIndex_(values[0]);
  const rows = [];
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const topic = getCell_(row, headers, "topic");
    if (!topic) continue;

    const present = Number(getCell_(row, headers, "presentcount") || 0);
    const total = Number(getCell_(row, headers, "totalcount") || 0);
    const rate = total > 0 ? present / total * 100 : 0;
    rows.push({
      topic: normalizeTopicLabel_(topic),
      presentCount: present,
      totalCount: total,
      ratio: present + "/" + total,
      rate: round1_(rate),
      percentage: formatPercent_(rate)
    });
  }

  return rows.sort(function(a, b) { return topicSortValue_(b.topic) - topicSortValue_(a.topic); });
}

function readTopicRowsFromPresensi_(ss, participants) {
  const sheet = ss.getSheetByName("Presensi");
  if (!sheet) return [];

  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];

  const headers = values[0];
  const topicCols = [];
  for (let c = 0; c < headers.length; c++) {
    const header = String(headers[c] || "").trim();
    if (/^Topik\s+/i.test(header)) {
      topicCols.push({ index: c, topic: header });
    }
  }

  const activeIds = {};
  if (participants && participants.length) {
    participants.forEach(function(participant) {
      const key = String(participant.studentId || "").trim().toLowerCase();
      if (key) activeIds[key] = true;
    });
  }
  const useActiveIds = Object.keys(activeIds).length > 0;
  let total = 0;
  for (let r = 1; r < values.length; r++) {
    const studentId = String(values[r][11] || "").trim().toLowerCase();
    if (useActiveIds && !activeIds[studentId]) continue;
    total++;
  }

  return topicCols.map(function(topicCol) {
    let present = 0;
    for (let r = 1; r < values.length; r++) {
      const studentId = String(values[r][11] || "").trim().toLowerCase();
      if (useActiveIds && !activeIds[studentId]) continue;
      if (values[r][topicCol.index] === true || values[r][topicCol.index] === "TRUE") present++;
    }
    const rate = total > 0 ? present / total * 100 : 0;
    return {
      topic: topicCol.topic,
      presentCount: present,
      totalCount: total,
      ratio: present + "/" + total,
      rate: round1_(rate),
      percentage: formatPercent_(rate)
    };
  }).sort(function(a, b) { return topicSortValue_(b.topic) - topicSortValue_(a.topic); });
}

function readAttendanceProfiles_(ss, participants) {
  const sheet = ss.getSheetByName("Presensi");
  if (!sheet || participants.length === 0) return [];

  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];

  const headers = values[0];
  const topicCols = [];
  for (let c = 0; c < headers.length; c++) {
    if (/^Topik\s+/i.test(String(headers[c] || "").trim())) topicCols.push(c);
  }
  if (topicCols.length === 0) return [];

  const participantMap = {};
  participants.forEach(function(participant) {
    participantMap[String(participant.studentId || "").trim().toLowerCase()] = participant;
  });

  const profiles = [];
  for (let r = 1; r < values.length; r++) {
    const studentId = String(values[r][11] || "").trim();
    const participant = participantMap[studentId.toLowerCase()];
    if (!participant) continue;

    let present = 0;
    topicCols.forEach(function(col) {
      if (values[r][col] === true || values[r][col] === "TRUE") present++;
    });

    const rate = present / topicCols.length * 100;
    profiles.push({
      studentId: studentId,
      name: participant.name || String(values[r][1] || "").trim(),
      kelasKi: participant.kelasKi,
      katekisKk: participant.katekisKk,
      present: present,
      total: topicCols.length,
      rate: rate,
      zone: zoneForRate_(rate)
    });
  }
  return profiles;
}

function buildZoneSummary_(profiles, fallbackTotal) {
  const zoneLabels = [
    { key: "green", label: "Zona Hijau (Aman)", shortLabel: "Aman" },
    { key: "yellow", label: "Zona Kuning (Perhatian)", shortLabel: "Perhatian" },
    { key: "red", label: "Zona Merah (Pengawasan)", shortLabel: "Pengawasan" },
    { key: "black", label: "Zona Hitam (Penindakan)", shortLabel: "Penindakan" }
  ];
  const counts = { green: 0, yellow: 0, red: 0, black: 0 };

  profiles.forEach(function(profile) {
    if (profile.zone === "Zona Hijau") counts.green++;
    else if (profile.zone === "Zona Kuning") counts.yellow++;
    else if (profile.zone === "Zona Merah") counts.red++;
    else counts.black++;
  });

  const total = profiles.length || fallbackTotal || 0;
  return zoneLabels.map(function(zone) {
    const count = counts[zone.key] || 0;
    const rate = total > 0 ? count / total * 100 : 0;
    return {
      key: zone.key,
      label: zone.label,
      shortLabel: zone.shortLabel,
      count: count,
      rate: round1_(rate),
      percentage: formatPercent_(rate)
    };
  });
}

function buildCategorySummary_(items, field, total, orderedLabels) {
  const counts = {};
  items.forEach(function(item) {
    const key = String(item[field] || "Belum Diketahui").trim() || "Belum Diketahui";
    counts[key] = (counts[key] || 0) + 1;
  });

  const labels = orderedLabels && orderedLabels.length
    ? orderedLabels.concat(Object.keys(counts).filter(function(label) { return orderedLabels.indexOf(label) === -1; }).sort())
    : Object.keys(counts).sort();

  return labels.map(function(label) {
    const count = counts[label];
    const rate = total > 0 ? count / total * 100 : 0;
    return {
      label: label,
      count: count || 0,
      rate: round1_(rate),
      percentage: formatPercent_(rate)
    };
  });
}

function buildHeaderIndex_(headerRow) {
  const headers = {};
  for (let i = 0; i < headerRow.length; i++) {
    const key = String(headerRow[i] || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
    if (key) headers[key] = i;
  }
  return headers;
}

function getCell_(row, headers, key) {
  const index = headers[key];
  if (index === undefined) return "";
  const value = row[index];
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function getCellAny_(row, headers, keys, fallbackIndex) {
  for (let i = 0; i < keys.length; i++) {
    const value = getCell_(row, headers, keys[i]);
    if (value) return value;
  }
  if (fallbackIndex >= 0 && fallbackIndex < row.length) {
    const fallback = row[fallbackIndex];
    if (fallback !== null && fallback !== undefined) return String(fallback).trim();
  }
  return "";
}

function isInactiveParticipant_(participant) {
  const ki = String(participant.kelasKi || "").trim().toLowerCase();
  const kk = String(participant.katekisKk || "").trim().toLowerCase();
  return /^(inactive|nonaktif|tidak aktif)$/.test(ki) || /^(inactive|nonaktif|tidak aktif)$/.test(kk);
}

function normalizeTopicLabel_(topic) {
  const text = String(topic || "").trim();
  if (/^Topik\s+/i.test(text)) return text;
  return "Topik " + text;
}

function topicSortValue_(topic) {
  const match = String(topic || "").match(/(?:Topik\s*)?R?(\d+)/i);
  return match ? Number(match[1]) : 0;
}

function zoneForRate_(rate) {
  if (rate > 85) return "Zona Hijau";
  if (rate >= 65) return "Zona Kuning";
  if (rate >= 50) return "Zona Merah";
  return "Zona Hitam";
}

function round1_(value) {
  return Math.round(Number(value || 0) * 10) / 10;
}

function formatPercent_(value) {
  return round1_(value).toFixed(1) + "%";
}

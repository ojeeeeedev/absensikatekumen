const PROFILE_CACHE_VERSION_ = 2;
const PROFILE_CACHE_FRESH_SECONDS_ = 60;
const PROFILE_CACHE_STALE_SECONDS_ = 21600;
const PROFILE_CACHE_MAX_BYTES_ = 90000;
const PROFILE_CACHE_KEYS_ = {
  names: { fresh: "PROFILE_NAMES_V2", stale: "PROFILE_NAMES_STALE_V2" },
  full: { fresh: "PROFILE_FULL_V2", stale: "PROFILE_FULL_STALE_V2" },
};

function doPost(e) {
  // 1. Safety check for empty data
  if (!e || !e.postData || !e.postData.contents) {
    return buildResponse_({ status: "error", message: "No POST data received" });
  }

  try {
    const data = JSON.parse(e.postData.contents);

    // --- SECURITY VERIFICATION ---
    const scriptProperties = PropertiesService.getScriptProperties();
    const expectedSecret = scriptProperties.getProperty("GAS_SECRET_KEY");
    if (!expectedSecret || data.api_secret !== expectedSecret) {
      return buildResponse_({ status: "error", message: "Unauthorized: Invalid API secret" });
    }

    // Handle getStudentList action
    if (data.action === "getStudentNames") {
      const result = getStudentNames_(SpreadsheetApp.getActiveSpreadsheet());
      return buildResponse_({ status: "ok", students: result.students, meta: result.meta });
    }

    if (data.action === "getStudentList") {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const result = getStudentList_(ss);
      return buildResponse_({ status: "ok", students: result.students, meta: result.meta });
    }

    if (data.action === "getStudentContact") {
      return getStudentContact_(SpreadsheetApp.getActiveSpreadsheet(), data.studentId);
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
    const studentIdDisplay = String(rawId).trim().toUpperCase();
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("Presensi");

    if (!sheet) {
      return buildResponse_({ status: "error", message: "Sheet 'Presensi' not found" });
    }

    // Header row decides the topic column; it is read fresh on every scan.
    const headerRow = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const weekStr = String(weekRaw).trim();
    const headerName = "Topik " + (/^R\d+$/i.test(weekStr) ? weekStr.toUpperCase() : weekStr);
    const topikCol = headerRow.indexOf(headerName) + 1; // 1-based index

    if (topikCol < 1) {
      return buildResponse_({
        status: "error",
        message: `Kolom '${headerName}' tidak ditemukan di sheet Presensi.`
      });
    }

    // Attendance outcomes: ok | duplicate | not found | busy | error.
    // "busy" means the lock was not acquired; the Vercel proxy turns it into a
    // retryable HTTP 503, so the scan is retried instead of being lost.
    const lock = LockService.getScriptLock();
    if (!lock.tryLock(5000)) {
      return buildResponse_({ status: "busy", message: "Sistem sedang sibuk, silakan scan ulang." });
    }

    try {
      // The cached map stores row numbers. Rows move when the sheet is sorted
      // or edited, so the row is verified before writing; a stale map is rebuilt.
      let entry = getStudentMapEntry_(ss, sheet, false);
      let studentData = entry.students[studentIdNormalized];
      const rowMoved = studentData && !rowHoldsStudent_(sheet, studentData.r, studentIdNormalized);
      // A student added since the map was built is not in it yet; rebuild at most
      // once per STUDENT_MAP_MISS_REBUILD_MS_ so unknown IDs cannot keep the lock busy.
      const missOnOldMap = !studentData && Date.now() - entry.builtAt > STUDENT_MAP_MISS_REBUILD_MS_;
      if (rowMoved || missOnOldMap) {
        entry = getStudentMapEntry_(ss, sheet, true);
        studentData = entry.students[studentIdNormalized];
      }
      if (!studentData || !rowHoldsStudent_(sheet, studentData.r, studentIdNormalized)) {
        return buildResponse_({
          status: "not found",
          message: `❌ ID ${studentIdDisplay} tidak terdaftar.`
        });
      }

      const statusCell = sheet.getRange(studentData.r, topikCol);
      const currentValue = statusCell.getValue();
      if (currentValue === true || currentValue === "TRUE") {
        return buildResponse_({
          status: "duplicate",
          studentId: studentIdDisplay,
          name: studentData.n,
          message: `Kode ${studentIdDisplay} sudah absen sebelumnya.`
        });
      }

      statusCell.setValue(true);
      SpreadsheetApp.flush();
      // Photos are served by the authenticated /api/photo proxy, never from the sheet.
      return buildResponse_({
        status: "ok",
        studentId: studentIdDisplay,
        name: studentData.n,
        message: `✅ ${studentData.n} hadir ${headerName}`
      });
    } finally {
      lock.releaseLock();
    }

  } catch (err) {
    console.error("doPost failed: " + err);
    return buildResponse_({
      status: "error",
      message: "Terjadi kesalahan pada server presensi."
    });
  }
}

const STUDENT_MAP_CACHE_KEY_ = "STUDENT_MAP_V2";
const STUDENT_MAP_MISS_REBUILD_MS_ = 60 * 1000;
const STUDENT_ID_COLUMN_ = 12; // Column L in Presensi and Data Siswa

// Returns { builtAt, students: { normalizedId: { r: row, n: name } } }.
// The cache only speeds up lookup; it never decides attendance on its own
// (rows are re-verified with rowHoldsStudent_ before every write).
function getStudentMapEntry_(ss, sheet, forceRebuild) {
  let cache = null;
  try {
    cache = CacheService.getScriptCache();
    if (!forceRebuild) {
      const cachedData = cache.get(STUDENT_MAP_CACHE_KEY_);
      const parsed = cachedData ? JSON.parse(cachedData) : null;
      if (parsed && Number.isFinite(parsed.builtAt) && parsed.students
          && typeof parsed.students === "object" && !Array.isArray(parsed.students)) {
        return parsed;
      }
    }
  } catch (e) {
    console.log("Cache read failed: " + e.toString());
  }

  const entry = { builtAt: Date.now(), students: buildStudentMap_(ss, sheet) };
  if (cache) {
    try {
      cache.put(STUDENT_MAP_CACHE_KEY_, JSON.stringify(entry), 21600);
    } catch (e) {
      console.log("Cache write failed: " + e.toString());
    }
  }
  return entry;
}

function rowHoldsStudent_(sheet, row, studentIdNormalized) {
  if (!row || row < 2) return false;
  const value = sheet.getRange(row, STUDENT_ID_COLUMN_).getValue();
  return String(value || "").trim().toLowerCase() === studentIdNormalized;
}

function getProfileCache_() {
  try {
    return CacheService.getScriptCache();
  } catch (e) {
    console.log("Profile roster cache unavailable");
    return null;
  }
}

function isValidProfileStudents_(students, view) {
  if (!Array.isArray(students)) return false;
  return students.every(function(student) {
    if (!student || typeof student !== "object") return false;
    if (typeof student.studentId !== "string" || !student.studentId.trim()) return false;
    if (typeof student.name !== "string") return false;
    if (view === "names") return typeof student.inactive === "boolean";
    return ["dob", "kelasKi", "katekisKk"].every(function(field) {
      return typeof student[field] === "string";
    });
  });
}

function readProfileCache_(cache, key, view, maxAgeSeconds) {
  if (!cache) return null;
  try {
    const raw = cache.get(key);
    if (!raw) return null;
    const envelope = JSON.parse(raw);
    const cachedAtMs = Date.parse(envelope && envelope.cachedAt);
    const ageMs = Date.now() - cachedAtMs;
    if (!envelope || envelope.version !== PROFILE_CACHE_VERSION_ ||
        !Number.isFinite(cachedAtMs) || ageMs < 0 || ageMs > maxAgeSeconds * 1000 ||
        !isValidProfileStudents_(envelope.students, view)) {
      console.log("Profile roster cache invalid: " + view);
      return null;
    }
    console.log("Profile roster cache hit: " + view);
    return envelope;
  } catch (e) {
    console.log("Profile roster cache read failed: " + view);
    return null;
  }
}

function writeProfileCache_(cache, key, envelope, expirationSeconds, view) {
  if (!cache) return;
  try {
    const serialized = JSON.stringify(envelope);
    if (Utilities.newBlob(serialized).getBytes().length > PROFILE_CACHE_MAX_BYTES_) {
      console.log("Profile roster cache skipped oversized value: " + view);
      return;
    }
    cache.put(key, serialized, expirationSeconds);
  } catch (e) {
    console.log("Profile roster cache write failed: " + view);
  }
}

function cacheProfileStudents_(cache, view, students, cachedAt) {
  const envelope = { version: PROFILE_CACHE_VERSION_, cachedAt: cachedAt, students: students };
  const keys = PROFILE_CACHE_KEYS_[view];
  writeProfileCache_(cache, keys.fresh, envelope, PROFILE_CACHE_FRESH_SECONDS_, view);
  writeProfileCache_(cache, keys.stale, envelope, PROFILE_CACHE_STALE_SECONDS_, view);
}

function profileResult_(envelope, source) {
  return {
    students: envelope.students,
    meta: { rosterSource: source, cachedAt: envelope.cachedAt },
  };
}

function namesFromStudents_(students) {
  return students.map(function(student) {
    return {
      studentId: student.studentId,
      name: student.name,
      inactive: isProfileStudentInactive_(student),
    };
  });
}

function isProfileStudentInactive_(student) {
  return [student.kelasKi, student.katekisKk].some(function(value) {
    return String(value || "").trim().toLowerCase() === "inactive";
  });
}

function getStudentNames_(ss) {
  const cache = getProfileCache_();
  const namesKeys = PROFILE_CACHE_KEYS_.names;
  const fullKeys = PROFILE_CACHE_KEYS_.full;
  const freshNames = readProfileCache_(cache, namesKeys.fresh, "names", PROFILE_CACHE_FRESH_SECONDS_);
  if (freshNames) return profileResult_(freshNames, "cache");

  const freshFull = readProfileCache_(cache, fullKeys.fresh, "full", PROFILE_CACHE_FRESH_SECONDS_);
  if (freshFull) {
    const envelope = {
      version: PROFILE_CACHE_VERSION_,
      cachedAt: freshFull.cachedAt,
      students: namesFromStudents_(freshFull.students),
    };
    cacheProfileStudents_(cache, "names", envelope.students, envelope.cachedAt);
    return profileResult_(envelope, "cache");
  }

  try {
    const students = readStudentNamesFromSheets_(ss);
    const cachedAt = new Date().toISOString();
    cacheProfileStudents_(cache, "names", students, cachedAt);
    console.log("Profile roster cache miss: names");
    return profileResult_({ students: students, cachedAt: cachedAt }, "sheet");
  } catch (sheetError) {
    const staleNames = readProfileCache_(cache, namesKeys.stale, "names", PROFILE_CACHE_STALE_SECONDS_);
    if (staleNames) return profileResult_(staleNames, "stale-cache");
    const staleFull = readProfileCache_(cache, fullKeys.stale, "full", PROFILE_CACHE_STALE_SECONDS_);
    if (staleFull) {
      return profileResult_({
        students: namesFromStudents_(staleFull.students),
        cachedAt: staleFull.cachedAt,
      }, "stale-cache");
    }
    throw sheetError;
  }
}

function readStudentNamesFromSheets_(ss) {
  const sheet = ss.getSheetByName("Presensi");
  if (!sheet) throw new Error("Sheet 'Presensi' not found");

  const studentMap = {};
  const presensiData = sheet.getDataRange().getValues();
  for (let i = 1; i < presensiData.length; i++) {
    const id = String(presensiData[i][11] || "").trim();
    if (!id) continue;
    studentMap[id.toLowerCase()] = {
      studentId: id,
      name: String(presensiData[i][1] || "").trim(),
      inactive: false,
    };
  }

  const sheetSiswa = ss.getSheetByName("Data Siswa");
  if (sheetSiswa) {
    const siswaData = sheetSiswa.getDataRange().getValues();
    for (let i = 1; i < siswaData.length; i++) {
      const id = String(siswaData[i][11] || "").trim().toLowerCase();
      if (!studentMap[id]) continue;
      studentMap[id].inactive = isProfileStudentInactive_({
        kelasKi: siswaData[i][17],
        katekisKk: siswaData[i][18],
      });
    }
  }

  return Object.values(studentMap);
}

/**
 * Helper to build the student map from "Presensi" and "Data Siswa"
 * Returns: { "student_id": { r: rowIndex, n: name, i: imageUrl } }
 */
function buildStudentMap_(ss, sheetPresensi) {
  const map = {};
  const presensiData = sheetPresensi.getDataRange().getValues();
  for (let i = 1; i < presensiData.length; i++) {
    const id = String(presensiData[i][STUDENT_ID_COLUMN_ - 1] || "").trim().toLowerCase();
    if (id) {
      map[id] = {
        r: i + 1, // 1-based row index
        n: String(presensiData[i][1] || "").trim(), // Column B
      };
    }
  }
  return map;
}

function doGet(e) {
  // Clear cache action (useful for debugging or forced updates)
  if (e && e.parameter && e.parameter.action === "clear_cache") {
    const scriptProperties = PropertiesService.getScriptProperties();
    const expectedSecret = scriptProperties.getProperty("GAS_SECRET_KEY");
    if (!expectedSecret || e.parameter.api_secret !== expectedSecret) {
      return buildResponse_({ status: "error", message: "Unauthorized" });
    }
    const cache = CacheService.getScriptCache();
    [
      "STUDENT_MAP_V1",
      STUDENT_MAP_CACHE_KEY_,
      "PROFILE_NAMES_V1",
      "PROFILE_NAMES_STALE_V1",
      "PROFILE_FULL_V1",
      "PROFILE_FULL_STALE_V1",
      PROFILE_CACHE_KEYS_.names.fresh,
      PROFILE_CACHE_KEYS_.names.stale,
      PROFILE_CACHE_KEYS_.full.fresh,
      PROFILE_CACHE_KEYS_.full.stale,
    ].forEach(function(key) { cache.remove(key); });
    return buildResponse_({ status: "ok", message: "Cache cleared" });
  }
  return buildResponse_({ status: "ready", message: "Backend is running" });
}

function buildResponse_(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function getStudentContact_(ss, studentId) {
  const sheet = ss.getSheetByName("Data Siswa");
  if (!sheet) return buildResponse_({ status: "error", message: "Sheet 'Data Siswa' not found" });

  const rows = sheet.getDataRange().getValues();
  const phoneColumn = rows[0] ? rows[0].indexOf("No.HP") : -1;
  if (phoneColumn < 0) return buildResponse_({ status: "error", message: "Kolom 'No.HP' tidak ditemukan" });

  const normalizedId = String(studentId || "").trim().toLowerCase();
  if (!normalizedId) return buildResponse_({ status: "not_found" });
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][11] || "").trim().toLowerCase() !== normalizedId) continue;
    const phone = String(rows[i][phoneColumn] || "").trim();
    return phone
      ? buildResponse_({ status: "ok", phone: phone })
      : buildResponse_({ status: "missing_contact" });
  }

  return buildResponse_({ status: "not_found" });
}

/**
 * Retrieves all registered students with DOB (TTL) from Google Sheets
 */
function getStudentList_(ss) {
  const cache = getProfileCache_();
  const keys = PROFILE_CACHE_KEYS_.full;
  const fresh = readProfileCache_(cache, keys.fresh, "full", PROFILE_CACHE_FRESH_SECONDS_);
  if (fresh) return profileResult_(fresh, "cache");

  try {
    const students = readStudentListFromSheets_(ss);
    const cachedAt = new Date().toISOString();
    cacheProfileStudents_(cache, "full", students, cachedAt);
    cacheProfileStudents_(cache, "names", namesFromStudents_(students), cachedAt);
    console.log("Profile roster cache miss: full");
    return profileResult_({ students: students, cachedAt: cachedAt }, "sheet");
  } catch (sheetError) {
    const stale = readProfileCache_(cache, keys.stale, "full", PROFILE_CACHE_STALE_SECONDS_);
    if (stale) return profileResult_(stale, "stale-cache");
    throw sheetError;
  }
}

function readStudentListFromSheets_(ss) {
  const students = [];
  const sheetPresensi = ss.getSheetByName("Presensi");
  const sheetSiswa = ss.getSheetByName("Data Siswa");
  
  if (!sheetPresensi) throw new Error("Sheet 'Presensi' not found");
  
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

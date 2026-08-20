const PROFILE_CACHE_VERSION_ = 1;
const PROFILE_CACHE_FRESH_SECONDS_ = 60;
const PROFILE_CACHE_STALE_SECONDS_ = 21600;
const PROFILE_CACHE_MAX_BYTES_ = 90000;
const PROFILE_CACHE_KEYS_ = {
  names: { fresh: "PROFILE_NAMES_V1", stale: "PROFILE_NAMES_STALE_V1" },
  full: { fresh: "PROFILE_FULL_V1", stale: "PROFILE_FULL_STALE_V1" },
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
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("Presensi");

    if (!sheet) {
      return buildResponse_({ status: "error", message: "Sheet 'Presensi' not found" });
    }

    // The cache improves lookup speed but must not control attendance availability.
    let cache = null;
    let studentMap = null;
    try {
      cache = CacheService.getScriptCache();
      const cachedData = cache.get("STUDENT_MAP_V1");
      if (cachedData) studentMap = JSON.parse(cachedData);
      if (!studentMap || typeof studentMap !== "object" || Array.isArray(studentMap)) studentMap = null;
    } catch (e) {
      console.log("Cache read failed: " + e.toString());
    }

    if (!studentMap) {
      studentMap = buildStudentMap_(ss, sheet);
      if (cache) {
        try {
          cache.put("STUDENT_MAP_V1", JSON.stringify(studentMap), 21600);
        } catch (e) {
          console.log("Cache write failed: " + e.toString());
        }
      }
    }

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
    const lock = LockService.getScriptLock();
    if (!lock.tryLock(5000)) {
      return buildResponse_({ status: "error", message: "Sistem sedang sibuk, silakan scan ulang." });
    }

    try {
      // ponytail: script-wide lock; revisit only if measured scan contention matters.
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
      SpreadsheetApp.flush();
      return buildResponse_({
        status: "ok",
        studentId: rawId.toUpperCase(),
        name: studentData.n,
        image: studentData.i, // Retrieved from map/cache
        message: `✅ ${studentData.n} hadir ${headerName}`
      });
    } finally {
      lock.releaseLock();
    }

  } catch (err) {
    return buildResponse_({
      status: "error",
      message: "Internal: " + err.toString()
    });
  }
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
    if (view === "names") return true;
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
    return { studentId: student.studentId, name: student.name };
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
    };
  }

  return Object.values(studentMap);
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
    const expectedSecret = scriptProperties.getProperty("GAS_SECRET_KEY");
    if (!expectedSecret || e.parameter.api_secret !== expectedSecret) {
      return buildResponse_({ status: "error", message: "Unauthorized" });
    }
    const cache = CacheService.getScriptCache();
    [
      "STUDENT_MAP_V1",
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

function doPost(e) {
  // 1. Safety check for empty data
  if (!e || !e.postData || !e.postData.contents) {
    return buildResponse_({ status: "error", message: "No POST data received" });
  }

  try {
    const data = JSON.parse(e.postData.contents);

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

    // 5. Check Attendance (Read specific cell)
    // studentData.r is the 1-based row index
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
    CacheService.getScriptCache().remove("STUDENT_MAP_V1");
    return buildResponse_({ status: "ok", message: "Cache cleared" });
  }
  return buildResponse_({ status: "ready", message: "Backend is running" });
}

function buildResponse_(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

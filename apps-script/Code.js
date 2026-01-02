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

    const values = sheet.getDataRange().getValues();
    const headerRow = values[0];

    // 3. Determine Column based on Week
    let headerName;
    const weekStr = String(weekRaw).trim();
    
    // Logic: if it's just a number "1", it becomes "Topik 1"
    // If it's "R1", it becomes "Topik R1"
    if (/^R\d+$/i.test(weekStr)) {
      headerName = "Topik " + weekStr.toUpperCase();
    } else {
      headerName = "Topik " + weekStr; 
    }

    const topikCol = headerRow.indexOf(headerName) + 1;

    if (topikCol < 1) {
      return buildResponse_({
        status: "error",
        message: `Kolom '${headerName}' tidak ditemukan di sheet Presensi.`
      });
    }

    // 4. Find Student & Mark Attendance
    for (let i = 1; i < values.length; i++) {
      const idCell = String(values[i][11] || "").trim().toLowerCase(); // Column L is index 11

      if (idCell === studentIdNormalized) {
        const studentName = String(values[i][1] || "").trim(); // Column B is index 1
        const currentValue = values[i][topikCol - 1]; // Array is 0-based, column is 1-based

        if (currentValue === true || currentValue === "TRUE") {
          return buildResponse_({
            status: "duplicate",
            studentId: rawId.toUpperCase(),
            name: studentName,
            message: `Kode ${rawId.toUpperCase()} sudah absen sebelumnya.`
          });
        }

        // Mark Attendance in Sheet
        sheet.getRange(i + 1, topikCol).setValue(true);

        // 5. Fetch Image from "Data Siswa"
        let imageUrl = "";
        const sheetSiswa = ss.getSheetByName("Data Siswa");
        if (sheetSiswa) {
          const dataSiswa = sheetSiswa.getDataRange().getValues();
          for (let k = 1; k < dataSiswa.length; k++) {
            const sId = String(dataSiswa[k][11] || "").trim().toLowerCase(); // Column L
            if (sId === studentIdNormalized) {
              imageUrl = dataSiswa[k][19]; // Column T is index 19
              break;
            }
          }
        }

        return buildResponse_({
          status: "ok",
          studentId: rawId.toUpperCase(),
          name: studentName,
          image: imageUrl,
          message: `✅ ${studentName} hadir ${headerName}`
        });
      }
    }

    return buildResponse_({
      status: "not found",
      message: `❌ ID ${rawId.toUpperCase()} tidak terdaftar.`
    });

  } catch (err) {
    return buildResponse_({
      status: "error",
      message: "Internal: " + err.toString()
    });
  }
}

function doGet(e) {
  // Since topics are hardcoded in the frontend, we only need a health check here.
  return buildResponse_({ status: "ready", message: "Backend is running" });
}

function buildResponse_(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
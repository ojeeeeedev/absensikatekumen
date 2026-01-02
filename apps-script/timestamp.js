function onChange(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Dashboard"); // <-- change to where you want the timestamp
  sheet.getRange("O4").setValue(new Date()); // <-- timestamp cell
}

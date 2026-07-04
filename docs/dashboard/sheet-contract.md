# Dashboard Google Sheets Contract

The dashboard reads class data from the Google Sheet attached to each Apps Script Web App deployment.

## Required Tabs

### `Presensi`

The first row must contain headers.

| Field | Preferred Header | Positional Fallback |
| --- | --- | --- |
| Student ID | `Student ID` | Column L |
| Name | `Nama` | Column B |
| Attendance topics | Headers starting with `Topik ` | None |

Attendance values should be checkbox `TRUE` or text `TRUE`.

### `Data Siswa`

These exact headers are used for dashboard enrichment:

| Dashboard field | Data Siswa header |
| --- | --- |
| Name | `Nama` |
| Contact / WhatsApp | `No.HP` |
| Gender | `JK` |
| Religion | `Agama` |
| Student ID | `StudentID` |
| KI class / inactive marker | `Kelas (KI)` |
| Katekis KK | `Katekis Kelompok Kecil` |
| Marital status | `Status Perkawinan` |

Participants are excluded from dashboard counts when `Kelas (KI)` or `Katekis Kelompok Kecil` is one of `Inactive`, `Nonaktif`, or `Tidak Aktif`.

## Metadata Tab

Create a tab named exactly `Dashboard_Metadata`.

| key | value |
| --- | --- |
| `kelompok` | Group/class display name |
| `intakeYear` | Intake year |
| `baptismYear` | Baptism year |
| `priest` | Priest in charge |
| `baptis` | Baptism period label |
| `lastUpdated` | Auto-filled by Apps Script |

Do not manually maintain `lastUpdated`. Apps Script updates or creates that row after a successful QR attendance write, using `YYYY-MM-DD HH:mm:ss` in the script timezone.

## Optional Override Tabs

`Dashboard_Peserta` and `Dashboard_Presensi` are still supported for cleaned/curated dashboard data. If present and non-empty, they take precedence over source-derived participant or topic rows.

# Dashboard Google Sheets Contract

This dashboard reads class data from the Google Sheet attached to each Apps Script Web App deployment. `Presensi` and `Data Siswa` are the minimum required tabs. Dashboard-specific tabs are optional overrides.

## Required Tabs

### `Presensi`

The first row must contain headers. The dashboard reads participants and attendance from this tab when optional dashboard tabs are absent.

Required data:

| Field | Preferred Header | Positional Fallback | Notes |
| --- | --- | --- | --- |
| Student ID | `Student ID` | Column L | Also accepts headers that normalize to `studentId`, `ID Peserta`, `ID Siswa`, or `ID`. |
| Name | `Nama` | Column B | Also accepts `Name` or `Nama Lengkap`. |
| Attendance topics | `Topik 1`, `Topik 2`, `Topik R1` | None | Header must start with `Topik `. Values should be checkbox `TRUE` or text `TRUE`. |

Keep Student IDs identical to `Data Siswa`; matching is case-insensitive after trimming spaces.

### `Data Siswa`

The dashboard enriches participant demographics and inactive status from this tab.

Recommended headers:

| Header | Purpose | Positional Fallback |
| --- | --- | --- |
| `Nama` | Participant display name | None |
| `Jenis Kelamin` | Gender summary | None |
| `Agama` | Religion summary and chart | None |
| `Status Perkawinan` | Marital status summary | None |
| `Student ID` | Join key to `Presensi` | Column L |
| `Kelas KI` | KI assignment and inactive marker | Column R |
| `Katekis KK` | KK catechist assignment and inactive marker | Column S |

Participants are excluded from dashboard counts when `Kelas KI` or `Katekis KK` is one of:

- `Inactive`
- `Nonaktif`
- `Tidak Aktif`

## Optional Dashboard Override Tabs

Use these only when the source tabs are messy or when the dashboard needs manually curated values.

### `Dashboard_Metadata`

Two-column key/value table.

| Column A key | Column B value |
| --- | --- |
| `tahun` | Active catechumenate year |
| `kelompok` | Group/class display name |
| `baptis` | Baptism period or date label |
| `lastUpdated` | Last update date, preferably `YYYY-MM-DD` |

### `Dashboard_Peserta`

Clean participant table. If present and non-empty, this takes precedence over participant data derived from `Presensi` and `Data Siswa`.

Required headers:

- `studentId`
- `name`
- `gender`
- `religion`
- `maritalStatus`
- `kelasKi`
- `katekisKk`
- `active`

Set `active` to `false`, `no`, `tidak`, `inactive`, `nonaktif`, or `0` to exclude a participant.

### `Dashboard_Presensi`

Precomputed topic attendance table. If present and non-empty, this takes precedence over topic summaries derived from `Presensi`.

Required headers:

- `topic`
- `presentCount`
- `totalCount`

`topic` can be `1`, `Topik 1`, `R1`, or `Topik R1`; the dashboard normalizes the label.

## Apps Script Deployment Checklist

After pushing code with `npx clasp push`, update the Web App deployment too:

1. Open the Apps Script project used by the class.
2. Go to **Deploy > Manage deployments**.
3. Edit the active Web App deployment.
4. Select a new version that includes `getDashboardData_`.
5. Deploy and keep using the same `/exec` URL in `VERCEL_SCRIPT_MAP_JSON`.
6. Repeat for every class URL if classes use separate Apps Script projects or deployments.

If the dashboard shows fallback participant data with a message about an old deployment, Vercel is still receiving the old attendance-only Apps Script response (`Missing studentId or week`) from that class Web App URL.

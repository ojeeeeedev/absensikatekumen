# Code Audit v2 — Report

Plan: `CODE_AUDIT_V2.md`. Audit date: 2026-11-17. Baseline: `dev` at
`b086c96` (main `36ada9a` + dependency fixes, PR #36), version 2.9.2, Node 24.

Method: three independent read-only audits (auth/session/routing, scanning and
attendance, profiles/photos/uploads), each finding re-verified against the code
before any fix. Fixes were then checked with unit tests and a mobile-viewport
browser run.

## Result

| | Count |
| --- | ---: |
| Findings (deduplicated) | 56 |
| Fixed | 53 |
| Not a problem (verified) | 3 |

Verification after fixes: `npm run build` ✓, `npm run lint` ✓, `npm test`
144/144 ✓ (was 117), `npm audit` 0 ✓, `test:scan-history` ✓,
`test:profile-combobox` ✓,
focused browser check 33/33 ✓ (390×844, no console errors), uploader race
check ✓, real login/cookie/logout cycle against local Express ✓.

**Apps Script is deployed** (2026-11-17). Each class's live web-app URL was
moved to a new version; URLs, and so `VERCEL_SCRIPT_MAP_JSON`, are unchanged.
Before pushing, every live version and editor HEAD was confirmed identical to
the committed code, so no editor-only changes were overwritten.

| Class | Before | After | Roll back with |
| --- | --- | --- | --- |
| SAB | v51 | v52 | `clasp update-deployment <id> -V 51` |
| TOM | v12 | v13 | `… -V 12` |
| URS | v11 | v12 | `… -V 11` |
| VIN | v6 | v7 | `… -V 6` |

The new GAS works with the currently deployed Vercel code. **The Vercel side is
not deployed**; until it is, A1 (phone-number leak through `/api/absensi`) and
the client fixes are not live.

## State machines

| Machine | States | Where |
| --- | --- | --- |
| Session | anonymous → logging-in → authed → expired → logged out | `public/session.js`, `public/script.js` (login, onload, pageshow), `public/index.html` first paint |
| Scan queue item | pending → processing → success / duplicate / error; pending carries `attempts`, `nextAttemptAt`, `mayHaveReachedServer` | `ScanQueue` in `public/script.js` |
| Camera | idle → starting → streaming → stopping → error (retryable); stops when the tab is hidden | `startScanner` / `stopScanner` / `visibilitychange` in `public/script.js` |
| Attendance (GAS) | ok · duplicate · not found · busy · error | `doPost` in `apps-script/Code.js`; `busy` → HTTP 503 in `api/absensi.js` |
| Roster load | idle → loading → names → enriched / details-unavailable (retry) / error | `loadStudents` in `public/profile.js` |
| Class list | idle → loading → loaded / failed (retried on next visit) | `loadClasses` in `public/profile.js` |
| Photo upload | closed → open → picked → uploading → success / failed | `public/profile-uploader.js` |

## Fixed

### P1

| ID | Finding | Fix |
| --- | --- | --- |
| A1 | `/api/absensi` spread the whole request body into the GAS call, so any logged-in client could send `action: "getStudentContact"` and get a student's raw phone number back as JSON (or the full roster with dates of birth). Found independently by two auditors. | Proxy forwards only `{studentId, week, api_secret}`. Test added. |
| A2 | GAS cached each student's row number for 6 h. After rows are sorted or inserted, a scan ticks **another student's** box and reports success. New students were "tidak terdaftar" for up to 6 h. | Row ID is re-read inside the lock; on mismatch or miss the map is rebuilt once. Tests added. *Needs `clasp push`.* |
| A3 | One failing class (e.g. a broken GAS deployment) blocked every later scan forever: oldest-first retry with no cap. | Per-item backoff (`nextAttemptAt`); other items keep flowing; after 6 server failures the item becomes an error asking for a rescan. |
| A4 | Lock contention ("Sistem sedang sibuk") arrived as HTTP 200 + error, which the client treats as final, so the scan was lost. | GAS returns `busy`; proxy maps it (and the old message) to 503, which is retried. |
| P1 | Closing the photo sheet mid-upload then opening another student put student A's photo on student B. | Student ID captured before the request; user close blocked while uploading; result always applied to the right student. Browser-verified. |

### P2

| ID | Finding | Fix |
| --- | --- | --- |
| A5 | No request timeouts; a dead connection froze the queue. Slow Supabase lookup delayed every scan. | 20 s client timeout; 25 s GAS timeout and 4 s photo-lookup cap on the server. |
| A6 | Invalid QR vibrated ~30×/s while in view, with no message; well-formed-but-wrong base64 showed "HTTP 400". | ID pattern checked before queuing; one "QR tidak valid" toast per 2.5 s. |
| A7 | Offline scans gave no feedback at all. | One "Koneksi terputus. Pindaian disimpan…" toast per outage; `online` retries immediately. |
| A8 | Camera kept running in hidden tabs and could not restart (black viewfinder on iOS return). No retry after a camera error. | Stop on hidden, restart on visible; camera error explains denied vs unavailable and offers a 44 px "Coba lagi" button. |
| A9 | Raw sheet image value (column T) reached the client, bypassing `/api/photo`. | Proxy always drops `image` unless it is the `/api/photo` URL; GAS no longer returns it. |
| A10 | Internal errors (stack text, class codes, GAS response snippets, storage messages) reached toasts. | Generic messages to clients, details in server logs (`absensi`, `students`, `upload-photo`, `version`, GAS). |
| A11 | Every failed retry started a new 5 s timer chain; during an outage request volume grew with each scan. | Single `retryTimer`. |
| A12 | Dedupe keyed on student only; a QR held > 5 s queued twice and showed a false "Duplikat". | Dedupe on student + topic, and never re-queue a pair that is still pending. |
| S1 | Cookie lifetime was reset to 1 h on every reload while the token's own expiry was fixed, so expired sessions looked logged in (scanner shell flashed; `/dashboard` showed bare "Unauthorized"). | Cookie `max-age` follows token `exp` (+ `Secure` on HTTPS); first paint checks expiry; `/dashboard` redirects to login. |
| S2 | Profile requests ignored 401: an expired session kept showing the cached roster (with dates of birth) for up to 6 h. | 401 anywhere in profile → expire session, show login, no cache fallback. Browser-verified. |
| S3 | Logout in one tab left other tabs logged in, and a reload there restored the cookie. | Explicit logout broadcasts to other tabs. |
| S4 | "Keep topic for 10 minutes after logout" never worked after login (user always landed on the topic picker). | Login restores the saved topic using the same expiry rule as page load. |
| S5 | Back button after logout could restore an authenticated page from the bfcache. | `pageshow` re-checks the session. |
| R1 | Background details arriving collapsed the profile the user had just opened and jumped the list to the top. | Merge re-applies the filter without collapsing or scrolling. |
| R2 | A roster response already in flight overwrote a just-uploaded photo and re-cached the old one. | Uploaded-photo overrides; cache invalidated for the student's own class. |
| R3 | "Names loaded, details failed" stayed on "Memuat…" forever with `aria-busy`. | Shows "Tidak tersedia" and a "Coba lagi" toast action. |
| R4 | A failed `/api/classes` load could only be fixed by reloading the page. | Class list retries on the next profile visit. |
| R5 | If the photo bucket listing failed, every student got a guessed photo URL, so a 40-student class made 40 function calls plus 40 storage list calls. | Roster returns no photo URLs on listing failure. Test added. |
| R6 | Photos of 4.5–5 MB passed the 5 MB client check but hit Vercel's ~4.5 MB body limit, showing "Unexpected token…". | Photos above 4 MB are downscaled in the browser (1600 px JPEG); non-JSON errors handled; 413 explained. |
| R7 | Double upload possible; a file picked mid-upload was silently dropped. | Picker and drop zone disabled while uploading; later selections win. |
| R8 | Collapsed "Nonaktif" group stayed reachable by Tab and screen readers. | `inert` + `aria-controls` kept in sync everywhere the group toggles. |

### P3

| ID | Finding | Fix |
| --- | --- | --- |
| A13 | `studentId` and `week` were not type- or length-checked (an array ID wrote attendance and then errored). | String + length check on ID, `^R?\d{1,2}$` on week. Tests added. |
| A14 | A scan replayed after a reload mid-request showed "Duplikat" for a first attendance. | Replayed items that come back `duplicate` count as recorded. |
| A15 | After a 401 the queue kept retrying with `Bearer null`, re-triggering the expiry flash on the login screen. | Queue pauses when there is no token; resumes on login. |
| A16 | Camera loader kept stale text ("pilih topik…"/denied) after the state changed. | Loader reset on every start. |
| S6 | Login had no double-submit guard or in-flight state; 429/5xx showed "Error koneksi". | Button disabled in flight; messages per status. |
| S7 | The shared password stayed in the input (possibly visible) after login. | Cleared and masked on success. |
| S8 | Session expiry left the student drawer and upload sheet open over the login screen. | Login state closes overlays. |
| S9 | Wrong passwords were not throttled on Vercel (the limiter only exists in `app.js`). | 750 ms delay on every failed login. Partial: see deferred D2. |
| R9 | Uploads and bucket creation accepted any well-formed class code. | Upload requires a class from `VERCEL_SCRIPT_MAP_JSON`. Test added. |
| R10 | Choosing the same file again after cancelling did nothing. | Input value cleared after each pick. |
| R11 | Upload size check kept buffering after rejecting the request. | Buffering stops at the limit. |
| R12 | Large-photo button kept "Tambah foto" label after an upload; old-photo cleanup errors ignored. | Label updated; cleanup errors logged. |
| D1 | `AGENTS.md` / README env-var drift (`GAS_SECRET_KEY`, `DAFTAR_URL`, `DASHBOARD_PATH` missing; README called the server key an "anon key"). | Docs updated; `AGENTS.md` now indexes every state machine and the forward-only-two-fields rule. |
| C1 | Dead `totalInBatch` counter, stale "Insert this check…" comment, unused upload `filename` field, GET advertised in CORS but 405. | Removed. |

## Resolved in round 2 (previously deferred)

| ID | Finding | Fix |
| --- | --- | --- |
| D2 | No login rate limit on Vercel. | Per-IP limit: 10 failures / 15 min → 429 with `Retry-After`, plus the 750 ms failure delay. In-memory per function instance, so best-effort; a Vercel Firewall rule on `POST /api/absensi` is still the global option. |
| D3 | Repo files possibly public on Vercel. | **Not a leak.** Probed `/apps-script/Code.js`, `/.clasp.json`, `/package.json`, `/AGENTS.md`, `/app.js`, `/classcode.json`: every path returns the app's `index.html` (the same as a nonexistent path), never file contents. The unstyled page seen at those URLs is the login screen with relative asset paths. |
| D4 | Session token readable by scripts (XSS could steal it). | Login sets the JWT as an `HttpOnly; SameSite=Lax` (`Secure` on HTTPS) cookie and returns only `expiresAt`; the page keeps only that expiry. Requests authenticate by cookie (Bearer still accepted). New `action: "logout"` clears the cookie and sends `Clear-Site-Data: "cache"`. Sessions from the previous release are adopted, so nobody is logged out by the deploy. **Contract change:** the login response no longer contains `token`. |
| D5 | Two tabs overwrote each other's scan queue and could submit twice. | `save()` merges storage (newest `updatedAt` wins, removals are tombstoned), the `storage` event mirrors other tabs, a Web Lock lets one tab send at a time, and only abandoned `processing` items are reset. Browser-verified with two tabs. |
| D6 | WhatsApp handoff errors opened a raw JSON tab. | Browser navigations get a small Indonesian error page (design tokens, 44 px "Kembali ke Profil" / "Masuk kembali" action); API clients still get JSON. |
| D7 | Every thumbnail re-downloaded the full photo (`no-store`); HEAD downloaded the image. | Photo URLs carry the file's `updated_at` as `v`; versioned URLs are `private, max-age=3600`, unversioned stay `no-store`; logout clears the cache. HEAD no longer downloads. Scan results now name the file, saving a storage listing per scan. |
| D8 | Upload sheet had no focus trap; combobox stayed open after Tab. | Tab/Shift+Tab stay inside the sheet; the combobox closes when keyboard focus leaves (not when the iOS keyboard is dismissed). |
| D9 | Dead onboarding module (≈500 lines) still loaded. | Removed `onboarding.js`/`.css`, the script tag, the login hook, onboarding-only icon entries, and the `DESIGN.md` mentions. |
| D10 | Both repo UI scripts failed on the baseline. | Both pass now (see below). |

### New findings while fixing D10

| ID | Finding | Fix |
| --- | --- | --- |
| N1 | **Profile stuck half-closed.** Closing a profile while its opening animation was still running left it in `closing` forever (the opening's `transitioncancel` was mistaken for the close's own end, which also cancelled the fallback timer). | Cancellation no longer ends the wait; the fallback timer and revision check finish it. |
| N2 | Focus was lost after a photo upload (the disabled confirm button dropped focus to `<body>`). | The sheet returns focus when focus has fallen to `<body>`. |
| N3 | On short phones (390×664) the scanner scrolled by 1 px since the history cards got 2 px borders (36ada9a). | The 6 px progress-bar gap (off the spacing scale) is 4 px on short screens. |
| N5 | `test:scan-history` timed the five-second toast rule with fixed sleeps after many steps, so a busy machine made it fail. | Timed from toast creation; the expiry check waits up to 2 s for late timers. |
| N4 | Scripts asserted outdated design: old dark palette, centred expanded names, gradient body, a hidden inactive row being clickable; logged in with an expired `'preview'` token; read colours mid-transition; measured before layout settled. | Assertions synced to the intentional commits (`258e265`, `7f6d882`, `da13805`); real unexpired token; waits for transitions/layout; opens the "Nonaktif" group like a user would. |

## Owner decision applied

| ID | Finding | Resolution |
| --- | --- | --- |
| O1 | In dark mode `--slate-3` equalled `--slate-2` (`#242424`, from `258e265`), so `--secondary` equalled `--card` and student cards blended into their container. | Owner chose `#2e2e2e` (2026-11-17). Also lifts dark `--muted` surfaces by the same step. |

## Rejected / not a bug

- **Phone number in the `/api/reach` redirect** — inherent to a WhatsApp handoff;
  it is in the `Location` header only, never in a payload.
- **Roster payloads** — confirmed free of phone numbers (`/api/students` names
  and full views).
- **Changing topic mid-request** — safe; the week is captured per queue item.

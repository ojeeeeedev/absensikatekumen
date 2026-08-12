# Code Health Audit

Audit date: 2026-07-14  
Branch baseline: `codex/ui-font` at `a20df94`  
Runtime baseline: Node.js `v24.18.0`, npm `11.16.0`
Execution update: 2026-07-14

## Executive summary

The resolved findings were removed from this report. The current checkout keeps
three findings: F-08, F-12, and F-14. F-13 is also solved in the current profile
filter because it hides existing rows instead of rebuilding the complete DOM.

No P0 or P1 issue remains. Two P2 findings and one P3 finding remain. The
remaining work does not require a route, payload, storage-key, Sheet-contract,
authentication, onboarding, or design change.

| Priority | Count | Meaning |
| --- | ---: | --- |
| P0 | 0 | Immediate outage, data-loss, or critical security risk |
| P1 | 0 | High-impact correctness or sensitive-data risk |
| P2 | 2 | Confirmed maintainability, reliability, or scaling debt |
| P3 | 1 | Low-risk hygiene or evidence-gathering work |

## Scope and method

The audit covered tracked application code, local development routing, Vercel
handlers and middleware, Apps Script, test and smoke scripts, package metadata,
and GitHub Actions. Historical files under `docs/superpowers/` were treated as
an intentional archive. Existing untracked/generated paths (`plans/`,
`storybook-static/`, and `tsconfig.tsbuildinfo`) and the user's modified
`classcode.json` were excluded from cleanup conclusions.

### Cleanup status

The current checkout confirms F-01–F-07, F-09–F-11, F-13, and F-15 as solved.
F-08 remains partial. F-12 and F-14 remain because later code changes made
their documentation conclusions incomplete.

Evidence came from:

- `npm audit --json`, `npm outdated --json`, npm registry deprecation metadata,
  and `depcheck`;
- tracked-file, import, route, HTML-handler, and global-reference searches;
- the repository's code-quality analyzer, with results manually checked against
  the source to discard parser false positives;
- `npm test`, `npm run build`, and direct source inspection.

Severity is impact, not effort. Confidence means how strongly the repository
proves the conclusion: **high** is directly observable, **medium** needs a
runtime or production-data check, and **low** is a hypothesis only.

## Runtime entry-point map

| Surface | Entry points and contract |
| --- | --- |
| Main frontend | `public/index.html` loads the shared browser scripts; `public/script.js` owns login, app state, scanning, offline queueing, history, and student detail UI. |
| Profile frontend | `public/profile.html` loads `public/profile.js`, which calls `/api/classes`, `/api/students`, and `/api/upload-photo`. |
| Shared frontend | `theme.js`, `session.js`, `toast.js`, `search-combobox.js`, `icons.js`, `topics.js`, and the intentionally disabled but retained `onboarding.js`. |
| Local server | `app.js` emulates rewrites and selected `api/` handlers, then serves `public/`. |
| Vercel | Files in `api/` are serverless routes; `middleware.js` protects `/dashboard`; `vercel.json` rewrites `/daftar` and static paths. |
| Apps Script | `doPost` and `doGet` are web-app entry points; `onChange` is an installable/simple trigger; `BASE64ENCODE` is a Sheet custom function. They are externally invoked and are not dead code. |
| Tooling | `scripts/check-profile-combobox.js`, `scripts/check-scan-history-ui.js`, and `scripts/clasp-push-all.js` are explicit npm-script entry points. |
| Verification | `test/*.test.js` runs through Vitest; one GitHub Actions workflow installs with `npm ci`, syntax-checks runtime JavaScript, and runs tests. |

## Findings and execution status

The findings below are the remaining items after the solved findings were
removed. The validation block records the original 2026-07-14 execution.

| Finding | Outcome |
| --- | --- |
| F-08 | Partially resolved: queue, history, and scanner behavior now live in `public/scan-queue.js`, `public/scan-history.js`, and `public/scanner.js`. `public/profile.js` still combines class and student list behavior. |
| F-12 | Not current: the code now requires `GAS_SECRET_KEY`, but README still documents a removed default fallback. |
| F-14 | Partially resolved: the student endpoint and scan queue have concise comments, but the upload controller contract remains implicit. |

### F-08 — Core frontend modules combine too many responsibilities

- **Severity:** P2
- **Confidence:** High
- **Evidence:** `public/script.js` is 1,267 lines; `ScanQueue` still owns
  persistence, deduplication, retries, authentication expiry, networking, status
  transitions, timers, and rendering. `public/profile-uploader.js` now owns the
  upload flow, but `public/profile.js` is 868 lines and still combines class and
  student fetching, filtering, accordion rendering, and page initialization.
- **Affected behavior:** Small changes to scanning, history, or profile UI have
  broad regression surfaces and depend on implicit script ordering/globals.
- **Recommendation:** Extract along existing boundaries, one behavior at a time:
  queue/state, history rendering, scanner lifecycle, profile upload, and profile
  list rendering. Preserve plain JavaScript and existing browser globals until
  each consumer is migrated and smoke-tested.

### F-12 — GAS secret requirements are stale in the deployment documentation

- **Severity:** P2
- **Confidence:** High
- **Evidence:** `api/absensi.js` and `api/students.js` reject missing
  `GAS_SECRET_KEY`, and `apps-script/Code.js` rejects a missing
  `GAS_SECRET_KEY` Script Property. `README.md:118-123` still says both sides
  fall back to `default_development_secret`.
- **Affected behavior:** Operators can follow an obsolete setup and removal
  procedure. A missing secret now causes attendance or profile requests to fail.
- **Recommendation:** Update the README to state that both environments require
  the same configured secret. Do not reintroduce the removed fallback.

### F-14 — Critical contracts are documented unevenly

- **Severity:** P3
- **Confidence:** High
- **Evidence:** `api/students.js:6-8` documents the roster output and
  `public/script.js:360-366` documents queue persistence and retry classes. The
  upload parser has a local parser comment, but the upload controller has no
  concise contract for authentication, limits, storage, and failure responses.
- **Affected behavior:** Operators must reconstruct upload behavior from several
  branches and helper calls.
- **Recommendation:** Add one concise contract comment at the upload controller
  boundary. Keep line-by-line comments out of self-explanatory code.

## Dead-code conclusion

No tracked application function was proven dead strongly enough to delete in
this audit. Browser functions referenced through inline HTML handlers and global
objects were counted as live. Vercel file-based handlers, middleware, Apps
Script entry points, triggers, and custom Sheet functions were treated as
externally invoked. The onboarding implementation is intentionally disabled by
`public/onboarding.js:2-5` and retained for future releases, so it is deliberate
dormant code rather than accidental dead code.

Any future source deletion should require a zero-reference result plus the
relevant API or browser smoke check.

## Remaining cleanup roadmap

1. Update the README to match the required `GAS_SECRET_KEY` behavior.
2. Add one concise contract comment at the upload controller boundary.

## Verification gate for cleanup work

Run after each relevant phase, not only at the end:

```bash
npm ci
npm audit
npm test
npm run build
npm run test:profile-combobox
npm run test:scan-history
```

Also syntax-check tracked runtime JavaScript, boot the local server on a
temporary port, verify `/api/version`, and smoke-test local/API route parity.
Browser acceptance must preserve login, topic selection, queue retry/offline
behavior, profile loading and photo upload, dashboard redirect, and the disabled
onboarding state.

## 2026-07-14 validation result

- `npm audit`: 0 vulnerabilities.
- Direct dependency deprecation lookup: none marked deprecated.
- Clean `npm ci`: 164 packages installed, 0 vulnerabilities.
- Vitest: 10 files and 36 tests passed.
- `npm run build`: passed with real `node --check` coverage.
- Profile combobox browser smoke: passed.
- Scan-history browser smoke: passed on confirmation rerun; the first attempt
  missed the viewfinder animation timing assertion and the unchanged rerun
  completed successfully.
- Local `/api/version`: HTTP 200 with `{"version":"2.6.3-c"}`.
- Local `POST /api/upload-photo`: reached the handler and returned the expected
  unauthenticated HTTP 401 response.
- `git diff --check`: passed for staged and unstaged changes.

No schemas, public APIs, response payloads, storage keys, authentication rules,
onboarding behavior, or deployment interfaces were changed during execution.

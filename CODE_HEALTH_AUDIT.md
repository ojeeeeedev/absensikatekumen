# Code Health Audit

Audit date: 2026-07-14  
Branch baseline: `codex/ui-font` at `a20df94`  
Runtime baseline: Node.js `v24.18.0`, npm `11.16.0`
Execution update: 2026-07-14

## Executive summary

The audited cleanup has been executed without changing public routes, payloads,
storage keys, Sheet contracts, authentication behavior, onboarding behavior, or
the current design. The repository now has no tracked dependency output, one
deterministic CI workflow, local upload-route parity, redacted local logging,
paginated photo enrichment, focused upload coverage, and refreshed operational
documentation. The automated suite now contains 36 passing tests.

No P0 issue was found. Two P1 issues should be fixed first. The remaining work
can be shipped incrementally without changing public routes, payloads, storage
keys, Sheet contracts, authentication behavior, or the current design.

| Priority | Count | Meaning |
| --- | ---: | --- |
| P0 | 0 | Immediate outage, data-loss, or critical security risk |
| P1 | 2 | High-impact correctness or sensitive-data risk |
| P2 | 8 | Confirmed maintainability, reliability, or scaling debt |
| P3 | 5 | Low-risk hygiene or evidence-gathering work |

## Scope and method

The audit covered tracked application code, local development routing, Vercel
handlers and middleware, Apps Script, test and smoke scripts, package metadata,
and GitHub Actions. Historical files under `docs/superpowers/` were treated as
an intentional archive. Existing untracked/generated paths (`plans/`,
`storybook-static/`, and `tsconfig.tsbuildinfo`) and the user's modified
`classcode.json` were excluded from cleanup conclusions.

### Changes incorporated in this revision

- `app.js` now applies a global local-server rate limiter, exports the Express
  app for tests, and only listens when run directly.
- `test/app-security.test.js` adds coverage for rate limiting and safe
  format-string logging. It does not redact the request body, so F-02 remains.
- Package metadata is now version 2.6.3 and `classcode.json` contains five
  additional class labels. Neither change alters the dependency conclusions.

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

## Dependency status

`npm audit` reports **0** vulnerabilities across 195 installed packages. Live
npm registry checks report no deprecation message for any direct dependency.
An available version is not the same as a deprecation, so major upgrades are
not recommended merely because they exist.

| Dependency | Installed | Latest observed | Classification |
| --- | ---: | ---: | --- |
| `@supabase/supabase-js` | 2.89.0 | 2.110.4 | Used; update separately with API/storage regression tests |
| `@vercel/analytics` | 1.6.1 | 2.0.1 | Confirmed unused |
| `@vercel/speed-insights` | 1.2.0 | 2.0.0 | Confirmed unused |
| `cookie-parser` | resolved from `^1.4.6` | 1.4.7 | Used by local server |
| `dotenv` | 16.6.1 | 17.4.2 | Used; major update deferred |
| `express` | 4.22.2 | 5.2.1 | Used; major update deferred |
| `express-rate-limit` | 8.5.2 | 8.5.2 | Used |
| `jsonwebtoken` | 9.0.2 | 9.0.3 | Used |
| `playwright` | 1.60.0 | 1.61.1 | Used only by smoke-test scripts; should be development-only |
| `vitest` | 4.1.9 | 4.1.10 | Used as a development dependency |

The `depcheck` reference to a missing `storybook` package came only from the
excluded untracked `storybook-static/` output and is not an application issue.

## Findings and execution status

Evidence and line references below describe the audited baseline. The execution
outcome is recorded here so the original diagnosis remains reviewable.

| Finding | Outcome |
| --- | --- |
| F-01 | Resolved: the Express server now exposes `POST /api/upload-photo`; both a focused test and local HTTP probe reach the handler. |
| F-02 | Resolved: local logging records method and URL only; tests prove request bodies are not passed to the logger. |
| F-03 | Resolved: all 246 tracked `node_modules` files were removed from the Git index, the ignore rule remains, and clean `npm ci` succeeds. |
| F-04 | Resolved: both unused Vercel telemetry packages were removed and the lockfile regenerated. |
| F-05 | Resolved: Playwright is now a development dependency. |
| F-06 | Resolved: the duplicate workflow was removed after confirming the branch has no required protection check with that name. |
| F-07 | Resolved: `npm run build` now syntax-checks runtime, Apps Script, tooling, and test JavaScript without adding a bundler. |
| F-08 | Partially resolved: profile upload behavior was extracted to `public/profile-uploader.js` behind explicit callbacks. Queue/history/scanner extraction remains intentionally incremental because combining those migrations would increase behavioral risk. |
| F-09 | Resolved: `_gas-utils.js` centralizes script-map validation and upstream JSON parsing while endpoint-specific responses remain unchanged. |
| F-10 | Resolved: storage listing now paginates, with a multi-page unit test. |
| F-11 | Resolved: multipart coverage now includes valid binary parsing, absent and quoted boundaries, missing inputs, MIME rejection, and request-size enforcement. |
| F-12 | Resolved as documentation: the two-sided compatibility secret and ordered removal procedure are documented; the fallback remains unchanged by design. |
| F-13 | Deferred by design: this medium-confidence performance candidate requires representative class-size measurements before changing rendering behavior. |
| F-14 | Resolved for touched boundaries: concise contracts now cover the student endpoint, upload controller, and scan-queue retry/persistence invariants. |
| F-15 | Resolved: README, static fallbacks, package metadata, and project guidance now agree on v2.6.3 and the authenticated private-photo proxy. |

### F-01 — Local development omits the photo-upload route

- **Severity:** P1
- **Confidence:** High
- **Evidence:** `public/profile.js:174-180` posts to `/api/upload-photo`.
  `app.js:93-169` registers the other application API handlers but never
  registers `api/upload-photo.js`.
- **Affected behavior:** Photo uploads work as an automatic Vercel function but
  return the static fallback/404 behavior when the profile is exercised through
  `npm start`. Local testing therefore cannot validate production route parity.
- **Recommendation:** Register `POST /api/upload-photo` in `app.js` using the
  existing handler and JSON error shape. Add a local route smoke check before
  changing the handler itself.

### F-02 — Local request logging includes login secrets and tokens

- **Severity:** P1
- **Confidence:** High
- **Evidence:** `app.js:35-39` logs every request body. Login sends the shared
  secret in the request body (`public/script.js:270-275`), and authenticated
  operations may contain student identifiers. `test/app-security.test.js:20-32`
  explicitly expects the body argument; the test prevents format-string
  interpretation but does not test redaction.
- **Affected behavior:** Local terminal output and captured logs can retain
  credentials or personal identifiers. This is a development-only path, but it
  weakens the same trust boundary used to validate production behavior.
- **Recommendation:** Log method and path only, or explicitly redact `secret`,
  authorization values, and student data. Do not introduce a logging package.

### F-03 — Ignored dependency files are still tracked

- **Severity:** P2
- **Confidence:** High
- **Evidence:** `.gitignore:2` ignores `node_modules/`, but
  `git ls-files node_modules` returns 246 tracked files (1.7 MB, 246 of 342
  tracked paths).
- **Affected behavior:** Dependency installation can dirty the working tree,
  stale package contents can survive lockfile changes, and reviews contain
  generated third-party code.
- **Recommendation:** Remove all tracked `node_modules` paths from the Git index,
  retain the ignore rule, and prove reproducibility with a clean `npm ci`.

### F-04 — Two production dependencies have no runtime references

- **Severity:** P2
- **Confidence:** High
- **Evidence:** `package.json:20-21` declares `@vercel/analytics` and
  `@vercel/speed-insights`. `depcheck` identifies both as unused, and tracked
  application code contains no import, require, script tag, or initialization
  for either package.
- **Affected behavior:** Installs and deploy bundles include dependencies that
  provide no analytics or speed-insight behavior.
- **Recommendation:** Remove both declarations and regenerate the lockfile.
  If telemetry is wanted later, add one package together with explicit browser
  initialization and a verification event.

### F-05 — Playwright is classified as a production dependency

- **Severity:** P3
- **Confidence:** High
- **Evidence:** `package.json:27` places Playwright in `dependencies`; its only
  tracked imports are `scripts/check-profile-combobox.js:2` and
  `scripts/check-scan-history-ui.js:2`.
- **Affected behavior:** Production installs resolve browser-test tooling that
  is not needed by the serverless application.
- **Recommendation:** Move Playwright to `devDependencies`; keep both smoke-test
  scripts and their npm commands unchanged.

### F-06 — CI runs the same job twice with inconsistent installation

- **Severity:** P2
- **Confidence:** High
- **Evidence:** `.github/workflows/node.js.yml:6-31` and
  `.github/workflows/test.yml:3-34` share the same triggers, Node 24 matrix,
  build command, and test command. One uses `npm ci`; the other uses
  `npm install`.
- **Affected behavior:** Every push and pull request performs duplicate work,
  while the two jobs do not prove exactly the same dependency state.
- **Recommendation:** Keep one named workflow using `npm ci`, build/check, and
  tests. Remove the duplicate workflow only after confirming branch-protection
  rules do not require its old check name.

### F-07 — The build check is a no-op

- **Severity:** P3
- **Confidence:** High
- **Evidence:** `package.json:11` defines build as an `echo`, while both CI
  workflows present it as a build check.
- **Affected behavior:** A green “build” step proves no syntax, import, or route
  validity and can create false confidence.
- **Recommendation:** Either rename it to make the no-build architecture
  explicit or replace it with dependency-free `node --check` coverage for
  tracked runtime JavaScript. Do not add a bundler solely for this check.

### F-08 — Core frontend modules combine too many responsibilities

- **Severity:** P2
- **Confidence:** High
- **Evidence:** `public/script.js` is 1,286 lines; `ScanQueue` spans
  `public/script.js:317-881` and owns persistence, deduplication, retries,
  authentication expiry, networking, status transitions, timers, and rendering.
  `public/profile.js` is 611 lines and combines uploads, class/student fetching,
  filtering, accordion rendering, and page initialization. The quality scan
  scores these files 0 and 52 respectively because of long, complex functions.
- **Affected behavior:** Small changes to scanning, history, or profile UI have
  broad regression surfaces and depend on implicit script ordering/globals.
- **Recommendation:** Extract along existing boundaries, one behavior at a time:
  queue/state, history rendering, scanner lifecycle, profile upload, and profile
  list rendering. Preserve plain JavaScript and existing browser globals until
  each consumer is migrated and smoke-tested.

### F-09 — Backend handlers duplicate configuration and GAS response handling

- **Severity:** P2
- **Confidence:** High
- **Evidence:** `api/absensi.js:27-40` and `api/students.js:34-48` independently
  parse `VERCEL_SCRIPT_MAP_JSON`; `api/absensi.js:119-130` and
  `api/students.js:66-77` independently read, parse, log, and translate GAS
  responses. The quality scan also reports long/high-complexity handlers in
  `absensi.js`, `students.js`, `upload-photo.js`, and `init-bucket.js`.
- **Affected behavior:** Configuration and upstream-error behavior can drift
  between endpoints, making deployment failures harder to diagnose consistently.
- **Recommendation:** Add one small internal helper for script-map lookup and one
  for JSON response parsing. Keep endpoint-specific status codes and user-facing
  messages in each handler; do not introduce a handler framework.

### F-10 — Student photo enrichment has a 200-object ceiling

- **Severity:** P2
- **Confidence:** High
- **Evidence:** `api/students.js:84-86` requests a single storage page with
  `limit: 200`, then `api/students.js:88-105` enriches students only from those
  returned objects.
- **Affected behavior:** Classes/buckets with more than 200 photo objects can
  show valid students without photos depending on which objects appear in the
  first page.
- **Recommendation:** Record the current bucket sizes first. If any bucket can
  exceed 200 objects, paginate the listing or fetch only the required names.
  Add a test with more than one page before changing the query.

### F-11 — Multipart parsing is bespoke and lacks direct tests

- **Severity:** P2
- **Confidence:** High
- **Evidence:** `api/upload-photo.js:14-58` implements multipart parsing by
  manually scanning boundary buffers; `api/upload-photo.js:97-143` combines
  stream-size enforcement with parser and field validation. There is no
  `test/upload-photo.test.js`.
- **Affected behavior:** Boundary quoting, malformed headers, repeated fields,
  stream errors, and near-limit payloads can regress without detection on a
  security-sensitive upload path.
- **Recommendation:** Keep the dependency-free parser for now, but add focused
  tests for valid upload parsing, malformed boundary, missing file/student ID,
  MIME rejection, and size limits before refactoring it.

### F-12 — GAS compatibility-secret behavior is an undocumented deployment invariant

- **Severity:** P2
- **Confidence:** High
- **Evidence:** `api/absensi.js:90`, `api/students.js:50`,
  `apps-script/Code.js:11-14`, and `apps-script/Code.js:175-178` all fall back to
  `default_development_secret`.
- **Affected behavior:** Removing the fallback on only one side breaks attendance
  and profile loading; leaving it indefinitely can hide incomplete environment
  configuration.
- **Recommendation:** Document the two-sided compatibility contract and an
  ordered deployment/removal procedure. Do not remove or rename the fallback
  until every deployed Apps Script and Vercel environment is coordinated.

### F-13 — Profile filtering rebuilds the complete visible DOM on every keystroke

- **Severity:** P3
- **Confidence:** Medium
- **Evidence:** `public/profile.js:305-551` clears and recreates the student list,
  and `public/profile.js:553-561` invokes that full renderer for every input
  event registered at `public/profile.js:607-610`.
- **Affected behavior:** Large classes may experience input lag, image reloads,
  and lost accordion state. The current class sizes were not available, so this
  is a measured-performance candidate rather than a proven user-visible defect.
- **Recommendation:** Measure input/render time with realistic class sizes.
  Optimize only if it breaches an agreed threshold; first options are a short
  debounce and preserving/reusing existing rows, not a new UI framework.

### F-14 — Critical contracts are documented unevenly

- **Severity:** P3
- **Confidence:** High
- **Evidence:** `api/_supabase-utils.js:1-20` and
  `api/init-bucket.js:5-27` document their contracts well, while the complete
  `/api/students` flow (`api/students.js:5-113`) and queue retry/state behavior
  (`public/script.js:317-881`) have no top-level contract describing inputs,
  state transitions, failure classes, and persistence invariants. Conversely,
  `apps-script/Code.js:43-102` contains several speculative/redundant narration
  comments around straightforward statements.
- **Affected behavior:** Important operational behavior must be reconstructed
  from branches, while extra narration makes the truly consequential comments
  harder to find.
- **Recommendation:** Add concise contract comments only at trust boundaries and
  complex state machines. Remove speculative or line-by-line narration during
  the related refactor; do not comment self-explanatory code.

### F-15 — Repository documentation has release and architecture drift

- **Severity:** P3
- **Confidence:** High
- **Evidence:** `README.md:1` reports v2.4.5, the static UI fallbacks at
  `public/index.html:95` and `public/index.html:242` report v2.6.1, and
  `package.json:3` is 2.6.3. `README.md:21`, `README.md:45`, and the project
  guidance still describe signed image URLs, while the current implementation
  uses the authenticated same-origin `/api/photo` proxy.
- **Affected behavior:** Operators and contributors can follow stale deployment
  or troubleshooting assumptions even though runtime behavior is correct.
- **Recommendation:** Update the README only when the corresponding cleanup is
  implemented; make `package.json` the version source of truth and document the
  private photo proxy accurately.

## Dead-code conclusion

No tracked application function was proven dead strongly enough to delete in
this audit. Browser functions referenced through inline HTML handlers and global
objects were counted as live. Vercel file-based handlers, middleware, Apps
Script entry points, triggers, and custom Sheet functions were treated as
externally invoked. The onboarding implementation is intentionally disabled by
`public/onboarding.js:2-5` and retained for future releases, so it is deliberate
dormant code rather than accidental dead code.

The only confirmed unused runtime declarations are the two package dependencies
in F-04. Any future source deletion should require a zero-reference result plus
the relevant API/browser smoke check.

## Phased cleanup roadmap

### Phase 1 — Repository hygiene

1. Remove tracked `node_modules` content and verify a clean `npm ci`.
2. Consolidate CI into one deterministic workflow after checking required check
   names in branch protection.
3. Replace or rename the no-op build check.

### Phase 2 — Dependency cleanup

1. Remove `@vercel/analytics` and `@vercel/speed-insights`.
2. Move Playwright to `devDependencies`.
3. Regenerate and review `package-lock.json`; do not batch unrelated major
   upgrades into this change.

### Phase 3 — Correctness and dead paths

1. Add local `/api/upload-photo` parity and redact local request logging.
2. Add upload-parser tests and local route smoke coverage.
3. Re-run reference mapping, then remove only newly proven dead code.

### Phase 4 — Maintainability

1. Extract queue/history/scanner responsibilities from `public/script.js` in
   separate commits with the scan-history smoke test after each extraction.
2. Separate profile upload behavior from list rendering/filtering, preserving
   DOM structure, selectors, and accessibility behavior.
3. Centralize only the duplicated script-map and GAS-response helpers used by
   multiple backend handlers.

### Phase 5 — Documentation and measured efficiency

1. Document authentication sources, GAS compatibility, bucket naming,
   multipart limits, queue state transitions, and Apps Script cache behavior.
2. Measure bucket sizes and profile render latency before implementing storage
   pagination or DOM reuse.
3. Refresh the README and remove redundant comments while the related code is
   already being touched.

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

## Current validation result

- `npm audit`: 0 vulnerabilities.
- Direct dependency deprecation lookup: none marked deprecated.
- Clean `npm ci`: 164 packages installed, 0 vulnerabilities.
- Vitest: 10 files and 36 tests passed.
- `npm run build`: passed with real `node --check` coverage.
- Profile combobox browser smoke: passed.
- Scan-history browser smoke: passed on confirmation rerun; the first attempt
  missed the viewfinder animation timing assertion and the unchanged rerun
  completed successfully.
- Local `/api/version`: HTTP 200 with `{"version":"2.6.3"}`.
- Local `POST /api/upload-photo`: reached the handler and returned the expected
  unauthenticated HTTP 401 response.
- `git diff --check`: passed for staged and unstaged changes.

No schemas, public APIs, response payloads, storage keys, authentication rules,
onboarding behavior, or deployment interfaces were changed during execution.

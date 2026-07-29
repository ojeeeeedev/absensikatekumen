# AGENTS.md — Presensi Katekumen Digital

## Product and architecture

Mobile-first attendance system for the Catechumenate programme at St. Peter's Cathedral, Bandung.

Flow:

1. A facilitator signs in with a shared secret and receives a JWT.
2. The frontend scans a student QR code.
3. A Vercel Node.js serverless function validates and proxies the request.
4. Google Apps Script applies attendance rules and updates Google Sheets.
5. The authenticated `/api/photo` proxy retrieves photos from private Supabase Storage.

Preserve this architecture unless the user explicitly requests a migration.

- Frontend: HTML, CSS, and vanilla JavaScript.
- API: ESM Vercel Serverless Functions.
- Logic and data: Google Apps Script and Google Sheets.
- Files: private Supabase Storage.
- Local runtime: Vercel CLI or the existing Express wrapper.

Do not introduce React, Next.js, TypeScript, a new database, or another backend framework unless explicitly requested.

## Key paths

Verify paths and ownership before use.

- `api/`: Vercel handlers, including attendance, dashboard, registration, photo, and WhatsApp handoff routes.
- `apps-script/Code.js`: Apps Script entry points, caching, and Sheet operations.
- `public/`: the HTML, CSS, JavaScript, and static topic data.
- `app.js`: local Express wrapper.
- `middleware.js`: protected routing.
- `.clasp.json`, `vercel.json`, `package.json`: deployment and runtime configuration.

## Commands and configuration

```bash
npm install
npm start
node app.js       # only when the task uses the Express wrapper
npx clasp push    # only when the user explicitly requests Apps Script deployment
```

Inspect `package.json` before using another script.

Expected environment variables may include `AUTH_SECRET`, `JWT_SECRET`, `SUPABASE_URL`, `SUPABASE_KEY`, `VERCEL_SCRIPT_MAP_JSON`, and `DASHBOARD_URL`.

- Never expose or commit secret values, credentials, private URLs, or `.env` files.
- Preserve the class-code-to-GAS mapping in `VERCEL_SCRIPT_MAP_JSON`.
- Check all callers and deployment dependencies before renaming or removing a variable.
- Do not alter production configuration or deploy without explicit approval.

## Security invariants

- Verify JWTs server-side for attendance and dashboard operations.
- Validate `studentId` and other external input at the trust boundary.
- Keep Supabase buckets private and serve student images only through authenticated `/api/photo`.
- Preserve `/api/reach` as the authenticated WhatsApp handoff. Do not rename it to a contact-specific route.
- Never expose phone numbers in roster payloads, including `/api/students`.
- Keep secrets, service keys, private URLs, and contact data out of frontend code.
- Keep client errors generic when details could expose internal state.
- Do not weaken authentication or route protection for local testing.

## Apps Script and Sheets

- Keep attendance rules in Apps Script and Google Sheets as the system of record.
- Before changing shared fields, check the Vercel caller and `apps-script/Code.js`.
- Preserve deployed request and response contracts, Sheet names, columns, ID formats, date formats, and attendance rules unless the task changes them.
- Verify the actual schema. Do not rely on comments alone.
- Keep Sheet operations and cross-layer payloads bounded.
- Preserve `CacheService` where it prevents repeated reads; change caching only for correctness.
- Do not write to production data or run `clasp push` during verification.

## Frontend requirements

- Design for narrow mobile screens and unreliable networks.
- Preserve scanner speed, camera usability, accessible focus, touch targets, contrast, and existing haptics.
- Show clear feedback for successful scans, invalid QR codes, authentication failure, duplicate attendance, network failure, and server failure.
- Keep animations short and responsive. Inspect only the affected transition.
- Do not add a large dependency for a minor UI change.

## Change boundaries

- Do not migrate the stack, data, or Sheet structure during routine maintenance.
- Do not move Apps Script logic while changing frontend presentation.
- Check all consumers before renaming an endpoint, environment variable, class code, or payload field.
- Change deployment configuration only when required by the request.
- Do not bump versions, commit, push, deploy, or release unless requested.

## Focused verification

Use the global verification rules, then apply the relevant checks:

- Frontend: check the affected mobile viewport and interaction in a browser, including console errors.
- Vercel API: test authentication success and failure, validation, status codes, downstream contracts, and private-data filtering.
- Apps Script: check its Vercel caller and test parsing, validation, and errors without production writes or deployment.
- Supabase photos: confirm the bucket remains private, `/api/photo` remains required, unauthenticated access fails, and storage details stay hidden.
- Routing: test public and protected routes, unauthorized access, redirect loops, and compatibility with `vercel.json`.

## Known constraints

- Facilitators share one secret instead of individual accounts.
- Google Sheets remains the database for workflow compatibility.
- Apps Script latency, quotas, and cache expiry affect requests.
- Local Express behavior may differ from Vercel.
- Camera access outside localhost requires a secure context and varies by device.

Do not silently replace these constraints with a migration. Report the trade-off when it affects the task.

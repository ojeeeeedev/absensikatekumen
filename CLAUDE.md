# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Install Dependencies
```bash
npm install
```

### Run Local Development Server
Use the Vercel CLI to run serverless API functions and the frontend concurrently:
```bash
npm start
# or directly using the vercel CLI
vercel dev
```

There are no pre-configured unit testing or linting frameworks in this repository.

---

## Architectural Guide & Tech Stack

This repository implements a lightweight, responsive, serverless attendance system utilizing a mobile-first frontend, a secure serverless API proxy, and Google Sheets + Supabase backends.

### Frontend (`public/`)
- **Core Stack**: HTML5, CSS3 (Liquid glass/neumorphic visual language), ES6+ JavaScript. No build pipeline or single-page application framework.
- **QR Scanning**: Uses the `html5-qrcode` library for mobile camera scanner integration inside `public/script.js`.
- **Topic Configuration**: `public/topics.js` stores the statically compiled class syllabus list (`STATIC_TOPICS`) to guarantee instantaneous load time.

### Serverless API (`api/`)
- Hosted on Vercel as Node.js serverless functions:
  - `api/absensi.js`: Core endpoint. Handles two functionalities depending on `req.method` and payload:
    - **Authentication**: Validates shared secret (`AUTH_SECRET`) and issues a JSON Web Token (`JWT_SECRET`) valid for 8 hours.
    - **Attendance Recording**: Secures the submission through JWT validation, extracts class codes from student IDs, and proxies requests to class-specific Google Apps Scripts concurrently with generating Supabase signed URLs.
  - `api/dashboard.js`: Directs authorized users to the Google Sheets dashboard via a secure `307 Temporary Redirect` based on `DASHBOARD_URL`.
  - `api/register.js`: Redirects to the student registration portal (`DAFTAR_URL`).

### Backend Services (`apps-script/`)
- **Google Apps Script**:
  - Code inside `apps-script/Code.js` runs as a Google Web App to process sheets-related operations.
  - **Caching System**: Uses `CacheService.getScriptCache()` to cache student indexes (`STUDENT_MAP_V1`) for 6 hours to bypass repeated slow worksheet lookup operations.
- **Supabase**:
  - Object storage buckets (segmented dynamically as `pasfoto-<classcode>`) store student profile images.
  - Vercel API generates temporary, secure signed image URLs using the Supabase Node.js SDK so images are not exposed publicly.

---

## Technical Constraints & Standards

- **Environment Variables**: Local development demands a populated `.env` or `.env.local` containing:
  - `AUTH_SECRET`: The shared facilitator password.
  - `JWT_SECRET`: Secret string used to sign session JWTs.
  - `SUPABASE_URL` & `SUPABASE_KEY`: Supabase connection credentials.
  - `VERCEL_SCRIPT_MAP_JSON`: Stringified JSON object mapping class codes to GAS endpoint URLs (e.g., `{"SAB":"https://script.google.com/..."}`).
  - `DASHBOARD_URL`: Target Google Sheets editor URL.
  - `DAFTAR_URL`: Target Google Forms or registration URL.
- **Deployment**: Configured to deploy natively to Vercel (see `vercel.json` and `middleware.js` for redirects and path behavior).
- **Version Bumping**: When all requested modifications for a task are complete and verified, ask the user if they want to bump the package version (major, minor, patch, or none) before final completion. After every version bump, ask the user interactively whether to commit to the local repo or push it to the remote repo.


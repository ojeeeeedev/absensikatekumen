# GEMINI.md - Project Context: Presensi Katekumen Digital

This document provides essential context and instructions for AI agents working on the **Presensi Katekumen Digital** project.

## 1. Project Overview
A modern digital attendance system for the Catechumenate program at St. Peter's Cathedral, Bandung. It uses QR code scanning, real-time Google Sheets synchronization, and secure student image retrieval.

- **Primary Purpose:** Streamline weekly attendance for students using mobile devices.
- **Project Type:** Web Application (Serverless Architecture).
- **Core Workflow:** 
  1. Facilitator Login (Shared Secret + JWT).
  2. QR Scan (Student ID).
  3. API Proxy (Vercel Node.js).
  4. Business Logic & Database (Google Apps Script + Google Sheets).
  5. Image Retrieval (Supabase Storage).

---

## 2. Tech Stack
- **Frontend:** Pure HTML5, CSS3, JavaScript (ES6+). Mobile-first, "Liquid glass" UI.
- **Backend (API Layer):** Node.js (Vercel Serverless Functions).
- **Backend (Logic Layer):** Google Apps Script (GAS).
- **Database:** Google Sheets.
- **Storage:** Supabase Storage (Student Pasfoto).
- **Deployment/Hosting:** Vercel.

---

## 3. Key Files & Directory Structure
- `api/`: Vercel serverless functions (Node.js).
  - `absensi.js`: Main endpoint for login and attendance processing.
  - `dashboard.js`: Handles secure dashboard redirects.
  - `register.js`: (Likely) registration logic.
- `apps-script/`: Source code for Google Apps Script.
  - `Code.js`: Core GAS business logic (doPost, doGet, caching).
- `public/`: Frontend assets.
  - `index.html`, `script.js`, `style.css`: The mobile-first web interface.
  - `topics.js`: Statically defined weekly topics.
- `app.js`: Express wrapper for local development (proxies ESM API handlers).
- `middleware.js`: Vercel edge middleware for dashboard routing.
- `.clasp.json`: Configuration for Google Apps Script CLI (clasp).
- `vercel.json`: Vercel deployment configuration.

---

## 4. Building and Running

### Local Development
1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the development server (requires [Vercel CLI](https://vercel.com/cli)):
   ```bash
   npm start # runs `vercel dev`
   ```
   Or use the Express wrapper (if configured for your environment):
   ```bash
   node app.js
   ```

### Google Apps Script Management
Use `clasp` to push changes to Google Apps Script:
```bash
npx clasp push
```

---

## 5. Environment Variables
The following environment variables are required (configured in Vercel or `.env`):
- `AUTH_SECRET`: Shared facilitator login password.
- `JWT_SECRET`: Secret key for signing/verifying JWTs.
- `SUPABASE_URL`: Supabase project URL.
- `SUPABASE_KEY`: Supabase anon key.
- `VERCEL_SCRIPT_MAP_JSON`: JSON map linking Class Codes to GAS Web App URLs.
  - *Example:* `{"SAB":"https://script.google.com/macros/s/.../exec"}`
- `DASHBOARD_URL`: URL to the Google Sheets dashboard.

---

## 6. Development Conventions
- **Language/Style:** 
  - Backend: Node.js with ESM (`"type": "module"`).
  - Frontend: Vanilla JavaScript, avoid heavy frameworks to keep the load times fast for mobile data users.
- **Security:**
  - All sensitive operations (Attendance, Dashboard) must be protected by JWT verification.
  - Supabase images must be served via **Signed URLs** with short expiration (60s).
- **Optimization:**
  - **Caching:** GAS logic uses `CacheService` (6h TTL) to minimize slow Sheet read operations.
  - **Payloads:** Keep the JSON payloads between Frontend and GAS lean.
- **Error Handling:**
  - Provide clear visual and haptic (vibration) feedback for success/error states on the mobile UI.
  - Always validate incoming `studentId` formats before processing.

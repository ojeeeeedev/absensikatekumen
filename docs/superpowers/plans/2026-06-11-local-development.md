# Local Development Environment Setup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mengkonfigurasi lingkungan pengembangan lokal (local development) menggunakan Express.js berbasis ES Modules (ESM) sehingga pengembang dapat menjalankan, menguji, dan men-debug aplikasi secara lokal tanpa harus melakukan deployment ke Vercel setiap saat.

**Architecture:** Memperbarui `app.js` ke sintaks ESM (`import` dan `export`), mengintegrasikan middleware `cookie-parser` untuk membaca cookie autentikasi dashboard, meniru aturan routing Vercel (rewrite `/daftar` dan `/dashboard` dengan validasi cookie), serta menambahkan dependency `express`, `dotenv`, dan `cookie-parser`.

**Tech Stack:** Node.js, Express.js, cookie-parser, dotenv.

---

### Task 1: Pembaruan Dependency dan Script package.json
**Files:**
- Modify: `package.json`

- [ ] **Step 1: Modifikasi `package.json` untuk menambahkan dependencies baru dan perintah `npm run dev`.**

Tambahkan `express`, `dotenv`, dan `cookie-parser` ke dalam `dependencies`, dan tambahkan `"dev": "node app.js"` ke dalam `"scripts"`. Edit `package.json`:
```json
{
  "name": "absensikatekumen",
  "version": "1.8.0",
  "type": "module",
  "scripts": {
    "start": "vercel dev",
    "dev": "node app.js",
    "build": "echo 'No build step needed'"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.89.0",
    "@vercel/analytics": "^1.6.1",
    "@vercel/speed-insights": "^1.2.0",
    "cookie-parser": "^1.4.6",
    "dotenv": "^16.4.5",
    "express": "^4.19.2",
    "jsonwebtoken": "^9.0.2"
  },
  "devDependencies": {
    "@google/clasp": "^3.1.3",
    "vercel": "latest"
  }
}
```

- [ ] **Step 2: Jalankan `npm install` untuk memasang package baru.**

Run: `npm install`
Expected: Instalasi sukses tanpa error.

- [ ] **Step 3: Commit perubahan package.json.**
```bash
git add package.json package-lock.json
git commit -m "chore: add express, dotenv, cookie-parser dependencies and dev script"
```

---

### Task 2: Refactor app.js Menjadi ES Modules (ESM) & Integrasi Routing Vercel
**Files:**
- Modify: `app.js`

- [ ] **Step 1: Tulis ulang `app.js` ke sintaks ESM, pasang middleware cookie-parser, serta tiru alur routing Vercel untuk `/daftar` dan `/dashboard`.**

Ganti seluruh isi `app.js` dengan kode berikut. Edit baris 1-25 di `app.js`:
```javascript
import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import cookieParser from 'cookie-parser';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Middleware to parse JSON and cookies
app.use(express.json());
app.use(cookieParser());

// Accessing variables from environment
const PORT = process.env.PORT || 5500;

// ==========================================
// 1. REWRITES & MIDDLEWARE EMULATION
// ==========================================

// Route for register (daftar) rewrite matching vercel.json
app.get('/daftar', async (req, res) => {
  try {
    const handler = (await import('./api/register.js')).default;
    await handler(req, res);
  } catch (error) {
    console.error("Error running api/register:", error);
    res.status(500).send("Internal Server Error");
  }
});

// Route for dashboard rewrite with cookie check matching middleware.js
app.get('/dashboard', async (req, res) => {
  const token = req.cookies.auth_token;
  if (!token) {
    // If token is missing, redirect to login page (index.html)
    return res.redirect('/');
  }
  
  try {
    // Run api/dashboard handler directly
    const handler = (await import('./api/dashboard.js')).default;
    await handler(req, res);
  } catch (error) {
    console.error("Error running api/dashboard:", error);
    res.status(500).send("Internal Server Error");
  }
});

// ==========================================
// 2. API ENDPOINTS
// ==========================================

// Route to handle the main absensi API (Login and Attendance)
app.post('/api/absensi', async (req, res) => {
  try {
    const handler = (await import('./api/absensi.js')).default;
    await handler(req, res);
  } catch (error) {
    console.error("Error running api/absensi:", error);
    res.status(500).json({ status: "error", message: "Internal Server Error" });
  }
});

// Route to handle dashboard direct API call
app.get('/api/dashboard', async (req, res) => {
  try {
    const handler = (await import('./api/dashboard.js')).default;
    await handler(req, res);
  } catch (error) {
    console.error("Error running api/dashboard:", error);
    res.status(500).send("Internal Server Error");
  }
});

// ==========================================
// 3. STATIC FILES
// ==========================================
app.use(express.static(path.join(__dirname, 'public')));

// Fallback for clean URLs - serve index.html for unknown paths
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server started locally on http://localhost:${PORT}`);
});
```

- [ ] **Step 2: Jalankan aplikasi secara lokal untuk memverifikasi server berjalan.**

Run: `npm run dev`
Expected: Server log `Server started locally on http://localhost:5500` muncul di terminal. Buka http://localhost:5500 di browser untuk memastikan halaman login tampil dengan benar.

- [ ] **Step 3: Commit perubahan app.js.**
```bash
git add app.js
git commit -m "feat: refactor app.js to ES Modules and implement local Vercel-like routing redirects"
```

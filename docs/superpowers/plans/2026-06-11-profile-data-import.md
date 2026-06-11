# Profile Data Import and Accordion UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Import student list and date of birth details from Google Sheets, fetch signed pasfoto URLs from Supabase, and render the details in an expandable search-filterable accordion list on the `/profile` route.

**Architecture:** Extend Google Apps Script to fetch names, IDs, and DOB (TTL Column F) from sheet; implement a Vercel endpoint `/api/students` that verifies the JWT token and fetches/batch-signs student images; build the frontend class selector, search filter, and accordion UI.

**Tech Stack:** Node.js, Express, Google Apps Script, Supabase, Vanilla JS, CSS

---

### Task 1: Update Google Apps Script (`apps-script/Code.js`)

**Files:**
- Modify: `apps-script/Code.js`

- [ ] **Step 1: Update `doPost` to handle the `getStudentList` action**

  In [apps-script/Code.js](file:///Users/andarpartogi/repo/absensikatekumen/apps-script/Code.js) around lines 8-10, insert the action check:
  ```javascript
  const data = JSON.parse(e.postData.contents);

  // Handle getStudentList action
  if (data.action === "getStudentList") {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const students = getStudentList_(ss);
    return buildResponse_({ status: "ok", students: students });
  }
  ```

- [ ] **Step 2: Add helper function `getStudentList_` at the end of the file**

  In [apps-script/Code.js](file:///Users/andarpartogi/repo/absensikatekumen/apps-script/Code.js) at the bottom, append:
  ```javascript
  /**
   * Retrieves all registered students with DOB (TTL) from Google Sheets
   */
  function getStudentList_(ss) {
    const students = [];
    const sheetPresensi = ss.getSheetByName("Presensi");
    const sheetSiswa = ss.getSheetByName("Data Siswa");
    
    if (!sheetPresensi) return [];
    
    // Read Presensi Data (Fast bulk read)
    const presensiData = sheetPresensi.getDataRange().getValues();
    const studentMap = {};
    
    // Start from row 1 (skip header)
    for (let i = 1; i < presensiData.length; i++) {
      const id = String(presensiData[i][11] || "").trim(); // Column L (Index 11)
      const name = String(presensiData[i][1] || "").trim(); // Column B (Index 1)
      if (id) {
        studentMap[id.toLowerCase()] = {
          studentId: id,
          name: name,
          dob: "" // Default empty
        };
      }
    }
    
    // Read Data Siswa (for TTL in Column F - Index 5)
    if (sheetSiswa) {
      const siswaData = sheetSiswa.getDataRange().getValues();
      for (let k = 1; k < siswaData.length; k++) {
        const sId = String(siswaData[k][11] || "").trim().toLowerCase(); // Column L
        if (studentMap[sId]) {
          studentMap[sId].dob = String(siswaData[k][5] || "").trim(); // Column F (TTL)
        }
      }
    }
    
    // Convert map to array
    for (const key in studentMap) {
      students.push(studentMap[key]);
    }
    
    return students;
  }
  ```

- [ ] **Step 3: Push changes to Google Apps Script**

  Run:
  ```bash
  npx clasp push
  ```
  Expected: Pushed files successfully.

- [ ] **Step 4: Commit Google Apps Script changes**

  Run:
  ```bash
  git add apps-script/Code.js
  git commit -m "feat: add getStudentList action to Google Apps Script backend"
  ```

---

### Task 2: Create Vercel API Endpoints (`api/students.js` and `api/classes.js`)

**Files:**
- Create: `api/students.js`
- Create: `api/classes.js`

- [ ] **Step 1: Implement `api/students.js` for retrieving and batch-signing students**

  Create file `api/students.js` with this exact content:
  ```javascript
  import jwt from 'jsonwebtoken';
  import { createClient } from '@supabase/supabase-js';

  export default async function handler(req, res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

    if (req.method === "OPTIONS") {
      return res.status(200).end();
    }

    if (req.method !== "GET") {
      return res.status(405).json({ status: "error", message: `Method ${req.method} not allowed` });
    }

    const JWT_SECRET = process.env.JWT_SECRET;
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ status: "error", message: "Akses ditolak: Token tidak valid" });
    }

    try {
      jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
    } catch (err) {
      return res.status(401).json({ status: "error", message: "Akses ditolak: Token tidak valid" });
    }

    const { classCode } = req.query;
    if (!classCode) {
      return res.status(400).json({ status: "error", message: "Parameter classCode diperlukan" });
    }

    const normalizedClassCode = classCode.toUpperCase();
    
    let SCRIPT_MAP = {};
    try {
      if (!process.env.VERCEL_SCRIPT_MAP_JSON) {
        throw new Error("Server configuration error: VERCEL_SCRIPT_MAP_JSON is not defined.");
      }
      SCRIPT_MAP = JSON.parse(process.env.VERCEL_SCRIPT_MAP_JSON);
    } catch (e) {
      console.error("Error parsing SCRIPT_MAP:", e);
      return res.status(500).json({ status: "error", message: "Server configuration error" });
    }

    const scriptURL = SCRIPT_MAP[normalizedClassCode];
    if (!scriptURL) {
      return res.status(400).json({ status: "error", message: `Invalid classCode: ${normalizedClassCode}` });
    }

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_KEY = process.env.SUPABASE_KEY;
    const supabase = (SUPABASE_URL && SUPABASE_KEY) ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;

    try {
      const gasResponse = await fetch(scriptURL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "getStudentList" })
      });

      const text = await gasResponse.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        console.error(`GAS response is not JSON: ${text}`);
        return res.status(502).json({ status: "error", message: "GAS returned invalid JSON" });
      }

      if (data.status !== "ok" || !data.students) {
        return res.status(502).json({ status: "error", message: data.message || "Failed to fetch students from sheet" });
      }

      const students = data.students;

      if (supabase && students.length > 0) {
        const bucketName = `pasfoto-${normalizedClassCode.toLowerCase()}`;

        const { data: files, error: listError } = await supabase.storage
          .from(bucketName)
          .list('', { limit: 200 });

        if (!listError && files && files.length > 0) {
          const fileMap = {};
          files.forEach(f => {
            const parts = f.name.split('.');
            const ext = parts.pop().toLowerCase();
            const nameWithoutExt = parts.join('.').toLowerCase();
            if (['jpg', 'jpeg', 'png'].includes(ext)) {
              fileMap[nameWithoutExt] = f.name;
            }
          });

          const pathsToSign = [];
          const studentImageMatches = {};

          students.forEach(s => {
            const normalizedId = s.studentId.replace(/\//g, '-').toLowerCase();
            const matchFileName = fileMap[normalizedId];
            if (matchFileName) {
              pathsToSign.push(matchFileName);
              studentImageMatches[s.studentId] = matchFileName;
            }
          });

          if (pathsToSign.length > 0) {
            const { data: signedData, error: signError } = await supabase.storage
              .from(bucketName)
              .createSignedUrls(pathsToSign, 60);

            if (!signError && signedData) {
              const signedUrlMap = {};
              signedData.forEach(d => {
                signedUrlMap[d.path] = d.signedUrl;
              });

              students.forEach(s => {
                const fileName = studentImageMatches[s.studentId];
                if (fileName && signedUrlMap[fileName]) {
                  s.image = signedUrlMap[fileName];
                }
              });
            }
          }
        }
      }

      return res.status(200).json({ status: "ok", students });
    } catch (err) {
      console.error("API Error in /api/students:", err);
      return res.status(500).json({ status: "error", message: err.message });
    }
  }
  ```

- [ ] **Step 2: Implement `api/classes.js` for retrieving configured Class Codes**

  Create file `api/classes.js` with this exact content:
  ```javascript
  import jwt from 'jsonwebtoken';

  export default async function handler(req, res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET");
    res.setHeader("Access-Control-Allow-Headers", "Authorization");
    
    if (req.method !== "GET") {
      return res.status(405).end();
    }

    const JWT_SECRET = process.env.JWT_SECRET;
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ status: "error", message: "Unauthorized" });
    }

    try {
      jwt.verify(token, JWT_SECRET);
    } catch (e) {
      return res.status(401).json({ status: "error", message: "Unauthorized" });
    }

    try {
      const map = JSON.parse(process.env.VERCEL_SCRIPT_MAP_JSON || "{}");
      const classes = Object.keys(map);
      return res.status(200).json({ status: "ok", classes });
    } catch (e) {
      return res.status(500).json({ status: "error", message: "Server config error" });
    }
  }
  ```

- [ ] **Step 3: Commit new Vercel serverless endpoints**

  Run:
  ```bash
  git add api/students.js api/classes.js
  git commit -m "feat: implement /api/students and /api/classes serverless functions"
  ```

---

### Task 3: Expose Serverless Endpoints in Local Server (`app.js`)

**Files:**
- Modify: `app.js`

- [ ] **Step 1: Expose local dev server routes in `app.js`**

  In [app.js](file:///Users/andarpartogi/repo/absensikatekumen/app.js) around line 88 (above `app.use(express.static)`), add:
  ```javascript
  // Route to handle retrieving students list
  app.get('/api/students', async (req, res) => {
    try {
      const handler = (await import('./api/students.js')).default;
      await handler(req, res);
    } catch (error) {
      console.error("Error running api/students:", error);
      res.status(500).json({ status: "error", message: "Internal Server Error" });
    }
  });

  // Route to handle retrieving class list
  app.get('/api/classes', async (req, res) => {
    try {
      const handler = (await import('./api/classes.js')).default;
      await handler(req, res);
    } catch (error) {
      console.error("Error running api/classes:", error);
      res.status(500).json({ status: "error", message: "Internal Server Error" });
    }
  });
  ```

- [ ] **Step 2: Commit local server modifications**

  Run:
  ```bash
  git add app.js
  git commit -m "feat: expose students and classes API endpoints in local dev server"
  ```

---

### Task 4: Create Frontend Logic Script (`public/profile.js`)

**Files:**
- Create: `public/profile.js`

- [ ] **Step 1: Create and write contents of `public/profile.js`**

  Create file `public/profile.js` with this exact content:
  ```javascript
  function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
  }

  const token = getCookie('auth_token');
  if (!token) {
    window.location.href = '/';
  }

  let allStudents = [];

  function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateLogos(savedTheme);
  }

  function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateLogos(newTheme);
  }

  function updateLogos(theme) {
    const logos = document.querySelectorAll('.theme-logo');
    logos.forEach(logo => {
      if (theme === 'light') {
        logo.src = 'assets/favicon.png';
      } else {
        logo.src = 'assets/pewartaan_invert.png';
      }
    });
  }

  async function loadClasses() {
    try {
      const res = await fetch('/api/classes', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (data.status === 'ok') {
        const select = document.getElementById('class-selector');
        select.innerHTML = '<option value="" disabled selected>Pilih Kelas...</option>';
        data.classes.forEach(c => {
          const opt = document.createElement('option');
          opt.value = c;
          opt.textContent = `Kelas ${c}`;
          select.appendChild(opt);
        });
      }
    } catch (e) {
      console.error("Error loading classes:", e);
      showToast("Gagal memuat daftar kelas", "error");
    }
  }

  async function loadStudents(classCode) {
    const listContainer = document.getElementById('students-list');
    const loader = document.getElementById('students-loader');
    
    listContainer.innerHTML = '';
    loader.style.display = 'flex';
    
    try {
      const res = await fetch(`/api/students?classCode=${classCode}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (data.status === 'ok') {
        allStudents = data.students;
        renderStudents(allStudents);
      } else {
        showToast(data.message || "Gagal memuat data", "error");
      }
    } catch (e) {
      console.error("Error loading students:", e);
      showToast("Gagal mengambil data katekumen", "error");
    } finally {
      loader.style.display = 'none';
    }
  }

  function renderStudents(students) {
    const listContainer = document.getElementById('students-list');
    listContainer.innerHTML = '';
    
    if (students.length === 0) {
      listContainer.innerHTML = '<div class="empty-state">Tidak ada data katekumen ditemukan.</div>';
      return;
    }
    
    students.forEach(student => {
      const item = document.createElement('div');
      item.className = 'student-accordion-item';
      
      const header = document.createElement('div');
      header.className = 'student-accordion-header';
      header.setAttribute('tabindex', '0');
      header.setAttribute('role', 'button');
      header.setAttribute('aria-expanded', 'false');
      
      const imgUrl = student.image || 'assets/favicon.png';
      
      header.innerHTML = `
        <div class="header-left">
          <img class="student-thumb" src="${imgUrl}" alt="${student.name}" onerror="this.src='assets/favicon.png'">
          <div class="student-meta">
            <div class="student-name-text">${student.name}</div>
            <div class="student-id-text">${student.studentId}</div>
          </div>
        </div>
        <span class="material-icons-outlined expand-arrow">expand_more</span>
      `;
      
      const body = document.createElement('div');
      body.className = 'student-accordion-body';
      body.style.display = 'none';
      
      body.innerHTML = `
        <div class="student-detail-card">
          <img class="student-photo-large" src="${imgUrl}" alt="Foto ${student.name}" onerror="this.src='assets/favicon.png'">
          <h3 class="detail-name">${student.name}</h3>
          <p class="detail-id">ID: ${student.studentId}</p>
          
          <div class="detail-info-grid">
            <div class="detail-item">
              <span class="detail-label">Tempat, Tanggal Lahir (TTL)</span>
              <span class="detail-value">${student.dob || '-'}</span>
            </div>
          </div>
        </div>
      `;
      
      const toggle = () => {
        const isExpanded = body.style.display === 'flex';
        
        document.querySelectorAll('.student-accordion-body').forEach(b => b.style.display = 'none');
        document.querySelectorAll('.student-accordion-header').forEach(h => {
          h.classList.remove('active');
          h.setAttribute('aria-expanded', 'false');
        });
        
        if (!isExpanded) {
          body.style.display = 'flex';
          header.classList.add('active');
          header.setAttribute('aria-expanded', 'true');
        }
      };
      
      header.addEventListener('click', toggle);
      header.addEventListener('keydown', (e) => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          toggle();
        }
      });
      
      item.appendChild(header);
      item.appendChild(body);
      listContainer.appendChild(item);
    });
  }

  function filterStudents() {
    const query = document.getElementById('search-input').value.toLowerCase().trim();
    const filtered = allStudents.filter(s => 
      s.name.toLowerCase().includes(query) || 
      s.studentId.toLowerCase().includes(query)
    );
    renderStudents(filtered);
  }

  function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    container.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('show');
    }, 10);
    
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => {
        toast.remove();
      }, 300);
    }, 3000);
  }

  document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    loadClasses();
    
    document.getElementById('class-selector').addEventListener('change', (e) => {
      document.getElementById('search-input').style.display = 'block';
      loadStudents(e.target.value);
    });
    
    document.getElementById('search-input').addEventListener('input', filterStudents);
  });
  ```

- [ ] **Step 2: Commit new frontend script**

  Run:
  ```bash
  git add public/profile.js
  git commit -m "feat: add javascript file for profile route rendering and accordion logic"
  ```

---

### Task 5: Update Frontend HTML Structure (`public/profile.html`)

**Files:**
- Modify: `public/profile.html`

- [ ] **Step 1: Rewrite HTML structure in `public/profile.html`**

  In [public/profile.html](file:///Users/andarpartogi/repo/absensikatekumen/public/profile.html), replace the contents from line 18 down (inside `<body>`) to match the new dynamic accordion design and script reference:
  ```html
  <body>
    <div class="liquid-background">
      <div class="liquid-shape shape1"></div>
      <div class="liquid-shape shape2"></div>
    </div>

    <main id="app-container" class="glass-container">
      <div class="app-section" style="display: flex; flex-direction: column;">
        <div class="header-container">
          <img src="assets/favicon.png" class="header-logo theme-logo" alt="Logo Pewartaan" onclick="toggleTheme()" tabindex="0" role="button" aria-label="Ganti Tema" onkeydown="if(event.key === ' ' || event.key === 'Enter') { event.preventDefault(); toggleTheme(); }" style="cursor: pointer;">
          <div class="header-text">
            <h1>Profil Katekumen</h1>
            <h2>Detail & Riwayat</h2>
          </div>
        </div>

        <div class="profile-selector-container">
          <select id="class-selector">
            <option value="" disabled selected>Memuat kelas...</option>
          </select>
          <input type="text" id="search-input" placeholder="Cari nama atau ID..." style="display: none;">
        </div>

        <div id="students-loader" style="display: none;">
          <div class="spinner"></div>
          <span style="font-size: 0.85rem; color: var(--text-primary); opacity: 0.8;">Memuat katekumen...</span>
        </div>

        <div id="students-list" class="students-list-container">
          <!-- Dynamically populated via profile.js -->
        </div>

        <button id="login-btn" onclick="window.location.href='/'" style="margin-top: 20px;"><b>Kembali ke Presensi</b></button>
      </div>
    </main>

    <div id="toast-container" class="toast-container" role="status" aria-live="polite"></div>

    <script src="profile.js"></script>
  </body>
  ```

- [ ] **Step 2: Commit HTML template modifications**

  Run:
  ```bash
  git add public/profile.html
  git commit -m "feat: restructure public/profile.html to support dynamic loading and accordion list"
  ```

---

### Task 6: Add Accordion Styling to Stylesheet (`public/style.css`)

**Files:**
- Modify: `public/style.css`

- [ ] **Step 1: Append Profile accordion styling rules to `public/style.css`**

  In [public/style.css](file:///Users/andarpartogi/repo/absensikatekumen/public/style.css) at the very bottom, append:
  ```css
  /* --- PROFILE ACCORDION STYLES --- */
  .profile-selector-container {
    display: flex;
    flex-direction: column;
    gap: 12px;
    width: 100%;
    margin-bottom: 20px;
  }

  #class-selector {
    width: 100%;
    padding: 0.85rem;
    background: var(--bg-card);
    border: 1px solid var(--border-glass);
    border-radius: 12px;
    color: var(--text-primary);
    font-size: 1rem;
    font-weight: 500;
    outline: none;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    transition: border-color 0.3s;
  }

  #class-selector:focus {
    border-color: var(--accent);
  }

  #search-input {
    width: 100%;
    padding: 0.85rem;
    background: var(--bg-card);
    border: 1px solid var(--border-glass);
    border-radius: 12px;
    color: var(--text-primary);
    font-size: 1rem;
    outline: none;
    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    transition: border-color 0.3s;
  }

  #search-input:focus {
    border-color: var(--accent);
  }

  .students-list-container {
    display: flex;
    flex-direction: column;
    gap: 12px;
    width: 100%;
    max-height: 50vh;
    overflow-y: auto;
    padding-right: 4px;
  }

  .students-list-container::-webkit-scrollbar {
    width: 6px;
  }
  .students-list-container::-webkit-scrollbar-track {
    background: transparent;
  }
  .students-list-container::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 10px;
  }

  .student-accordion-item {
    background: var(--bg-card);
    border: 1px solid var(--border-glass);
    border-radius: 12px;
    overflow: hidden;
    transition: transform 0.2s, box-shadow 0.2s;
  }

  .student-accordion-item:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(0,0,0,0.15);
  }

  .student-accordion-header {
    padding: 12px 16px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    cursor: pointer;
    outline: none;
  }

  .student-accordion-header.active {
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .student-thumb {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    object-fit: cover;
    border: 2px solid rgba(255, 255, 255, 0.2);
  }

  .student-meta {
    display: flex;
    flex-direction: column;
  }

  .student-name-text {
    font-weight: 600;
    font-size: 0.95rem;
    color: var(--text-primary);
  }

  .student-id-text {
    font-size: 0.75rem;
    color: var(--text-primary);
    opacity: 0.7;
  }

  .expand-arrow {
    color: var(--text-primary);
    opacity: 0.7;
    transition: transform 0.2s;
  }

  .student-accordion-header.active .expand-arrow {
    transform: rotate(180deg);
  }

  .student-accordion-body {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 20px;
    background: rgba(0,0,0,0.05);
  }

  .student-detail-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
  }

  .student-photo-large {
    width: 120px;
    height: 150px;
    border-radius: 12px;
    object-fit: cover;
    border: 2px solid rgba(255, 255, 255, 0.15);
    box-shadow: 0 8px 24px rgba(0,0,0,0.25);
    margin-bottom: 16px;
  }

  .detail-name {
    font-family: 'Cinzel', serif;
    font-size: 1.25rem;
    font-weight: bold;
    color: var(--text-primary);
    margin-bottom: 4px;
  }

  .detail-id {
    font-family: 'Inter', sans-serif;
    font-size: 0.85rem;
    color: var(--accent);
    font-weight: 500;
    margin-bottom: 16px;
  }

  .detail-info-grid {
    width: 100%;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    padding-top: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .detail-item {
    display: flex;
    flex-direction: column;
    text-align: left;
  }

  .detail-label {
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    opacity: 0.6;
    color: var(--text-primary);
    margin-bottom: 4px;
  }

  .detail-value {
    font-size: 0.9rem;
    font-weight: 500;
    color: var(--text-primary);
  }

  #students-loader {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 30px;
    gap: 12px;
  }

  .empty-state {
    text-align: center;
    padding: 30px;
    font-size: 0.9rem;
    opacity: 0.7;
    color: var(--text-primary);
  }
  ```

- [ ] **Step 2: Commit styling modifications**

  Run:
  ```bash
  git add public/style.css
  git commit -m "feat: add styling rules for accordion profile layout"
  ```

---

### Task 7: Run Verification Checks

**Files:**
- Create: None
- Modify: None

- [ ] **Step 1: Start the local server**

  Run:
  ```bash
  PORT=5588 node app.js
  ```

- [ ] **Step 2: Test endpoints and UI**

  1. Query `http://localhost:5588/api/classes` and verify it responds with config list.
  2. Query `http://localhost:5588/api/students?classCode=SAB` and check returned array of students.
  3. Load `http://localhost:5588/profile` in browser, verify layout rendering, class selection, searching, and expandable card layout.

# UI/UX Overhaul & Sistem Antrean Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merancang ulang antarmuka aplikasi absensi katekumen menjadi mobile-first, satu-halaman (single-page) bertema krem marmer (Light) dengan toggle Dark mode, alur terpandu berbasis status (State Machine), serta sistem antrean sinkronisasi latar belakang yang dinamis.

**Architecture:** Memanfaatkan variabel CSS untuk manajemen tema terang/gelap secara real-time, menyembunyikan/menampilkan section via kelas status (`state-auth`, `state-selection`, `state-scanning`) pada `#app-container`, serta kelas JavaScript `ScanQueue` berbasis `localStorage` untuk memproses antrean secara sequensial (FIFO) tanpa menghentikan pemindaian.

**Tech Stack:** Vanilla HTML5, CSS3 Variables, JavaScript (ES6), LocalStorage API.

---

### Task 1: Persiapan HTML & Restrukturisasi DOM
**Files:**
- Modify: `public/index.html`

- [ ] **Step 1: Modifikasi `public/index.html` untuk menambahkan tombol toggle tema, merestrukturisasi container status aplikasi, dan menambahkan markup antrean.**

Ganti isi `public/index.html` dengan markup yang bersih dan terstruktur untuk mendukung transisi status. Edit baris 1-152 di `public/index.html`:
```html
<!DOCTYPE html>
<html lang="id">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <title>Sistem Presensi Katekumen Dewasa</title>
    <link rel="icon" href="assets/favicon.png" type="image/png" />
    <script src="https://unpkg.com/html5-qrcode"></script>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link rel="preconnect" href="https://script.google.com">
    <link rel="preconnect" href="https://yqguiiczpluljethcopn.supabase.co">
    <link href="https://fonts.googleapis.com/icon?family=Material+Icons+Outlined" rel="stylesheet">
    <link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@1&family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="style.css">
  </head>

  <body>
    <!-- Floating Theme Toggle -->
    <button id="theme-toggle" class="theme-toggle-btn" onclick="toggleTheme()" aria-label="Toggle Theme">
      <span class="material-icons-outlined">dark_mode</span>
    </button>

    <div class="liquid-background">
      <div class="liquid-shape shape1"></div>
      <div class="liquid-shape shape2"></div>
    </div>

    <!-- Loading screen for login -->
    <div id="login-loader">
      <div class="spinner"></div>
    </div>

    <main id="app-container" class="glass-container state-auth">
      
      <!-- ==========================================
           1. STATE: AUTH (LOGIN SCREEN)
           ========================================== -->
      <div id="login-section" class="app-section">
        <div class="login-header-logo">
          <img src="assets/pewartaan_invert.png" alt="Logo Pewartaan" class="logo-large">
        </div>
        <h1 class="login-header-title">Login Fasilitator</h1>
        <div id="login-error-box" class="login-error-message" style="display: none;" onmouseover="hideLoginError()"></div>
        <div class="input-wrapper">
          <label for="login-input" class="sr-only">Password</label>
          <input type="password" id="login-input" placeholder="Masukkan password..." onkeydown="if(event.key==='Enter') handleLogin()" oninput="hideLoginError()">
          <span id="login-success-icon" class="material-icons-outlined" style="display: none;">check_circle</span>
          <span id="password-toggle" class="material-icons-outlined password-toggle-icon" onclick="togglePasswordVisibility()">visibility_off</span>
        </div>
        <button id="login-btn" onclick="handleLogin()"><b>Masuk</b></button>
        <div id="login-footer">
          <a href="https://wa.link/3yg0ug">Lupa password?</a>
        </div>
      </div>

      <!-- ==========================================
           2. STATE: SELECTION & SCANNING (SHARED)
           ========================================== -->
      <div id="main-app-section" class="app-section">
        <!-- Brand Header (Kecil di scan state, besar di selection state) -->
        <div class="header-container">
          <img src="assets/pewartaan_invert.png" class="header-logo" alt="Logo Pewartaan">
          <div class="header-text">
            <h1>Sistem Presensi</h1>
            <h2>Katekumen Dewasa</h2>
          </div>
        </div>

        <!-- STATE 1: TOPIC SELECTION -->
        <div id="selection-panel" class="panel-state">
          <div class="instruction-box">
            <span class="material-icons-outlined">info</span>
            <p>Silakan pilih topik pertemuan hari ini sebelum memulai pemindaian QR katekumen.</p>
          </div>
          <button id="topic-trigger-large" class="topic-selector-btn-large" onclick="openTopicModal()">
            <span>Pilih Topik Pertemuan...</span>
            <span class="material-icons-outlined">arrow_drop_down</span>
          </button>
        </div>

        <!-- STATE 2: ACTIVE SCANNING -->
        <div id="scanning-panel" class="panel-state">
          <!-- Mini Active Topic Bar -->
          <div class="active-topic-bar">
            <div class="topic-info">
              <span class="material-icons-outlined">event_note</span>
              <span id="active-topic-name">Belum memilih topik</span>
            </div>
            <button class="change-topic-btn" onclick="setAppState(1)">Ubah</button>
          </div>

          <!-- Camera Viewer -->
          <div id="reader-container">
            <div id="camera-loader">
              <div class="spinner"></div>
              <span>Memuat Kamera...</span>
            </div>
            <div id="reader"></div>
          </div>

          <!-- Status Indicator -->
          <div id="status" class="idle"></div>

          <!-- Sync Queue Warning Bar -->
          <div id="queue-warning-bar" class="queue-warning-banner" style="display: none;">
            <div class="spinner-small"></div>
            <span>Menyinkronkan... Mohon jangan tutup halaman ini (<span id="queue-remaining-count">0</span> item tersisa)</span>
          </div>

          <!-- Queue History List -->
          <div id="queue-history-panel">
            <div class="history-header">
              <span>Riwayat Pemindaian Terkini:</span>
              <span id="queue-status-text">Semua tersinkronisasi</span>
            </div>
            <div id="queue-list" class="queue-list-container">
              <!-- Dynamically populated via script -->
              <div class="queue-empty-state">Belum ada data pemindaian.</div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <footer class="app-footer">
          <div class="footer-text">
            <a href="https://github.com/ojeeeeedev/absensikatekumen" class="footer-link">v1.9.0</a> © 2026 Tim Katekumen Dewasa
            &bull; <a href="https://wa.link/rogbpe" class="footer-link">Bantuan?</a>
          </div>
        </footer>
      </div>
    </main>

    <!-- Bottom Fixed Branding (Only visible on login screen) -->
    <div id="bottom-branding" class="fixed-bottom-branding">
      <img src="assets/pewartaan_invert.png" alt="Logo Pewartaan" width="48" height="48" style="margin-right: 12px;">
      <div class="branding-text">
        <div style="font-weight: bold;">Subseksi Katekumen Dewasa</div>
        <div>Paroki St. Petrus - Katedral Bandung</div>
      </div>
    </div>

    <!-- Modal Topic Selection -->
    <div id="topic-modal">
      <div class="modal-content">
        <h3>Pilih Topik Pertemuan</h3>
        <input type="text" id="topic-search-input" oninput="filterTopics()" placeholder="Cari topik...">
        <div id="topic-list-container">
          <div class="topic-loading-placeholder">Memuat topik...</div>
        </div>
        <div class="modal-close-btn" onclick="closeTopicModal()">Tutup</div>
      </div>
    </div>

    <script src="topics.js"></script>
    <script src="script.js"></script>
  </body>
</html>
```

- [ ] **Step 2: Jalankan verifikasi manual.**
Pastikan tidak ada tag HTML yang rusak dan file tersimpan dengan benar.

- [ ] **Step 3: Commit perubahan HTML.**
```bash
git add public/index.html
git commit -m "feat: restructure HTML body for theme toggle, state machine, and queue layout"
```

---

### Task 2: Implementasi CSS Global & Variabel Tema
**Files:**
- Modify: `public/style.css`

- [ ] **Step 1: Desain ulang `public/style.css` secara menyeluruh dengan CSS Variables, Light Theme, Dark Theme overrides, transisi status state-machine, tombol melayang, dan struktur kartu tanpa scroll.**

Ganti isi `public/style.css` dengan kode CSS berikut. Edit baris 1-521 di `public/style.css`:
```css
/* =========================================
   GLOBAL RESET & CORE THEME VARIABLES
   ========================================= */
:root {
  /* Light Theme (Default) */
  --bg-body: #FAF9F5;
  --bg-glass: rgba(255, 255, 255, 0.8);
  --border-glass: rgba(0, 0, 0, 0.08);
  --text-primary: #2B2D2F;
  --text-secondary: #6E7175;
  --accent: #1E3A8A;           /* Marian Blue */
  --accent-hover: #152960;
  --accent-glow: rgba(30, 58, 138, 0.15);
  --shadow: 0 12px 32px rgba(0, 0, 0, 0.05);

  /* Status Colors */
  --status-success-bg: #e8f5e9;
  --status-success-border: #a5d6a7;
  --status-success-text: #2e7d32;

  --status-duplicate-bg: #ffebee;
  --status-duplicate-border: #ef9a9a;
  --status-duplicate-text: #c62828;

  --status-pending-bg: #fff8e1;
  --status-pending-border: #ffe082;
  --status-pending-text: #b78103;

  --status-idle-bg: rgba(0, 0, 0, 0.03);
  --status-idle-border: rgba(0, 0, 0, 0.08);
  --status-idle-text: #6c757d;

  --vh: 1vh;
}

[data-theme="dark"] {
  /* Dark Theme */
  --bg-body: #121212;
  --bg-glass: rgba(30, 30, 30, 0.7);
  --border-glass: rgba(255, 255, 255, 0.08);
  --text-primary: #E0E0E0;
  --text-secondary: #9A9DA2;
  --accent: #3B82F6;           /* Bright Marian Blue for Dark Mode */
  --accent-hover: #2563EB;
  --accent-glow: rgba(59, 130, 246, 0.2);
  --shadow: 0 12px 32px rgba(0, 0, 0, 0.4);

  --status-success-bg: rgba(46, 125, 50, 0.2);
  --status-success-border: #2e7d32;
  --status-success-text: #81c784;

  --status-duplicate-bg: rgba(198, 40, 40, 0.2);
  --status-duplicate-border: #c62828;
  --status-duplicate-text: #ef5350;

  --status-pending-bg: rgba(255, 179, 0, 0.15);
  --status-pending-border: #b78103;
  --status-pending-text: #ffe082;

  --status-idle-bg: rgba(255, 255, 255, 0.05);
  --status-idle-border: rgba(255, 255, 255, 0.08);
  --status-idle-text: #9a9da2;
}

* { 
  box-sizing: border-box; 
  margin: 0; padding: 0;
  transition: background-color 0.3s ease, border-color 0.3s ease, color 0.3s ease, transform 0.2s ease; 
}

body {
  width: 100%;
  height: 100vh;
  height: calc(var(--vh, 1vh) * 100);
  background-color: var(--bg-body);
  color: var(--text-primary);
  font-family: "Inter", sans-serif;
  display: flex; justify-content: center; align-items: center;
  overflow: hidden;
  position: relative;
}

.sr-only {
  position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border-width: 0;
}

/* =========================================
   BACKGROUND ANIMATION
   ========================================= */
.liquid-background {
  position: absolute; top: 0; left: 0; width: 100%; height: 100%;
  z-index: 1; overflow: hidden; pointer-events: none;
}

.liquid-shape {
  position: absolute; border-radius: 50%;
  filter: blur(120px); opacity: 0.45;
}
[data-theme="dark"] .liquid-shape { opacity: 0.25; }

.shape1 {
  width: 300px; height: 300px; background: var(--accent);
  top: -80px; left: -100px; animation: move1 20s infinite alternate ease-in-out;
}

.shape2 {
  width: 250px; height: 250px; background: #0369a1;
  bottom: -60px; right: -60px; animation: move2 25s infinite alternate ease-in-out;
}

@keyframes move1 { from { transform: translate(0, 0) rotate(0deg); } to { transform: translate(120px, 180px) rotate(180deg); } }
@keyframes move2 { from { transform: translate(0, 0) rotate(0deg); } to { transform: translate(-150px, -120px) rotate(-180deg); } }

/* =========================================
   FLOATING THEME TOGGLE
   ========================================= */
.theme-toggle-btn {
  position: fixed; top: 16px; right: 16px;
  width: 40px; height: 40px; border-radius: 50%;
  background: var(--bg-glass);
  border: 1px solid var(--border-glass);
  color: var(--text-primary);
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; z-index: 100;
  box-shadow: var(--shadow);
  backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
}
.theme-toggle-btn:hover {
  transform: scale(1.08);
  border-color: var(--accent);
}

/* =========================================
   GLASS CONTAINER
   ========================================= */
.glass-container {
  background: var(--bg-glass);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid var(--border-glass);
  border-radius: 24px;
  box-shadow: var(--shadow);
  padding: 1.25rem;
  width: 92%; max-width: 400px;
  max-height: 94vh;
  display: flex; flex-direction: column;
  position: relative; z-index: 10;
  overflow: hidden;
}

.app-section {
  display: none;
  flex-direction: column;
  width: 100%;
}

/* =========================================
   STATE TRANSITION CLASSES
   ========================================= */
.glass-container.state-auth #login-section { display: flex; }
.glass-container.state-auth #bottom-branding { display: flex; }

.glass-container.state-selection #main-app-section { display: flex; }
.glass-container.state-selection #selection-panel { display: flex; flex-direction: column; }
.glass-container.state-selection #scanning-panel { display: none; }

.glass-container.state-scanning #main-app-section { display: flex; }
.glass-container.state-scanning #selection-panel { display: none; }
.glass-container.state-scanning #scanning-panel { display: flex; flex-direction: column; }

/* =========================================
   LOGIN SCREEN STYLES
   ========================================= */
.login-header-logo {
  text-align: center; margin-bottom: 1.5rem;
}
.logo-large {
  height: 80px; width: auto;
  filter: drop-shadow(0 4px 6px rgba(0,0,0,0.1));
}
[data-theme="light"] .logo-large, 
[data-theme="light"] .header-logo,
[data-theme="light"] .fixed-bottom-branding img {
  filter: invert(15%) sepia(95%) saturate(3000%) hue-rotate(220deg) brightness(85%) contrast(105%);
}

.login-header-title {
  font-family: 'DM Serif Display', serif; font-size: 1.5rem; font-style: italic; font-weight: 400;
  text-align: center; margin-bottom: 1.5rem; color: var(--text-primary);
}

.input-wrapper {
  position: relative; width: 100%; margin-bottom: 1rem;
}

#login-input {
  width: 100%; padding: 0.85rem 3rem 0.85rem 1.25rem; font-size: 1rem;
  background: var(--bg-body); border: 1px solid var(--border-glass); border-radius: 12px;
  color: var(--text-primary); outline: none;
}
#login-input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-glow);
}

.password-toggle-icon {
  position: absolute; top: 50%; right: 1rem; transform: translateY(-50%);
  cursor: pointer; color: var(--text-secondary);
}

#login-success-icon {
  position: absolute; top: 50%; right: 3rem; transform: translateY(-50%);
  color: var(--status-success-text); animation: fadeIn 0.3s;
}

#login-btn {
  width: 100%; padding: 0.85rem; background: var(--accent); color: white;
  border: none; border-radius: 12px; font-size: 1rem; font-weight: 600;
  cursor: pointer; text-align: center; margin-bottom: 1rem;
  box-shadow: 0 4px 12px var(--accent-glow);
}
#login-btn:hover {
  background: var(--accent-hover);
}

#login-footer {
  text-align: center; font-size: 0.85rem; margin-top: 0.5rem;
}
#login-footer a {
  color: var(--accent); text-decoration: none; font-weight: 500;
}

.login-error-message {
  padding: 0.75rem 1rem; background: var(--status-duplicate-bg);
  color: var(--status-duplicate-text); border: 1px solid var(--status-duplicate-border);
  border-radius: 10px; margin-bottom: 1rem; font-size: 0.85rem; text-align: center;
  animation: shake 0.4s;
}

/* =========================================
   MAIN APP & HEADER STYLES
   ========================================= */
.header-container {
  display: flex; align-items: center; justify-content: center;
  padding-bottom: 1rem; border-bottom: 1px solid var(--border-glass);
  margin-bottom: 1rem;
}
.header-logo {
  height: 48px; width: auto; margin-right: 12px;
}
.header-text h1 {
  font-family: 'DM Serif Display', serif; font-size: 1.15rem; font-style: italic; font-weight: 400; color: var(--text-primary);
  line-height: 1.2;
}
.header-text h2 {
  font-family: 'Inter', sans-serif; font-size: 0.75rem; font-weight: 400; color: var(--text-secondary);
  letter-spacing: 0.05em; text-transform: uppercase; margin-top: 2px;
}

/* =========================================
   STATE 1: TOPIC SELECTION PANEL
   ========================================= */
.instruction-box {
  background: var(--accent-glow); border-radius: 12px;
  padding: 0.85rem; display: flex; gap: 10px;
  margin-bottom: 1.5rem; align-items: flex-start;
}
.instruction-box span { color: var(--accent); font-size: 1.25rem; }
.instruction-box p { font-size: 0.8rem; color: var(--text-primary); line-height: 1.4; }

.topic-selector-btn-large {
  width: 100%; padding: 1.25rem; background: var(--bg-body);
  border: 2px dashed var(--accent); border-radius: 14px;
  color: var(--accent); font-size: 1rem; font-weight: 600;
  display: flex; justify-content: space-between; align-items: center;
  cursor: pointer; text-align: left;
}
.topic-selector-btn-large:hover {
  background: var(--accent-glow);
  transform: translateY(-2px);
}

/* =========================================
   STATE 2: ACTIVE SCANNING PANEL
   ========================================= */
.active-topic-bar {
  background: var(--bg-body); border: 1px solid var(--border-glass);
  padding: 0.65rem 0.85rem; border-radius: 10px;
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 0.75rem;
}
.topic-info {
  display: flex; align-items: center; gap: 8px; font-size: 0.8rem;
  overflow: hidden; white-space: nowrap; text-overflow: ellipsis;
}
.topic-info span.material-icons-outlined { color: var(--accent); font-size: 1.1rem; }
#active-topic-name { font-weight: 500; color: var(--text-primary); }

.change-topic-btn {
  background: var(--accent-glow); color: var(--accent); border: none;
  padding: 4px 10px; border-radius: 6px; font-size: 0.7rem; font-weight: 600;
  cursor: pointer;
}
.change-topic-btn:hover { background: var(--accent); color: white; }

#reader-container {
  width: 100%; aspect-ratio: 1.35 / 1; border-radius: 16px;
  overflow: hidden; position: relative; border: 1px solid var(--border-glass);
  background: #000; box-shadow: inset 0 4px 12px rgba(0,0,0,0.2);
  margin-bottom: 0.75rem;
}
#reader { width: 100%; height: 100%; object-fit: cover; }

#camera-loader {
  position: absolute; top: 0; left: 0; width: 100%; height: 100%;
  background: #111; display: flex; flex-direction: column;
  justify-content: center; align-items: center; color: #888;
  font-size: 0.8rem; gap: 12px; z-index: 10;
}

#status {
  width: 100%; padding: 0.65rem; border-radius: 10px; min-height: 42px;
  display: flex; align-items: center; justify-content: center; gap: 8px;
  font-size: 0.8rem; font-weight: 500; text-align: center;
  margin-bottom: 0.75rem;
}
#status.idle { background: var(--status-idle-bg); border: 1px dashed var(--status-idle-border); color: var(--status-idle-text); }
#status.success { background: var(--status-success-bg); border: 1px solid var(--status-success-border); color: var(--status-success-text); }
#status.error { background: var(--status-duplicate-bg); border: 1px solid var(--status-duplicate-border); color: var(--status-duplicate-text); }
#status.processing { background: var(--status-pending-bg); border: 1px solid var(--status-pending-border); color: var(--status-pending-text); }

.status-text-container { display: flex; flex-direction: column; align-items: center; }
.main-text { font-weight: 600; }
.sub-text { font-size: 0.65rem; opacity: 0.85; margin-top: 1px; }

/* Queue Warning Banner */
.queue-warning-banner {
  background: var(--status-pending-bg); border: 1px solid var(--status-pending-border);
  color: var(--status-pending-text); padding: 0.5rem 0.75rem; border-radius: 8px;
  display: flex; align-items: center; gap: 8px; font-size: 0.7rem;
  margin-bottom: 0.75rem; animation: pulse 1.5s infinite alternate;
}
@keyframes pulse { from { opacity: 0.85; } to { opacity: 1; } }

/* =========================================
   COMPACT HISTORY / QUEUE LIST
   ========================================= */
#queue-history-panel {
  flex-grow: 1; display: flex; flex-direction: column;
  overflow: hidden; margin-bottom: 0.5rem;
}

.history-header {
  display: flex; justify-content: space-between; font-size: 0.7rem;
  font-weight: 600; text-transform: uppercase; color: var(--text-secondary);
  letter-spacing: 0.05em; padding-bottom: 4px; border-bottom: 1px solid var(--border-glass);
  margin-bottom: 6px;
}
#queue-status-text { color: var(--status-success-text); }

.queue-list-container {
  overflow-y: auto; display: flex; flex-direction: column; gap: 6px;
  max-height: 160px; /* Force small size to prevent scrolling */
  padding-right: 2px;
}

.queue-empty-state {
  font-size: 0.75rem; color: var(--text-secondary); text-align: center;
  padding: 1.5rem 0; font-style: italic;
}

/* Row Item */
.queue-row {
  display: flex; align-items: center; justify-content: space-between;
  padding: 6px 8px; border-radius: 8px; background: var(--bg-body);
  border: 1px solid var(--border-glass);
}
.queue-row.success { border-left: 3px solid var(--status-success-text); }
.queue-row.duplicate { border-left: 3px solid var(--status-duplicate-text); }
.queue-row.error { border-left: 3px solid var(--status-duplicate-text); }
.queue-row.processing, .queue-row.pending { border-left: 3px solid var(--status-pending-text); }

.student-info { display: flex; align-items: center; gap: 8px; }

.student-photo {
  width: 28px; height: 28px; border-radius: 50%; background: var(--border-glass);
  object-fit: cover; border: 1.5px solid var(--bg-glass);
}

.student-text { display: flex; flex-direction: column; }
.student-name { font-size: 0.75rem; font-weight: 600; color: var(--text-primary); }
.student-id { font-size: 0.6rem; color: var(--text-secondary); }

.status-badge {
  font-size: 0.6rem; font-weight: 700; padding: 2px 6px; border-radius: 4px;
  text-transform: uppercase;
}
.status-badge.success { background: var(--status-success-bg); color: var(--status-success-text); }
.status-badge.duplicate { background: var(--status-duplicate-bg); color: var(--status-duplicate-text); }
.status-badge.error { background: var(--status-duplicate-bg); color: var(--status-duplicate-text); }
.status-badge.processing { background: var(--status-pending-bg); color: var(--status-pending-text); }
.status-badge.pending { background: var(--status-idle-bg); color: var(--status-idle-text); }

/* =========================================
   MODALS
   ========================================= */
#topic-modal {
  display: none; position: fixed; inset: 0;
  background: rgba(0, 0, 0, 0.55); z-index: 200;
  backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px);
  flex-direction: column; justify-content: flex-end;
}

.modal-content {
  background: var(--bg-glass);
  border-top-left-radius: 20px; border-top-right-radius: 20px;
  padding: 1.25rem; max-height: 80vh;
  display: flex; flex-direction: column;
  border-top: 1px solid var(--border-glass);
  box-shadow: 0 -8px 24px rgba(0,0,0,0.1);
}
.modal-content h3 { font-family: 'DM Serif Display', serif; font-size: 1.15rem; font-style: italic; font-weight: 400; text-align: center; margin-bottom: 0.85rem; }

#topic-search-input {
  width: 100%; padding: 0.65rem 1rem; margin-bottom: 0.75rem;
  background: var(--bg-body); border: 1px solid var(--border-glass); border-radius: 10px;
  color: var(--text-primary); outline: none; font-size: 0.85rem;
}
#topic-search-input:focus { border-color: var(--accent); }

#topic-list-container {
  overflow-y: auto; display: flex; flex-direction: column; gap: 6px;
  max-height: 45vh; padding-right: 2px;
}

.topic-option {
  padding: 0.75rem; background: var(--bg-body); border-radius: 8px;
  text-align: left; font-size: 0.8rem; color: var(--text-primary);
  border: 1px solid var(--border-glass); cursor: pointer;
}
.topic-option.active { border-color: var(--accent); background: var(--accent-glow); color: var(--accent); font-weight: 600; }
.topic-option.topic-p { border-left: 3px solid #ff9f0a; }
.topic-option.topic-ki { border-left: 3px solid #0a84ff; }
.topic-option.topic-rekoleksi { border-left: 3px solid #34c759; font-weight: 600; }

.modal-close-btn {
  margin-top: 0.75rem; padding: 0.75rem; background: var(--status-duplicate-text); color: white;
  text-align: center; border-radius: 10px; cursor: pointer; font-weight: 600; font-size: 0.85rem;
}

/* =========================================
   SPINNERS
   ========================================= */
.spinner {
  border: 3px solid rgba(255, 255, 255, 0.15);
  border-top: 3px solid var(--accent);
  border-radius: 50%; width: 28px; height: 28px;
  animation: spin 0.8s linear infinite;
}
[data-theme="dark"] .spinner { border-color: rgba(255,255,255,0.1); border-top-color: var(--accent); }

.spinner-small {
  border: 2px solid rgba(0,0,0,0.1);
  border-top: 2px solid var(--status-pending-text);
  border-radius: 50%; width: 14px; height: 14px;
  animation: spin 0.8s linear infinite;
}

@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

/* =========================================
   FOOTER & BOTTOM BRANDING
   ========================================= */
.app-footer {
  width: 100%; padding-top: 0.75rem;
  border-top: 1px solid var(--border-glass);
  text-align: center; font-size: 0.65rem; color: var(--text-secondary);
  margin-top: auto;
}
.footer-link { color: var(--accent); text-decoration: none; font-weight: 500; }

.fixed-bottom-branding {
  position: absolute; bottom: 2vh; left: 0; width: 100%;
  display: flex; justify-content: center; align-items: center; z-index: 2;
  pointer-events: none;
}
.branding-text {
  text-align: left; font-size: 0.6rem; color: var(--text-secondary); line-height: 1.3;
}

/* =========================================
   ANIMATIONS & EFFECTS
   ========================================= */
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes shake {
  10%, 90% { transform: translateX(-2px); }
  20%, 80% { transform: translateX(3px); }
  30%, 50%, 70% { transform: translateX(-4px); }
  40%, 60% { transform: translateX(4px); }
}
```

- [ ] **Step 2: Jalankan verifikasi manual.**
Pastikan syntax CSS bersih, tidak ada kurung kurawal yang terbuka.

- [ ] **Step 3: Commit perubahan CSS.**
```bash
git add public/style.css
git commit -m "feat: rewrite style.css to support light/dark mode variables, marian blue theme, state classes, and scroll-free layout"
```

---

### Task 3: State Machine & Theme Toggle Logic
**Files:**
- Modify: `public/script.js`:1-113

- [ ] **Step 1: Ganti inisialisasi awal, loader, login, dan handler tema pada `public/script.js`.**

Sunting bagian atas `public/script.js` untuk menambahkan dukungan tema gelap/terang, persistensi tema, serta fungsi transisi status (`setAppState`). Ganti baris 1-113 di `public/script.js`:
```javascript
let html5QrcodeScanner = null;
let selectedWeek = null;
let profileModalTimeout = null;

// --- STATE MANAGEMENT ---
// State 0: Auth, State 1: Selection, State 2: Scanning
function setAppState(state) {
  const container = document.getElementById('app-container');
  container.className = 'glass-container';
  
  if (state === 0) {
    container.classList.add('state-auth');
    stopScanner();
  } else if (state === 1) {
    container.classList.add('state-selection');
    stopScanner();
  } else if (state === 2) {
    container.classList.add('state-scanning');
    // Set active topic name text
    const topicTrigger = document.getElementById('topic-trigger-large');
    const activeTopicText = document.getElementById('active-topic-name');
    if (activeTopicText && topicTrigger) {
      activeTopicText.textContent = topicTrigger.textContent.replace('arrow_drop_down', '').trim();
    }
    startScanner();
  }
}

// --- THEME MANAGEMENT ---
function initTheme() {
  const savedTheme = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeToggleIcon(savedTheme);
}

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
  const newTheme = currentTheme === 'light' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('theme', newTheme);
  updateThemeToggleIcon(newTheme);
}

function updateThemeToggleIcon(theme) {
  const icon = document.querySelector('#theme-toggle span');
  if (icon) {
    icon.textContent = theme === 'light' ? 'dark_mode' : 'light_mode';
  }
}

// --- SAFARI VIEWPORT FIX ---
function setViewportHeight() {
  let vh = window.innerHeight * 0.01;
  document.documentElement.style.setProperty('--vh', `${vh}px`);
}
setViewportHeight();
window.addEventListener('resize', setViewportHeight);

// --- MODAL FUNCTIONS ---
function openTopicModal() { document.getElementById('topic-modal').style.display = 'flex'; }
function closeTopicModal() { document.getElementById('topic-modal').style.display = 'none'; }

function selectTopic(week, name, element) {
  selectedWeek = week;
  const btn = document.getElementById('topic-trigger-large');
  if (btn) {
    btn.innerHTML = `<span>${week}. ${name}</span><span class="material-icons-outlined">arrow_drop_down</span>`;
  }
  document.querySelectorAll('.topic-option').forEach(el => el.classList.remove('active'));
  element.classList.add('active');
  setTimeout(() => {
    closeTopicModal();
    setAppState(2); // Go straight to scanner state on selection
  }, 200);
}

function filterTopics() {
  const searchTerm = document.getElementById('topic-search-input').value.toLowerCase();
  const topics = document.querySelectorAll('.topic-option');
  topics.forEach(topic => {
    const topicText = topic.textContent.toLowerCase();
    topic.style.display = topicText.includes(searchTerm) ? 'block' : 'none';
  });
}

function togglePasswordVisibility() {
  const input = document.getElementById('login-input');
  const icon = document.getElementById('password-toggle');
  if (input.type === 'password') {
    input.type = 'text';
    icon.textContent = 'visibility';
  } else {
    input.type = 'password';
    icon.textContent = 'visibility_off';
  }
}

function hideLoginError() {
  const errorBox = document.getElementById('login-error-box');
  if (errorBox) {
    errorBox.style.display = 'none';
  }
}
```

- [ ] **Step 2: Modifikasi `handleLogin` di `public/script.js`.**

Perbarui fungsi login di `public/script.js` agar memanggil status alur terpandu dan menyembunyikan branding secara dinamis. Edit baris 115-192 di `public/script.js`:
```javascript
// --- AUTHENTICATION ---
async function handleLogin() {
  const secret = document.getElementById('login-input').value;
  const errorBox = document.getElementById('login-error-box');
  const successIcon = document.getElementById('login-success-icon');
  const loginLoader = document.getElementById('login-loader');

  if (!secret) {
    errorBox.textContent = 'Password tidak boleh kosong.';
    errorBox.style.display = 'block';
    return;
  }

  hideLoginError();

  try {
    const response = await fetch("/api/absensi", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: 'login', secret }),
    });
    const data = await response.json();

    if (data.status === 'ok' && data.token) {
      successIcon.style.display = 'block';
      
      setTimeout(() => {
        successIcon.style.display = 'none';
        loginLoader.style.display = 'flex';

        setTimeout(() => {
          sessionStorage.setItem('authToken', data.token);
          loginLoader.style.display = 'none';
          
          // Switch to Selection State
          setAppState(1);
          initializeApp();
        }, 250);
      }, 800);
    } else {
      errorBox.textContent = data.message || 'Login gagal.';
      errorBox.style.display = 'block';
      document.getElementById('login-input').style.animation = 'shake 0.4s';
      setTimeout(() => document.getElementById('login-input').style.animation = '', 400);
    }
  } catch (e) {
    console.error("Login request failed:", e);
    errorBox.textContent = 'Error koneksi ke server.';
    errorBox.style.display = 'block';
  }
}
```

- [ ] **Step 3: Commit perubahan Task 3.**
```bash
git add public/script.js
git commit -m "feat: implement theme management, app state machine transitions, and updated login flow"
```

---

### Task 4: Pembuatan Kelas Antrean Latar Belakang (ScanQueue Engine)
**Files:**
- Modify: `public/script.js` (bagian tengah/akhir)

- [ ] **Step 1: Sisipkan logic engine antrean sinkronisasi latar belakang (`ScanQueue`) ke dalam `public/script.js`.**

Tambahkan deklarasi class `ScanQueue` yang berinteraksi dengan API Vercel `/api/absensi` secara sequential (FIFO) dan menyimpan riwayat absensi ke `localStorage`. Edit baris 194-270 di `public/script.js`:
```javascript
// --- BACKGROUND SCAN QUEUE ENGINE ---
class ScanQueue {
  constructor() {
    this.queue = JSON.parse(localStorage.getItem('scan_queue') || '[]');
    this.isProcessing = false;
    this.cooldowns = {}; // For preventing duplicate double scans
  }

  save() {
    localStorage.setItem('scan_queue', JSON.stringify(this.queue));
    this.render();
  }

  add(studentId, week) {
    const timestamp = Date.now();
    
    // Prevent double scan check (cooldown 3s for same studentId)
    if (this.cooldowns[studentId] && (timestamp - this.cooldowns[studentId] < 3000)) {
      console.log(`Scan blocked by cooldown: ${studentId}`);
      return;
    }
    this.cooldowns[studentId] = timestamp;

    const id = 'scan_' + Math.random().toString(36).substring(2, 9) + '_' + timestamp;
    const item = {
      id,
      studentId,
      week,
      status: 'pending',
      name: '',
      image: '',
      errorMsg: '',
      timestamp
    };

    this.queue.unshift(item); // Add to the top of list
    this.save();
    
    // Trigger immediate sequential processing loop
    this.process();
  }

  async process() {
    if (this.isProcessing) return;

    // Find the oldest pending item
    const pendingItem = [...this.queue].reverse().find(item => item.status === 'pending');
    if (!pendingItem) {
      this.isProcessing = false;
      this.updateBanner();
      return;
    }

    this.isProcessing = true;
    pendingItem.status = 'processing';
    this.save();

    try {
      const token = sessionStorage.getItem('authToken');
      const response = await fetch("/api/absensi", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json", 
          "Authorization": `Bearer ${token}` 
        },
        body: JSON.stringify({ studentId: pendingItem.studentId, week: pendingItem.week }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      
      if (data.status === "ok") {
        pendingItem.status = 'success';
        pendingItem.name = data.name;
        pendingItem.image = data.image || '';
        showStatus(data.name, "success", `Hadir - Topik ${pendingItem.week}`);
        if (navigator.vibrate) navigator.vibrate(200);
      } else if (data.status === "duplicate") {
        pendingItem.status = 'duplicate';
        pendingItem.name = data.name || 'Sudah Absen';
        pendingItem.image = data.image || '';
        showStatus("Sudah Hadir", "error", data.message);
        if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
      } else {
        pendingItem.status = 'error';
        pendingItem.errorMsg = data.message || 'Gagal sinkronisasi';
        showStatus("Gagal", "error", pendingItem.errorMsg);
      }
    } catch (error) {
      console.error("Queue sync error:", error);
      pendingItem.status = 'pending'; // Leave in pending to retry when online
      
      // Stop loop temporarily due to network disconnect
      this.isProcessing = false;
      this.updateBanner();
      return;
    }

    this.isProcessing = false;
    this.save();
    
    // Continue processing remaining items in queue
    setTimeout(() => this.process(), 500);
  }

  updateBanner() {
    const warningBar = document.getElementById('queue-warning-bar');
    const remainingText = document.getElementById('queue-remaining-count');
    const statusText = document.getElementById('queue-status-text');

    const pendingCount = this.queue.filter(item => item.status === 'pending' || item.status === 'processing').length;

    if (warningBar && remainingText) {
      if (pendingCount > 0) {
        warningBar.style.display = 'flex';
        remainingText.textContent = pendingCount;
        if (statusText) {
          statusText.textContent = `Menyinkronkan (${pendingCount})`;
          statusText.style.color = 'var(--status-pending-text)';
        }
      } else {
        warningBar.style.display = 'none';
        if (statusText) {
          statusText.textContent = 'Semua Tersinkronisasi';
          statusText.style.color = 'var(--status-success-text)';
        }
      }
    }
  }

  render() {
    this.updateBanner();
    const listContainer = document.getElementById('queue-list');
    if (!listContainer) return;

    if (this.queue.length === 0) {
      listContainer.innerHTML = '<div class="queue-empty-state">Belum ada data pemindaian.</div>';
      return;
    }

    // Keep only the most recent 10 items in DOM to save performance
    const renderItems = this.queue.slice(0, 10);
    listContainer.innerHTML = '';

    renderItems.forEach(item => {
      const row = document.createElement('div');
      row.className = `queue-row ${item.status}`;

      const avatarSrc = item.image || '/assets/favicon.png';
      
      let badgeText = item.status;
      if (item.status === 'success') badgeText = 'Hadir';
      if (item.status === 'duplicate') badgeText = 'Sudah Absen';
      if (item.status === 'error') badgeText = 'Gagal';
      if (item.status === 'pending') badgeText = 'Antre';

      row.innerHTML = `
        <div class="student-info">
          <img class="student-photo" src="${avatarSrc}" onerror="this.src='/assets/favicon.png'" alt="Foto">
          <div class="student-text">
            <span class="student-name">${item.name || 'Katekumen'}</span>
            <span class="student-id">${item.studentId} &bull; Topik ${item.week}</span>
          </div>
        </div>
        <span class="status-badge ${item.status}">${badgeText}</span>
      `;
      listContainer.appendChild(row);
    });
  }

  clearOldHistory() {
    // Keep only the last 20 items in localStorage to prevent storage overflow
    if (this.queue.length > 20) {
      this.queue = this.queue.slice(0, 20);
      this.save();
    }
  }
}

const scanQueue = new ScanQueue();
```

- [ ] **Step 2: Commit perubahan Task 4.**
```bash
git add public/script.js
git commit -m "feat: implement ScanQueue engine with sequential processing, auto-retry, and DOM rendering"
```

---

### Task 5: Scanner, Integrasi Akhir & Pembersihan Kode
**Files:**
- Modify: `public/script.js` (Bagian penanganan QR code, inisialisasi awal)

- [ ] **Step 1: Terapkan penanganan scanner baru dan sesuaikan pemuatan awal aplikasi pada `public/script.js`.**

Ganti baris-baris sisa di `public/script.js` (baris 271-akhir) dengan kode integrasi berikut:
```javascript
// --- STATUS HANDLER ---
function showStatus(mainText, type, subText = "") {
  const el = document.getElementById("status");
  if (!el) return;
  
  let iconName = "qr_code_scanner";
  if (type === 'success') iconName = "check_circle_outline";
  else if (type === 'error') iconName = "error_outline";
  else if (type === 'processing') iconName = "hourglass_empty";

  if (subText) {
    el.innerHTML = `
      <span class="material-icons-outlined" style="font-size: 1.25rem;">${iconName}</span>
      <div class="status-text-container">
        <div class="main-text">${mainText}</div>
        <div class="sub-text">${subText}</div>
      </div>
    `;
  } else {
    el.innerHTML = `
      <span class="material-icons-outlined" style="font-size: 1.25rem;">${iconName}</span>
      <div class="main-text">${mainText}</div>
    `;
  }
  el.className = type;
}

function resetStatus() { 
  const pendingCount = scanQueue.queue.filter(item => item.status === 'pending' || item.status === 'processing').length;
  if (pendingCount > 0) {
    showStatus("Sinkronisasi sedang berjalan...", "processing", `${pendingCount} item tersisa di antrean.`);
  } else {
    showStatus("Silakan pindai kode QR berikutnya", "idle");
  }
}

function safeAtob(str) {
  let cleaned = str.replace(/\s/g, '').replace(/-/g, '+').replace(/_/g, '/');
  const pad = cleaned.length % 4;
  if (pad) {
    if (pad === 1) throw new Error("Invalid base64 structure");
    cleaned += '='.repeat(4 - pad);
  }
  return atob(cleaned);
}

// --- SCANNER LOGIC ---
async function handleScan(decodedText) {
  if (!selectedWeek) {
    showStatus("Pilih topik terlebih dahulu!", "error");
    setAppState(1);
    openTopicModal();
    return;
  }

  let originalStudentId;
  try {
    originalStudentId = safeAtob(decodedText);
  } catch (e) {
    showStatus("Kode QR Tidak Valid", "error", "Format kode tidak dikenali.");
    if (navigator.vibrate) navigator.vibrate([100, 50]);
    return;
  }

  // Optimistic tactile feedback
  if (navigator.vibrate) navigator.vibrate(80);

  // Add scan to queue instantly and keep camera running!
  scanQueue.add(originalStudentId, selectedWeek);
}

async function startScanner() {
  if (html5QrcodeScanner) return; // Already running

  const scanConfig = { 
    fps: 30,
    qrbox: { width: 220, height: 220 },
    aspectRatio: 1.0,
    disableFlip: false,
    experimentalFeatures: {
      useBarCodeDetectorIfSupported: true
    },
    videoConstraints: {
      facingMode: "environment",
      width: { ideal: 640 },
      height: { ideal: 640 }
    }
  };

  html5QrcodeScanner = new Html5Qrcode("reader", /* verbose= */ false);
  html5QrcodeScanner.start(
    { facingMode: "environment" },
    scanConfig,
    handleScan
  ).then(() => {
    const loader = document.getElementById("camera-loader");
    if (loader) loader.style.display = "none";
    resetStatus();
  }).catch(err => {
    console.error("Camera start failed:", err);
    const loader = document.getElementById("camera-loader");
    if (loader) {
      loader.innerHTML = '<div style="color:var(--status-duplicate-text); text-align:center; padding:10px;">Izin kamera ditolak<br>atau kamera tidak tersedia</div>';
    }
  });
}

async function stopScanner() {
  if (html5QrcodeScanner) {
    try {
      await html5QrcodeScanner.stop();
      html5QrcodeScanner = null;
      const loader = document.getElementById("camera-loader");
      if (loader) loader.style.display = "flex";
    } catch (err) {
      console.error("Failed to stop scanner:", err);
    }
  }
}

async function loadTopikList() {
  const listContainer = document.getElementById("topic-list-container");
  if (!listContainer) return;

  try {
    if (typeof STATIC_TOPICS !== 'undefined' && Array.isArray(STATIC_TOPICS)) {
      listContainer.innerHTML = "";
      STATIC_TOPICS.forEach((item) => {
        const div = document.createElement("div");
        div.className = "topic-option";
        if (item.name.includes("(P)")) div.classList.add("topic-p");
        else if (item.name.includes("(KI)")) div.classList.add("topic-ki");
        
        if (item.week === "R1" || item.week === "R2") {
          div.classList.add("topic-rekoleksi");
        }
        div.textContent = `${item.week}. ${item.name}`;
        div.onclick = () => selectTopic(item.week, item.name, div);
        listContainer.appendChild(div);
      });
    } else {
      listContainer.innerHTML = `<div class="topic-loading-placeholder" style="color:var(--status-duplicate-text);">Data topik tidak ditemukan.</div>`;
    }
  } catch (err) {
    console.error(err);
    listContainer.innerHTML = `<div class="topic-loading-placeholder" style="color:var(--status-duplicate-text);">Gagal memuat topik.</div>`;
  }
}

async function initializeApp() {
  await loadTopikList();
  scanQueue.render();
  scanQueue.process(); // Process any leftover queue from last load
}

// Initial triggers
window.onload = () => {
  initTheme();
  
  // Connect background queue trigger for online state detection
  window.addEventListener('online', () => {
    scanQueue.process();
  });

  if (sessionStorage.getItem('authToken')) {
    setAppState(1); // Set to selection page initially
    initializeApp();
  } else {
    setAppState(0); // Authentication screen
  }
}
```

- [ ] **Step 2: Jalankan verifikasi manual.**
Periksa kembali seluruh file `public/script.js` untuk memastikan tidak ada syntax error.

- [ ] **Step 3: Commit perubahan Task 5.**
```bash
git add public/script.js
git commit -m "feat: complete integrations of QR scanner state machine with the background queue, theme selector, and offline retry logic"
```

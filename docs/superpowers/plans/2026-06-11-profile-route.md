# /profile Route and Branch Setup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a git branch named `profilecard`, push it to the remote repository, and implement a new `/profile` route that serves a static HTML placeholder page matching the liquid glass UI design.

**Architecture:** Enable HTML extension resolution on local Express static file serving to match Vercel production clean URLs behavior, then create a placeholder HTML page at `public/profile.html`.

**Tech Stack:** Node.js, Express, Git

---

### Task 1: Setup Local Git Branch

**Files:**
- Create: None
- Modify: None

- [x] **Step 1: Create and switch to local branch `profilecard`**

  Run:
  ```bash
  git checkout -b profilecard
  ```
  Expected: Switch to a new branch 'profilecard'

- [x] **Step 2: Verify the current branch is `profilecard`**

  Run:
  ```bash
  git branch --show-current
  ```
  Expected output:
  ```
  profilecard
  ```

---

### Task 2: Configure Express Server for HTML Extension Resolution

**Files:**
- Modify: `app.js:90-95`

- [x] **Step 1: Modify static serving middleware in `app.js`**

  In [app.js](file:///Users/andarpartogi/repo/absensikatekumen/app.js) around lines 90-95, replace:
  ```javascript
  app.use(express.static(path.join(__dirname, 'public')));
  ```
  with:
  ```javascript
  app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));
  ```

- [x] **Step 2: Commit the Express server changes**

  Run:
  ```bash
  git add app.js
  git commit -m "feat: configure express static middleware to resolve html extensions"
  ```
  Expected: 1 file changed, 1 insertion(+), 1 deletion(-)

---

### Task 3: Create Profile HTML Placeholder Page

**Files:**
- Create: `public/profile.html`

- [x] **Step 1: Create and write contents of `public/profile.html`**

  Create file `public/profile.html` with this exact content:
  ```html
  <!DOCTYPE html>
  <html lang="id">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      <title>Profil Katekumen - Presensi Katekumen Digital</title>
      <link rel="icon" href="assets/favicon.png" type="image/png" />
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link href="https://fonts.googleapis.com/icon?family=Material+Icons+Outlined" rel="stylesheet">
      <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;500;700&family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet">
      <link rel="stylesheet" href="style.css">
    </head>
    <body>
      <div class="liquid-background">
        <div class="liquid-shape shape1"></div>
        <div class="liquid-shape shape2"></div>
      </div>

      <main id="app-container" class="glass-container">
        <div class="app-section">
          <div class="header-container">
            <img src="assets/pewartaan_invert.png" class="header-logo theme-logo" alt="Logo Pewartaan" style="cursor: pointer;">
            <div class="header-text">
              <h1>Profil Katekumen</h1>
              <h2>Detail & Riwayat</h2>
            </div>
          </div>

          <div style="text-align: center; margin: 40px 0; color: var(--text-color, #ffffff);">
            <span class="material-icons-outlined" style="font-size: 48px; opacity: 0.7; margin-bottom: 16px;">account_circle</span>
            <h3 style="font-family: 'Cinzel', serif; font-size: 20px; margin-bottom: 8px;">Kartu Profil Katekumen</h3>
            <p style="font-family: 'Inter', sans-serif; font-size: 14px; opacity: 0.8; max-width: 280px; margin: 0 auto;">Fitur profil katekumen sedang dalam pengembangan.</p>
          </div>

          <button onclick="window.location.href='/'" style="width: 100%; margin-top: 20px;"><b>Kembali ke Presensi</b></button>
        </div>
      </main>
    </body>
  </html>
  ```

- [x] **Step 2: Commit the new HTML file**

  Run:
  ```bash
  git add public/profile.html
  git commit -m "feat: add /profile route HTML placeholder page"
  ```
  Expected: 1 file changed, 44 insertions(+)

---

### Task 4: Push to Remote Repository

**Files:**
- Create: None
- Modify: None

- [x] **Step 1: Push the `profilecard` branch to origin**

  Run:
  ```bash
  git push -u origin profilecard
  ```
  Expected: Branch 'profilecard' set up to track remote branch 'profilecard' from 'origin'.

---

### Task 5: Run Verification Checks

**Files:**
- Create: None
- Modify: None

- [x] **Step 1: Start the local server**

  Run:
  ```bash
  npm run dev
  ```
  Expected output:
  ```
  Server started locally on http://localhost:5500
  ```

- [x] **Step 2: Verify the route loads successfully**

  Open browser to: `http://localhost:5500/profile` and verify the profile page renders correctly without showing the index/login page or a 404 error. Also check `http://localhost:5500/profile.html`.

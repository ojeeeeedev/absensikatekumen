# Nav Separation, Button Optimization, and Scanner Resizing Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Separate the top navigation bar from the main app card container, optimize navigation buttons to be slimmer and prevent multi-line wrapping, and resize the scanner area to 300px * 300px with responsive aspect-ratio.

**Architecture:** Move navigation markup above `#app-container` in HTML. Style `.app-nav` and `.nav-item` to align as independent floating glass buttons. Update `#reader-container` dimensions to `300px` square with `aspect-ratio: 1 / 1` and `max-width: 100%`. Sync nav visibility in JavaScript when the app state changes.

**Tech Stack:** Vanilla HTML5, CSS3, JavaScript (ES6+).

---

### Task 1: HTML Markup & Inline Scripts

**Files:**
- Modify: `public/index.html`
- Modify: `public/profile.html`

- [ ] **Step 1: Move and update nav markup in index.html**
  Modify `public/index.html` to move `<nav class="app-nav">` above `<main id="app-container">`, add `id="app-nav"` and `style="display: none;"` to it, and update the inline script inside `#app-container` to show it if token exists:
  ```html
    <nav class="app-nav" id="app-nav" style="display: none;">
      <a href="/" class="nav-item active">
        <span class="material-icons-outlined">qr_code_scanner</span>
        <span>Scan Presensi</span>
      </a>
      <a href="/profile" class="nav-item">
        <span class="material-icons-outlined">people_alt</span>
        <span>Profil Katekumen</span>
      </a>
    </nav>

    <main id="app-container" class="glass-container">
      <script>
        (function() {
          const sessionToken = sessionStorage.getItem('authToken');
          const container = document.currentScript.parentElement;
          if (sessionToken) {
            container.classList.add('state-scanning');
            const savedWeek = localStorage.getItem('selectedWeek');
            if (!savedWeek) {
              container.classList.add('needs-topic');
            }
            const nav = document.getElementById('app-nav');
            if (nav) nav.style.display = 'flex';
          } else {
            container.classList.add('state-auth');
          }
        })();
      </script>
  ```

- [ ] **Step 2: Move nav markup in profile.html**
  Modify `public/profile.html` to move `<nav class="app-nav">` above `<main id="app-container">` and add `id="app-nav"` to it:
  ```html
    <nav class="app-nav" id="app-nav">
      <a href="/" class="nav-item">
        <span class="material-icons-outlined">qr_code_scanner</span>
        <span>Scan Presensi</span>
      </a>
      <a href="/profile" class="nav-item active">
        <span class="material-icons-outlined">people_alt</span>
        <span>Profil Katekumen</span>
      </a>
    </nav>

    <main id="app-container" class="glass-container">
  ```

- [ ] **Step 3: Git stage HTML modifications**
  Run:
  ```bash
  git add public/index.html public/profile.html
  ```

---

### Task 2: CSS Layout & Sizing Adjustments

**Files:**
- Modify: `public/style.css`

- [ ] **Step 1: Replace navbar styles with floating glass buttons**
  Replace `.app-nav` and `.nav-item` rules inside `public/style.css` (lines 1218-1258) with the slimmer, separated layout:
  ```css
  .app-nav {
    display: flex;
    margin-bottom: 0.75rem;
    gap: 8px;
    width: 92%;
    max-width: 400px;
    z-index: 10;
  }
  
  .nav-item {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 0.55rem 0.6rem;
    border-radius: 12px;
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--text-secondary);
    text-decoration: none;
    background: var(--bg-glass);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border: 1px solid var(--border-glass);
    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: var(--shadow);
    white-space: nowrap;
  }
  
  .nav-item span.material-icons-outlined {
    font-size: 1.15rem;
  }
  
  .nav-item:hover {
    color: var(--text-primary);
    background: rgba(255, 255, 255, 0.05);
    border-color: rgba(255, 255, 255, 0.15);
    transform: translateY(-1px);
  }
  
  .nav-item.active {
    color: #fff !important;
    background: var(--accent);
    border-color: var(--accent);
    box-shadow: 0 4px 12px var(--accent-glow);
  }
  ```

- [ ] **Step 2: Increase scanner container size in CSS**
  Replace `#reader-container` rules inside `public/style.css` (lines 332-337) to size the container to `300px` square while ensuring responsiveness:
  ```css
  #reader-container {
    width: 300px;
    max-width: 100%;
    aspect-ratio: 1 / 1;
    height: auto;
    border-radius: 20px;
    overflow: hidden;
    position: relative;
    border: 1px solid var(--border-glass);
    background: #000;
    box-shadow: inset 0 4px 12px rgba(0,0,0,0.2);
    margin: 0 auto 0.75rem auto;
  }
  ```

- [ ] **Step 3: Git stage CSS changes**
  Run:
  ```bash
  git add public/style.css
  ```

---

### Task 3: JavaScript Nav Visibility Controls

**Files:**
- Modify: `public/script.js`

- [ ] **Step 1: Toggle nav visibility in setAppState**
  Update `window.setAppState` (lines 7-45) to show/hide the navigation bar according to the application state:
  ```javascript
  window.setAppState = async function(state) {
    const container = document.getElementById('app-container');
    container.className = 'glass-container';
    const nav = document.getElementById('app-nav');
    
    if (state === 0) {
      container.classList.add('state-auth');
      await stopScanner();
      if (nav) nav.style.display = 'none';
    } else if (state === 1) {
      container.classList.add('state-selection');
      await stopScanner();
      if (nav) nav.style.display = 'flex';
    } else if (state === 2) {
      container.classList.add('state-scanning');
      if (nav) nav.style.display = 'flex';
      
      if (!selectedWeek) {
        container.classList.add('needs-topic');
        const activeTopicText = document.getElementById('active-topic-name');
        if (activeTopicText) {
          activeTopicText.textContent = "Ketuk di sini untuk memilih topik...";
        }
      } else {
        container.classList.remove('needs-topic');
        const topicTrigger = document.getElementById('topic-trigger-large');
        const activeTopicText = document.getElementById('active-topic-name');
        if (activeTopicText && topicTrigger) {
          activeTopicText.textContent = topicTrigger.textContent.replace('arrow_drop_down', '').trim();
        }
      }
  
      if (selectedWeek) {
        startScanner();
      } else {
        const loader = document.getElementById("camera-loader");
        if (loader) {
          loader.innerHTML = '<span style="color:var(--text-secondary); text-align:center;">Silakan pilih topik terlebih dahulu</span>';
          loader.style.display = "flex";
        }
      }
    }
  }
  ```

- [ ] **Step 2: Git stage JS changes**
  Run:
  ```bash
  git add public/script.js
  ```

---

### Task 4: Build Verification

- [ ] **Step 1: Run build verification**
  Run: `npm run build`
  Expected: Command succeeds with no errors.

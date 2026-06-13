# Navigation & Scanner-First Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a top Navigation Bar to toggle between scanning and profile pages, skip the initial selection state, and dim the interface if no topic is selected.

**Architecture:** Add standard HTML `<nav>` tags linking between `/` and `/profile`. In `script.js`, set initial state to State 2 (Scanning). If `selectedWeek` is null, add a `.needs-topic` class to the container, show a placeholder, and skip initializing the camera. When a topic is picked, the class is removed and the camera is started.

**Tech Stack:** Vanilla HTML5, CSS3, JavaScript (ES6+).

---

### Task 1: Add HTML Markup for Navigation Bar

**Files:**
- Modify: `public/index.html:56-65`
- Modify: `public/profile.html:20-29`
- Modify: `public/profile.html:52-56`

- [ ] **Step 1: Add Navigation Bar to index.html**
  Insert the `<nav class="app-nav">` bar directly at the top of `#main-app-section` inside `public/index.html`:
  ```html
        <!-- STATE 2: SELECTION & SCANNING (SHARED) -->
        <div id="main-app-section" class="app-section">
          <nav class="app-nav">
            <a href="/" class="nav-item active">
              <span class="material-icons-outlined">qr_code_scanner</span>
              <span>Scan Presensi</span>
            </a>
            <a href="/profile" class="nav-item">
              <span class="material-icons-outlined">people_alt</span>
              <span>Profil Katekumen</span>
            </a>
          </nav>
  ```

- [ ] **Step 2: Add Navigation Bar and remove redundant button in profile.html**
  Insert the `<nav class="app-nav">` bar directly at the top of the `.app-section` in `public/profile.html` and remove the bottom `Kembali ke Presensi` button:
  ```html
      <main id="app-container" class="glass-container">
        <div class="app-section" style="display: flex; flex-direction: column; flex: 1; min-height: 0; overflow-y: auto;">
          <nav class="app-nav">
            <a href="/" class="nav-item">
              <span class="material-icons-outlined">qr_code_scanner</span>
              <span>Scan Presensi</span>
            </a>
            <a href="/profile" class="nav-item active">
              <span class="material-icons-outlined">people_alt</span>
              <span>Profil Katekumen</span>
            </a>
          </nav>
  ```
  And delete lines 54-55:
  ```html
          <button id="login-btn" onclick="window.location.href='/'" style="margin-top: 20px;"><b>Kembali ke Presensi</b></button>
  ```

- [ ] **Step 3: Commit HTML changes**
  Run:
  ```bash
  git add public/index.html public/profile.html
  git commit -m "feat: add top Navigation Bar markup and remove redundant profile back button"
  ```

---

### Task 2: Add Navigation Bar and Dimming Styles to CSS

**Files:**
- Modify: `public/style.css`

- [ ] **Step 1: Append styles to public/style.css**
  Append the following navigation and dimming selectors to the end of `public/style.css`:
  ```css
  /* =========================================
     NAVIGATION BAR
     ========================================= */
  .app-nav {
    display: flex;
    background: var(--bg-hover);
    border: 1px solid var(--border-glass);
    border-radius: 12px;
    padding: 4px;
    margin-bottom: 1.25rem;
    gap: 4px;
    width: 100%;
  }
  
  .nav-item {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 0.6rem 1rem;
    border-radius: 8px;
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--text-secondary);
    text-decoration: none;
    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  }
  
  .nav-item span.material-icons-outlined {
    font-size: 1.15rem;
  }
  
  .nav-item:hover {
    color: var(--text-primary);
    background: rgba(255, 255, 255, 0.05);
  }
  
  .nav-item.active {
    color: #fff !important;
    background: var(--accent);
    box-shadow: 0 4px 12px var(--accent-glow);
  }
  
  /* =========================================
     TOPIC NOT SELECTED DIMMING STATE
     ========================================= */
  .needs-topic #reader-container,
  .needs-topic #status,
  .needs-topic #queue-warning-bar,
  .needs-topic #queue-history-panel,
  .needs-topic .app-nav {
    opacity: 0.2;
    pointer-events: none;
    filter: blur(1.5px);
    transition: all 0.3s ease;
  }
  
  .needs-topic .active-topic-bar {
    border-color: var(--accent);
    box-shadow: 0 0 15px var(--accent-glow);
    animation: pulse-border 2s infinite;
  }
  
  @keyframes pulse-border {
    0% { box-shadow: 0 0 0 0 var(--accent-glow); }
    70% { box-shadow: 0 0 0 8px rgba(162, 123, 222, 0); }
    100% { box-shadow: 0 0 0 0 rgba(162, 123, 222, 0); }
  }
  ```

- [ ] **Step 2: Commit CSS changes**
  Run:
  ```bash
  git add public/style.css
  git commit -m "feat: add CSS styles for navbar and needs-topic dimming state"
  ```

---

### Task 3: Update App States and Caching/Dimming Logic

**Files:**
- Modify: `public/script.js`

- [ ] **Step 1: Modify setAppState state 2 logic**
  In `public/script.js`, modify `window.setAppState` (State 2 block) to handle `selectedWeek` check, class toggling, camera loader messaging, and conditional camera starting:
  ```javascript
    } else if (state === 2) {
      container.classList.add('state-scanning');
      
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
  ```

- [ ] **Step 2: Update handleLogin and window.onload state transition targets**
  * Modify line 155 inside `handleLogin` to target state `2`:
    ```javascript
              setAppState(2);
    ```
  * Modify line 889 inside `window.onload` to target state `2`:
    ```javascript
        setAppState(2); // Set to scanner page initially
    ```

- [ ] **Step 3: Modify handleScan topic guard**
  Modify the topic safeguard check inside `handleScan` to remove `setAppState(1)`:
  ```javascript
    if (!selectedWeek) {
      showStatus("Pilih topik terlebih dahulu!", "error");
      openTopicModal();
      return;
    }
  ```

- [ ] **Step 4: Commit script JS changes**
  Run:
  ```bash
  git add public/script.js
  git commit -m "feat: bypass selection panel on load/login and apply dimming when topic not selected"
  ```

---

### Task 4: Build Verification

- [ ] **Step 1: Run build script**
  Run: `npm run build`
  Expected: Command finishes successfully with "No build step needed".

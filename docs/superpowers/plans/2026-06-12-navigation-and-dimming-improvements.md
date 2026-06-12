# Navigation & Dimming Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refine the navigation bar styling into distinct clickable buttons, allow clicking the nav bar when no topic is selected, persist topic selection in `localStorage`, and implement inline page-parsing scripts to completely eliminate dark mode/login screen flashes during transitions.

**Architecture:** Use inline blocking scripts inside the HTML head and body to evaluate theme and session state before rendering. Redesign CSS layout for `.app-nav` and `.nav-item` to separate the segmented sliding look into standalone button styles. Store/restore `selectedWeek` in `localStorage` in `selectTopic()` and `window.onload`.

**Tech Stack:** Vanilla HTML5, CSS3, JavaScript (ES6+).

---

### Task 1: HTML Markup & Inline Scripts

**Files:**
- Modify: `public/index.html`
- Modify: `public/profile.html`

- [ ] **Step 1: Add theme resolution to index.html `<head>`**
  Insert the following script block directly in the `<head>` of `public/index.html` before any stylesheet links:
  ```html
    <script>
      (function() {
        const savedTheme = localStorage.getItem('theme') || 'light';
        document.documentElement.setAttribute('data-theme', savedTheme);
      })();
    </script>
  ```

- [ ] **Step 2: Add inline auth state resolution to index.html `#app-container`**
  Modify `<main id="app-container" class="glass-container state-auth">` inside `public/index.html`. Remove the default class `state-auth` and insert an inline script immediately after the opening `<main>` tag:
  ```html
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
          } else {
            container.classList.add('state-auth');
          }
        })();
      </script>
  ```

- [ ] **Step 3: Add theme resolution to profile.html `<head>`**
  Insert the following script block directly in the `<head>` of `public/profile.html` before any stylesheet links:
  ```html
    <script>
      (function() {
        const savedTheme = localStorage.getItem('theme') || 'light';
        document.documentElement.setAttribute('data-theme', savedTheme);
      })();
    </script>
  ```

- [ ] **Step 4: Add inline token validation to profile.html body**
  Insert the following script block at the very top of `<body>` inside `public/profile.html` before any visual markup:
  ```html
  <body>
    <script>
      (function() {
        const getCookie = (name) => {
          const value = '; ' + document.cookie;
          const parts = value.split('; ' + name + '=');
          if (parts.length === 2) return parts.pop().split(';').shift();
          return null;
        };
        if (!getCookie('auth_token')) {
          window.location.href = '/';
        }
      })();
    </script>
  ```

- [ ] **Step 5: Git stage HTML modifications**
  Run:
  ```bash
  git add public/index.html public/profile.html
  ```

---

### Task 2: CSS Navigation Bar & Transition Styling

**Files:**
- Modify: `public/style.css`

- [ ] **Step 1: Update `.app-nav` and `.nav-item` styles**
  Replace lines 1218-1257 inside `public/style.css` with:
  ```css
  .app-nav {
    display: flex;
    margin-bottom: 1.25rem;
    gap: 12px;
    width: 100%;
  }
  
  .nav-item {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 0.75rem 1rem;
    border-radius: 12px;
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--text-secondary);
    text-decoration: none;
    background: var(--bg-hover);
    border: 1px solid var(--border-glass);
    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.05);
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

- [ ] **Step 2: Allow navigation bar interaction in dimming state**
  Replace lines 1262-1271 (the `.needs-topic` class list selector) inside `public/style.css` to exclude `.app-nav`:
  ```css
  .needs-topic #reader-container,
  .needs-topic #status,
  .needs-topic #queue-warning-bar,
  .needs-topic #queue-history-panel {
    opacity: 0.2;
    pointer-events: none;
    filter: blur(1.5px);
    transition: all 0.3s ease;
  }
  ```

- [ ] **Step 3: Add transition keyframes and page animation**
  Append the entrance transition keyframes and rule to the end of `public/style.css`:
  ```css
  /* =========================================
     PAGE ENTRY ANIMATIONS (SHADCN STYLED)
     ========================================= */
  @keyframes enterAnimation {
    from {
      opacity: 0;
      transform: scale(0.985) translateY(6px);
    }
    to {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
  }
  
  .app-section {
    animation: enterAnimation 0.3s cubic-bezier(0.16, 1, 0.3, 1) both;
  }
  ```

- [ ] **Step 4: Git stage CSS changes**
  Run:
  ```bash
  git add public/style.css
  ```

---

### Task 3: JavaScript State & Persistence Logic

**Files:**
- Modify: `public/script.js`

- [ ] **Step 1: Store topic in localStorage upon selection**
  Inside `window.selectTopic` in `public/script.js`, store `week` and `name` variables to `localStorage`:
  ```javascript
  window.selectTopic = function(week, name, element) {
    selectedWeek = week;
    localStorage.setItem('selectedWeek', week);
    localStorage.setItem('selectedTopicName', name);
    const btn = document.getElementById('topic-trigger-large');
  ```

- [ ] **Step 2: Restore topic from localStorage on script initialization**
  Inside `window.onload` in `public/script.js`, check and restore `selectedWeek` and update the topic picker UI before calling `setAppState(2)`:
  ```javascript
    const sessionToken = sessionStorage.getItem('authToken');
    if (sessionToken) {
      // Sync the auth_token cookie with the sessionStorage token
      document.cookie = `auth_token=${sessionToken}; path=/; max-age=28800; SameSite=Lax`;
      
      const savedWeek = localStorage.getItem('selectedWeek');
      const savedTopicName = localStorage.getItem('selectedTopicName');
      if (savedWeek && savedTopicName) {
        selectedWeek = savedWeek;
        const btn = document.getElementById('topic-trigger-large');
        if (btn) {
          btn.innerHTML = `<span>${savedWeek}. ${savedTopicName}</span><span class="material-icons-outlined">arrow_drop_down</span>`;
        }
        const activeTopicText = document.getElementById('active-topic-name');
        if (activeTopicText) {
          activeTopicText.textContent = `${savedWeek}. ${savedTopicName}`;
        }
      }
      
      setAppState(2); // Set to scanner page initially
      initializeApp();
    }
  ```

- [ ] **Step 3: Highlight active topic in modal list**
  Inside `loadTopikList()` in `public/script.js`, set the `.active` class on the topic element if its week code matches the current `selectedWeek`:
  ```javascript
        STATIC_TOPICS.forEach((item) => {
          const div = document.createElement("div");
          div.className = "topic-option";
          if (item.name.includes("(P)")) div.classList.add("topic-p");
          else if (item.name.includes("(KI)")) div.classList.add("topic-ki");
          
          if (item.week === "R1" || item.week === "R2") {
            div.classList.add("topic-rekoleksi");
          }
          div.textContent = `${item.week}. ${item.name}`;
          
          if (item.week === selectedWeek) {
            div.classList.add("active");
          }
  ```

- [ ] **Step 4: Git stage JS changes**
  Run:
  ```bash
  git add public/script.js
  ```

---

### Task 4: Build Verification

- [ ] **Step 1: Run build verification**
  Run: `npm run build`
  Expected: Command succeeds with no errors.

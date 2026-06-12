# Spec: Navigation and Dimming Improvements

## Status
Approved

## Date
2026-06-12

## Author
Antigravity Coding Assistant

---

## 1. Objective
Improve user experience by refining the navigation bar layout, persisting the selected topic in client-side storage, allowing navigation when no topic is selected, and eliminating visual page load flashing (FOUC) through inline rendering scripts and Shadcn-inspired animations.

## 2. Requirements & Constraints
* **Interactive Navigation**: The navigation bar (`.app-nav`) must remain active (no `pointer-events: none;` or extreme opacity/blur) even if no topic is selected (`.needs-topic` state).
* **Topic Persistence**: When a user selects a topic, it must be stored in `localStorage`. Upon page reload or navigation back to the scanner, the topic must be restored automatically and the camera initialized if authenticated.
* **Button Layout**: The navigation tabs must look like separate, clickable buttons with distinct glass outlines rather than a single contiguous sliding toggle.
* **Graceful Transitions**:
  * Solve the theme flash on page load by resolving `data-theme` inside `<head>`.
  * Solve the auth state flash (brief login screen display) by resolving `state-auth` vs `state-scanning` inline in `#app-container`.
  * Smooth entry transitions using CSS keyframes for a premium feel.

## 3. Detailed Technical Design

### 3.1 Markup & Inline Blocking Scripts

#### `public/index.html`
* **Theme check inside `<head>`**:
  ```html
  <script>
    (function() {
      const savedTheme = localStorage.getItem('theme') || 'light';
      document.documentElement.setAttribute('data-theme', savedTheme);
    })();
  </script>
  ```
* **Instant state resolution inside `<main id="app-container">`**:
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

#### `public/profile.html`
* **Theme check inside `<head>`**:
  ```html
  <script>
    (function() {
      const savedTheme = localStorage.getItem('theme') || 'light';
      document.documentElement.setAttribute('data-theme', savedTheme);
    })();
  </script>
  ```
* **Instant token redirect at the top of `<body>`**:
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

### 3.2 CSS Additions and Overrides (`public/style.css`)
* **Navigation Bar Redesign**:
  Replace existing `.app-nav` and `.nav-item` rules with:
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
* **Needs-Topic Overlay Clickability**:
  Remove `.needs-topic .app-nav` from the dimming rule:
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
* **Graceful Page Entry Transition**:
  Add:
  ```css
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

### 3.3 JS Changes (`public/script.js`)
* **Topic Selection Storage**:
  In `selectTopic()`:
  ```javascript
  localStorage.setItem('selectedWeek', week);
  localStorage.setItem('selectedTopicName', name);
  ```
* **Topic Restoration**:
  In `window.onload` (before running `setAppState(2)`):
  ```javascript
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
  ```
* **Modal Highlighting**:
  In `loadTopikList()`:
  ```javascript
  if (item.week === selectedWeek) {
    div.classList.add("active");
  }
  ```

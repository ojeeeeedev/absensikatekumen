# Spec: Top Nav Separation, Button Optimization, and Scanner Resizing

## Status
Approved

## Date
2026-06-12

## Author
Antigravity Coding Assistant

---

## 1. Objective
Refine the layout of the digital attendance app by separating the top navigation bar from the main app card, increasing the scanner area to 300px * 300px with a responsive square constraint, and slimming down navigation buttons so their text remains on a single line without wrapping.

## 2. Requirements & Constraints
* **Nav Separation**: The navigation bar `<nav class="app-nav">` must reside outside of `#app-container` (`.glass-container`) in both `index.html` and `profile.html`.
* **Nav Buttons**: Individual nav buttons must be separate glassmorphic items styled with `background: var(--bg-glass)` and `border: 1px solid var(--border-glass)` so they float independently.
* **Single Line Layout**: Nav button paddings, margins, gaps, and font sizes must be adjusted to ensure "Profil Katekumen" and "Scan Presensi" stay on a single line (`white-space: nowrap`) even on small devices.
* **Scanner Resizing**: The scanner viewport `#reader-container` must be set to `300px` width, with `max-width: 100%` and `aspect-ratio: 1 / 1` to ensure responsiveness.
* **Auth State Coordination**:
  * In `index.html`, the top navigation bar should only display if the user is authenticated.
  * We will use inline scripts in HTML and update `setAppState` in `script.js` to control the display property of `#app-nav`.

## 3. Detailed Technical Design

### 3.1 Markup Changes

#### `public/index.html`
* Move `<nav class="app-nav">` outside and directly above `#app-container`.
* Add `id="app-nav"` and `style="display: none;"` to it.
* Update inline check script inside `#app-container` to toggle `#app-nav` display immediately:
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

#### `public/profile.html`
* Move `<nav class="app-nav">` outside and directly above `#app-container`.
* Add `id="app-nav"` to it:
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

### 3.2 CSS Changes (`public/style.css`)
* Update `.app-nav` and `.nav-item` rules to style them as separate floating buttons aligned with the main container:
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
* Resize `#reader-container` to `300px` square with responsive support:
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

### 3.3 JS Changes (`public/script.js`)
* In `setAppState(state)`:
  ```javascript
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
  ```

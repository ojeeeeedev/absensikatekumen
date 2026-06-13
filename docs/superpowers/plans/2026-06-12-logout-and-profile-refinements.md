# Logout and Profile Refinements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement navigation logout button, topic selection expiry logic (10-minute timeout), natural scrolling adjustments, constant search stats, and clean loading state transitions.

**Architecture:** A logout button is added to the shared navigation bar. LocalStorage timestamps (`logoutTimestamp` and `lastActiveTimestamp`) are checked during app initialization to clear `selectedWeek` if the user was logged out for more than 10 minutes. Programmatic height collapsing is removed to let the header scroll out of view naturally, and stats counts are computed from the full class array `allStudents` instead of the filtered array.

**Tech Stack:** HTML5, CSS3, vanilla JavaScript.

---

### Task 1: HTML Nav Bar Updates

**Files:**
- Modify: `public/index.html`
- Modify: `public/profile.html`

- [ ] **Step 1: Add logout button to `public/index.html`**

Update `public/index.html` (around lines 36-45) to add the logout link to the navigation bar:
```html
<<<<
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
====
    <nav class="app-nav" id="app-nav" style="display: none;">
      <a href="/" class="nav-item active">
        <span class="material-icons-outlined">qr_code_scanner</span>
        <span>Scan Presensi</span>
      </a>
      <a href="/profile" class="nav-item">
        <span class="material-icons-outlined">people_alt</span>
        <span>Profil Katekumen</span>
      </a>
      <a href="#" class="nav-item logout-btn" onclick="handleLogout(event)" aria-label="Keluar">
        <span class="material-icons-outlined">logout</span>
      </a>
    </nav>
>>>>
```

- [ ] **Step 2: Add logout button to `public/profile.html`**

Update `public/profile.html` (around lines 39-48) to add the logout link to the navigation bar:
```html
<<<<
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
====
    <nav class="app-nav" id="app-nav">
      <a href="/" class="nav-item">
        <span class="material-icons-outlined">qr_code_scanner</span>
        <span>Scan Presensi</span>
      </a>
      <a href="/profile" class="nav-item active">
        <span class="material-icons-outlined">people_alt</span>
        <span>Profil Katekumen</span>
      </a>
      <a href="#" class="nav-item logout-btn" onclick="handleLogout(event)" aria-label="Keluar">
        <span class="material-icons-outlined">logout</span>
      </a>
    </nav>
>>>>
```

- [ ] **Step 3: Commit HTML updates**

Run:
```bash
git add public/index.html public/profile.html
git commit -m "feat(nav): add logout button to navigation bar"
```

---

### Task 2: CSS Layout & Button Styling

**Files:**
- Modify: `public/style.css`

- [ ] **Step 1: Add style for logout button and clean up programmatic header collapse**

Update `public/style.css` to add the `.nav-item.logout-btn` rule at the end of the navigation section (around line 1285), and remove the scroll-collapse overrides for `.app-section.scrolled .header-container` and `.app-section.scrolled .header-logo`.

First, clean up scroll-collapse rules for header-container (around line 273):
```css
<<<<
.app-section.scrolled .header-container {
  max-height: 0;
  padding-bottom: 0;
  margin-bottom: 0;
  opacity: 0;
  border-bottom-color: transparent;
  pointer-events: none;
  visibility: hidden;
}
.header-logo {
  height: 48px; width: auto; margin-right: 12px;
  transition: height 0.3s cubic-bezier(0.4, 0, 0.2, 1),
              margin-right 0.3s cubic-bezier(0.4, 0, 0.2, 1),
              opacity 0.2s ease;
}

.app-section.scrolled .header-logo {
  height: 0;
  margin-right: 0;
  opacity: 0;
}
====
.header-logo {
  height: 48px; width: auto; margin-right: 12px;
}
>>>>
```

Next, add layout styles for the `.logout-btn` navigation item (around line 1280):
```css
<<<<
.nav-item.active {
  color: #fff !important;
  background: var(--accent);
  border-color: var(--accent);
  box-shadow: 0 4px 12px var(--accent-glow);
}
====
.nav-item.active {
  color: #fff !important;
  background: var(--accent);
  border-color: var(--accent);
  box-shadow: 0 4px 12px var(--accent-glow);
}

.nav-item.logout-btn {
  flex: 0 0 auto;
  width: 45px;
  padding: 0.55rem;
  justify-content: center;
}
>>>>
```

- [ ] **Step 2: Commit CSS updates**

Run:
```bash
git add public/style.css
git commit -m "style(nav): add logout button styles and revert programmatic scroll collapse"
```

---

### Task 3: JS Expiry and Logout Logic

**Files:**
- Modify: `public/script.js`

- [ ] **Step 1: Implement topic selection expiry and handleLogout in `public/script.js`**

Add `handleLogout` globally and the topic expiry check on `DOMContentLoaded` init in `public/script.js`:
```javascript
<<<<
let selectedWeek = null;
====
let selectedWeek = null;

// Expose handleLogout globally
window.handleLogout = function(e) {
  if (e) e.preventDefault();
  document.cookie = 'auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax';
  sessionStorage.removeItem('authToken');
  localStorage.setItem('logoutTimestamp', Date.now().toString());
  window.location.href = '/';
};

function checkTopicExpiry() {
  const loggedIn = !!sessionStorage.getItem('authToken');
  const now = Date.now();
  const tenMinutes = 10 * 60 * 1000;

  if (loggedIn) {
    const logoutTime = localStorage.getItem('logoutTimestamp');
    if (logoutTime) {
      if (now - parseInt(logoutTime) > tenMinutes) {
        localStorage.removeItem('selectedWeek');
      }
      localStorage.removeItem('logoutTimestamp');
    }
    localStorage.setItem('lastActiveTimestamp', now.toString());
  } else {
    const lastActive = localStorage.getItem('lastActiveTimestamp');
    if (lastActive) {
      if (now - parseInt(lastActive) > tenMinutes) {
        localStorage.removeItem('selectedWeek');
      }
      localStorage.removeItem('lastActiveTimestamp');
    }
  }
}
>>>>
```

Also call `checkTopicExpiry()` at the beginning of the `DOMContentLoaded` listener (around line 915):
```javascript
<<<<
document.addEventListener('DOMContentLoaded', () => {
  // Update CSS custom property --vh on load and resize
  updateVhProperty();
  window.addEventListener('resize', updateVhProperty);
  
  // Theme initialization
  initTheme();
  
  // Load saved week if it exists
  const savedWeek = localStorage.getItem('selectedWeek');
====
document.addEventListener('DOMContentLoaded', () => {
  // Check topic selection expiry first
  checkTopicExpiry();

  // Update CSS custom property --vh on load and resize
  updateVhProperty();
  window.addEventListener('resize', updateVhProperty);
  
  // Theme initialization
  initTheme();
  
  // Load saved week if it exists
  const savedWeek = localStorage.getItem('selectedWeek');
>>>>
```

- [ ] **Step 2: Commit script.js updates**

Run:
```bash
git add public/script.js
git commit -m "feat(auth): implement topic selection expiry logic and logout in script.js"
```

---

### Task 4: Profile Page JS Refinements

**Files:**
- Modify: `public/profile.js`

- [ ] **Step 1: Implement global handleLogout and adjust scroll threshold in `public/profile.js`**

Add `handleLogout` globally and update the scroll threshold to `50px` inside the `DOMContentLoaded` listener:
```javascript
<<<<
const token = getCookie('auth_token');
if (!token) {
  window.location.href = '/';
}

let allStudents = [];
====
const token = getCookie('auth_token');
if (!token) {
  window.location.href = '/';
}

let allStudents = [];

// Expose handleLogout globally
window.handleLogout = function(e) {
  if (e) e.preventDefault();
  document.cookie = 'auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax';
  sessionStorage.removeItem('authToken');
  localStorage.setItem('logoutTimestamp', Date.now().toString());
  window.location.href = '/';
};
>>>>
```

Update scroll listener threshold to `50px` (around line 320):
```javascript
<<<<
  // Scroll listener for header minimization
  const appSection = document.querySelector('.app-section');
  if (appSection) {
    appSection.addEventListener('scroll', () => {
      if (appSection.scrollTop > 10) {
        appSection.classList.add('scrolled');
      } else {
        appSection.classList.remove('scrolled');
      }
    });
  }
====
  // Scroll listener for header minimization
  const appSection = document.querySelector('.app-section');
  if (appSection) {
    appSection.addEventListener('scroll', () => {
      if (appSection.scrollTop > 50) {
        appSection.classList.add('scrolled');
      } else {
        appSection.classList.remove('scrolled');
      }
    });
  }
>>>>
```

- [ ] **Step 2: Hide counts summary container immediately on class load**

Modify `loadStudents(classCode)` (around line 72) to hide `#students-summary` at the start of the function:
```javascript
<<<<
async function loadStudents(classCode) {
  const listContainer = document.getElementById('students-list');
  const loader = document.getElementById('students-loader');
  
  // Reset scroll position and remove scrolled class on loading new students
  const appSection = document.querySelector('.app-section');
  if (appSection) {
    appSection.scrollTop = 0;
    appSection.classList.remove('scrolled');
  }
  
  if (listContainer) listContainer.innerHTML = '';
  if (loader) loader.style.display = 'flex';
====
async function loadStudents(classCode) {
  const listContainer = document.getElementById('students-list');
  const loader = document.getElementById('students-loader');
  const summaryContainer = document.getElementById('students-summary');
  
  // Hide counts summary box immediately when starting to load a class
  if (summaryContainer) {
    summaryContainer.style.display = 'none';
  }
  
  // Reset scroll position and remove scrolled class on loading new students
  const appSection = document.querySelector('.app-section');
  if (appSection) {
    appSection.scrollTop = 0;
    appSection.classList.remove('scrolled');
  }
  
  if (listContainer) listContainer.innerHTML = '';
  if (loader) loader.style.display = 'flex';
>>>>
```

- [ ] **Step 3: Modify stats summary counts calculation to always represent full class array (`allStudents`)**

Update `renderStudents(students)` (around lines 135-148) to calculate counts using `allStudents`:
```javascript
<<<<
  // Update count summary badges
  if (summaryContainer && summaryTotalText && summaryActiveText && summaryInactiveText) {
    const selector = document.getElementById('class-selector');
    const classCode = selector ? selector.value : '';
    
    if (classCode) {
      summaryContainer.style.display = 'flex';
      
      // Calculate active/inactive counts from current array (filtered if search active, or all)
      const currentTotal = students.length;
      const currentActive = activeList.length;
      const currentInactive = inactiveList.length;

      summaryTotalText.textContent = `Total: ${currentTotal}`;
      summaryActiveText.textContent = `Aktif: ${currentActive}`;
      summaryInactiveText.textContent = `Nonaktif: ${currentInactive}`;
    } else {
      summaryContainer.style.display = 'none';
    }
  }
====
  // Update count summary badges
  if (summaryContainer && summaryTotalText && summaryActiveText && summaryInactiveText) {
    const selector = document.getElementById('class-selector');
    const classCode = selector ? selector.value : '';
    
    if (classCode) {
      summaryContainer.style.display = 'flex';
      
      // Calculate active/inactive counts from full class list (allStudents) instead of filtered students list
      const activeAll = allStudents.filter(s => !isInactive(s));
      const inactiveAll = allStudents.filter(s => isInactive(s));
      
      const currentTotal = allStudents.length;
      const currentActive = activeAll.length;
      const currentInactive = inactiveAll.length;

      summaryTotalText.textContent = `Total: ${currentTotal}`;
      summaryActiveText.textContent = `Aktif: ${currentActive}`;
      summaryInactiveText.textContent = `Nonaktif: ${currentInactive}`;
    } else {
      summaryContainer.style.display = 'none';
    }
  }
>>>>
```

- [ ] **Step 4: Commit profile.js updates**

Run:
```bash
git add public/profile.js
git commit -m "feat(profile): optimize scrolling, load states, search count calculations, and handleLogout"
```

---

### Task 5: Verification and Version Bump

- [ ] **Step 1: Verify build integrity**

Run:
```bash
npm run build
```
Expected: PASS without errors.

- [ ] **Step 2: Version Bump**

Ask the user if they want to bump the version in `package.json` before final completion.
Bump if approved.

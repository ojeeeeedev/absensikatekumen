# Profile Page Enhancements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement UI/UX enhancements on the profile page, including a sticky persistent search bar, scroll-linked header minimization, inactive student bottom grouping, and semantic counters.

**Architecture:** Sticky positioning is applied to the selector container in CSS, coupled with a scroll event listener in JavaScript that toggles a `.scrolled` state class. Inactive students are identified using a case-insensitive check on their KI/KK values and grouped at the end of the rendering list, while semantic counts are calculated and updated inside updated summary badge HTML elements.

**Tech Stack:** HTML5, CSS3, vanilla JavaScript.

---

### Task 1: HTML Markup Updates

**Files:**
- Modify: `public/profile.html:73-75`

- [ ] **Step 1: Replace simple summary element with semantic badges markup**

Update `public/profile.html` to replace the old `#students-summary` child with three semantic badges:
```html
<<<<
        <div id="students-summary" class="students-summary-container" style="display: none;">
          <span id="summary-text"></span>
        </div>
====
        <div id="students-summary" class="students-summary-container" style="display: none;">
          <div class="summary-badge summary-total">
            <span class="material-icons-outlined">group</span>
            <span id="summary-total-text">Total: 0</span>
          </div>
          <div class="summary-badge summary-active">
            <span class="material-icons-outlined">check_circle</span>
            <span id="summary-active-text">Aktif: 0</span>
          </div>
          <div class="summary-badge summary-inactive">
            <span class="material-icons-outlined">cancel</span>
            <span id="summary-inactive-text">Tidak Aktif: 0</span>
          </div>
        </div>
>>>>
```

- [ ] **Step 2: Commit markup changes**

Run:
```bash
git add public/profile.html
git commit -m "feat(profile): update summary markup to use semantic badges"
```

---

### Task 2: CSS Styles Implementation

**Files:**
- Modify: `public/style.css` (around lines 889-933, 1147-1160)

- [ ] **Step 1: Update selector styling and add sticky layout rules**

Replace the existing `.profile-selector-container` and inputs styling in `public/style.css` (lines 889-933) with sticky positioning and minimization transitions:
```css
<<<<
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
====
.profile-selector-container {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
  margin-bottom: 20px;
  position: sticky;
  top: 0;
  z-index: 10;
  background: var(--bg-glass);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-bottom: 1px solid transparent;
  padding-top: 5px;
  padding-bottom: 5px;
  margin-top: -5px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.app-section.scrolled .profile-selector-container {
  gap: 8px;
  margin-bottom: 12px;
  border-bottom: 1px solid var(--border-glass);
  padding-top: 8px;
  padding-bottom: 8px;
}

#class-selector, #search-input {
  width: 100%;
  padding: 0.85rem;
  background: var(--bg-card);
  border: 1px solid var(--border-glass);
  border-radius: 12px;
  color: var(--text-primary);
  font-size: 1rem;
  outline: none;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  transition: padding 0.3s cubic-bezier(0.4, 0, 0.2, 1),
              font-size 0.3s cubic-bezier(0.4, 0, 0.2, 1),
              border-color 0.3s;
}

#class-selector {
  font-weight: 500;
  cursor: pointer;
}

#class-selector:focus, #search-input:focus {
  border-color: var(--accent);
}

.app-section.scrolled #class-selector,
.app-section.scrolled #search-input {
  padding: 0.55rem 0.85rem;
  font-size: 0.85rem;
}
>>>>
```

- [ ] **Step 2: Add header scroll transitions and minimization styles**

Add the header scroll transitions in `public/style.css` (around line 262):
```css
<<<<
.header-container {
  display: flex; align-items: center; justify-content: center;
  padding-bottom: 1rem; border-bottom: 1px solid var(--border-glass);
  margin-bottom: 1rem;
}
====
.header-container {
  display: flex; align-items: center; justify-content: center;
  padding-bottom: 1rem; border-bottom: 1px solid var(--border-glass);
  margin-bottom: 1rem;
  transition: max-height 0.3s cubic-bezier(0.4, 0, 0.2, 1),
              padding 0.3s cubic-bezier(0.4, 0, 0.2, 1),
              margin 0.3s cubic-bezier(0.4, 0, 0.2, 1),
              opacity 0.2s ease,
              border-bottom-width 0.3s ease;
  overflow: hidden;
}

.app-section.scrolled .header-container {
  max-height: 0;
  padding-bottom: 0;
  margin-bottom: 0;
  opacity: 0;
  border-bottom-width: 0;
  pointer-events: none;
}
>>>>
```

- [ ] **Step 3: Update summary container styles and add semantic badge classes**

Replace the old `.students-summary-container` styling (around lines 1147-1160) and add badges & inactive cards styling:
```css
<<<<
/* Summary Box */
.students-summary-container {
  padding: 6px 12px;
  margin-bottom: 12px;
  border-radius: 8px;
  background: var(--bg-hover);
  border: 1px solid var(--border-glass);
  font-size: 0.75rem;
  color: var(--text-secondary);
  font-weight: 500;
  display: flex;
  align-items: center;
  justify-content: center;
}
====
/* Summary Box */
.students-summary-container {
  display: flex;
  gap: 8px;
  justify-content: space-between;
  align-items: center;
  background: transparent;
  border: none;
  padding: 0;
  margin-bottom: 16px;
}

.summary-badge {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px;
  border-radius: 10px;
  font-size: 0.75rem;
  font-weight: 600;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  transition: all 0.3s ease;
}

.summary-badge span.material-icons-outlined {
  font-size: 1rem !important;
}

.summary-total {
  background: var(--accent-glow);
  border: 1px solid var(--border-glass);
  color: var(--text-primary);
}
.summary-total span.material-icons-outlined {
  color: var(--accent);
}

.summary-active {
  background: var(--status-success-bg);
  border: 1px solid var(--status-success-border);
  color: var(--status-success-text);
}

.summary-inactive {
  background: var(--status-duplicate-bg);
  border: 1px solid var(--status-duplicate-border);
  color: var(--status-duplicate-text);
}

/* Inactive student list cards */
.student-accordion-item.inactive {
  opacity: 0.65;
  border-style: dashed;
}

.student-accordion-item.inactive:hover {
  opacity: 0.85;
}

.inactive-badge {
  font-size: 0.62rem;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 4px;
  background: var(--status-duplicate-bg);
  border: 1px solid var(--status-duplicate-border);
  color: var(--status-duplicate-text);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  display: inline-block;
}
>>>>
```

- [ ] **Step 4: Commit CSS modifications**

Run:
```bash
git add public/style.css
git commit -m "style(profile): implement scroll transitions, sticky selector, and semantic badges"
```

---

### Task 3: JS Logic Updates

**Files:**
- Modify: `public/profile.js`

- [ ] **Step 1: Set up scroll event listener in DOMContentLoaded**

Update the initialization logic inside the `DOMContentLoaded` event listener (around line 286) to attach a scroll listener to `.app-section`:
```javascript
<<<<
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  loadClasses();
  
  const selector = document.getElementById('class-selector');
====
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  loadClasses();

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
  
  const selector = document.getElementById('class-selector');
>>>>
```

- [ ] **Step 2: Update rendering logic to sort inactive students and update semantic badges**

Modify `renderStudents(students)` (around lines 106-143) to partition the students, calculate badges, update HTML elements, and tag inactive items:
```javascript
<<<<
function renderStudents(students) {
  const listContainer = document.getElementById('students-list');
  const summaryContainer = document.getElementById('students-summary');
  const summaryText = document.getElementById('summary-text');
  
  if (!listContainer) return;
  listContainer.innerHTML = '';
  
  // Update count summary
  if (summaryContainer && summaryText) {
    const selector = document.getElementById('class-selector');
    const classCode = selector ? selector.value : '';
    const selectedOption = selector && selector.selectedIndex >= 0 ? selector.options[selector.selectedIndex] : null;
    const query = document.getElementById('search-input')?.value.trim();
    
    if (classCode) {
      summaryContainer.style.display = 'flex';
      const classNameDisplay = selectedOption ? selectedOption.textContent : `Kelas ${classCode}`;
      if (query) {
        summaryText.textContent = `Menampilkan ${students.length} dari ${allStudents.length} katekumen (pencarian "${query}")`;
      } else {
        summaryText.textContent = `Total ${allStudents.length} katekumen terdaftar di ${classNameDisplay}`;
      }
    } else {
      summaryContainer.style.display = 'none';
    }
  }
  
  if (students.length === 0) {
    listContainer.innerHTML = `
      <div class="empty-state">
        <span class="material-icons-outlined empty-icon">person_search</span>
        <p>Tidak ada data katekumen ditemukan.</p>
      </div>
    `;
    return;
  }
  
  students.forEach((student, index) => {
    const item = document.createElement('div');
    item.className = 'student-accordion-item';
====
function renderStudents(students) {
  const listContainer = document.getElementById('students-list');
  const summaryContainer = document.getElementById('students-summary');
  
  const summaryTotalText = document.getElementById('summary-total-text');
  const summaryActiveText = document.getElementById('summary-active-text');
  const summaryInactiveText = document.getElementById('summary-inactive-text');
  
  if (!listContainer) return;
  listContainer.innerHTML = '';

  // Inactive helper
  const isInactive = (student) => {
    const ki = (student.kelasKi || '').trim().toLowerCase();
    const kk = (student.katekisKk || '').trim().toLowerCase();
    return ki === 'inactive' || kk === 'inactive';
  };

  // Group active and inactive students (inactive at the bottom)
  const activeList = students.filter(s => !isInactive(s));
  const inactiveList = students.filter(s => isInactive(s));
  const processedStudents = [...activeList, ...inactiveList];
  
  // Update count summary badges
  if (summaryContainer && summaryTotalText && summaryActiveText && summaryInactiveText) {
    const selector = document.getElementById('class-selector');
    const classCode = selector ? selector.value : '';
    
    if (classCode) {
      summaryContainer.style.display = 'flex';
      
      // Calculate active/inactive counts from current array (filtered if search active, or all)
      const currentTotal = students.length;
      const currentActive = students.filter(s => !isInactive(s)).length;
      const currentInactive = students.filter(s => isInactive(s)).length;

      summaryTotalText.textContent = `Total: ${currentTotal}`;
      summaryActiveText.textContent = `Aktif: ${currentActive}`;
      summaryInactiveText.textContent = `Tidak Aktif: ${currentInactive}`;
    } else {
      summaryContainer.style.display = 'none';
    }
  }
  
  if (processedStudents.length === 0) {
    listContainer.innerHTML = `
      <div class="empty-state">
        <span class="material-icons-outlined empty-icon">person_search</span>
        <p>Tidak ada data katekumen ditemukan.</p>
      </div>
    `;
    return;
  }
  
  processedStudents.forEach((student, index) => {
    const item = document.createElement('div');
    const studentInactive = isInactive(student);
    item.className = studentInactive 
      ? 'student-accordion-item inactive' 
      : 'student-accordion-item';
>>>>
```

- [ ] **Step 3: Prepend inactive badge inside student accordion header**

Modify the student accordion header generation block (around lines 168-177) to prepend the inactive badge if applicable:
```javascript
<<<<
    header.innerHTML = `
      <div class="header-left">
        ${photoHtml}
        <div class="student-meta">
          <div class="student-name-text">${escapeHTML(student.name)}</div>
          <div class="student-id-text">${escapeHTML(student.studentId)}</div>
        </div>
      </div>
      <span class="material-icons-outlined expand-arrow">expand_more</span>
    `;
====
    const inactiveBadge = studentInactive 
      ? `<span class="inactive-badge">Tidak Aktif</span>`
      : '';

    header.innerHTML = `
      <div class="header-left">
        ${photoHtml}
        <div class="student-meta">
          <div class="student-name-text-wrapper" style="display: flex; align-items: center; gap: 8px;">
            <div class="student-name-text">${escapeHTML(student.name)}</div>
            ${inactiveBadge}
          </div>
          <div class="student-id-text">${escapeHTML(student.studentId)}</div>
        </div>
      </div>
      <span class="material-icons-outlined expand-arrow">expand_more</span>
    `;
>>>>
```

- [ ] **Step 4: Commit JS changes**

Run:
```bash
git add public/profile.js
git commit -m "feat(profile): implement inactive student grouping, badges, and scroll listener logic"
```

---

### Task 4: Verification and Version Bump

- [ ] **Step 1: Verify build integrity**

Run:
```bash
npm run build
```
Expected: Prints `No build step needed` successfully without errors.

- [ ] **Step 2: Version Bump**

Ask the user if they want to bump the version in `package.json` before final completion.
Bump if approved.

# Spec: Profile Page Enhancements

This specification outlines the UI/UX enhancements to the profile tab in the Presensi Katekumen Digital application.

## 1. Requirements

1. **Persistent search bar:** The search bar sticks to the top of the profile container on scroll to remain accessible while viewing the student list.
2. **Minimize class name on scroll:** The header container and class selector container shrink smoothly when scrolling down to maximize vertical list area.
3. **Inactive student grouping:** Students marked as `"Inactive"` in their KI (Kelas Inisiasi) or KK (Katekis Kelompok) fields are sorted to the bottom of the list and grouped together, with visual indicators distinguishing them.
4. **Semantic status summary:** The single-line text summary is replaced by three semantic containers showing Total, Active, and Inactive student counts.

## 2. Technical Design

### A. HTML Structural Changes (`public/profile.html`)
Modify `#students-summary` to contain three distinct semantic containers:
```html
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
```

### B. CSS Styling (`public/style.css`)
1. Make `.profile-selector-container` sticky:
   ```css
   .profile-selector-container {
     position: sticky;
     top: 0;
     z-index: 10;
     background: var(--bg-glass);
     backdrop-filter: blur(20px);
     -webkit-backdrop-filter: blur(20px);
     border-bottom: 1px solid transparent;
     transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
   }
   ```
2. Minimize header and selector on scroll:
   ```css
   /* Header minimization on scroll */
   .header-container {
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

   .app-section.scrolled .profile-selector-container {
     gap: 8px;
     margin-bottom: 12px;
     border-bottom: 1px solid var(--border-glass);
     padding-top: 8px;
     padding-bottom: 8px;
   }

   /* Inputs minimizing transition */
   #class-selector, #search-input {
     transition: padding 0.3s cubic-bezier(0.4, 0, 0.2, 1),
                 font-size 0.3s cubic-bezier(0.4, 0, 0.2, 1),
                 border-color 0.3s;
   }

   .app-section.scrolled #class-selector,
   .app-section.scrolled #search-input {
     padding: 0.55rem 0.85rem;
     font-size: 0.85rem;
   }
   ```
3. Semantic Summary Badges styling:
   ```css
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
   ```
4. Inactive Student card styling:
   ```css
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
   ```

### C. JS Logic Changes (`public/profile.js`)
1. **Scroll Event Listener:**
   Add scroll listener to `.app-section` on initialization:
   ```javascript
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
   ```
2. **Inactive Check Helper:**
   Define `isInactive(student)` helper:
   ```javascript
   const isInactive = (student) => {
     const ki = (student.kelasKi || '').trim().toLowerCase();
     const kk = (student.katekisKk || '').trim().toLowerCase();
     return ki === 'inactive' || kk === 'inactive';
   };
   ```
3. **Sorting/Grouping in `renderStudents(students)`:**
   Sort the input array:
   ```javascript
   const activeList = students.filter(s => !isInactive(s));
   const inactiveList = students.filter(s => isInactive(s));
   const processedStudents = [...activeList, ...inactiveList];
   ```
4. **Populate counts:**
   Update the DOM elements: `#summary-total-text`, `#summary-active-text`, `#summary-inactive-text` using the sorted arrays or overall counts.
5. **Differentiate Inactive cards:**
   If a student is inactive, add class `inactive` to their `.student-accordion-item` and render the `inactive-badge` inside the header.

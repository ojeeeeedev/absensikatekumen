# User Onboarding Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a user onboarding modal popup overlay showing updates and simplifications, displayed automatically once after a successful login. It is designed to be easily removed in the future.

**Architecture:** Implement the onboarding feature as completely decoupled files (`public/onboarding.js` and `public/onboarding.css`) that are dynamically loaded. The main code references the modal check via a safe callback so that the entire feature can be uninstalled simply by deleting these two files and their references.

**Design Details:**
- Constrained width (90%, max 400px) so the modal floats centered without touching the screen edges.
- Logo: Pewartaan logo image on top (`assets/pewartaan_normal.png`).
- Typography: Inter font for the header, no subtitle.
- Feature log: Each row gets its own accordion/dropdown (initially all closed).
- Colors: Soft light blues for both sections, completely removing red color schemes.
- Animation: Staggered sequential entry animation for each row.

---

### Task 1: Create/Update the Onboarding Script (Dynamic Injection & Row Accordion)

**Files:**
- Modify: `public/onboarding.js`

- [ ] **Step 1: Write `public/onboarding.js`**
Update this file to handle CSS injection, HTML rendering (using row accordions), and state management.

```javascript
(function() {
  const checkOnboarding = () => {
    // Check if they already saw onboarding
    if (localStorage.getItem('hasSeenOnboardingV2')) return;

    const sessionToken = sessionStorage.getItem('authToken');
    if (!sessionToken) return;

    // Dynamically inject stylesheet if not already loaded
    if (!document.getElementById('onboarding-style')) {
      const link = document.createElement('link');
      link.id = 'onboarding-style';
      link.rel = 'stylesheet';
      link.href = 'onboarding.css';
      document.head.appendChild(link);
    }

    // Dynamically inject onboarding modal HTML
    if (!document.getElementById('onboarding-modal')) {
      const modal = document.createElement('div');
      modal.id = 'onboarding-modal';
      modal.className = 'student-modal';
      modal.style.display = 'flex';
      modal.setAttribute('role', 'dialog');
      modal.setAttribute('aria-modal', 'true');
      
      // Close modal on click outside content
      modal.onclick = (e) => closeOnboardingModal(e);
      
      modal.innerHTML = `
        <div class="modal-content onboarding-modal-content">
          <!-- Small Pewartaan Logo -->
          <img src="assets/pewartaan_normal.png" alt="Logo Pewartaan" class="onboarding-logo">

          <!-- Welcome Header (Inter Font) -->
          <h2 class="onboarding-title">Selamat datang di Sistem Presensi v2</h2>

          <div class="onboarding-scroll-area">
            <!-- Section 1: Fitur Baru yang Memudahkan -->
            <h3 class="onboarding-section-header updates-header">
              <span class="material-icons-outlined" aria-hidden="true">auto_awesome</span>
              Fitur Baru yang Memudahkan
            </h3>
            <div class="updates-list">
              
              <!-- Row 1: Scan QR Berturut-turut -->
              <div class="row-accordion" id="row-scan">
                <div class="row-accordion-header">
                  <div class="row-accordion-title">
                    <span class="material-icons-outlined" aria-hidden="true">bolt</span>
                    <span>Scan QR Berturut-turut</span>
                  </div>
                  <span class="material-icons-outlined chevron">expand_more</span>
                </div>
                <div class="row-accordion-content">
                  <div class="row-accordion-body">
                    Scan peserta berikutnya langsung tanpa jeda. Data otomatis dikirim di latar belakang.
                  </div>
                </div>
              </div>

              <!-- Row 2: Simpan Offline Otomatis -->
              <div class="row-accordion" id="row-offline">
                <div class="row-accordion-header">
                  <div class="row-accordion-title">
                    <span class="material-icons-outlined" aria-hidden="true">wifi_off</span>
                    <span>Simpan Offline Otomatis</span>
                  </div>
                  <span class="material-icons-outlined chevron">expand_more</span>
                </div>
                <div class="row-accordion-content">
                  <div class="row-accordion-body">
                    Scan tetap jalan walau internet lambat/putus. Data aman dan terkirim otomatis saat online.
                  </div>
                </div>
              </div>

              <!-- Row 3: Daftar & Profil Katekumen -->
              <div class="row-accordion" id="row-profile">
                <div class="row-accordion-header">
                  <div class="row-accordion-title">
                    <span class="material-icons-outlined" aria-hidden="true">badge</span>
                    <span>Daftar & Profil Katekumen</span>
                  </div>
                  <span class="material-icons-outlined chevron">expand_more</span>
                </div>
                <div class="row-accordion-content">
                  <div class="row-accordion-body">
                    Halaman khusus untuk melihat daftar seluruh peserta kelas, katekis, kelompok KI, dan foto mereka.
                  </div>
                </div>
              </div>

              <!-- Row 4: Tampilan Informasi Rapi -->
              <div class="row-accordion" id="row-detail">
                <div class="row-accordion-header">
                  <div class="row-accordion-title">
                    <span class="material-icons-outlined" aria-hidden="true">layers</span>
                    <span>Tampilan Informasi Rapi</span>
                  </div>
                  <span class="material-icons-outlined chevron">expand_more</span>
                </div>
                <div class="row-accordion-content">
                  <div class="row-accordion-body">
                    Detail data katekumen kini langsung muncul di bagian bawah layar secara instan.
                  </div>
                </div>
              </div>

            </div>

            <!-- Section 2: Penyederhanaan Sistem -->
            <h3 class="onboarding-section-header removals-header">
              <span class="material-icons-outlined" aria-hidden="true">published_with_changes</span>
              Penyederhanaan Sistem
            </h3>
            <div class="removals-list">
              
              <!-- Row 5: Buka Scanner Lebih Cepat -->
              <div class="row-accordion" id="row-speed">
                <div class="row-accordion-header">
                  <div class="row-accordion-title">
                    <span class="material-icons-outlined" aria-hidden="true">speed</span>
                    <span>Buka Scanner Lebih Cepat</span>
                  </div>
                  <span class="material-icons-outlined chevron">expand_more</span>
                </div>
                <div class="row-accordion-content">
                  <div class="row-accordion-body">
                    Topik pertemuan terakhir otomatis disimpan. Tidak perlu memilih ulang setiap membuka web.
                  </div>
                </div>
              </div>

              <!-- Row 6: Navigasi Menu Simpel -->
              <div class="row-accordion" id="row-nav">
                <div class="row-accordion-header">
                  <div class="row-accordion-title">
                    <span class="material-icons-outlined" aria-hidden="true">navigation</span>
                    <span>Navigasi Menu Simpel</span>
                  </div>
                  <span class="material-icons-outlined chevron">expand_more</span>
                </div>
                <div class="row-accordion-content">
                  <div class="row-accordion-body">
                    Menu bawah layar baru memudahkan ganti halaman secara instan tanpa tombol ribet.
                  </div>
                </div>
              </div>

            </div>
          </div>
          <button class="onboarding-btn" id="onboarding-dismiss-btn">Mulai Gunakan</button>
        </div>
      `;
      document.body.appendChild(modal);

      // Stop propagation programmatically
      const content = modal.querySelector('.onboarding-modal-content');
      if (content) {
        content.onclick = (e) => e.stopPropagation();
      }

      // Bind row click handlers programmatically
      const rows = modal.querySelectorAll('.row-accordion');
      rows.forEach(row => {
        const header = row.querySelector('.row-accordion-header');
        if (header) {
          header.onclick = () => toggleOnboardingRow(row.id);
        }
      });

      // Bind dismiss button
      const dismissBtn = document.getElementById('onboarding-dismiss-btn');
      if (dismissBtn) {
        dismissBtn.onclick = () => closeOnboardingModal(null);
      }

      // Register escape key handler
      window.addEventListener('keydown', handleEscapeKey);
    }
  };

  const toggleOnboardingRow = (id) => {
    const el = document.getElementById(id);
    if (!el) return;
    
    const isOpen = el.classList.contains('open');
    
    // Close all other rows
    const container = document.querySelector('.onboarding-scroll-area');
    if (container) {
      const all = container.querySelectorAll('.row-accordion');
      all.forEach(acc => acc.classList.remove('open'));
    }
    
    // Toggle selected row
    if (!isOpen) {
      el.classList.add('open');
    }
  };

  const handleEscapeKey = (e) => {
    if (e.key === 'Escape') {
      closeOnboardingModal(null);
    }
  };

  const closeOnboardingModal = (event) => {
    if (event && event.stopPropagation) {
      event.stopPropagation();
    }
    const modal = document.getElementById('onboarding-modal');
    if (modal) {
      modal.remove();
      localStorage.setItem('hasSeenOnboardingV2', 'true');
    }
    window.removeEventListener('keydown', handleEscapeKey);
  };

  // Expose check function globally
  window.checkOnboarding = checkOnboarding;

  // Run on load if token already exists
  window.addEventListener('DOMContentLoaded', () => {
    setTimeout(checkOnboarding, 600);
  });
})();
```

- [ ] **Step 2: Commit**
```bash
git add public/onboarding.js
git commit -m "feat: implement row accordion structure in onboarding script"
```

---

### Task 2: Create/Update the Onboarding Stylesheet

**Files:**
- Modify: `public/onboarding.css`

- [ ] **Step 1: Write `public/onboarding.css`**
Update the stylesheet to style the row accordions, the logo, the Inter-styled title, and the constrained modal width.

```css
/* Onboarding Modal Styles */
.onboarding-modal-content {
  max-height: 80vh !important;
  width: 90% !important;
  max-width: 400px !important;
  margin: auto;
  border-radius: 24px;
  padding: 1.5rem;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.25);
  animation: slideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border-glass);
}

.onboarding-logo {
  height: 48px;
  width: auto;
  align-self: center;
  margin-bottom: 12px;
}

.onboarding-title {
  font-family: 'Inter', sans-serif !important;
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0 0 16px 0;
  text-align: center !important;
}

.onboarding-scroll-area {
  flex-grow: 1;
  overflow-y: auto;
  padding-right: 6px;
  margin-bottom: 1rem;
  border-top: 1px solid var(--border-glass);
  border-bottom: 1px solid var(--border-glass);
  padding-top: 0.5rem;
  padding-bottom: 0.5rem;
}

/* Custom scrollbar for scroll area */
.onboarding-scroll-area::-webkit-scrollbar {
  width: 4px;
}
.onboarding-scroll-area::-webkit-scrollbar-track {
  background: transparent;
}
.onboarding-scroll-area::-webkit-scrollbar-thumb {
  background: var(--border-glass);
  border-radius: 2px;
}

/* Section Headers */
.onboarding-section-header {
  font-size: 0.82rem;
  font-weight: 600;
  margin: 14px 0 8px 0;
  display: flex;
  align-items: center;
  gap: 6px;
  text-align: left !important;
}

.onboarding-section-header span {
  font-size: 1.05rem;
}

.updates-header {
  color: #38bdf8; /* Lighter shade of blue */
}

.removals-header {
  color: #7dd3fc; /* Lighter shade of blue (no red) */
}

/* Row Accordion Card Styles */
.row-accordion {
  border: 1px solid var(--border-glass);
  border-radius: 12px;
  margin-bottom: 8px;
  background: rgba(255, 255, 255, 0.02);
  transition: background 0.25s, border-color 0.25s;
  text-align: left;
  overflow: hidden;
  
  /* Staggered entrance animation properties */
  opacity: 0;
  transform: translateY(10px);
  animation: fadeInUp 0.4s cubic-bezier(0.4, 0, 0.2, 1) forwards;
}

.row-accordion:hover {
  background: rgba(255, 255, 255, 0.04);
  border-color: rgba(255, 255, 255, 0.15);
}

/* Stagger delays for 6 items total */
.row-accordion:nth-child(1) { animation-delay: 0.05s; }
.row-accordion:nth-child(2) { animation-delay: 0.12s; }
.row-accordion:nth-child(3) { animation-delay: 0.19s; }
.row-accordion:nth-child(4) { animation-delay: 0.26s; }
/* Removals Section elements: we target by container children offset */
.removals-list .row-accordion:nth-child(1) { animation-delay: 0.33s; }
.removals-list .row-accordion:nth-child(2) { animation-delay: 0.40s; }

.row-accordion-header {
  padding: 10px 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  user-select: none;
}

.row-accordion-title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text-primary);
}

.row-accordion-title span.material-icons-outlined {
  font-size: 1.2rem;
  flex-shrink: 0;
}

/* Icon colors using lighter blues */
.updates-list .row-accordion-title span.material-icons-outlined {
  color: #38bdf8;
}

.removals-list .row-accordion-title span.material-icons-outlined {
  color: #7dd3fc;
}

.row-accordion-header .chevron {
  font-size: 1.1rem;
  color: var(--text-secondary);
  transition: transform 0.25s ease;
}

.row-accordion-content {
  max-height: 0;
  overflow: hidden;
  transition: max-height 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.row-accordion.open {
  border-color: rgba(56, 189, 248, 0.3);
  background: rgba(56, 189, 248, 0.03);
}

.row-accordion.open .row-accordion-content {
  max-height: 80px; /* Space for detail text */
}

.row-accordion.open .chevron {
  transform: rotate(180deg);
  color: var(--text-primary);
}

.row-accordion-body {
  padding: 0 12px 10px 38px; /* Indent body text to align with title text */
  font-size: 0.75rem;
  line-height: 1.4;
  color: var(--text-secondary);
  opacity: 0.95;
  text-align: left !important;
}

.onboarding-btn {
  width: 100%;
  padding: 0.75rem;
  background: linear-gradient(135deg, var(--accent) 0%, #00f2fe 100%);
  border: none;
  border-radius: 12px;
  color: white;
  font-weight: 700;
  font-size: 0.85rem;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
  box-shadow: 0 4px 15px var(--accent-glow);
  margin-top: 8px;
}

.onboarding-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 20px var(--accent-glow);
}

.onboarding-btn:active {
  transform: translateY(0);
}

.onboarding-btn:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

@keyframes slideUp {
  from {
    transform: translateY(30px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

@keyframes fadeInUp {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

- [ ] **Step 2: Commit**
```bash
git add public/onboarding.css
git commit -m "style: implement row accordion layout and style updates"
```

---

### Task 3: Verify and Build

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Test interactive workflow**
1. Clear localStorage keys `hasSeenOnboardingV2`.
2. Login and confirm modal appears automatically.
3. Confirm that it is centered, fits correct width, has Inter header font, Pewartaan logo, and no subtitle.
4. Verify all items are closed initially.
5. Click on individual rows, verify they expand smoothly and slide down.
6. Verify that opening a row closes the previous open row.
7. Click "Mulai Gunakan" and confirm it closes and writes correct key to storage.

- [ ] **Step 2: Bump version**
Bump version to `2.2.1` in `package.json`.

- [ ] **Step 3: Run build**
Run: `npm run build`
Ensure build passes.

- [ ] **Step 4: Commit changes**
```bash
git add package.json
git commit -m "chore: bump version to 2.2.1 for onboarding accordion enhancements"
```

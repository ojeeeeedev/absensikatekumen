# User Onboarding Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a user onboarding modal popup overlay showing updates and simplifications, displayed automatically once after a successful login. It is designed to be easily removed in the future.

**Architecture:** Implement the onboarding feature as completely decoupled files (`public/onboarding.js` and `public/onboarding.css`) that are dynamically loaded. The main code references the modal check via a safe callback so that the entire feature can be uninstalled simply by deleting these two files and their references.

**Tech Stack:** HTML5, CSS3, Vanilla JS

---

### Task 1: Create the Onboarding Script (Dynamic Injection)

**Files:**
- Create: `public/onboarding.js`

- [ ] **Step 1: Write `public/onboarding.js`**
Create this file to handle CSS injection, HTML rendering, and state management.

```javascript
(function() {
  // Check if they already saw onboarding
  if (localStorage.getItem('hasSeenOnboardingV2')) return;

  const checkOnboarding = () => {
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
      modal.onclick = (e) => closeOnboardingModal(e);
      
      modal.innerHTML = `
        <div class="modal-content onboarding-modal-content" onclick="event.stopPropagation()">
          <div class="onboarding-header">
            <span class="material-icons-outlined onboarding-welcome-icon" aria-hidden="true">celebration</span>
            <h2 class="onboarding-title">Selamat datang di Sistem Presensi v2</h2>
            <p class="onboarding-subtitle">Panduan singkat pembaruan aplikasi Anda:</p>
          </div>

          <div class="onboarding-scroll-area">
            <div class="onboarding-section">
              <h3 class="onboarding-section-title updates-title">
                <span class="material-icons-outlined" aria-hidden="true">auto_awesome</span>
                Fitur Baru yang Memudahkan
              </h3>
              <div class="onboarding-list">
                <div class="onboarding-item">
                  <span class="material-icons-outlined onboarding-item-icon updates-icon" aria-hidden="true">bolt</span>
                  <div class="onboarding-item-text">
                    <strong>Scan QR Berturut-turut:</strong> Scan peserta berikutnya langsung tanpa jeda. Data otomatis dikirim di latar belakang.
                  </div>
                </div>
                <div class="onboarding-item">
                  <span class="material-icons-outlined onboarding-item-icon updates-icon" aria-hidden="true">wifi_off</span>
                  <div class="onboarding-item-text">
                    <strong>Simpan Offline Otomatis:</strong> Scan tetap jalan walau internet lambat/putus. Data aman dan terkirim otomatis saat online.
                  </div>
                </div>
                <div class="onboarding-item">
                  <span class="material-icons-outlined onboarding-item-icon updates-icon" aria-hidden="true">badge</span>
                  <div class="onboarding-item-text">
                    <strong>Daftar & Profil Katekumen:</strong> Halaman khusus untuk melihat daftar seluruh peserta kelas, katekis, kelompok KI, dan foto mereka.
                  </div>
                </div>
                <div class="onboarding-item">
                  <span class="material-icons-outlined onboarding-item-icon updates-icon" aria-hidden="true">layers</span>
                  <div class="onboarding-item-text">
                    <strong>Tampilan Informasi Rapi:</strong> Detail data katekumen kini langsung muncul di bagian bawah layar secara instan.
                  </div>
                </div>
              </div>
            </div>

            <div class="onboarding-section">
              <h3 class="onboarding-section-title removals-title">
                <span class="material-icons-outlined" aria-hidden="true">published_with_changes</span>
                Penyederhanaan Sistem
              </h3>
              <div class="onboarding-list">
                <div class="onboarding-item">
                  <span class="material-icons-outlined onboarding-item-icon removals-icon" aria-hidden="true">speed</span>
                  <div class="onboarding-item-text">
                    <strong>Buka Scanner Lebih Cepat:</strong> Topik pertemuan terakhir otomatis disimpan. Tidak perlu memilih ulang setiap membuka web.
                  </div>
                </div>
                <div class="onboarding-item">
                  <span class="material-icons-outlined onboarding-item-icon removals-icon" aria-hidden="true">navigation</span>
                  <div class="onboarding-item-text">
                    <strong>Navigasi Menu Simpel:</strong> Menu bawah layar baru memudahkan ganti halaman secara instan tanpa tombol ribet.
                  </div>
                </div>
              </div>
            </div>
          </div>
          <button class="onboarding-btn" id="onboarding-dismiss-btn">Mulai Gunakan</button>
        </div>
      `;
      document.body.appendChild(modal);

      document.getElementById('onboarding-dismiss-btn').onclick = () => closeOnboardingModal(null);
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
git commit -m "feat: create onboarding logic script"
```

---

### Task 2: Create the Onboarding Stylesheet

**Files:**
- Create: `public/onboarding.css`

- [ ] **Step 1: Write `public/onboarding.css`**
Create this file to define modal popup styling.

```css
/* Onboarding Modal Styles */
.onboarding-modal-content {
  max-height: 80vh !important;
  max-width: 460px;
  margin: auto;
  border-radius: 24px;
  padding: 1.5rem;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.25);
  animation: slideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  flex-direction: column;
}

.onboarding-header {
  text-align: center;
  margin-bottom: 1rem;
}

.onboarding-welcome-icon {
  font-size: 2.75rem;
  color: var(--accent);
  margin-bottom: 8px;
}

.onboarding-title {
  font-family: 'Cinzel', serif;
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0 0 6px 0;
  text-align: center !important;
}

.onboarding-subtitle {
  font-size: 0.8rem;
  color: var(--text-secondary);
  margin: 0;
  opacity: 0.9;
  text-align: center !important;
}

.onboarding-scroll-area {
  flex-grow: 1;
  overflow-y: auto;
  padding-right: 6px;
  margin-bottom: 1.25rem;
  border-top: 1px solid var(--border-glass);
  border-bottom: 1px solid var(--border-glass);
  padding-top: 1rem;
  padding-bottom: 1rem;
}

/* Custom scrollbar for scroll area */
.onboarding-scroll-area::-webkit-scrollbar {
  width: 5px;
}
.onboarding-scroll-area::-webkit-scrollbar-track {
  background: transparent;
}
.onboarding-scroll-area::-webkit-scrollbar-thumb {
  background: var(--border-glass);
  border-radius: 4px;
}

.onboarding-section {
  margin-bottom: 1.25rem;
}

.onboarding-section-title {
  font-size: 0.85rem;
  font-weight: 600;
  margin: 0 0 0.75rem 0;
  display: flex;
  align-items: center;
  gap: 6px;
  text-align: left !important;
}

.onboarding-section-title.updates-title {
  color: var(--accent);
}

.onboarding-section-title.removals-title {
  color: #f43f5e;
}

.onboarding-section-title span {
  font-size: 1.05rem;
}

.onboarding-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.onboarding-item {
  display: flex;
  gap: 10px;
  align-items: flex-start;
}

.onboarding-item-icon {
  font-size: 1.25rem;
  margin-top: 1px;
  flex-shrink: 0;
}

.onboarding-item-icon.updates-icon {
  color: var(--accent);
}

.onboarding-item-icon.removals-icon {
  color: #f43f5e;
}

.onboarding-item-text {
  font-size: 0.78rem;
  line-height: 1.4;
  color: var(--text-primary);
  text-align: left !important;
}

.onboarding-item-text strong {
  color: var(--text-primary);
  font-weight: 600;
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
}

.onboarding-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 20px var(--accent-glow);
}

.onboarding-btn:active {
  transform: translateY(0);
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
```

- [ ] **Step 2: Commit**
```bash
git add public/onboarding.css
git commit -m "style: create onboarding css styling"
```

---

### Task 3: Load Script in HTML and Revert Static Markup

**Files:**
- Modify: `public/index.html`

- [ ] **Step 1: Edit `public/index.html`**
1. Load `onboarding.js` by adding `<script src="onboarding.js" defer></script>` in the header (e.g. at line 219, right after `script.js`).
2. Remove any previously added static HTML markup for onboarding.

- [ ] **Step 2: Verify index.html**
View the file using `view_file` to ensure it looks clean and matches the specification.

- [ ] **Step 3: Commit**
```bash
git add public/index.html
git commit -m "feat: load onboarding script in HTML and revert static HTML modal"
```

---

### Task 4: Integrate Trigger Check in Main JS

**Files:**
- Modify: `public/script.js`

- [ ] **Step 1: Edit `public/script.js`**
Find `handleLogin()` where successful login loader hides and state transitions:
```javascript
        setTimeout(() => {
          sessionStorage.setItem('authToken', data.token);
          // Set the cookie for server-side middleware and profile page access
          document.cookie = `auth_token=${data.token}; path=/; max-age=28800; SameSite=Lax`;
          loginLoader.style.display = 'none';
          
          // Switch to Selection State
          setAppState(2);
          initializeApp();
        }, 250);
```
And update it to safely call `checkOnboarding()`:
```javascript
        setTimeout(() => {
          sessionStorage.setItem('authToken', data.token);
          // Set the cookie for server-side middleware and profile page access
          document.cookie = `auth_token=${data.token}; path=/; max-age=28800; SameSite=Lax`;
          loginLoader.style.display = 'none';
          
          // Switch to Selection State
          setAppState(2);
          initializeApp();

          // Safe trigger for onboarding
          if (typeof window.checkOnboarding === 'function') {
            window.checkOnboarding();
          }
        }, 250);
```

- [ ] **Step 2: Commit**
```bash
git add public/script.js
git commit -m "feat: safely call onboarding check after login"
```

---

### Task 5: Verify Decoupling and Version Bump

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Test the onboarding workflow**
1. Clear localStorage keys `hasSeenOnboardingV2`.
2. Login and confirm modal appears.
3. Dismiss modal and confirm `hasSeenOnboardingV2` is set and modal doesn't show again.

- [ ] **Step 2: Test Decoupling / Removability**
1. Rename `onboarding.js` to `onboarding.js.disabled` (or remove script tag in index.html).
2. Login and confirm that no errors are printed in the console and the app functions normally.
3. Restore script tag.

- [ ] **Step 3: Bump package version**
Bump version to `2.2.0` in `package.json`.

- [ ] **Step 4: Run build**
Run: `npm run build`
Ensure build passes.

- [ ] **Step 5: Commit changes**
```bash
git add package.json
git commit -m "chore: bump version to 2.2.0 for onboarding v2 modal feature"
```

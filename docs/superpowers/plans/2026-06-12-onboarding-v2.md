# User Onboarding Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a user onboarding modal popup overlay showing updates and simplifications, displayed automatically once after a successful login.

**Architecture:** Add a new modal overlay styled using glassmorphism in HTML. Implement JavaScript logic to check if the user is logged in and if they have not seen the onboarding modal before (tracked using `hasSeenOnboardingV2` in `localStorage`), displaying it automatically or hiding it when dismissed.

**Tech Stack:** HTML5, CSS3, Vanilla JS

---

### Task 1: Add HTML Markup for Onboarding Modal

**Files:**
- Modify: `public/index.html`

- [ ] **Step 1: Edit `public/index.html`**
Add the onboarding modal markup right before the closing `</body>` tag (e.g. before line 218).

```html
    <!-- Onboarding Modal -->
    <div id="onboarding-modal" class="student-modal" style="display: none;" onclick="closeOnboardingModal(event)">
      <div class="modal-content onboarding-modal-content" onclick="event.stopPropagation()">
        <!-- Welcome Header -->
        <div class="onboarding-header">
          <span class="material-icons-outlined onboarding-welcome-icon">celebration</span>
          <h2 class="onboarding-title">Selamat datang di Sistem Presensi v2</h2>
          <p class="onboarding-subtitle">Panduan singkat pembaruan aplikasi Anda:</p>
        </div>

        <!-- Scrollable content area -->
        <div class="onboarding-scroll-area">
          <!-- Feature Updates Section -->
          <div class="onboarding-section">
            <h4 class="onboarding-section-title updates-title">
              <span class="material-icons-outlined">auto_awesome</span>
              Fitur Baru yang Memudahkan
            </h4>
            <div class="onboarding-list">
              <div class="onboarding-item">
                <span class="material-icons-outlined onboarding-item-icon updates-icon">bolt</span>
                <div class="onboarding-item-text">
                  <strong>Scan QR Berturut-turut:</strong> Scan peserta berikutnya langsung tanpa jeda. Data otomatis dikirim di latar belakang.
                </div>
              </div>
              <div class="onboarding-item">
                <span class="material-icons-outlined onboarding-item-icon updates-icon">wifi_off</span>
                <div class="onboarding-item-text">
                  <strong>Simpan Offline Otomatis:</strong> Scan tetap jalan walau internet lambat/putus. Data aman dan terkirim otomatis saat online.
                </div>
              </div>
              <div class="onboarding-item">
                <span class="material-icons-outlined onboarding-item-icon updates-icon">badge</span>
                <div class="onboarding-item-text">
                  <strong>Daftar & Profil Katekumen:</strong> Halaman khusus untuk melihat daftar seluruh peserta kelas, katekis, kelompok KI, dan foto mereka.
                </div>
              </div>
              <div class="onboarding-item">
                <span class="material-icons-outlined onboarding-item-icon updates-icon">layers</span>
                <div class="onboarding-item-text">
                  <strong>Tampilan Informasi Rapi:</strong> Detail data katekumen kini langsung muncul di bagian bawah layar secara instan.
                </div>
              </div>
            </div>
          </div>

          <!-- Feature Removals/Simplifications Section -->
          <div class="onboarding-section">
            <h4 class="onboarding-section-title removals-title">
              <span class="material-icons-outlined">published_with_changes</span>
              Penyederhanaan Sistem
            </h4>
            <div class="onboarding-list">
              <div class="onboarding-item">
                <span class="material-icons-outlined onboarding-item-icon removals-icon">speed</span>
                <div class="onboarding-item-text">
                  <strong>Buka Scanner Lebih Cepat:</strong> Topik pertemuan terakhir otomatis disimpan. Tidak perlu memilih ulang setiap membuka web.
                </div>
              </div>
              <div class="onboarding-item">
                <span class="material-icons-outlined onboarding-item-icon removals-icon">navigation</span>
                <div class="onboarding-item-text">
                  <strong>Navigasi Menu Simpel:</strong> Menu bawah layar baru memudahkan ganti halaman secara instan tanpa tombol ribet.
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Dismiss Button -->
        <button class="onboarding-btn" onclick="closeOnboardingModal(null)">Mulai Gunakan</button>
      </div>
    </div>
```

- [ ] **Step 2: Verify `public/index.html`**
Check the structure of the HTML file using the view_file tool to ensure the markup was properly added without disrupting other code.

- [ ] **Step 3: Commit**
```bash
git add public/index.html
git commit -m "feat: add onboarding modal html markup"
```

---

### Task 2: Add CSS Rules for Onboarding Modal

**Files:**
- Modify: `public/style.css`

- [ ] **Step 1: Edit `public/style.css`**
Append styles for the onboarding modal at the bottom of the CSS file.

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
git add public/style.css
git commit -m "style: add styles for onboarding modal"
```

---

### Task 3: Implement JavaScript Lifecycle Logic

**Files:**
- Modify: `public/script.js`

- [ ] **Step 1: Add modal trigger functions**
Insert helper functions for opening and closing the onboarding modal in `public/script.js` (before `window.onload`).

```javascript
// --- USER ONBOARDING MODAL ---
window.openOnboardingModal = function() {
  const modal = document.getElementById('onboarding-modal');
  if (modal) {
    modal.style.display = 'flex';
  }
};

window.closeOnboardingModal = function(event) {
  if (event && event.stopPropagation) {
    event.stopPropagation();
  }
  const modal = document.getElementById('onboarding-modal');
  if (modal) {
    modal.style.display = 'none';
    localStorage.setItem('hasSeenOnboardingV2', 'true');
  }
};
```

- [ ] **Step 2: Add check in `window.onload`**
Update `window.onload` to trigger the onboarding modal if the user is logged in but has not seen it yet.
Find the block:
```javascript
  const sessionToken = sessionStorage.getItem('authToken');
  if (sessionToken) {
    // ...
    setAppState(2); // Set to scanner page initially
    initializeApp();
  } else {
    setAppState(0); // Authentication screen
  }
```
And change it to:
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

    // Trigger onboarding if not seen yet
    if (!localStorage.getItem('hasSeenOnboardingV2')) {
      setTimeout(() => {
        window.openOnboardingModal();
      }, 600);
    }
  } else {
    setAppState(0); // Authentication screen
  }
```

- [ ] **Step 3: Add check in successful login flow**
Update `handleLogin()` to trigger the onboarding modal right after login and transitioning state.
Find the block:
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
And change it to:
```javascript
        setTimeout(() => {
          sessionStorage.setItem('authToken', data.token);
          // Set the cookie for server-side middleware and profile page access
          document.cookie = `auth_token=${data.token}; path=/; max-age=28800; SameSite=Lax`;
          loginLoader.style.display = 'none';
          
          // Switch to Selection State
          setAppState(2);
          initializeApp();

          // Trigger onboarding if not seen yet
          if (!localStorage.getItem('hasSeenOnboardingV2')) {
            setTimeout(() => {
              window.openOnboardingModal();
            }, 600);
          }
        }, 250);
```

- [ ] **Step 4: Verify `public/script.js` changes**
Inspect `public/script.js` using `view_file` to verify the code edits.

- [ ] **Step 5: Commit**
```bash
git add public/script.js
git commit -m "feat: implement onboarding modal check and triggering logic"
```

---

### Task 4: Verify System Behavior

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Test logout and login**
Run local development mode if needed.
1. Clear localStorage keys `hasSeenOnboardingV2`.
2. Refresh app, confirm modal appears automatically.
3. Click "Mulai Gunakan" and confirm it closes and sets the key in localStorage.
4. Refresh and verify the modal no longer appears.

- [ ] **Step 2: Bump version in `package.json`**
Bump `version` in `package.json` to `2.2.0`.

- [ ] **Step 3: Build verification**
Run: `npm run build`
Ensure build passes without error.

- [ ] **Step 4: Commit version bump**
```bash
git add package.json
git commit -m "chore: bump version to 2.2.0 for onboarding experience"
```

# Design Spec: User Onboarding Experience (Selamat datang di Sistem Presensi v2)

## 1. Overview
Introduce a clean, non-technical, and visual onboarding experience for facilitators upon their first login to version 2 of the application. The onboarding is implemented as a completely decoupled and dynamically injected modal module to ensure it can be easily removed in the future after users have become familiar with the system.

## 2. Goals & Constraints
* **Welcome Screen:** Display "Selamat datang di Sistem Presensi v2" as the header.
* **Feature Logs:** Present feature updates and simplifications with Material Icons and clear non-technical wording.
* **Frequency:** Display automatically *only once* after successful login. Once dismissed, store a flag in `localStorage` to prevent it from showing again.
* **Removability:** Structure the feature in separate files (`public/onboarding.js` and `public/onboarding.css`) that are dynamically loaded. The main codebase should only contain a fallback check, making complete removal as simple as deleting these files and their references.
* **Aesthetics:** Follow the app's existing "Liquid Glass" visual language (glassmorphism, subtle gradients, and dark/light mode compatibility).

---

## 3. Detailed Design

### 3.1. Decoupled Architecture
To make the feature easily removable:
1. **Dynamic Injection:** All onboarding HTML markup is defined as a template string inside `public/onboarding.js`. This script checks the session/local storage on load and login, and injects both the stylesheet (`public/onboarding.css`) and the modal (`#onboarding-modal`) directly into the DOM only if required.
2. **Dedicated CSS:** All styling for the onboarding experience resides in `public/onboarding.css`.
3. **Safe Global Check:** The main application in `public/script.js` calls `window.checkOnboarding()` using a safe typeof check: `if (typeof window.checkOnboarding === 'function') window.checkOnboarding();`. If the files are deleted, the application continues to run without errors.

### 3.2. UI Layout & Content (HTML Template in JS)
The injected onboarding modal is structured identically to the other app modals (like the student details modal) to ensure style consistency.

* **Dismiss Button:** "Mulai Gunakan" at the bottom of the modal.
* **Content Sections:**
  * **Header:** Celebration icon + "Selamat datang di Sistem Presensi v2".
  * **Fitur Baru yang Memudahkan (Feature Updates):**
    * ⚡ **Scan QR Berturut-turut:** Scan peserta berikutnya langsung tanpa jeda. Data otomatis dikirim di latar belakang.
    * 📶 **Simpan Offline Otomatis:** Scan tetap jalan walau internet lambat/putus. Data aman dan terkirim otomatis saat online.
    * 👤 **Daftar & Profil Katekumen:** Halaman khusus untuk melihat daftar seluruh peserta kelas, katekis, kelompok KI, dan foto mereka.
    * 📱 **Tampilan Detail Rapi:** Info katekumen yang baru di-scan kini langsung muncul di bagian bawah layar secara instan.
  * **Penyederhanaan Sistem (Feature Removals/Simplifications):**
    * 🚀 **Buka Scanner Lebih Cepat:** Topik pertemuan terakhir otomatis disimpan. Tidak perlu memilih ulang setiap membuka web.
    * 🗺️ **Navigasi Menu Simpel:** Menu bawah layar baru memudahkan ganti halaman secara instan tanpa tombol ribet.

---

## 4. Proposed Changes

### 4.1. `public/index.html`
* Load `public/onboarding.js` at the bottom of the head or body with `defer`:
  ```html
  <script src="onboarding.js" defer></script>
  ```
* Remove any static onboarding HTML from the main index file.

### 4.2. `public/onboarding.css`
* Dedicated style definitions for the onboarding modal overlay, container, headers, list spacing, and buttons.

### 4.3. `public/onboarding.js`
* Self-executing function that:
  - Hooks into DOM loading.
  - Dynamically injects `public/onboarding.css` and the `#onboarding-modal` HTML.
  - Exposes `window.checkOnboarding` to check if a token is present and the modal should open.
  - Handles dismissal via `closeOnboardingModal(event)` which sets `hasSeenOnboardingV2` in `localStorage`.

### 4.4. `public/script.js`
* Call `window.checkOnboarding()` safely inside the successful login callback and onload logic.

---

## 5. Verification Plan
* **Manual Verification:**
  1. Open the app in a new session (logged out). Confirm no onboarding modal appears.
  2. Log in with password. Confirm the onboarding modal immediately appears.
  3. Click "Mulai Gunakan" and confirm it closes and sets the key in localStorage.
  4. Refresh the page or log out/in. Confirm it does not display again.
  5. **Removal Test:** Comment out `<script src="onboarding.js" defer></script>` in `public/index.html` and verify the app runs perfectly without console errors.

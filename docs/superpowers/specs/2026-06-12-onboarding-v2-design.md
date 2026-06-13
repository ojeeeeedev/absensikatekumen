# Design Spec: User Onboarding Experience (Selamat datang di Sistem Presensi v2)

## 1. Overview
Introduce a clean, non-technical, and visual onboarding experience for facilitators upon their first login to version 2 of the application. The onboarding is implemented as a completely decoupled, dynamically injected modal module to ensure it can be easily removed in the future. In this revision, each individual changelog item (row) behaves as its own expandable accordion/dropdown to keep the layout extremely clean, with all items defaulting to a closed state.

## 2. Goals & Constraints
* **Welcome Screen:** Display "Selamat datang di Sistem Presensi v2" as the header in **Inter** font (sans-serif), removing any subtitles.
* **Branding:** Use a small Pewartaan logo image (`assets/pewartaan_normal.png`) at the top instead of a material icon.
* **Feature Logs (Row-by-Row Accordions):**
  * Present feature updates and simplifications with Material Icons and titles.
  * Every row is an accordion: tapping the row expands it to reveal its description.
  * Default to all accordions in the closed state initially.
  * Use a light shade of blue (sky blue) for all highlighting and icons, removing red color schemes completely.
* **Frequency:** Display automatically *only once* after successful login. Once dismissed, store a flag in `localStorage` to prevent it from showing again.
* **Removability:** Structure the feature in separate files (`public/onboarding.js` and `public/onboarding.css`) that are dynamically loaded. The main codebase should only contain a fallback check, making complete removal as simple as deleting these files and their references.
* **Aesthetics & Width:** Follow the app's existing "Liquid Glass" visual language. Set the onboarding modal's width to `width: 90%; max-width: 400px; margin: auto;` so it floats centered with clear gaps on the left and right edges on mobile screens.

---

## 3. Detailed Design

### 3.1. Decoupled Architecture
1. **Dynamic Injection:** All onboarding HTML markup is defined as a template string inside `public/onboarding.js`. This script checks the session/local storage on load and login, and injects both the stylesheet (`public/onboarding.css`) and the modal (`#onboarding-modal`) directly into the DOM only if required.
2. **Dedicated CSS:** All styling for the onboarding experience resides in `public/onboarding.css`.
3. **Safe Global Check:** The main application in `public/script.js` calls `window.checkOnboarding()` using a safe typeof check: `if (typeof window.checkOnboarding === 'function') window.checkOnboarding();`. If the files are deleted, the application continues to run without errors.

### 3.2. UI Layout & Content (HTML Template in JS)
The injected onboarding modal is structured identically to the other app modals (like the student details modal) to ensure style consistency.

* **Logo:** Pewartaan Logo (`assets/pewartaan_normal.png`).
* **Header:** "Selamat datang di Sistem Presensi v2" (font-family: 'Inter', sans-serif).
* **Dismiss Button:** "Mulai Gunakan" at the bottom of the modal.
* **Content Sections (Row-by-Row Accordion List):**
  * **Fitur Baru yang Memudahkan (Feature Updates):**
    * ⚡ **Scan QR Berturut-turut:** Scan peserta berikutnya langsung tanpa jeda. Data otomatis dikirim di latar belakang.
    * 📶 **Simpan Offline Otomatis:** Scan tetap jalan walau internet lambat/putus. Data aman dan terkirim otomatis saat online.
    * 👤 **Daftar & Profil Katekumen:** Halaman khusus untuk melihat daftar seluruh peserta kelas, katekis, kelompok KI, dan foto mereka.
    * 📱 **Tampilan Detail Rapi:** Detail data katekumen kini langsung muncul di bagian bawah layar secara instan.
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

### 4.2. `public/onboarding.css`
* Dedicated styles for `.onboarding-modal-content`, `.preview-logo`, `.preview-title`, accordion items (`.row-accordion`), headers (`.row-accordion-header`), chevrons (`.chevron`), and text alignment.

### 4.3. `public/onboarding.js`
* Self-executing IIFE that:
  - Hooks into DOM loading.
  - Dynamically injects `public/onboarding.css` and the `#onboarding-modal` HTML.
  - Exposes `window.checkOnboarding` to check if a token is present and the modal should open.
  - Handles dismissal via `closeOnboardingModal(event)` which sets `hasSeenOnboardingV2` in `localStorage`.
  - Implements accordion expand/collapse logic `toggleOnboardingRow(id)` which opens/closes individual item rows and closes any other open row in the list.

### 4.4. `public/script.js`
* Call `window.checkOnboarding()` safely inside the successful login callback and onload logic.

---

## 5. Verification Plan
* **Manual Verification:**
  1. Open the app in a new session (logged out). Confirm no onboarding modal appears.
  2. Log in with password. Confirm the onboarding modal immediately appears.
  3. Verify modal layout: does not touch left/right edges of screen, uses Pewartaan logo, and uses Inter font for title without any subtitles.
  4. Verify that all accordions are closed by default.
  5. Tap different rows: verify they expand smoothly and show descriptions. Tap a different row: verify it closes the previously open row (accordion behavior).
  6. Click "Mulai Gunakan" and confirm it closes and sets the key in localStorage.
  7. Refresh the page or log out/in. Confirm it does not display again.

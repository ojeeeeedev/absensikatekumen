# Design Spec: User Onboarding Experience (Selamat datang di Sistem Presensi v2)

## 1. Overview
Introduce a clean, non-technical, and visual onboarding experience for facilitators upon their first login to version 2 of the application. The onboarding is implemented as a modal overlay displaying major functional updates and simplifications with visual icons and direct descriptions, avoiding technical jargon.

## 2. Goals & Constraints
* **Welcome Screen:** Display "Selamat datang di Sistem Presensi v2" as the header.
* **Feature Logs:** Present feature updates and removals clearly with illustrative Material Icons.
* **Frequency:** Display automatically *only once* after successful login. Once dismissed, store a flag in `localStorage` to prevent it from showing again.
* **Aesthetics:** Follow the app's existing "Liquid Glass" visual language (glassmorphism, subtle gradients, and dark/light mode compatibility).

---

## 3. Detailed Design

### 3.1. UI Layout & Content (HTML & CSS)
The onboarding modal is structured identically to the other app modals (like the student details modal) to ensure style consistency.

* **Trigger Button:** "Mulai Gunakan" at the bottom of the modal.
* **Content Sections:**
  * **Header:** Celebration icon + "Selamat datang di Sistem Presensi v2".
  * **Fitur Baru yang Memudahkan (Feature Updates):**
    * ⚡ **Scan QR Berturut-turut:** Scan peserta berikutnya langsung tanpa jeda. Data otomatis dikirim di latar belakang.
    * 📶 **Simpan Offline Otomatis:** Scan tetap jalan walau internet lambat/putus. Data aman dan terkirim otomatis saat online.
    * 👤 **Daftar & Profil Katekumen:** Halaman khusus untuk melihat daftar seluruh peserta kelas, katekis, kelompok KI, dan foto mereka.
    * 📱 **Tampilan Detail Rapi:** Info katekumen yang baru di-scan kini muncul di bagian bawah layar secara instan.
  * **Penyederhanaan Sistem (Feature Removals/Simplifications):**
    * 🚀 **Buka Scanner Lebih Cepat:** Topik pertemuan terakhir otomatis disimpan. Tidak perlu memilih ulang setiap membuka web.
    * 🗺️ **Navigasi Menu Simpel:** Menu bawah layar baru memudahkan ganti halaman secara instan tanpa tombol ribet.

### 3.2. Behavioral Logic (JavaScript)
* **Local Storage Key:** `hasSeenOnboardingV2`
* **Triggering Flow:**
  1. On page load or successful login:
     * Check if a valid session token exists in `sessionStorage.getItem('authToken')`.
     * If logged in, check if `localStorage.getItem('hasSeenOnboardingV2')` is set.
     * If the key does not exist, open the onboarding modal automatically.
  2. Clicking "Mulai Gunakan" (Dismiss button):
     * Set `localStorage.setItem('hasSeenOnboardingV2', 'true')`.
     * Fade out and close the modal.

---

## 4. Proposed Changes

### 4.1. `public/index.html`
* Add modal structure right before `</body>`.

### 4.2. `public/style.css`
* Style definitions for onboarding modal, sections, icon grid layouts, and custom scrollbar styles for the content container.

### 4.3. `public/script.js`
* Helper functions `openOnboardingModal()` and `closeOnboardingModal()`.
* Integrate check in the `window.onload` script and within the successful login callback.

---

## 5. Verification Plan
* **Manual Verification:**
  1. Open the app in a new session (logged out). Confirm no onboarding modal appears.
  2. Log in with password. Confirm the onboarding modal immediately appears with correct headers and bullet points.
  3. Inspect CSS layout for alignment, responsiveness, and icons.
  4. Click "Mulai Gunakan" and confirm it closes smoothly.
  5. Refresh the page or log out and back in. Confirm that the onboarding modal does not display again.

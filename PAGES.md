# UI Pages, Components, and Modals

This document lists all the UI elements present in the **Presensi Katekumen Digital** application.

## 1. Views / Pages

### A. Login View (`#login-container`)
The initial screen shown to the user (facilitator).
- **Header:** "Login Fasilitator" title.
- **Error Box:** `#login-error-box` - Floating error message for incorrect credentials.
- **Input Field:** Password input with integrated toggle.
- **Components:**
  - `password-toggle`: Eye icon to reveal/hide password.
  - `login-success-icon`: Green checkmark shown upon successful authentication.
  - `login-btn`: Main action button.
- **Footer:** `#login-footer` with "Lupa password?" link.

### B. Scanner View (`#scanner-ui`)
The main interface for attendance processing, shown after a successful login.
- **Header:** Organization logo and titles (Paroki St. Petrus).
- **Topic Selector:** `#topic-trigger` - Button that shows the currently selected week/topic.
- **Scanner Component:** `#reader-container` - Integrated QR code scanner with a loading spinner for initialization.
- **Status Indicator:** `#status` - Dynamic bar that shows the current state (Idle, Processing, Success, Error).
- **Footer:** `#app-footer` with versioning and help links.

---

## 2. Modals

### A. Topic Selection Modal (`#topic-modal`)
Triggered by clicking the Topic Selector.
- **Header:** "Pilih Topik Pertemuan" title.
- **Search Bar:** `#topic-search-input` for filtering topics.
- **List Container:** `#topic-list-container` - Dynamically populated list of meeting topics.
- **Close Button:** Manual close button at the bottom.

### B. Student Profile Modal (`#profile-modal`)
Triggered automatically after a successful scan.
- **Countdown Spinner:** Visual SVG ring that indicates when the modal will auto-close.
- **Image Wrapper:** Circular frame for the student's profile picture from Supabase.
- **Details:**
  - `#profile-name`: Student's full name.
  - `#profile-id`: Student ID and the current Topic.
- **Close Button:** Manual override to close the card.

---

## 3. Global Components

- **Liquid Background:** Animated background layers (`.liquid-shape`).
- **Loading Overlay:** `#login-loader` - Full-screen spinner shown during authentication and state transitions.
- **Bottom Branding:** `#bottom-branding` - Fixed footer showing sub-section and parish details (hidden on certain views).
- **Glass Container:** Main `.glass-container` wrapper that provides the frosted-glass aesthetic to all views.

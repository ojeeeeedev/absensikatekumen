# Design Spec: Login Screen Refinements

This specification describes the changes to refine the login screen layout on the homepage. The goal is to create a more integrated, clean, and balanced interface by moving the branding inside the login card, removing redundant titles, and polishing action buttons.

## 1. Requirements

### A. Branding Header Integration
* Move the bottom-fixed branding (`#bottom-branding`) containing the logo and subseksi details into the header of the login container (`#login-section`), replacing the large header logo (`.login-header-logo`).
* Position the small logo image (`width="48" height="48"`) and the branding text side-by-side.
* Eliminate the bottom-fixed branding element from the bottom of the page in `index.html` (since it is now integrated into the card).
* Ensure the branding layout looks consistent and premium in both light and dark modes.

### B. Heading Cleanup
* Remove the "Login" title (`h2.login-header-title`) completely to make the container more concise and clean.

### C. Spacing & Alignment
* Adjust the gap below the new header branding to `1.25rem` (20px) to match the container's internal padding.
* No horizontal line or divider bar should be placed beneath the branding header.

### D. Action Button Polish
* Remove the bold font styling from the "Masuk" button (unbold the text).
* Add a Material Icon span containing `arrow_circle_right` inside the button, side-by-side with the "Masuk" text.
* Style the button as a flex container to center the text and icon horizontally with a small gap (`gap: 8px`).

---

## 2. Proposed Changes

### A. HTML Changes (`public/index.html`)

Modify the `#login-section` panel:
```html
<div id="login-section" class="app-section">
  <!-- 1. Integrated Branding Header (replacing large logo) -->
  <div class="login-header-branding">
    <img src="assets/pewartaan_normal.png" alt="Logo Pewartaan" width="48" height="48" class="theme-logo" onclick="toggleTheme()" style="cursor: pointer;">
    <div class="branding-text">
      <div style="font-weight: bold;">Subseksi Katekumen Dewasa</div>
      <div>Paroki St. Petrus - Katedral</div>
      <div>Keuskupan Bandung</div>
    </div>
  </div>

  <!-- Note: h2.login-header-title is removed -->

  <div id="login-error-box" class="login-error-message" style="display: none;" onmouseover="hideLoginError()"></div>
  
  <div class="input-wrapper">
    <label for="login-input" class="sr-only">Password</label>
    <input type="password" id="login-input" placeholder="Masukkan password..." onkeydown="if(event.key==='Enter') handleLogin()" oninput="hideLoginError()">
    <span id="login-success-icon" class="material-icons-outlined" style="display: none;">check_circle</span>
    <span id="password-toggle" class="material-icons-outlined password-toggle-icon" onclick="togglePasswordVisibility()" role="button" tabindex="0" aria-label="Tampilkan password" aria-pressed="false" onkeydown="if(event.key === ' ' || event.key === 'Enter') { event.preventDefault(); togglePasswordVisibility(); }">visibility_off</span>
  </div>

  <!-- 2. Unbolded Button text with icon -->
  <button id="login-btn" onclick="handleLogin()">
    <span>Masuk</span>
    <span class="material-icons-outlined">arrow_circle_right</span>
  </button>
  
  <div id="login-footer">
    <a href="https://wa.link/3yg0ug">Lupa password?</a>
  </div>
</div>
```

Remove the legacy bottom fixed branding markup from `public/index.html` (lines 172-180):
```html
<!-- This block is removed -->
<div id="bottom-branding" class="fixed-bottom-branding">
  ...
</div>
```

---

### B. CSS Changes (`public/style.css`)

1. **Remove large logo styles and add integrated branding styles:**
Replace `.login-header-logo` and `.logo-large` with `.login-header-branding` styles:
```css
.login-header-branding {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 1.25rem;
}
.login-header-branding img {
  margin-right: 12px;
}
```

2. **Remove `.login-header-title` styles:**
We can keep or delete it, but since it is no longer used, we can safely delete or keep it as legacy.

3. **Update `#login-btn` to use flex and align center:**
```css
#login-btn {
  width: 100%; padding: 0.85rem; background: var(--accent); color: white;
  border: none; border-radius: 12px; font-size: 1rem; font-weight: 500;
  cursor: pointer; display: flex; align-items: center; justify-content: center;
  gap: 8px; margin-bottom: 1rem;
  box-shadow: 0 4px 12px var(--accent-glow);
}
```

4. **Disable absolute bottom display rule in state auth:**
Remove or comment out the rule showing the bottom branding outside the container:
```css
/* Remove this:
.glass-container.state-auth ~ #bottom-branding { display: flex; }
*/
```

---

## 3. Verification & Testing

* **Visual inspection:** Ensure that the login card renders with the branding banner perfectly sized and positioned in the card's header, followed immediately by the password input and the unbolded "Masuk" button with its circle-arrow icon.
* **Theme switching:** Clicking on the logo in the header branding should toggle the theme between light and dark modes successfully, swapping the image to `assets/pewartaan_invert.png` in dark mode.
* **Layout responsiveness:** Check that the card is centered and fully fits on standard mobile viewport sizes without vertical clipping.

# Login Screen Refinements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refine the login screen layout by moving the branding inside the login container, removing the "Login" heading, and polishing the "Masuk" button with an arrow icon.

**Architecture:** Integrate the branding header directly into the `#login-section` flow in HTML. Style it to align logo and text side-by-side using CSS flexbox. Clean up layout styles by removing the old absolute-bottom branding logic.

**Tech Stack:** HTML5, Vanilla CSS3

---

### Task 1: HTML Structure Update

**Files:**
* Modify: `public/index.html`

- [ ] **Step 1: Replace header logo and remove title in index.html**

Open [public/index.html](file:///Users/andarpartogi/repo/absensikatekumen/public/index.html) and locate `#login-section` (lines 72-88). Remove the `<div class="login-header-logo">` block and the `<h2 class="login-header-title">Login</h2>` title, and replace them with the new `.login-header-branding` block:

```html
      <div id="login-section" class="app-section">
        <div class="login-header-branding">
          <img src="assets/pewartaan_normal.png" alt="Logo Pewartaan" width="48" height="48" class="theme-logo" onclick="toggleTheme()" style="cursor: pointer;">
          <div class="branding-text">
            <div style="font-weight: bold;">Subseksi Katekumen Dewasa</div>
            <div>Paroki St. Petrus - Katedral</div>
            <div>Keuskupan Bandung</div>
          </div>
        </div>
        <div id="login-error-box" class="login-error-message" style="display: none;" onmouseover="hideLoginError()"></div>
```

- [ ] **Step 2: Update the login button to use unbolded text with an icon**

In the same `#login-section` block, change the `<button id="login-btn">` content:

```html
        <button id="login-btn" onclick="handleLogin()">
          <span>Masuk</span>
          <span class="material-icons-outlined">arrow_circle_right</span>
        </button>
```

- [ ] **Step 3: Remove the old bottom-fixed branding element**

Locate the `#bottom-branding` element at the end of `public/index.html` (lines 172-180):

```html
    <!-- Bottom Fixed Branding (Only visible on login screen) -->
    <div id="bottom-branding" class="fixed-bottom-branding">
      <img src="assets/pewartaan_normal.png" alt="Logo Pewartaan" width="48" height="48" style="margin-right: 12px; cursor: pointer;" class="theme-logo" onclick="toggleTheme()">
      <div class="branding-text">
        <div style="font-weight: bold;">Subseksi Katekumen Dewasa</div>
        <div>Paroki St. Petrus - Katedral</div>
        <div>Keuskupan Bandung</div>
      </div>
    </div>
```

Delete this block completely from the file.

- [ ] **Step 4: Commit**

```bash
git add public/index.html
git commit -m "feat(login): update index.html structure for integrated branding and button arrow icon"
```

---

### Task 2: CSS Styling Update

**Files:**
* Modify: `public/style.css`

- [ ] **Step 1: Replace header logo classes with branding container styles**

Open [public/style.css](file:///Users/andarpartogi/repo/absensikatekumen/public/style.css) and search for `.login-header-logo` and `.logo-large` (around lines 202-209):

```css
.login-header-logo {
  text-align: center; margin-bottom: 1.5rem;
}
.logo-large {
  height: 80px; width: auto;
  filter: drop-shadow(0 4px 6px rgba(0,0,0,0.1));
}
```

Replace them with:

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

- [ ] **Step 2: Remove `.login-header-title` rule**

Delete the `.login-header-title` selector style rules (around lines 210-213) as it is no longer used:

```css
.login-header-title {
  font-family: 'Cinzel', serif; font-size: 1.5rem; font-weight: 500;
  text-align: center; margin-bottom: 1.5rem; color: var(--text-primary);
}
```

- [ ] **Step 3: Update login button to use flex alignment and unbolded text**

Search for `#login-btn` (around lines 239-247):

```css
#login-btn {
  width: 100%; padding: 0.85rem; background: var(--accent); color: white;
  border: none; border-radius: 12px; font-size: 1rem; font-weight: 600;
  cursor: pointer; text-align: center; margin-bottom: 1rem;
  box-shadow: 0 4px 12px var(--accent-glow);
}
#login-btn:hover {
  background: var(--accent-hover);
}
```

Replace with:

```css
#login-btn {
  width: 100%; padding: 0.85rem; background: var(--accent); color: white;
  border: none; border-radius: 12px; font-size: 1rem; font-weight: 500;
  cursor: pointer; display: flex; align-items: center; justify-content: center;
  gap: 8px; margin-bottom: 1rem;
  box-shadow: 0 4px 12px var(--accent-glow);
}
#login-btn:hover {
  background: var(--accent-hover);
}
```

- [ ] **Step 4: Remove the bottom branding display rule**

Locate the following display trigger rule (around line 189):

```css
.glass-container.state-auth ~ #bottom-branding { display: flex; }
```

Remove it from `public/style.css`.

- [ ] **Step 5: Run tests and verify the UI looks correct**

1. Run the Express dev server if not already running: `npm run dev`
2. Open `http://localhost:5500` in your browser.
3. Confirm the login container displays the branding banner in the header correctly.
4. Verify the margin under the branding matches the card's padding.
5. Verify the "Masuk" button has normal font-weight and displays the circle-arrow icon centered next to the text.
6. Verify there is no branding logo or banner at the bottom of the page outside the card.
7. Click the logo in the header branding to verify that theme switching works (swaps theme and updates logo color/invert).

- [ ] **Step 6: Commit**

```bash
git add public/style.css
git commit -m "style(login): add header branding and unbolded button styles"
```

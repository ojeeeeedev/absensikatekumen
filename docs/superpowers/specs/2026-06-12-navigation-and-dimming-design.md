# Spec: Frontend Navigation & Scanner-First Workflow

## Status
Approved

## Date
2026-06-12

## Author
Antigravity Coding Assistant

---

## 1. Objective
To streamline user experience by bypassing the initial topic selection screen and launching directly into the scanner view. To prevent scanning without a selected topic, we will dim the rest of the scanning interface (including disabling camera startup) until a topic is selected. Additionally, a top Navigation Bar will be added to easily toggle between Scan Presensi and Profil Katekumen.

## 2. Requirements & Constraints
* **NavBar Visibility**: The top navigation bar must only be visible when the user is logged in.
* **Initial State**: Upon login or load, skip the selection state (State 1) and go directly to the scanning state (State 2).
* **Dimming Overlay**: If no topic is selected (`selectedWeek === null`):
  * Do not initialize/start the camera.
  * Set a placeholder text on the camera view and active topic bar.
  * Dim all scanner elements except the active topic bar.
  * Disable user interaction on dimmed elements.
* **eviction/restoration**: Once a topic is picked:
  * Remove dimming from all elements.
  * Auto-initialize the camera.

## 3. Implementation Details

### 3.1 CSS Addition (`public/style.css`)
```css
/* Navigation Bar */
.app-nav {
  display: flex;
  background: var(--bg-hover);
  border: 1px solid var(--border-glass);
  border-radius: 12px;
  padding: 4px;
  margin-bottom: 1.25rem;
  gap: 4px;
}

.nav-item {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 0.6rem 1rem;
  border-radius: 8px;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-secondary);
  text-decoration: none;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.nav-item span.material-icons-outlined {
  font-size: 1.15rem;
}

.nav-item:hover {
  color: var(--text-primary);
  background: rgba(255, 255, 255, 0.05);
}

.nav-item.active {
  color: #fff;
  background: var(--accent);
  box-shadow: 0 4px 12px var(--accent-glow);
}

/* Dimming Overlay for Topic Not Selected */
.needs-topic #reader-container,
.needs-topic #status,
.needs-topic #queue-warning-bar,
.needs-topic #queue-history-panel,
.needs-topic .app-nav {
  opacity: 0.2;
  pointer-events: none;
  filter: blur(1.5px);
  transition: all 0.3s ease;
}

.needs-topic .active-topic-bar {
  border-color: var(--accent);
  box-shadow: 0 0 15px var(--accent-glow);
  animation: pulse-border 2s infinite;
}

@keyframes pulse-border {
  0% { box-shadow: 0 0 0 0 var(--accent-glow); }
  70% { box-shadow: 0 0 0 8px rgba(162, 123, 222, 0); }
  100% { box-shadow: 0 0 0 0 rgba(162, 123, 222, 0); }
}
```

### 3.2 HTML Changes
* **`public/index.html`**:
  * Insert `<nav class="app-nav">` inside `#main-app-section` before `#selection-panel` or `.header-container`.
* **`public/profile.html`**:
  * Insert `<nav class="app-nav">` above `.header-container`.
  * Delete the redundant bottom button `Kembali ke Presensi` at line 54.

### 3.3 JS Changes (`public/script.js`)
* In `window.onload` (line 889) and `handleLogin` (line 155), replace `setAppState(1)` with `setAppState(2)`.
* In `setAppState(state)`:
  * Check `if (!selectedWeek)`:
    * Add `.needs-topic` class to container.
    * Set `#active-topic-name` to `"Ketuk di sini untuk memilih topik..."`.
    * Show placeholder inside `#camera-loader` instead of starting the camera.
  * Otherwise:
    * Remove `.needs-topic` class.
    * Run `startScanner()` to turn on the camera.
* In `handleScan()`, remove `setAppState(1)` from the topic check safeguard.

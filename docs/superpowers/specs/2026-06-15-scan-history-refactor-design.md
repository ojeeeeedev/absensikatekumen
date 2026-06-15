# Design Spec: Scan History Refactoring

This specification describes the changes to refactor the scan history feature in the **Presensi Katekumen Digital** application. The goal is to optimize the mobile layout using a horizontal carousel, make the sync queue bar persistent, show scan counters, and replace the large "Hapus Riwayat Scan" button with a compact trash can icon on the right.

## 1. Requirements

### A. Horizontal Scan History Carousel (Points 1 & 2)
* Refactor the vertical list into a horizontal-scrolling list of cards.
* Cards will be snap-aligned (`scroll-snap-type: x mandatory` on the container, `scroll-snap-align: center` on the card row).
* Tune card styling so that each card takes up the width of the container, simulating a carousel effect.
* Hide the horizontal scrollbar.
* Add pagination dots below the carousel to indicate the position of the currently visible card.
* Update dots dynamically based on the scroll position of the carousel.

### B. Persistent Sync Queue Bar (Point 3)
* The sync queue warning bar (`#queue-warning-bar`) will be persistently displayed rather than hiding when the queue is empty.
* **Syncing state:** Displays progress ("X/Y Selesai"), active progress bar fill, and the spinning loader with warning (orange) colors.
* **Idle state:** Displays a success message ("Semua data tersinkronisasi"), 100% progress bar, a cloud check icon, and success (green) colors.

### C. Scan Counters (Point 4)
* Add a counters header section above the carousel.
* Display three separate counter pills representing:
  * **Sukses** (Green check icon + count)
  * **Rescan** (Orange refresh icon + count)
  * **Gagal** (Red close icon + count)
* These counters will update automatically when the queue state changes.

### D. Sleek Trash Can Button (Point 5)
* Place a compact trash can icon button (`#history-trash-btn`) on the right side of the scan history container (aligned with the counters header).
* Only render/display this button once at least one scan has been conducted.
* Maintain the double-click confirmation workflow:
  * Click 1: Button expands or changes color to warn the user (e.g. shows red background or trash can changes state).
  * Click 2: Clears all completed scans from history.
  * Auto-collapses after 4 seconds of inactivity.

---

## 2. Proposed Changes

### A. HTML Changes (`public/index.html`)

Modify the `#queue-history-panel` section:
```html
          <!-- Queue History List -->
          <div id="queue-history-panel">
            <!-- Header Row with Counters and Trash Can -->
            <div id="history-header" class="history-header-row" style="display: none;">
              <div class="history-counters">
                <span id="counter-success" class="counter-badge success">
                  <span class="material-icons-outlined">check</span>
                  <span class="count-value">0</span>
                </span>
                <span id="counter-duplicate" class="counter-badge duplicate">
                  <span class="material-icons-outlined">refresh</span>
                  <span class="count-value">0</span>
                </span>
                <span id="counter-error" class="counter-badge error">
                  <span class="material-icons-outlined">close</span>
                  <span class="count-value">0</span>
                </span>
              </div>
              <button id="history-trash-btn" class="compact-trash-btn" aria-label="Hapus riwayat pemindaian" onclick="handleTrashClick(event)">
                <span class="material-icons-outlined icon-default">delete_outline</span>
                <span class="material-icons-outlined icon-confirm">delete_forever</span>
              </button>
            </div>

            <!-- Carousel Wrapper -->
            <div class="carousel-container">
              <div id="queue-list" class="queue-list-container horizontal-carousel">
                <!-- Dynamically populated via script -->
                <div class="queue-empty-state">Belum ada data pemindaian.</div>
              </div>
            </div>

            <!-- Carousel Pagination Dots -->
            <div id="carousel-dots" class="carousel-dots-container" style="display: none;"></div>
          </div>
```

---

### B. JS Changes (`public/script.js`)

1. **Modify `ScanQueue` constructor and `save()`**:
   - Ensure the counters and header visibility are updated on save/render.

2. **Update `updateBanner()`**:
   - Make `#queue-warning-bar` always visible (`display: flex`).
   - If `pendingCount > 0`, apply the warning classes/styles.
   - If `pendingCount === 0`, apply the success classes/styles and display the static "Semua data tersinkronisasi" text.

3. **Update `render()`**:
   - Calculate totals for `success`, `duplicate` (rescan), and `error` items in `this.queue`.
   - Update the UI counter text and display the `#history-header` if `this.queue.length > 0`.
   - Update the visibility of the `#history-trash-btn`.
   - Populate `.queue-empty-state` inside `#queue-list` if empty.
   - If items exist, render them inside the carousel container as horizontal snap rows.
   - Build pagination dots dynamically based on the number of items.
   - Attach scroll listeners to the carousel to highlight the active dot based on scroll position.

4. **Implement Trash Button Click Handler**:
   - Replace the legacy `handleFloatingClearClick` with a unified `handleTrashClick` function.
   - Use identical confirmation logic (adding `.confirm-delete` class to the button).

---

### C. CSS Changes (`public/style.css`)

1. **Persistent Queue Bar Styling**:
   - Add styles for the success state of `.queue-warning-banner` (greenish gradient background and borders).
   - Ensure it starts with `display: flex;` by default.

2. **Horizontal Carousel**:
   - Update `.queue-list-container` to scroll horizontally:
     ```css
     .queue-list-container.horizontal-carousel {
       display: flex;
       flex-direction: row;
       overflow-x: auto;
       scroll-snap-type: x mandatory;
       scrollbar-width: none; /* Hide scrollbar for Firefox */
       -ms-overflow-style: none;  /* Hide scrollbar for IE/Edge */
       gap: 12px;
       padding: 4px 8px;
     }
     .queue-list-container.horizontal-carousel::-webkit-scrollbar {
       display: none; /* Hide scrollbar for Chrome/Safari */
     }
     ```
   - Update `.queue-row` to take full width and snap:
     ```css
     .queue-row {
       flex: 0 0 100%;
       scroll-snap-align: center;
       box-sizing: border-box;
     }
     ```

3. **Counter Badges & Header**:
   - Style `.history-header-row` as a space-between flexbox container.
   - Style `.counter-badge` as a pill containing small icon and count.
   - Style the compact trash button with hover transitions.

4. **Carousel Dots Indicator**:
   - Style the `.carousel-dots-container` with small dot elements.
   - Highlight the active dot using a primary brand color.

---

## 3. Verification & Testing

* **Build Verification:** Run `npm run build` to ensure no syntax errors.
* **Persistent Bar Verification:** Verify that even without scans, the queue bar is visible and indicates successful synchronization.
* **Horizontal Carousel & Dots:** Perform multiple scans, check that cards scroll horizontally, snap to the center, and update the active dot.
* **Counters validation:** Confirm the Sukses, Rescan, and Gagal counters match the respective card counts.
* **Trash Can Workflow:** Press the trash button once (visual confirmation state), press again (verify completed scans are cleared). Check auto-collapse.

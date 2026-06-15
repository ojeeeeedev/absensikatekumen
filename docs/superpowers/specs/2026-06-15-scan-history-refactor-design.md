# Design Spec: Scan History Refactoring (V2)

This specification describes the changes to refactor the scan history feature in the **Presensi Katekumen Digital** application. The goal is to optimize the mobile layout by removing redundant status/sync containers, using a horizontal carousel for scan cards, and integrating a segmented progress bar (representing success/duplicate/failed scans) along with a compact trash can button directly into the history section.

## 1. Requirements

### A. UI Space Optimization
* Remove the `#status` container ("Silakan pindai...") entirely to free up vertical screen space.
* Remove the `#queue-warning-bar` container from below the scanner.
* Place the scan history section directly below the camera view container.

### B. Horizontal Scan History Carousel
* Refactor the vertical list into a horizontal-scrolling list of cards.
* Cards will be snap-aligned (`scroll-snap-type: x mandatory` on the container, `scroll-snap-align: center` on the card row).
* Tune card styling so that each card takes up the full width of the container, simulating a carousel effect.
* Hide the horizontal scrollbar.
* Add pagination dots below the carousel to indicate the position of the currently visible card.
* Update dots dynamically based on the scroll position of the carousel.

### C. Integrated Segmented Progress Bar (Option B)
* Add a progress bar section inside the history header.
* The bar will be a segmented horizontal line where the colored segments represent the proportions of:
  * **Sukses** (Green segment)
  * **Rescan/Duplicate** (Orange segment)
  * **Gagal** (Red segment)
  * **Pending Sync** (Blue pulsing segment, visible when `pendingCount > 0`)
* Display labels/legend text beneath the progress bar showing the count breakdown (e.g. "2 Sukses", "1 Duplikat", "1 Gagal").
* Show a small spinning sync icon next to the "Riwayat Scan" title when syncing is active.

### D. Sleek Trash Can Button
* Place a compact trash can icon button (`#history-trash-btn`) on the right side of the history header.
* Only render/display this button once at least one scan has been conducted.
* Maintain the double-click confirmation workflow:
  * Click 1: Button enters confirmation state (shows trash can delete_forever icon, changes style).
  * Click 2: Clears all completed scans from history.
  * Auto-collapses after 4 seconds of inactivity.

---

## 2. Proposed Changes

### A. HTML Changes (`public/index.html`)

Modify `public/index.html` to remove the old `#status` and `#queue-warning-bar` markup, and update the `#queue-history-panel` as follows:

```html
          <!-- STATE 2: ACTIVE SCANNING -->
          <div id="scanning-panel" class="panel-state">
            <!-- Mini Active Topic Bar -->
            <div class="active-topic-bar" onclick="openTopicModal()">
              ...
            </div>

            <!-- Camera Viewer -->
            <div id="reader-container">
              ...
            </div>

            <!-- Note: #status and #queue-warning-bar are REMOVED from here -->

            <!-- Queue History List -->
            <div id="queue-history-panel">
              <!-- Integrated Header (Title, Sync Spinner, and Trash Can) -->
              <div id="history-header" class="history-header-row" style="display: none;">
                <div class="history-title-area">
                  <span class="history-title-text">Riwayat Scan</span>
                  <div id="history-sync-spinner" class="spinner-small" style="display: none;"></div>
                </div>
                <button id="history-trash-btn" class="compact-trash-btn" aria-label="Hapus riwayat pemindaian" onclick="handleTrashClick(event)">
                  <span class="material-icons-outlined icon-default">delete_outline</span>
                  <span class="material-icons-outlined icon-confirm" style="display: none;">delete_forever</span>
                </button>
              </div>

              <!-- Segmented Progress Bar Area -->
              <div id="history-progress-area" class="history-progress-container" style="display: none;">
                <div class="segmented-progress-bar">
                  <div id="segment-success" class="progress-segment success" style="width: 0%;"></div>
                  <div id="segment-duplicate" class="progress-segment duplicate" style="width: 0%;"></div>
                  <div id="segment-error" class="progress-segment error" style="width: 0%;"></div>
                  <div id="segment-pending" class="progress-segment pending pulse-animation" style="width: 0%;"></div>
                </div>
                <div class="progress-legend">
                  <span id="legend-success" class="legend-item success" style="display: none;">
                    <span class="dot"></span> <span class="text">0 Sukses</span>
                  </span>
                  <span id="legend-duplicate" class="legend-item duplicate" style="display: none;">
                    <span class="dot"></span> <span class="text">0 Duplikat</span>
                  </span>
                  <span id="legend-error" class="legend-item error" style="display: none;">
                    <span class="dot"></span> <span class="text">0 Gagal</span>
                  </span>
                  <span id="legend-pending" class="legend-item pending" style="display: none;">
                    <span class="dot"></span> <span class="text">0 Sinkronisasi</span>
                  </span>
                </div>
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
          </div>
```

---

### B. JS Changes (`public/script.js`)

1. **Update `ScanQueue` methods (`render`, `updateBanner`, etc.)**:
   - Calculate proportions and update progress bar widths (`#segment-success`, `#segment-duplicate`, `#segment-error`, `#segment-pending`).
   - Show/hide legend tags depending on whether the corresponding count is > 0.
   - Show `#history-sync-spinner` and `#legend-pending` when `pendingCount > 0`.
   - Keep `#history-header` and `#history-progress-area` visible when the queue length is > 0.
   - Show/hide `#history-trash-btn` depending on if there is at least one scan.
   - Build carousel dots based on `this.queue` items (up to 10 rendered items).
   - Add scroll listener to `.queue-list-container` to calculate the current slide index and update `.active` class on dots.

2. **Refactor Trash Handler**:
   - Implement `handleTrashClick(event)` with state checks:
     - On first tap: Add `.confirm-delete` class to the button, show confirm icon, hide default icon, set 4s timeout to revert.
     - On second tap: Revert button class, trigger history clear of completed items (`item.status !== 'pending' && item.status !== 'processing'`), save and re-render.

---

### C. CSS Changes (`public/style.css`)

1. **Horizontal Carousel**:
   ```css
   .queue-list-container.horizontal-carousel {
     display: flex;
     flex-direction: row;
     overflow-x: auto;
     scroll-snap-type: x mandatory;
     scrollbar-width: none;
     -ms-overflow-style: none;
     gap: 12px;
     padding: 4px 0;
   }
   .queue-list-container.horizontal-carousel::-webkit-scrollbar {
     display: none;
   }
   .queue-list-container.horizontal-carousel .queue-row {
     flex: 0 0 100%;
     scroll-snap-align: center;
     box-sizing: border-box;
     margin-bottom: 0;
   }
   ```

2. **History Header, Progress Bar, and Trash Can**:
   ```css
   .history-header-row {
     display: flex;
     justify-content: space-between;
     align-items: center;
     margin-top: 8px;
   }
   .history-title-area {
     display: flex;
     align-items: center;
     gap: 8px;
   }
   .history-title-text {
     font-size: 0.75rem;
     font-weight: 700;
     color: var(--text-secondary);
     text-transform: uppercase;
     letter-spacing: 0.05em;
   }
   .history-progress-container {
     margin-bottom: 12px;
   }
   .segmented-progress-bar {
     width: 100%;
     height: 6px;
     border-radius: 3px;
     background: var(--border-glass);
     display: flex;
     overflow: hidden;
     margin: 6px 0;
   }
   .progress-segment {
     height: 100%;
     transition: width 0.3s ease;
   }
   .progress-segment.success { background-color: var(--status-success-text); }
   .progress-segment.duplicate { background-color: var(--status-pending-text); }
   .progress-segment.error { background-color: var(--status-duplicate-text); }
   .progress-segment.pending { background-color: var(--accent); }
   
   .progress-legend {
     display: flex;
     flex-wrap: wrap;
     gap: 12px;
     font-size: 0.65rem;
     color: var(--text-secondary);
     font-weight: 500;
   }
   .legend-item {
     display: flex;
     align-items: center;
     gap: 4px;
   }
   .legend-item .dot {
     width: 6px;
     height: 6px;
     border-radius: 50%;
   }
   .legend-item.success .dot { background-color: var(--status-success-text); }
   .legend-item.duplicate .dot { background-color: var(--status-pending-text); }
   .legend-item.error .dot { background-color: var(--status-duplicate-text); }
   .legend-item.pending .dot { background-color: var(--accent); }
   
   /* Compact Trash Button */
   .compact-trash-btn {
     background: var(--status-duplicate-bg);
     border: 1px solid var(--status-duplicate-border);
     color: var(--status-duplicate-text);
     border-radius: 8px;
     width: 32px;
     height: 32px;
     display: flex;
     align-items: center;
     justify-content: center;
     cursor: pointer;
     transition: all 0.2s ease;
   }
   [data-theme="dark"] .compact-trash-btn {
     background: rgba(198, 40, 40, 0.15);
     border-color: rgba(198, 40, 40, 0.35);
     color: #ef5350;
   }
   .compact-trash-btn:hover {
     background: rgba(198, 40, 40, 0.08);
     border-color: var(--status-duplicate-text);
   }
   .compact-trash-btn.confirm-delete {
     background: var(--status-duplicate-text) !important;
     color: white !important;
     border-color: var(--status-duplicate-text) !important;
   }
   [data-theme="dark"] .compact-trash-btn.confirm-delete {
     background: #c62828 !important;
     border-color: #c62828 !important;
   }
   ```

3. **Carousel Dots Indicator**:
   ```css
   .carousel-dots-container {
     display: flex;
     justify-content: center;
     gap: 6px;
     margin-top: 8px;
     margin-bottom: 4px;
   }
   .carousel-dot {
     width: 6px;
     height: 6px;
     border-radius: 50%;
     background-color: var(--border-glass);
     transition: background-color 0.3s ease, transform 0.2s ease;
   }
   .carousel-dot.active {
     background-color: var(--accent);
     transform: scale(1.2);
   }
   ```

---

## 3. Verification & Testing

* **Build Verification:** Run `npm run build` to verify no syntax errors exist.
* **Layout Check:** Verify that `#status` and `#queue-warning-bar` are removed, resulting in a cleaner UI under the scanner.
* **Segmented Bar Verification:** Perform multiple scans (success, duplicate, errors) and verify that the progress bar segment widths and legend values are correct.
* **Active Sync Test:** Simulate active syncs to confirm the blue segment and sync spinner render.
* **Dots Verification:** Drag/scroll the carousel cards and verify the active dot highlights correctly.
* **Trash Can Test:** Ensure double-tap confirmation and automatic timeout collapse work correctly.

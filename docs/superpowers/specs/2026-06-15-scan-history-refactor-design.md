# Design Spec: Scan History Refactoring (V3)

This specification describes the changes to refactor the scan history feature in the **Presensi Katekumen Digital** application. The goal is to optimize the mobile layout by removing redundant status/sync containers, using a horizontal carousel for scan cards, and integrating a segmented progress bar along with a compact trash can button directly into the history section.

## 1. Requirements

### A. UI Space Optimization
* Remove the `#status` container ("Silakan pindai...") entirely to free up vertical screen space.
* Remove the `#queue-warning-bar` container from below the scanner.
* Place the scan history section directly below the camera view container.
* Keep the history header, progress bar container, and carousel viewport visible at all times, showing a skeleton card placeholder when there are no scan records yet.

### B. Horizontal Scan History Carousel
* Refactor the vertical list into a horizontal-scrolling list of cards.
* Cards will be snap-aligned (`scroll-snap-type: x mandatory` on the container, `scroll-snap-align: center` on the card row).
* Tune card styling so that each card takes up the full width of the container, simulating a carousel effect.
* Hide the horizontal scrollbar.
* Add pagination dots below the carousel to indicate the position of the currently visible card. Use simple white dots (high opacity for active dot, low opacity for inactive dots).
* Update dots dynamically based on the scroll position of the carousel.
* **Navigation Chevrons:** Add left and right chevron buttons flanking the carousel viewport. Clicking a chevron scrolls the carousel by one card width. Dynamically disable or fade out the chevrons when the user is at the start or end of the carousel.

### C. Skeleton Placeholder State (Zero-State)
* When no scans have been conducted yet:
  * The `#history-header` is visible, but the trash button is hidden.
  * The `#history-progress-area` shows an empty progress bar (0% fill across all segments).
  * The `#queue-list` renders a single **skeleton card** featuring pulsing placeholder elements (pulsing photo circle, name line, ID line, and status badge) to indicate where scan cards will appear.
  * Carousel chevrons and pagination dots are hidden.

### D. Integrated Segmented Progress Bar
* Add a progress bar section inside the history header.
* The bar will be a segmented horizontal line where the colored segments represent the proportions of:
  * **Hadir** (Green segment)
  * **Rescan/Duplicate** (Orange segment)
  * **Gagal** (Red segment)
  * **Pending Sync** (Blue pulsing segment, visible when `pendingCount > 0`)
* Display labels/legend text beneath the progress bar showing the count breakdown (e.g. "2 Hadir", "1 Duplikat", "1 Gagal").
* Show a small spinning sync icon next to the "Riwayat Scan" title when syncing is active.

### E. Sleek Trash Can Button
* Place a compact trash can icon button (`#history-trash-btn`) on the right side of the history header.
* Only render/display this button once at least one scan has been conducted.
* Maintain the double-click confirmation workflow:
  * Click 1: Button enters confirmation state (shows trash can delete_forever icon, changes style, updates `aria-label`).
  * Click 2: Clears all completed scans from history.
  * Auto-collapses after 4 seconds of inactivity.

---

## 2. Proposed Changes

### A. HTML Changes (`public/index.html`)

Modify the `#queue-history-panel` as follows:

```html
            <!-- Queue History List -->
            <div id="queue-history-panel">
              <!-- Integrated Header (Title, Sync Spinner, and Trash Can) -->
              <div id="history-header" class="history-header-row">
                <div class="history-title-area">
                  <span class="history-title-text">Riwayat Scan</span>
                  <div id="history-sync-spinner" class="spinner-small" style="display: none;"></div>
                </div>
                <button id="history-trash-btn" type="button" class="compact-trash-btn" aria-label="Hapus riwayat pemindaian" style="display: none;" onclick="handleTrashClick(event)">
                  <span class="material-icons-outlined icon-default" aria-hidden="true">delete_outline</span>
                  <span class="material-icons-outlined icon-confirm" style="display: none;" aria-hidden="true">delete_forever</span>
                </button>
              </div>

              <!-- Segmented Progress Bar Area -->
              <div id="history-progress-area" class="history-progress-container">
                <div class="segmented-progress-bar" aria-hidden="true">
                  <div id="segment-success" class="progress-segment success" style="width: 0%;"></div>
                  <div id="segment-duplicate" class="progress-segment duplicate" style="width: 0%;"></div>
                  <div id="segment-error" class="progress-segment error" style="width: 0%;"></div>
                  <div id="segment-pending" class="progress-segment pending" style="width: 0%;"></div>
                </div>
                <div class="progress-legend">
                  <span id="legend-success" class="legend-item success" style="display: none;">
                    <span class="dot" aria-hidden="true"></span> <span class="text">0 Hadir</span>
                  </span>
                  <span id="legend-duplicate" class="legend-item duplicate" style="display: none;">
                    <span class="dot" aria-hidden="true"></span> <span class="text">0 Duplikat</span>
                  </span>
                  <span id="legend-error" class="legend-item error" style="display: none;">
                    <span class="dot" aria-hidden="true"></span> <span class="text">0 Gagal</span>
                  </span>
                  <span id="legend-pending" class="legend-item pending" style="display: none;">
                    <span class="dot" aria-hidden="true"></span> <span class="text">0 Sinkronisasi</span>
                  </span>
                </div>
              </div>

              <!-- Carousel Wrapper -->
              <div class="carousel-container-outer">
                <button id="carousel-prev-btn" type="button" class="carousel-nav-btn prev" aria-label="Slide sebelumnya" style="display: none;" onclick="scrollCarousel(-1)">
                  <span class="material-icons-outlined" aria-hidden="true">chevron_left</span>
                </button>
                
                <div class="carousel-container">
                  <div id="queue-list" class="queue-list-container horizontal-carousel">
                    <!-- Dynamically populated via script -->
                  </div>
                </div>
                
                <button id="carousel-next-btn" type="button" class="carousel-nav-btn next" aria-label="Slide berikutnya" style="display: none;" onclick="scrollCarousel(1)">
                  <span class="material-icons-outlined" aria-hidden="true">chevron_right</span>
                </button>
              </div>

              <!-- Carousel Pagination Dots -->
              <div id="carousel-dots" class="carousel-dots-container" style="display: none;"></div>
            </div>
```

---

### B. JS Changes (`public/script.js`)

1. **Implement `scrollCarousel(direction)` globally**:
   ```javascript
   window.scrollCarousel = function(direction) {
     const listContainer = document.getElementById('queue-list');
     if (!listContainer) return;
     const itemWidth = (listContainer.clientWidth || 0) + 12;
     listContainer.scrollBy({
       left: direction * itemWidth,
       behavior: 'smooth'
     });
   };
   ```

2. **Update `updateNavButtons()` helper**:
   Inside `onscroll` and `render()`, toggle visibility and disabled state of the navigation chevrons (`#carousel-prev-btn`, `#carousel-next-btn`):
   - Prev button visible and enabled if `scrollLeft > 5`.
   - Next button visible and enabled if `scrollLeft + clientWidth < scrollWidth - 5`.

3. **Update `render()` inside `ScanQueue`**:
   - Always display `#history-header` and `#history-progress-area`.
   - If `queueLength === 0`:
     - Hide `#history-trash-btn`.
     - Set all segments to 0% width.
     - Render the skeleton card:
       ```javascript
       listContainer.innerHTML = `
         <div class="queue-row skeleton" aria-hidden="true">
           <div class="student-info">
             <div class="student-photo skeleton-pulse"></div>
             <div class="student-text">
               <div class="skeleton-line name skeleton-pulse"></div>
               <div class="skeleton-line id skeleton-pulse"></div>
             </div>
           </div>
           <div class="status-badge skeleton-pulse"></div>
         </div>
       `;
       ```
     - Hide navigation chevrons and dots.
   - If `queueLength > 0`:
     - Render actual card list and pagination dots using `<button type="button">`.
     - Cache dot references and add optimized scroll handler.
     - Call `updateNavButtons()` on render and scroll.

---

### C. CSS Changes (`public/style.css`)

1. **White Carousel Dots**:
   ```css
   .carousel-dot {
     width: 6px;
     height: 6px;
     border-radius: 50%;
     background-color: rgba(255, 255, 255, 0.35); /* Simple white dot, semi-transparent */
     border: none;
     cursor: pointer;
     transition: background-color 0.3s ease, transform 0.2s ease;
   }
   .carousel-dot.active {
     background-color: rgba(255, 255, 255, 1); /* Full white active dot */
     transform: scale(1.2);
   }
   ```

2. **Carousel Navigation Buttons**:
   - Absolute positioning flanking the viewport or flex layout.
   - Using subtle glassmorphism theme styling:
   ```css
   .carousel-container-outer {
     position: relative;
     display: flex;
     align-items: center;
     width: 100%;
   }
   .carousel-container {
     flex: 1;
     overflow: hidden;
   }
   .carousel-nav-btn {
     background: var(--bg-card);
     border: 1px solid var(--border-glass);
     color: var(--text-primary);
     width: 28px;
     height: 28px;
     border-radius: 50%;
     display: flex;
     align-items: center;
     justify-content: center;
     cursor: pointer;
     position: absolute;
     z-index: 10;
     transition: all 0.2s ease;
     box-shadow: 0 2px 8px rgba(0,0,0,0.05);
   }
   .carousel-nav-btn.prev { left: -10px; }
   .carousel-nav-btn.next { right: -10px; }
   .carousel-nav-btn:hover { background: var(--bg-hover); }
   .carousel-nav-btn[disabled], .carousel-nav-btn.disabled {
     opacity: 0;
     pointer-events: none;
   }
   ```

3. **Skeleton Loading Animations**:
   ```css
   .queue-row.skeleton {
     background: rgba(255, 255, 255, 0.15) !important;
     border: 1px dashed var(--border-glass) !important;
     border-left: 4px solid var(--border-glass) !important;
     cursor: default !important;
     pointer-events: none;
   }
   .skeleton-pulse {
     background: linear-gradient(90deg, var(--border-glass) 25%, var(--bg-hover) 50%, var(--border-glass) 75%);
     background-size: 200% 100%;
     animation: skeletonLoading 1.5s infinite;
   }
   @keyframes skeletonLoading {
     0% { background-position: 200% 0; }
     100% { background-position: -200% 0; }
   }
   .student-photo.skeleton-pulse {
     width: 48px;
     height: 48px;
     border-radius: 50%;
     border: none !important;
   }
   .skeleton-line {
     height: 12px;
     border-radius: 4px;
   }
   .skeleton-line.name {
     width: 120px;
     margin-bottom: 6px;
   }
   .skeleton-line.id {
     width: 80px;
   }
   .status-badge.skeleton-pulse {
     width: 28px;
     height: 28px;
     border-radius: 50%;
   }
   ```

---

## 3. Verification & Testing

* **Build Verification:** Run `npm run build` to verify syntax.
* **Skeleton Verification:** Clear scan history, verify skeleton placeholder card displays with correct pulse animation and that progress container and headers are visible.
* **Chevron Navigation:** Scan 2+ items, check that chevron buttons appear on hover/touch, and clicking them scrolls the carousel card-by-card. Check that chevrons disappear when reaching boundaries.
* **Pagination Dots:** Verify they are simple white dots with opacity changing from 0.35 to 1.

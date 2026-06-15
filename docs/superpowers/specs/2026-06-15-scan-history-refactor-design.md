# Design Spec: Scan History Refactoring (V4)

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
* **Card Width Shrink:** Make each card take up `90%` of the container width (instead of 100%) to leave 5% margin space on both sides.
* Hide the horizontal scrollbar.
* Add pagination dots below the carousel to indicate the position of the currently visible card. Use simple white dots (high opacity for active dot, low opacity for inactive dots).
* Update dots dynamically based on the scroll position of the carousel.
* **Chevron Navigation:** Add left and right chevron buttons on the absolute left and right sides of the carousel container (in the 5% margin space outside the card). Chevrons should be simple transparent icon buttons with no surrounding background/border circle. Clicking a chevron scrolls the carousel by one card width. Dynamically disable or fade out the chevrons when the user is at the start or end of the carousel.

### C. Skeleton Placeholder State (Zero-State)
* When no scans have been conducted yet:
  * The `#history-header` is visible, but the trash button is hidden.
  * The `#history-progress-area` shows an empty progress bar (0% fill across all segments).
  * The `#queue-list` renders a single **skeleton card** featuring pulsing placeholder elements (pulsing photo circle, name line, ID line, and status badge) to indicate where scan cards will appear.
  * Carousel chevrons and pagination dots are hidden.

### D. Integrated Segmented Progress Bar & Trash Can
* Add a progress bar section inside the history header container.
* **Layout Adjustment:** The progress bar and the trash can button are placed side-by-side in a single row. The segmented progress bar takes up the maximum available space, and the trash button is placed on its right (only displayed when scans exist). When the trash button is hidden, the progress bar expands to take 100% of the row width.
* The bar will be a segmented horizontal line where the colored segments represent the proportions of:
  * **Hadir** (Green segment)
  * **Rescan/Duplicate** (Orange segment)
  * **Gagal** (Red segment)
  * **Pending Sync** (Blue pulsing segment, visible when `pendingCount > 0`)
* Display labels/legend text beneath the progress bar showing the count breakdown (e.g. "2 Hadir", "1 Duplikat", "1 Gagal", "1 Memproses").
* Change the term "Sinkronisasi" to "Memproses" in the legend labels.
* Show a small spinning sync icon next to the "Riwayat Scan" title when syncing is active.

### E. Sleek Trash Can Button
* Place a compact trash can icon button (`#history-trash-btn`) on the right side of the progress bar row.
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
              <!-- Integrated Header (Title, Sync Spinner) -->
              <div id="history-header" class="history-header-row">
                <div class="history-title-area">
                  <span class="history-title-text">Riwayat Scan</span>
                  <div id="history-sync-spinner" class="spinner-small" style="display: none;"></div>
                </div>
              </div>

              <!-- Segmented Progress Bar Area with Side-by-Side Trash Button -->
              <div id="history-progress-area" class="history-progress-container">
                <div class="progress-bar-row">
                  <div class="segmented-progress-bar" aria-hidden="true">
                    <div id="segment-success" class="progress-segment success" style="width: 0%;"></div>
                    <div id="segment-duplicate" class="progress-segment duplicate" style="width: 0%;"></div>
                    <div id="segment-error" class="progress-segment error" style="width: 0%;"></div>
                    <div id="segment-pending" class="progress-segment pending" style="width: 0%;"></div>
                  </div>
                  <button id="history-trash-btn" type="button" class="compact-trash-btn" aria-label="Hapus riwayat pemindaian" style="display: none;" onclick="handleTrashClick(event)">
                    <span class="material-icons-outlined icon-default" aria-hidden="true">delete_outline</span>
                    <span class="material-icons-outlined icon-confirm" style="display: none;" aria-hidden="true">delete_forever</span>
                  </button>
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
                    <span class="dot" aria-hidden="true"></span> <span class="text">0 Memproses</span>
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
     const cards = Array.from(listContainer.querySelectorAll('.queue-row'));
     const itemWidth = cards.length > 1 ? (cards[1].offsetLeft - cards[0].offsetLeft) : listContainer.clientWidth;
     listContainer.scrollBy({
       left: direction * itemWidth,
       behavior: 'smooth'
     });
   };
   ```

2. **Update `updateNavButtons()` helper**:
   ```javascript
   function updateNavButtons(listContainer, renderItemsLength) {
     const prevBtn = document.getElementById('carousel-prev-btn');
     const nextBtn = document.getElementById('carousel-next-btn');
     if (!prevBtn || !nextBtn) return;
     
     if (renderItemsLength <= 1) {
       prevBtn.style.display = 'none';
       nextBtn.style.display = 'none';
       return;
     }

     const scrollLeft = listContainer.scrollLeft;
     const clientWidth = listContainer.clientWidth;
     const scrollWidth = listContainer.scrollWidth;

     prevBtn.style.display = 'flex';
     nextBtn.style.display = 'flex';
     
     if (scrollLeft <= 5) {
       prevBtn.classList.add('disabled');
       prevBtn.setAttribute('disabled', 'true');
     } else {
       prevBtn.classList.remove('disabled');
       prevBtn.removeAttribute('disabled');
     }

     if (scrollLeft + clientWidth >= scrollWidth - 5) {
       nextBtn.classList.add('disabled');
       nextBtn.setAttribute('disabled', 'true');
     } else {
       nextBtn.classList.remove('disabled');
       nextBtn.removeAttribute('disabled');
     }
   }
   ```

3. **Update `render()` inside `ScanQueue`**:
   - Change the term `'Sinkronisasi'` to `'Memproses'` when calling legend updates.
   - Cache dot triggers and update `dot.onclick` and `onscroll` active dot math to use dynamic offset-based item width:
     ```javascript
     const cards = Array.from(listContainer.querySelectorAll('.queue-row'));
     const itemWidth = cards.length > 1 ? (cards[1].offsetLeft - cards[0].offsetLeft) : listContainer.clientWidth;
     ```

---

### C. CSS Changes (`public/style.css`)

1. **Card Width Shrink**:
   ```css
   .queue-list-container.horizontal-carousel .queue-row {
     flex: 0 0 90%; /* Shrink card to 90% */
     scroll-snap-align: center;
     box-sizing: border-box;
     margin-bottom: 0;
   }
   ```

2. **Transparent Navigation Buttons flanking the Viewport**:
   ```css
   .carousel-nav-btn {
     background: transparent;
     border: none;
     color: var(--text-primary);
     width: 24px;
     height: 24px;
     display: flex;
     align-items: center;
     justify-content: center;
     cursor: pointer;
     position: absolute;
     z-index: 10;
     transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
     box-shadow: none; /* No circle style */
   }
   .carousel-nav-btn.prev { left: -4px; }
   .carousel-nav-btn.next { right: -4px; }
   .carousel-nav-btn:hover {
     background: transparent;
     color: var(--accent);
     transform: scale(1.25);
   }
   .carousel-nav-btn[disabled], .carousel-nav-btn.disabled {
     opacity: 0 !important;
     pointer-events: none;
   }
   ```

3. **Side-by-Side Progress Bar and Trash Button**:
   ```css
   .progress-bar-row {
     display: flex;
     align-items: center;
     gap: 12px;
     width: 100%;
   }
   .segmented-progress-bar {
     flex: 1; /* Takes remaining space */
     height: 6px;
     border-radius: 3px;
     background: var(--border-glass);
     display: flex;
     overflow: hidden;
     margin: 6px 0;
   }
   ```

---

## 3. Verification & Testing

* **Build Verification:** Run `npm run build` to verify syntax.
* **Progress Row Layout:** Confirm trash can button renders inside the progress bar row and the progress bar automatically expands/shrinks as the button toggles.
* **Chevron Position & Style:** Verify chevrons sit outside the 90% cards and have no circular background.
* **Terminology Check:** Confirm legend shows "X Memproses" instead of "X Sinkronisasi".

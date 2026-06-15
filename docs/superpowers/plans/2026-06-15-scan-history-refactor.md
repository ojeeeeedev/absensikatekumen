# Scan History Refactor Implementation Plan (V3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the scan history feature into a horizontal carousel, integrate navigation chevrons, use white pagination dots, implement a skeleton placeholder card when empty, and replace the clear button with a compact trash can button.

**Architecture:** Remove redundant status/warning bars. Directly render the scan history section below the camera view. When empty, show a pulsing skeleton card. When scans are present, show a segmented progress bar and cards flanking navigation chevrons.

**Tech Stack:** Vanilla HTML5, CSS3, JavaScript.

---

### Task 1: Update HTML Structure

**Files:**
* Modify: `public/index.html:150-205`

- [ ] **Step 1: Replace old queue history markup with V3 structure**
  Modify lines 150-205 in `public/index.html` to integrate outer carousel navigation button tags, a clean progress segment layout, and wrapper tags.

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

- [ ] **Step 2: Commit HTML changes**
  ```bash
  git add public/index.html
  git commit -m "feat: restructure scan history HTML to support navigation chevrons and persistent layout"
  ```

---

### Task 2: Implement Refactored CSS Styles

**Files:**
* Modify: `public/style.css:472-517` (carousel styles)
* Modify: `public/style.css:842-981` (history headers, buttons, dots, skeleton loader)

- [ ] **Step 1: Update Carousel and Snap CSS**
  Update `public/style.css` to enable scroll-snapping, hide scrollbars, and align list cards:

  ```css
  .queue-list-container.horizontal-carousel {
    overflow-x: auto;
    overflow-y: hidden;
    display: flex;
    flex-direction: row;
    gap: 12px;
    padding: 4px 0;
    scroll-snap-type: x mandatory;
    scrollbar-width: none;
    -ms-overflow-style: none;
    flex: 1 1 auto;
    min-height: 0;
    width: 100%;
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

- [ ] **Step 2: Add CSS for Outer Container, Chevrons, White Dots, and Skeleton Loading**
  Append/update the following blocks in `public/style.css`:

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
  
  /* Carousel Navigation Buttons */
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
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 0 2px 8px rgba(0,0,0,0.05);
  }
  .carousel-nav-btn.prev { left: -10px; }
  .carousel-nav-btn.next { right: -10px; }
  .carousel-nav-btn:hover {
    background: var(--bg-hover);
    transform: scale(1.08);
  }
  .carousel-nav-btn:active {
    transform: scale(0.95);
  }
  .carousel-nav-btn[disabled], .carousel-nav-btn.disabled {
    opacity: 0 !important;
    pointer-events: none;
  }

  /* Simple White Pagination Dots */
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
    background-color: rgba(255, 255, 255, 0.35); /* Simple semi-transparent white */
    border: none;
    cursor: pointer;
    transition: background-color 0.3s ease, transform 0.2s ease;
  }
  .carousel-dot.active {
    background-color: rgba(255, 255, 255, 1); /* Full opaque white */
    transform: scale(1.2);
  }

  /* Skeleton Loading Placeholder */
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

- [ ] **Step 3: Commit CSS changes**
  ```bash
  git add public/style.css
  git commit -m "feat: implement styles for skeleton card, navigation chevrons, and white dots"
  ```

---

### Task 3: Implement JS Carousel Navigation & Skeleton Logic

**Files:**
* Modify: `public/script.js`

- [ ] **Step 1: Implement global scrolling functions and update helper**
  Add the global `scrollCarousel` function at the top level of `public/script.js`.
  Also implement the `updateNavButtons` helper inside `render()` or `ScanQueue`:

  ```javascript
  window.scrollCarousel = function(direction) {
    const listContainer = document.getElementById('queue-list');
    if (!listContainer) return;
    const itemWidth = (listContainer.clientWidth || 0) + 12; // clientWidth + 12px gap
    listContainer.scrollBy({
      left: direction * itemWidth,
      behavior: 'smooth'
    });
  };

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

    // Show and enable/disable based on scroll offset boundary
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

- [ ] **Step 2: Update `render()` inside `ScanQueue`**
  Modify `render()` to handle:
  - If `queueLength === 0`, render the skeleton card, hide dots, hide chevrons, and set progress bar to 0%.
  - If `queueLength > 0`, render actual scan cards, configure chevron click triggers, cache dot buttons, set type="button" on dots, and bind scroll handler.
  - Implement dynamic `aria-label` and `aria-current` toggles on dots and navigation chevrons.

- [ ] **Step 3: Update `handleTrashClick`**
  Ensure it updates the `#history-trash-btn` visibility state, confirmation text, and `aria-label` values properly.

- [ ] **Step 4: Commit JS changes**
  ```bash
  git add public/script.js
  git commit -m "feat: implement skeleton card, chevron scrolling, and dynamic dots logic in JS"
  ```

---

### Task 4: Build Verification

- [ ] **Step 1: Run build verification command**
  Run: `npm run build`
  Expected: Successful exit code, prints "No build step needed"

- [ ] **Step 2: Sanity Check**
  Verify the layout works on mobile resolutions, carousel snaps, chevrons navigate card-by-card, and the skeleton load is displayed when scan history is cleared.

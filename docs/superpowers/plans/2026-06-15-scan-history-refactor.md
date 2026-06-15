# Scan History Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the scan history feature into a horizontal carousel, integrate a segmented progress bar representing attendance proportions (Hadir, Duplikat, Gagal, Sinkronisasi), and replace the large clear button with a compact trash can button.

**Architecture:** Integrate the new layout directly below the scanner by removing the redundant `#status` and `#queue-warning-bar` panels. Dynamically calculate and render segment widths for the progress bar, handle scroll snapping with active pagination dots in CSS and JS, and implement a double-tap confirmation flow for the compact trash button.

**Tech Stack:** Vanilla HTML5, CSS3 (Flexbox, CSS variables, Scroll Snap), Vanilla JavaScript.

---

### Task 1: Update HTML Structure

**Files:**
* Modify: `public/index.html:149-174`

- [ ] **Step 1: Replace status and queue warning bar, and inject new history panels**
  Replace lines 149-174 in `public/index.html` to remove `#status` and `#queue-warning-bar`, and setup the new segmented progress bar, trash button, and carousel wrappers.

  ```html
            <!-- Note: #status and #queue-warning-bar containers are removed from here -->

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
                  <div id="segment-pending" class="progress-segment pending" style="width: 0%;"></div>
                </div>
                <div class="progress-legend">
                  <span id="legend-success" class="legend-item success" style="display: none;">
                    <span class="dot"></span> <span class="text">0 Hadir</span>
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
  ```

- [ ] **Step 2: Commit HTML changes**
  ```bash
  git add public/index.html
  git commit -m "feat: restructure scan history HTML and remove redundant status containers"
  ```

---

### Task 2: Implement Refactored CSS Styles

**Files:**
* Modify: `public/style.css:472-517` (update `.queue-list-container` and `.queue-row`)
* Modify: `public/style.css:842-917` (replace `.floating-clear-btn` styles)

- [ ] **Step 1: Replace old list container styles with horizontal carousel styles**
  Update `.queue-list-container` and `.queue-row` in `public/style.css` to enable horizontal scrolling, hide scrollbars, and allow snap alignment:

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

- [ ] **Step 2: Add styles for history headers, progress bar, dots, and compact trash button**
  Replace old `.floating-clear-btn` styles in `public/style.css` with the new design:

  ```css
  .history-header-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 8px;
    margin-bottom: 4px;
    padding-bottom: 4px;
    border-bottom: 1px solid var(--border-glass);
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
    transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
  .progress-segment.success { background-color: var(--status-success-text); }
  .progress-segment.duplicate { background-color: var(--status-pending-text); }
  .progress-segment.error { background-color: var(--status-duplicate-text); }
  .progress-segment.pending {
    background-color: var(--accent);
    animation: pendingPulse 1.5s infinite ease-in-out;
  }
  @keyframes pendingPulse {
    0% { opacity: 0.6; }
    50% { opacity: 1; }
    100% { opacity: 0.6; }
  }
  
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
    display: inline-block;
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
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
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

- [ ] **Step 3: Commit CSS changes**
  ```bash
  git add public/style.css
  git commit -m "feat: implement styles for segmented progress bar, carousel dots, and compact trash button"
  ```

---

### Task 3: Refactor JS Controller

**Files:**
* Modify: `public/script.js`

- [ ] **Step 1: Update `updateBanner()` in `ScanQueue`**
  Modify `updateBanner()` to manage the small sync spinner in the history header and the pending items counter instead of the removed `#queue-warning-bar` container:

  ```javascript
    updateBanner() {
      const pendingCount = this.queue.filter(item => item.status === 'pending' || item.status === 'processing').length;
      const syncSpinner = document.getElementById('history-sync-spinner');
      
      if (pendingCount === 0) {
        this.totalInBatch = 0;
      } else if (this.totalInBatch < pendingCount) {
        this.totalInBatch = pendingCount;
      }

      if (syncSpinner) {
        syncSpinner.style.display = pendingCount > 0 ? 'inline-block' : 'none';
      }
    }
  ```

- [ ] **Step 2: Update `render()` in `ScanQueue`**
  Rewrite the `render()` method to:
  1. Calculate totals for success (`Hadir`), duplicate (`Duplikat`), error (`Gagal`), and pending/processing (`Sinkronisasi`).
  2. Dynamically calculate percentages and set widths for `#segment-success`, `#segment-duplicate`, `#segment-error`, and `#segment-pending`.
  3. Show/hide legend spans and text based on values > 0.
  4. Toggle display of `#history-header` and `#history-progress-area` if `this.queue.length > 0`.
  5. Build horizontal card list and pagination dots dynamically.
  6. Listen to scroll events on `.queue-list-container` to toggle the `.active` class on pagination dots.
  
  Replace the `render()` method implementation:

  ```javascript
    render() {
      this.updateBanner();
      const listContainer = document.getElementById('queue-list');
      if (!listContainer) return;

      const queueLength = this.queue.length;
      const historyHeader = document.getElementById('history-header');
      const progressArea = document.getElementById('history-progress-area');
      const dotsContainer = document.getElementById('carousel-dots');
      const trashBtn = document.getElementById('history-trash-btn');

      if (queueLength === 0) {
        if (historyHeader) historyHeader.style.display = 'none';
        if (progressArea) progressArea.style.display = 'none';
        if (dotsContainer) dotsContainer.style.display = 'none';
        
        listContainer.innerHTML = '';
        const emptyDiv = document.createElement('div');
        emptyDiv.className = 'queue-empty-state';
        emptyDiv.textContent = 'Belum ada data pemindaian.';
        listContainer.appendChild(emptyDiv);
        return;
      }

      // Show headers and progress area
      if (historyHeader) historyHeader.style.display = 'flex';
      if (progressArea) progressArea.style.display = 'block';

      // 1. Calculate counters
      let successCount = 0;
      let duplicateCount = 0;
      let errorCount = 0;
      let pendingCount = 0;

      this.queue.forEach(item => {
        if (item.status === 'success') successCount++;
        else if (item.status === 'duplicate') duplicateCount++;
        else if (item.status === 'error') errorCount++;
        else if (item.status === 'pending' || item.status === 'processing') pendingCount++;
      });

      // 2. Set segmented widths
      const successPct = (successCount / queueLength) * 100;
      const duplicatePct = (duplicateCount / queueLength) * 100;
      const errorPct = (errorCount / queueLength) * 100;
      const pendingPct = (pendingCount / queueLength) * 100;

      const segSuccess = document.getElementById('segment-success');
      const segDuplicate = document.getElementById('segment-duplicate');
      const segError = document.getElementById('segment-error');
      const segPending = document.getElementById('segment-pending');

      if (segSuccess) segSuccess.style.width = `${successPct}%`;
      if (segDuplicate) segDuplicate.style.width = `${duplicatePct}%`;
      if (segError) segError.style.width = `${errorPct}%`;
      if (segPending) segPending.style.width = `${pendingPct}%`;

      // 3. Update legend counts and visibility
      const updateLegend = (id, count, singularTerm) => {
        const el = document.getElementById(id);
        if (el) {
          if (count > 0) {
            el.style.display = 'flex';
            el.querySelector('.text').textContent = `${count} ${singularTerm}`;
          } else {
            el.style.display = 'none';
          }
        }
      };

      updateLegend('legend-success', successCount, 'Hadir');
      updateLegend('legend-duplicate', duplicateCount, 'Duplikat');
      updateLegend('legend-error', errorCount, 'Gagal');
      updateLegend('legend-pending', pendingCount, 'Sinkronisasi');

      // 4. Render items (up to 10 items)
      const renderItems = this.queue.slice(0, 10);
      listContainer.innerHTML = '';

      renderItems.forEach(item => {
        const row = document.createElement('div');
        row.className = `queue-row ${item.status}`;
        row.style.cursor = 'pointer';
        row.setAttribute('role', 'button');
        row.setAttribute('tabindex', '0');
        row.setAttribute('aria-label', `Detail pemindaian ${item.name || 'Katekumen'}`);
        
        row.onclick = () => {
          showStudentModal(item);
        };
        row.onkeydown = (event) => {
          if (event.key === ' ' || event.key === 'Enter') {
            event.preventDefault();
            showStudentModal(item);
          }
        };

        const cachedPhoto = window.ImageCache ? window.ImageCache.get(item.studentId) : null;
        const avatarSrc = cachedPhoto || item.image || '/assets/favicon.png';
        
        const studentInfo = document.createElement('div');
        studentInfo.className = 'student-info';

        const studentPhoto = document.createElement('img');
        studentPhoto.className = 'student-photo';
        studentPhoto.setAttribute('crossorigin', 'anonymous');
        studentPhoto.setAttribute('data-student-id', item.studentId || '');
        studentPhoto.alt = 'Foto';
        studentPhoto.onload = function() {
          if (!this.src.startsWith('data:') && window.ImageCache && this.dataset.studentId) {
            window.ImageCache.compressAndCacheElement(this.dataset.studentId, this);
          }
        };
        studentPhoto.onerror = function() {
          this.onerror = null;
          this.src = '/assets/favicon.png';
        };
        studentPhoto.src = avatarSrc;
        studentInfo.appendChild(studentPhoto);

        const studentText = document.createElement('div');
        studentText.className = 'student-text';

        const studentName = document.createElement('span');
        studentName.className = 'student-name';
        studentName.textContent = item.name || 'Katekumen';
        studentText.appendChild(studentName);

        const studentIdSpan = document.createElement('span');
        studentIdSpan.className = 'student-id';
        studentIdSpan.textContent = `${item.studentId} • Topik ${item.week}`;
        studentText.appendChild(studentIdSpan);

        studentInfo.appendChild(studentText);
        row.appendChild(studentInfo);

        const statusBadge = document.createElement('span');
        statusBadge.className = `status-badge ${item.status}`;
        
        const icon = document.createElement('span');
        icon.className = 'material-icons-outlined';
        
        if (item.status === 'success') {
          icon.textContent = 'check';
        } else if (item.status === 'error') {
          icon.textContent = 'close';
        } else if (item.status === 'duplicate') {
          icon.textContent = 'refresh';
        } else if (item.status === 'processing') {
          icon.textContent = 'sync';
        } else {
          icon.textContent = 'schedule';
        }
        
        statusBadge.appendChild(icon);
        row.appendChild(statusBadge);

        listContainer.appendChild(row);
      });

      // 5. Render carousel pagination dots
      if (dotsContainer) {
        dotsContainer.innerHTML = '';
        if (renderItems.length > 1) {
          dotsContainer.style.display = 'flex';
          renderItems.forEach((_, index) => {
            const dot = document.createElement('div');
            dot.className = `carousel-dot ${index === 0 ? 'active' : ''}`;
            dot.onclick = () => {
              const cardWidth = listContainer.clientWidth;
              listContainer.scrollTo({
                left: index * cardWidth,
                behavior: 'smooth'
              });
            };
            dotsContainer.appendChild(dot);
          });

          // Add scroll listener to update active dots
          listContainer.onscroll = () => {
            const scrollLeft = listContainer.scrollLeft;
            const cardWidth = listContainer.clientWidth || 1;
            const activeIndex = Math.round(scrollLeft / cardWidth);
            const dots = dotsContainer.querySelectorAll('.carousel-dot');
            dots.forEach((dot, idx) => {
              if (idx === activeIndex) {
                dot.classList.add('active');
              } else {
                dot.classList.remove('active');
              }
            });
          };
        } else {
          dotsContainer.style.display = 'none';
        }
      }
    }
  ```

- [ ] **Step 3: Implement `handleTrashClick` and clean up `handleFloatingClearClick`**
  Remove the old `handleFloatingClearClick` implementation and document click listener (lines 1058-1096 in `public/script.js`), and replace them with:

  ```javascript
  window.handleTrashClick = function(event) {
    event.stopPropagation();
    const btn = document.getElementById('history-trash-btn');
    if (!btn) return;

    const defaultIcon = btn.querySelector('.icon-default');
    const confirmIcon = btn.querySelector('.icon-confirm');

    if (!btn.classList.contains('confirm-delete')) {
      btn.classList.add('confirm-delete');
      if (defaultIcon) defaultIcon.style.display = 'none';
      if (confirmIcon) confirmIcon.style.display = 'inline-block';

      if (window.trashBtnTimeout) clearTimeout(window.trashBtnTimeout);
      window.trashBtnTimeout = setTimeout(() => {
        btn.classList.remove('confirm-delete');
        if (defaultIcon) defaultIcon.style.display = 'inline-block';
        if (confirmIcon) confirmIcon.style.display = 'none';
      }, 4000);
    } else {
      if (window.trashBtnTimeout) clearTimeout(window.trashBtnTimeout);
      btn.classList.remove('confirm-delete');
      if (defaultIcon) defaultIcon.style.display = 'inline-block';
      if (confirmIcon) confirmIcon.style.display = 'none';
      
      if (typeof scanQueue !== 'undefined') {
        const pendingCount = scanQueue.queue.filter(item => item.status === 'pending' || item.status === 'processing').length;
        const completedCount = scanQueue.queue.length - pendingCount;
        
        if (completedCount === 0) {
          showToast("Belum ada riwayat pemindaian selesai untuk dihapus", "info");
          return;
        }
        
        scanQueue.queue = scanQueue.queue.filter(item => item.status === 'pending' || item.status === 'processing');
        scanQueue.save();
        showToast("Riwayat pemindaian berhasil dibersihkan", "info");
      }
    }
  };

  // Document click listener to auto-collapse trash button if clicking outside
  document.addEventListener('click', () => {
    const btn = document.getElementById('history-trash-btn');
    if (btn && btn.classList.contains('confirm-delete')) {
      btn.classList.remove('confirm-delete');
      const defaultIcon = btn.querySelector('.icon-default');
      const confirmIcon = btn.querySelector('.icon-confirm');
      if (defaultIcon) defaultIcon.style.display = 'inline-block';
      if (confirmIcon) confirmIcon.style.display = 'none';
      if (window.trashBtnTimeout) clearTimeout(window.trashBtnTimeout);
    }
  });
  ```

- [ ] **Step 4: Commit JS changes**
  ```bash
  git add public/script.js
  git commit -m "feat: refactor ScanQueue methods to support segmented progress bar and compact trash confirmation"
  ```

---

### Task 4: Build Verification

- [ ] **Step 1: Run build verification command**
  Run: `npm run build`
  Expected: Successful exit code, prints "No build step needed"

- [ ] **Step 2: Cleanup and finish branch**
  Perform sanity check on modified files to verify no syntax errors exist.

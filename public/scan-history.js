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

window.scrollCarousel = function(direction) {
  const listContainer = document.getElementById('queue-list');
  if (!listContainer) return;
  const cards = listContainer.querySelectorAll('.queue-row');
  const itemWidth = cards.length > 1 ? (cards[1].offsetLeft - cards[0].offsetLeft) : listContainer.clientWidth;
  listContainer.scrollBy({
    left: direction * itemWidth,
    behavior: 'smooth'
  });
};

function updateProgressBanner(queue) {
  const pendingCount = queue.filter(item => item.status === 'pending' || item.status === 'processing').length;
  const progressBar = document.querySelector('.segmented-progress-bar');

  if (progressBar) {
    const isLoading = pendingCount > 0;
    progressBar.classList.toggle('is-loading', isLoading);
    progressBar.setAttribute('aria-busy', String(isLoading));
  }
}

function renderScanHistory(items) {
  const queue = Array.isArray(items) ? items : [];
  const queueLength = queue.length;
  const listContainer = document.getElementById('queue-list');
  if (!listContainer) return;

  const progressArea = document.getElementById('history-progress-area');
  const dotsContainer = document.getElementById('carousel-dots');
  const prevBtn = document.getElementById('carousel-prev-btn');
  const nextBtn = document.getElementById('carousel-next-btn');
  updateProgressBanner(queue);
  // Ensure progress area is always visible (V3 Spec)
  if (progressArea) progressArea.style.display = 'block';

  if (queueLength === 0) {
    if (dotsContainer) dotsContainer.style.display = 'none';
    if (prevBtn) prevBtn.style.display = 'none';
    if (nextBtn) nextBtn.style.display = 'none';
    
    // Render 0% progress bar
    const segSuccess = document.getElementById('segment-success');
    const segDuplicate = document.getElementById('segment-duplicate');
    const segError = document.getElementById('segment-error');
    const segPending = document.getElementById('segment-pending');
    if (segSuccess) segSuccess.style.width = '0%';
    if (segDuplicate) segDuplicate.style.width = '0%';
    if (segError) segError.style.width = '0%';
    if (segPending) segPending.style.width = '0%';
    const progressBar = document.querySelector('.segmented-progress-bar');
    if (progressBar) progressBar.setAttribute('aria-valuenow', '0');

    // Hide all legend tags
    const legends = ['legend-success', 'legend-duplicate', 'legend-error', 'legend-pending'];
    legends.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });

    // Render empty history state
    listContainer.style.justifyContent = 'center';
    listContainer.innerHTML = `
      <div class="queue-empty-state" role="status">
        <span class="queue-empty-icon" aria-hidden="true">
          <re-icon icon="scanner" decorative></re-icon>
        </span>
        <strong>Belum ada riwayat pemindaian</strong>
        <span>Pemindaian terbaru akan tampil di sini.</span>
      </div>
    `;
    return;
  }

  // 1. Calculate counters
  let successCount = 0;
  let duplicateCount = 0;
  let errorCount = 0;
  let pendingCount = 0;

  queue.forEach(item => {
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
  const progressBar = document.querySelector('.segmented-progress-bar');
  if (progressBar) {
    const completePct = Math.round(successPct + duplicatePct + errorPct);
    progressBar.setAttribute('aria-valuenow', String(completePct));
  }

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
  updateLegend('legend-pending', pendingCount, 'Memproses');

  // 4. Render items (up to 10 items)
  const renderItems = queue.slice(0, 10);
  listContainer.style.justifyContent = renderItems.length <= 1 ? 'center' : 'flex-start';
  listContainer.innerHTML = '';

  renderItems.forEach(item => {
    const row = document.createElement('div');
    row.className = `queue-row ${item.status}`;
    row.style.cursor = 'pointer';
    row.setAttribute('role', 'button');
    row.setAttribute('tabindex', '0');
    const statusTextMap = {
      success: 'hadir',
      duplicate: 'presensi sudah tercatat',
      error: 'gagal',
      processing: 'sedang sinkronisasi',
      pending: 'menunggu sinkronisasi'
    };
    row.setAttribute('aria-label', `Detail pemindaian ${item.name || 'Katekumen'}, ${statusTextMap[item.status] || item.status}`);
    
    row.onclick = () => {
      row.blur();
      window.showStudentModal(item);
    };
    row.onkeydown = (event) => {
      if (event.key === ' ' || event.key === 'Enter') {
        event.preventDefault();
        window.showStudentModal(item, row);
      }
    };

    if (item.status !== 'pending' && item.status !== 'processing') {
      row.classList.add('dismissible');
      const dismissButton = document.createElement('button');
      dismissButton.type = 'button';
      dismissButton.className = 'history-dismiss-btn';
      dismissButton.setAttribute('aria-label', `Hapus riwayat ${item.name || item.studentId || 'pemindaian'}`);
      const dismissGlyph = document.createElement('span');
      dismissGlyph.setAttribute('aria-hidden', 'true');
      dismissGlyph.textContent = '×';
      dismissButton.appendChild(dismissGlyph);
      dismissButton.addEventListener('click', event => {
        event.stopPropagation();
        window.scanQueue?.dismiss(item.id);
      });
      dismissButton.addEventListener('keydown', event => event.stopPropagation());
      row.appendChild(dismissButton);
    }

    const avatarSrc = item.image || '/assets/favicon.png';
    
    const studentInfo = document.createElement('div');
    studentInfo.className = 'student-info';

    const studentPhoto = document.createElement('img');
    studentPhoto.className = 'student-photo';
    studentPhoto.setAttribute('data-student-id', item.studentId || '');
    studentPhoto.alt = 'Foto';
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

    const studentTopic = document.createElement('span');
    studentTopic.className = 'student-topic';
    studentTopic.textContent = `Topik ${item.week}`;
    studentText.appendChild(studentTopic);

    const studentIdSpan = document.createElement('span');
    studentIdSpan.className = 'student-id';
    studentIdSpan.textContent = item.studentId;
    studentText.appendChild(studentIdSpan);

    studentInfo.appendChild(studentText);
    row.appendChild(studentInfo);

    const statusBadge = document.createElement('span');
    statusBadge.className = `status-badge ${item.status}`;
    
    const statusIconByStatus = {
      success: 'check',
      error: 'x-circle',
      duplicate: 'refresh',
      pending: 'timer'
    };
    const icon = item.status === 'processing'
      ? Object.assign(document.createElement('app-spinner'), { className: 'app-spinner status-spinner' })
      : window.createAppIcon(statusIconByStatus[item.status] || statusIconByStatus.pending);
    if (item.status === 'processing') icon.setAttribute('aria-hidden', 'true');
    
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
        const dot = document.createElement('button');
        dot.setAttribute('type', 'button');
        dot.className = `carousel-dot ${index === 0 ? 'active' : ''}`;
        dot.setAttribute('aria-label', `Halaman ${index + 1}`);
        if (index === 0) dot.setAttribute('aria-current', 'step');
        dot.onclick = () => {
          const cards = listContainer.querySelectorAll('.queue-row');
          const itemWidth = cards.length > 1 ? (cards[1].offsetLeft - cards[0].offsetLeft) : listContainer.clientWidth;
          listContainer.scrollTo({
            left: index * itemWidth,
            behavior: 'smooth'
          });
        };
        dotsContainer.appendChild(dot);
      });

      // Add scroll listener to update active dots (cache dot elements and active index to avoid high-frequency DOM mutations)
      const dots = Array.from(dotsContainer.querySelectorAll('.carousel-dot'));
      let currentActiveIndex = 0;
      listContainer.onscroll = () => {
        const scrollLeft = listContainer.scrollLeft;
        const cards = listContainer.querySelectorAll('.queue-row');
        const itemWidth = cards.length > 1 ? (cards[1].offsetLeft - cards[0].offsetLeft) : (listContainer.clientWidth || 1);
        const activeIndex = Math.max(0, Math.min(renderItems.length - 1, Math.round(scrollLeft / itemWidth)));
        if (activeIndex !== currentActiveIndex) {
          if (dots[currentActiveIndex]) {
            dots[currentActiveIndex].classList.remove('active');
            dots[currentActiveIndex].removeAttribute('aria-current');
          }
          if (dots[activeIndex]) {
            dots[activeIndex].classList.add('active');
            dots[activeIndex].setAttribute('aria-current', 'step');
          }
          currentActiveIndex = activeIndex;
        }
        updateNavButtons(listContainer, renderItems.length);
      };
    } else {
      dotsContainer.style.display = 'none';
      listContainer.onscroll = null;
    }
  }

  // Update navigation buttons initially
  updateNavButtons(listContainer, renderItems.length);
}

window.renderScanHistory = renderScanHistory;
window.addEventListener('scanqueuechange', event => renderScanHistory(event.detail));

let studentModalReturnFocus = null;
let studentModalCloseTimer = null;
const STUDENT_DRAWER_CLOSE_MS = 280;
const STUDENT_DRAWER_DISMISS_DISTANCE = 96;
const STUDENT_DRAWER_DISMISS_VELOCITY = 0.5;

window.showStudentModal = function(item, trigger) {
  const modal = document.getElementById('student-detail-modal');
  const photoEl = document.getElementById('modal-student-photo');
  const nameEl = document.getElementById('modal-student-name');
  const idEl = document.getElementById('modal-student-id');
  const topicEl = document.getElementById('modal-student-topic');
  const statusEl = document.getElementById('modal-student-status');

  if (!modal) return;

  const modalImgSrc = item.image || '/assets/favicon.png';

  photoEl.setAttribute('data-student-id', item.studentId || '');
  photoEl.onerror = function() {
    this.onerror = null;
    this.src = '/assets/favicon.png';
  };
  photoEl.src = modalImgSrc;

  nameEl.textContent = item.name || 'Katekumen';
  idEl.textContent = item.studentId;
  
  topicEl.textContent = `Topik ${item.week}`;

  statusEl.className = `status-badge ${item.status}`;
  
  let statusText = item.status;
  if (item.status === 'success') statusText = 'HADIR';
  if (item.status === 'duplicate') statusText = 'PRESENSI SUDAH TERCATAT';
  if (item.status === 'error') statusText = 'GAGAL';
  if (item.status === 'pending') statusText = 'MENUNGGU...';
  if (item.status === 'processing') statusText = 'SYNCING...';
  statusEl.textContent = statusText;

  if (!modal.open) {
    studentModalReturnFocus = trigger || null;
    clearTimeout(studentModalCloseTimer);
    modal.classList.remove('is-open', 'is-closing', 'is-dragging');
    modal.querySelector('.student-modal-content')?.style.removeProperty('--drawer-offset');
    modal.showModal();
    modal.getBoundingClientRect();
    requestAnimationFrame(() => {
      if (!modal.open) return;
      modal.classList.add('is-open');
      modal.focus({ preventScroll: true });
    });
  }
};

window.closeStudentModal = function(event) {
  const modal = document.getElementById('student-detail-modal');
  if (event) event.stopPropagation();
  if (!modal?.open || modal.classList.contains('is-closing')) return;

  clearTimeout(studentModalCloseTimer);
  modal.classList.remove('is-open', 'is-dragging');
  modal.classList.add('is-closing');
  modal.querySelector('.student-modal-content')?.style.removeProperty('--drawer-offset');

  const finishClose = () => {
    if (!modal.open) return;
    modal.close();
    modal.classList.remove('is-closing');
    studentModalReturnFocus?.isConnected && studentModalReturnFocus.focus({ preventScroll: true });
    studentModalReturnFocus = null;
  };
  const delay = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : STUDENT_DRAWER_CLOSE_MS;
  studentModalCloseTimer = setTimeout(finishClose, delay);
};

function bindStudentDrawer() {
  const modal = document.getElementById('student-detail-modal');
  const sheet = modal?.querySelector('.student-modal-content');
  const handle = modal?.querySelector('[data-drawer-handle]');
  if (!modal || !sheet || !handle) return;

  let pointerId = null;
  let startY = 0;
  let startTime = 0;
  let distance = 0;

  const snapBack = () => {
    pointerId = null;
    modal.classList.remove('is-dragging');
    sheet.style.removeProperty('--drawer-offset');
  };

  handle.addEventListener('pointerdown', event => {
    if (event.button !== 0 || !modal.open) return;
    pointerId = event.pointerId;
    startY = event.clientY;
    startTime = performance.now();
    distance = 0;
    modal.classList.add('is-dragging');
    handle.setPointerCapture(pointerId);
  });

  handle.addEventListener('pointermove', event => {
    if (event.pointerId !== pointerId) return;
    distance = Math.max(0, event.clientY - startY);
    sheet.style.setProperty('--drawer-offset', `${distance}px`);
  });

  handle.addEventListener('pointerup', event => {
    if (event.pointerId !== pointerId) return;
    const velocity = distance / Math.max(performance.now() - startTime, 1);
    pointerId = null;
    if (distance >= STUDENT_DRAWER_DISMISS_DISTANCE || (distance >= 24 && velocity >= STUDENT_DRAWER_DISMISS_VELOCITY)) {
      window.closeStudentModal(event);
    } else {
      snapBack();
    }
  });
  handle.addEventListener('pointercancel', snapBack);

  modal.addEventListener('click', event => {
    if (event.target === modal) window.closeStudentModal(event);
  });
  modal.addEventListener('cancel', event => {
    event.preventDefault();
    window.closeStudentModal(event);
  });
}

bindStudentDrawer();

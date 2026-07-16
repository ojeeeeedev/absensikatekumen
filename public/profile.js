

const getProfileToken = () => sessionStorage.getItem('authToken') || getCookie('auth_token');

let allStudents = [];

// Note: handleLogout, updateActivity, and checkTopicExpiry are now centralized in session.js




// ============================================================
// Photo Upload Manager
// ============================================================
const PhotoUploader = createProfilePhotoUploader({
  getToken: getProfileToken,
  findStudent: studentId => allStudents.find(student => student.studentId === studentId),
  onUploaded: () => {
    renderStudents(allStudents);
    filterStudents();
  },
});

// ============================================================
// Class / Student Loading
// ============================================================

let classCombobox;

async function loadClasses() {
  try {
    const res = await fetch('/api/classes', {
      headers: {
        'Authorization': `Bearer ${getProfileToken()}`
      }
    });
    const data = await res.json();
    if (data.status === 'ok') {
      classCombobox.setItems(data.classes, 'Kelas tidak tersedia');
    } else {
      classCombobox.setItems([], 'Gagal memuat kelas');
      showToast(data.message || "Gagal memuat daftar kelas", "error");
    }
  } catch (e) {
    console.error("Error loading classes:", e);
    classCombobox.setItems([], 'Gagal memuat kelas');
    showToast("Gagal memuat daftar kelas", "error");
  }
}

async function loadStudents(classCode) {
  const listContainer = document.getElementById('students-list');
  const loader = document.getElementById('students-loader');
  const summaryContainer = document.getElementById('students-summary');
  
  // Hide counts summary box immediately when starting to load a class
  if (summaryContainer) {
    summaryContainer.style.display = 'none';
  }
  
  // Reset the list position when loading a new class.
  if (listContainer) listContainer.scrollTop = 0;
  
  if (listContainer) listContainer.innerHTML = '';
  if (loader) loader.style.display = 'flex';
  
  try {
    const res = await fetch(`/api/students?classCode=${classCode}`, {
      headers: {
        'Authorization': `Bearer ${getProfileToken()}`
      }
    });
    const data = await res.json();
    if (data.status === 'ok') {
      allStudents = data.students;
      renderStudents(allStudents);
      filterStudents();
    } else {
      showToast(data.message || "Gagal memuat data", "error");
    }
  } catch (e) {
    console.error("Error loading students:", e);
    showToast("Gagal mengambil data katekumen", "error");
  } finally {
    if (loader) loader.style.display = 'none';
  }
}

function escapeHTML(str) {
  if (!str) return '';
  return str.toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function isInactive(student) {
  if (!student) return false;
  const ki = String(student.kelasKi || '').trim().toLowerCase();
  const kk = String(student.katekisKk || '').trim().toLowerCase();
  return ki === 'inactive' || kk === 'inactive';
}

function renderStudents(students) {
  const listContainer = document.getElementById('students-list');
  const summaryContainer = document.getElementById('students-summary');
  
  const summaryActiveText = document.getElementById('summary-active-text');
  const summaryInactiveText = document.getElementById('summary-inactive-text');
  
  if (!listContainer) return;
  listContainer.style.removeProperty('--profile-scroll-slack');
  listContainer.innerHTML = '';

  // Group active and inactive students (inactive at the bottom)
  const activeList = students.filter(s => !isInactive(s));
  const inactiveList = students.filter(s => isInactive(s));
  
  // Update count summary badges
  if (summaryContainer && summaryActiveText && summaryInactiveText) {
    const selector = document.getElementById('class-selector');
    const classCode = selector ? selector.value : '';
    
    if (classCode) {
      summaryContainer.style.display = 'flex';
      
      // Calculate active/inactive counts from full class list (allStudents) instead of filtered students list
      const activeAll = allStudents.filter(s => !isInactive(s));
      const inactiveAll = allStudents.filter(s => isInactive(s));
      
      const currentActive = activeAll.length;
      const currentInactive = inactiveAll.length;

      summaryActiveText.textContent = String(currentActive);
      summaryInactiveText.textContent = String(currentInactive);
      summaryActiveText.parentElement.setAttribute('aria-label', `${currentActive} katekumen aktif`);
      summaryInactiveText.parentElement.setAttribute('aria-label', `${currentInactive} katekumen nonaktif`);
    } else {
      summaryContainer.style.display = 'none';
    }
  }
  
  const closeTimers = new WeakMap();
  const finishClose = (body) => {
    clearTimeout(closeTimers.get(body));
    closeTimers.delete(body);
    body.classList.remove('expanded', 'closing');
    body.classList.add('collapsed');
    const header = body.previousElementSibling;
    header.classList.remove('active', 'closing');
    header.setAttribute('aria-expanded', 'false');
  };

  const withoutMotion = (items, update) => {
    items.forEach(item => item.classList.add('skip-transition'));
    update();
    items[0]?.offsetHeight;
    requestAnimationFrame(() => items.forEach(item => item.classList.remove('skip-transition')));
  };
  
  // Helper to build a single student accordion item
  const buildStudentItem = (student, index, totalOffset = 0) => {
    const item = document.createElement('div');
    const studentInactive = isInactive(student);
    item.className = studentInactive
      ? 'student-accordion-item inactive'
      : 'student-accordion-item';
    item.dataset.searchName = String(student.name || '').toLowerCase();
    item.dataset.searchId = String(student.studentId || '').toLowerCase();
    item.dataset.searchKi = String(student.kelasKi || '').toLowerCase();
    item.dataset.searchKk = String(student.katekisKk || '').toLowerCase();

    const delay = Math.min((index + totalOffset) * 0.04, 0.8);
    item.style.animationDelay = `${delay}s`;

    const header = document.createElement('div');
    header.className = 'student-accordion-header';
    header.setAttribute('tabindex', '0');
    header.setAttribute('role', 'button');
    header.setAttribute('aria-expanded', 'false');
    header.setAttribute('aria-label', `${student.name || 'Katekumen'}, ${student.studentId || 'tanpa ID'}`);

    const displayImgUrl = student.image;
    const hasPhoto = !!displayImgUrl;

    const photoHtml = hasPhoto
      ? `<div class="student-photo-frame student-thumb-frame" aria-busy="true">
           <app-spinner class="app-spinner profile-photo-spinner" aria-hidden="true"></app-spinner>
           <img class="student-thumb" src="${escapeHTML(displayImgUrl)}" data-student-id="${escapeHTML(student.studentId || '')}" alt="${escapeHTML(student.name)}" loading="lazy" decoding="async" onload="this.classList.add('loaded'); this.previousElementSibling.style.display='none'; this.parentElement.setAttribute('aria-busy', 'false');" onerror="this.style.display='none'; this.previousElementSibling.style.display='none'; this.nextElementSibling.style.display='flex'; this.parentElement.setAttribute('aria-busy', 'false');">
           <div class="student-thumb-placeholder" style="display: none;"><re-icon icon="user" decorative weight="filled"></re-icon></div>
         </div>`
      : `<div class="student-thumb-placeholder"><re-icon icon="user" decorative weight="filled"></re-icon></div>`;

    const inactiveBadge = studentInactive
      ? `<span class="inactive-badge">Nonaktif</span>`
      : '';

    header.innerHTML = `
      <div class="header-left">
        ${photoHtml}
        <div class="student-meta">
          <div class="student-name-text-wrapper">
            <div class="student-name-text">${escapeHTML(student.name)}</div>
          </div>
          <div class="student-id-text">${escapeHTML(student.studentId)}</div>
        </div>
      </div>
      <div class="header-right">
        ${inactiveBadge}
        <re-icon icon="chevron-down" class="expand-arrow" decorative weight="filled"></re-icon>
      </div>
    `;

    const body = document.createElement('div');
    body.className = 'student-accordion-body collapsed';

    const photoReplaceControl = `
      <div class="photo-replace-menu" aria-hidden="true">
        <re-icon icon="gallery-add" weight="filled" decorative></re-icon>
        <span>Ubah Foto</span>
      </div>
      <input class="photo-replace-input" type="file" accept="image/jpeg,image/png,image/webp" hidden>
    `;

    const largePhotoHtml = hasPhoto
      ? `<div class="student-photo-frame student-photo-large-frame" aria-busy="true" role="button" tabindex="0" aria-label="Ganti foto ${escapeHTML(student.name)}" aria-expanded="false">
           <app-spinner class="app-spinner profile-photo-spinner" aria-hidden="true"></app-spinner>
           <img class="student-photo-large" src="${escapeHTML(displayImgUrl)}" alt="Foto ${escapeHTML(student.name)}" loading="lazy" decoding="async" onload="this.classList.add('loaded'); this.previousElementSibling.style.display='none'; this.parentElement.setAttribute('aria-busy', 'false');" onerror="this.style.display='none'; this.previousElementSibling.style.display='none'; this.nextElementSibling.style.display='flex'; this.parentElement.setAttribute('aria-busy', 'false');">
           <div class="student-photo-placeholder" style="display: none;"><re-icon icon="user" decorative weight="filled"></re-icon></div>
           ${photoReplaceControl}
         </div>`
      : `<div class="student-photo-frame student-photo-large-frame" role="button" tabindex="0" aria-label="Tambah foto ${escapeHTML(student.name)}" aria-expanded="false">
           <div class="student-photo-placeholder"><re-icon icon="user" decorative weight="filled"></re-icon></div>
           ${photoReplaceControl}
         </div>`;

    const katekisKiVal = student.kelasKi ? escapeHTML(student.kelasKi) : `<span class="text-na">N/A</span>`;
    const katekisKkVal = student.katekisKk ? escapeHTML(student.katekisKk) : `<span class="text-na">N/A</span>`;

    body.innerHTML = `
      <div class="student-accordion-inner">
        <div class="student-detail-card">
          ${largePhotoHtml}
          <div class="detail-info-grid">
            <div class="detail-item">
              <span class="detail-label">
                <re-icon icon="calendar-mark" class="detail-icon-inline" decorative weight="filled"></re-icon><span>TTL</span><span class="detail-colon">:</span>
              </span>
              <span class="detail-value">${escapeHTML(student.dob) || '-'}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">
                <re-icon icon="users2" class="detail-icon-inline" decorative weight="filled"></re-icon><span>KI</span><span class="detail-colon">:</span>
              </span>
              <span class="detail-value">${katekisKiVal}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">
                <re-icon icon="user" class="detail-icon-inline" decorative weight="filled"></re-icon><span>KK</span><span class="detail-colon">:</span>
              </span>
              <span class="detail-value">${katekisKkVal}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">
                <re-icon icon="user-id" class="detail-icon-inline" decorative weight="filled"></re-icon><span>ID</span><span class="detail-colon">:</span>
              </span>
              <span class="detail-value detail-id-value">${escapeHTML(student.studentId)}</span>
            </div>
          </div>
        </div>
      </div>
    `;

    const photoFrame = body.querySelector('.student-photo-large-frame');
    const photoMenu = photoFrame?.querySelector('.photo-replace-menu');
    const photoInput = photoFrame?.querySelector('.photo-replace-input');
    const canHover = window.matchMedia('(hover: hover) and (pointer: fine)');
    let photoMenuTimer;

    const closePhotoMenu = () => {
      clearTimeout(photoMenuTimer);
      photoFrame?.classList.remove('is-replace-open', 'is-dragover');
      photoFrame?.setAttribute('aria-expanded', 'false');
      photoMenu?.setAttribute('aria-hidden', 'true');
    };
    const armPhotoMenuTimeout = () => {
      clearTimeout(photoMenuTimer);
      photoMenuTimer = setTimeout(closePhotoMenu, 5000);
    };
    const openPhotoMenu = () => {
      photoFrame.classList.add('is-replace-open');
      photoFrame.setAttribute('aria-expanded', 'true');
      photoMenu.setAttribute('aria-hidden', 'false');
      armPhotoMenuTimeout();
    };
    const choosePhoto = (file) => {
      if (!file) return;
      closePhotoMenu();
      PhotoUploader.open(student.studentId, student.name, file);
    };

    const handlePhotoFrameAction = (event) => {
      if (event.target === photoInput) return;
      event.stopPropagation();
      if (photoFrame.classList.contains('is-replace-open')) {
        armPhotoMenuTimeout();
        photoInput.click();
      } else {
        openPhotoMenu();
      }
    };
    photoFrame?.addEventListener('click', handlePhotoFrameAction);
    photoFrame?.addEventListener('pointerenter', () => {
      if (canHover.matches) openPhotoMenu();
    });
    photoFrame?.addEventListener('pointerleave', () => {
      if (canHover.matches) closePhotoMenu();
    });
    photoFrame?.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      handlePhotoFrameAction(event);
    });
    photoInput?.addEventListener('change', () => choosePhoto(photoInput.files?.[0]));
    photoFrame?.addEventListener('dragenter', (event) => {
      event.preventDefault();
      openPhotoMenu();
      photoFrame.classList.add('is-dragover');
    });
    photoFrame?.addEventListener('dragover', (event) => {
      event.preventDefault();
      armPhotoMenuTimeout();
    });
    photoFrame?.addEventListener('dragleave', () => photoFrame.classList.remove('is-dragover'));
    photoFrame?.addEventListener('drop', (event) => {
      event.preventDefault();
      choosePhoto(event.dataTransfer?.files?.[0]);
    });

    const toggle = (animate = true) => {
      const shouldAnimate = animate && !matchMedia('(prefers-reduced-motion: reduce)').matches;
      const isExpanded = body.classList.contains('expanded');
      const previousBodies = [...document.querySelectorAll('.student-accordion-body:is(.expanded, .closing)')]
        .filter(openBody => openBody !== body);
      const list = document.getElementById('students-list');
      const shouldStabilize = previousBodies.length > 0 || list?.style.getPropertyValue('--profile-scroll-slack');
      const itemTopBeforeSwitch = shouldStabilize ? item.getBoundingClientRect().top : null;
      list?.style.removeProperty('--profile-scroll-slack');

      const closeCurrent = () => {
        body.classList.remove('expanded');
        body.classList.add('closing');
        header.classList.remove('active');
        header.classList.add('closing');
        header.setAttribute('aria-expanded', 'false');
        closeTimers.set(body, setTimeout(() => finishClose(body), 220));
      };

      const openCurrent = () => {
        clearTimeout(closeTimers.get(body));
        closeTimers.delete(body);
        body.classList.remove('collapsed', 'closing');
        body.classList.add('expanded');
        header.classList.remove('closing');
        header.classList.add('active');
        header.setAttribute('aria-expanded', 'true');
      };

      if (isExpanded) {
        if (shouldAnimate) closeCurrent();
        else withoutMotion([item], () => finishClose(body));
        return;
      }

      if (previousBodies.length > 0 || !shouldAnimate) {
        const affectedItems = [...new Set([item, ...previousBodies.map(openBody => openBody.parentElement)])];
        withoutMotion(affectedItems, () => {
          previousBodies.forEach(finishClose);
          openCurrent();
        });
      } else {
        openCurrent();
      }

      if (shouldStabilize) {
        const itemTopAfterSwitch = item.getBoundingClientRect().top;
        if (list) list.scrollTop += itemTopAfterSwitch - itemTopBeforeSwitch;
      }

      header.focus({ preventScroll: true });
      requestAnimationFrame(() => {
        if (!body.classList.contains('expanded')) return;
        if (!list) return;
        const scrollDistance = item.getBoundingClientRect().top - list.getBoundingClientRect().top;
        const missingScrollRange = Math.max(
          0,
          list.scrollTop + scrollDistance - (list.scrollHeight - list.clientHeight)
        );
        if (missingScrollRange > 0) {
          list.style.setProperty('--profile-scroll-slack', `${Math.ceil(missingScrollRange)}px`);
        }
        list.scrollBy({
          top: scrollDistance,
          behavior: shouldAnimate ? 'smooth' : 'auto'
        });
      });
    };

    header.addEventListener('click', () => toggle());
    header.addEventListener('keydown', (e) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        toggle(false);
      }
    });

    item.appendChild(header);
    item.appendChild(body);
    return item;
  };

  // Render active students
  activeList.forEach((student, index) => {
    listContainer.appendChild(buildStudentItem(student, index, 0));
  });

  // Render inactive students inside a collapsible group (default: closed)
  if (inactiveList.length > 0) {
    const groupWrapper = document.createElement('div');
    groupWrapper.className = 'inactive-group-wrapper';

    const groupHeader = document.createElement('div');
    groupHeader.className = 'inactive-group-header';
    groupHeader.setAttribute('role', 'button');
    groupHeader.setAttribute('tabindex', '0');
    groupHeader.setAttribute('aria-expanded', 'false');
    groupHeader.innerHTML = `
      <re-icon icon="user-off" decorative weight="filled"></re-icon>
      <span class="inactive-group-count">Nonaktif (${inactiveList.length})</span>
      <re-icon icon="chevron-down" class="inactive-group-arrow" decorative weight="filled"></re-icon>
    `;

    const groupBody = document.createElement('div');
    groupBody.className = 'inactive-group-body';

    const groupInner = document.createElement('div');
    groupInner.className = 'inactive-group-inner';

    inactiveList.forEach((student, index) => {
      groupInner.appendChild(buildStudentItem(student, index, activeList.length));
    });

    groupBody.appendChild(groupInner);

    const toggleGroup = () => {
      const isOpen = groupHeader.classList.contains('open');
      if (isOpen) {
        groupHeader.classList.remove('open');
        groupBody.classList.remove('open');
        groupHeader.setAttribute('aria-expanded', 'false');
      } else {
        groupHeader.classList.add('open');
        groupBody.classList.add('open');
        groupHeader.setAttribute('aria-expanded', 'true');
      }
    };

    groupHeader.addEventListener('click', toggleGroup);
    groupHeader.addEventListener('keydown', (e) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        toggleGroup();
      }
    });

    groupWrapper.appendChild(groupHeader);
    groupWrapper.appendChild(groupBody);
    listContainer.appendChild(groupWrapper);
  }

  const emptyState = document.createElement('div');
  emptyState.className = 'empty-state';
  emptyState.hidden = students.length > 0;
  emptyState.innerHTML = `
    <re-icon icon="incognito" class="empty-icon" decorative></re-icon>
    <p>Tidak ada data katekumen ditemukan.</p>
  `;
  listContainer.appendChild(emptyState);
}

function filterStudents() {
  const searchInput = document.getElementById('search-input');
  const listContainer = document.getElementById('students-list');
  if (!searchInput || !listContainer) return;

  const query = searchInput.value.toLowerCase().trim();
  const scopedQuery = query.match(/^(ki|kk)\s*:(.*)$/);
  const scope = scopedQuery?.[1];
  const term = scopedQuery ? scopedQuery[2].trim() : query;
  let visibleCount = 0;
  let visibleInactiveCount = 0;

  listContainer.scrollTop = 0;
  listContainer.style.removeProperty('--profile-scroll-slack');

  listContainer.querySelectorAll('.student-accordion-item').forEach((item) => {
    const matches = scope
      ? item.dataset[scope === 'ki' ? 'searchKi' : 'searchKk'].includes(term)
      : ['searchName', 'searchId', 'searchKi', 'searchKk']
          .some(field => item.dataset[field].includes(term));

    item.hidden = !matches;
    if (matches) {
      visibleCount += 1;
      if (item.classList.contains('inactive')) visibleInactiveCount += 1;
    }

    const body = item.querySelector('.student-accordion-body');
    const header = item.querySelector('.student-accordion-header');
    if (body?.classList.contains('expanded') || body?.classList.contains('closing')) {
      body.classList.remove('expanded', 'closing');
      body.classList.add('collapsed');
      header?.classList.remove('active', 'closing');
      header?.setAttribute('aria-expanded', 'false');
    }
  });

  const inactiveGroup = listContainer.querySelector('.inactive-group-wrapper');
  if (inactiveGroup) {
    inactiveGroup.hidden = visibleInactiveCount === 0;
    const groupHeader = inactiveGroup.querySelector('.inactive-group-header');
    const groupBody = inactiveGroup.querySelector('.inactive-group-body');
    const groupCount = inactiveGroup.querySelector('.inactive-group-count');
    groupHeader?.classList.remove('open');
    groupBody?.classList.remove('open');
    groupHeader?.setAttribute('aria-expanded', 'false');
    if (groupCount) groupCount.textContent = `Nonaktif (${visibleInactiveCount})`;
  }

  const emptyState = listContainer.querySelector('.empty-state');
  if (emptyState) emptyState.hidden = visibleCount > 0;
}

let profileInitialized = false;

window.initializeProfileView = function initializeProfileView() {
  if (profileInitialized) return;
  profileInitialized = true;
  initTheme();
  PhotoUploader.init();
  classCombobox = createSearchCombobox({
    rootId: 'class-combobox',
    triggerId: 'class-combobox-trigger',
    popoverId: 'class-combobox-popover',
    searchId: 'class-combobox-search',
    listId: 'class-combobox-options',
    emptyId: 'class-combobox-empty',
    valueId: 'class-combobox-value',
    selectId: 'class-selector',
    placeholder: 'Pilih Kelas...',
    getValue: item => item.code,
    getLabel: item => `Kelompok ${item.name}`,
    getSearchText: item => `${item.code} ${item.name}`
  });
  loadClasses();

  const selector = document.getElementById('class-selector');
  if (selector) {
    selector.addEventListener('change', (e) => {
      document.getElementById('app-container')?.classList.add('profile-expanded');
      const infoBar = document.getElementById('profile-info-bar');
      const searchInput = document.getElementById('search-input');
      if (infoBar) infoBar.style.display = 'flex';
      if (searchInput) {
        searchInput.value = '';
      }
      loadStudents(e.target.value);
    });
  }
  
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.addEventListener('input', filterStudents);
  }
};

window.closeProfileViewUI = function closeProfileViewUI() {
  classCombobox?.close();
  if (profileInitialized) PhotoUploader.close();
};

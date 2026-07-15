

const getProfileToken = () => sessionStorage.getItem('authToken') || getCookie('auth_token');

let allStudents = [];

// Note: handleLogout, updateActivity, and checkTopicExpiry are now centralized in session.js




// ============================================================
// Photo Upload Manager
// ============================================================
const PhotoUploader = createProfilePhotoUploader({
  getToken: getProfileToken,
  findStudent: studentId => allStudents.find(student => student.studentId === studentId),
  onUploaded: filterStudents,
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
  const appSection = document.getElementById('profile-view');
  if (appSection) appSection.scrollTop = 0;
  
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

function renderStudents(students) {
  const listContainer = document.getElementById('students-list');
  const summaryContainer = document.getElementById('students-summary');
  
  const summaryActiveText = document.getElementById('summary-active-text');
  const summaryInactiveText = document.getElementById('summary-inactive-text');
  
  if (!listContainer) return;
  listContainer.innerHTML = '';

  // Inactive helper
  const isInactive = (student) => {
    if (!student) return false;
    const ki = String(student.kelasKi || '').trim().toLowerCase();
    const kk = String(student.katekisKk || '').trim().toLowerCase();
    return ki === 'inactive' || kk === 'inactive';
  };

  // Group active and inactive students (inactive at the bottom)
  const activeList = students.filter(s => !isInactive(s));
  const inactiveList = students.filter(s => isInactive(s));
  const processedStudents = [...activeList, ...inactiveList];
  
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
  
  if (processedStudents.length === 0) {
    listContainer.innerHTML = `
      <div class="empty-state">
        <re-icon icon="user-search" class="empty-icon" decorative></re-icon>
        <p>Tidak ada data katekumen ditemukan.</p>
      </div>
    `;
    return;
  }
  
  // Helper to build a single student accordion item
  const buildStudentItem = (student, index, totalOffset = 0) => {
    const item = document.createElement('div');
    const studentInactive = isInactive(student);
    item.className = studentInactive
      ? 'student-accordion-item inactive'
      : 'student-accordion-item';

    const delay = Math.min((index + totalOffset) * 0.04, 0.8);
    item.style.animationDelay = `${delay}s`;

    const header = document.createElement('div');
    header.className = 'student-accordion-header';
    header.setAttribute('tabindex', '0');
    header.setAttribute('role', 'button');
    header.setAttribute('aria-expanded', 'false');

    const displayImgUrl = student.image;
    const hasPhoto = !!displayImgUrl;

    const photoHtml = hasPhoto
      ? `<img class="student-thumb" src="${escapeHTML(displayImgUrl)}" data-student-id="${escapeHTML(student.studentId || '')}" alt="${escapeHTML(student.name)}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
         <div class="student-thumb-placeholder" style="display: none;"><re-icon icon="user" decorative></re-icon></div>`
      : `<div class="student-thumb-placeholder"><re-icon icon="user" decorative></re-icon></div>`;

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
        <re-icon icon="chevron-down" class="expand-arrow" decorative></re-icon>
      </div>
    `;

    const body = document.createElement('div');
    body.className = 'student-accordion-body collapsed';

    const largePhotoHtml = hasPhoto
      ? `<img class="student-photo-large" src="${escapeHTML(displayImgUrl)}" alt="Foto ${escapeHTML(student.name)}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
         <div class="student-photo-placeholder" style="display: none;"><re-icon icon="user" decorative></re-icon></div>`
      : `<div class="student-photo-placeholder"><re-icon icon="user" decorative></re-icon></div>`;

    const kelasKiVal = student.kelasKi ? escapeHTML(student.kelasKi) : `<span class="text-na">N/A</span>`;
    const katekisKkVal = student.katekisKk ? escapeHTML(student.katekisKk) : `<span class="text-na">N/A</span>`;

    body.innerHTML = `
      <div class="student-accordion-inner">
        <div class="student-detail-card">
          ${largePhotoHtml}
          <h3 class="detail-name">${escapeHTML(student.name)}</h3>
          <p class="detail-id">ID: ${escapeHTML(student.studentId)}</p>
          <div class="detail-info-grid">
            <div class="detail-item">
              <span class="detail-value detail-value-with-icon">
                <re-icon icon="cake2" class="detail-icon-inline" decorative></re-icon>${escapeHTML(student.dob) || '-'}
              </span>
            </div>
            <div class="detail-item">
              <span class="detail-label">
                <re-icon icon="home-user" class="detail-icon-inline" decorative></re-icon>Kelompok Induk
              </span>
              <span class="detail-value">${kelasKiVal}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">
                <re-icon icon="user" class="detail-icon-inline" decorative></re-icon>Kelompok Kecil
              </span>
              <span class="detail-value">${katekisKkVal}</span>
            </div>
          </div>
          <button class="upload-photo-btn" data-student-id="${escapeHTML(student.studentId)}" data-student-name="${escapeHTML(student.name)}" type="button" aria-label="Ganti foto ${escapeHTML(student.name)}">
            <re-icon icon="camera" decorative></re-icon>
            Ganti Foto
          </button>
        </div>
      </div>
    `;

    const uploadBtn = body.querySelector('.upload-photo-btn');
    if (uploadBtn) {
      uploadBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        PhotoUploader.open(uploadBtn.dataset.studentId, uploadBtn.dataset.studentName);
      });
    }

    const toggle = () => {
      const isExpanded = body.classList.contains('expanded');
      document.querySelectorAll('.student-accordion-body').forEach(b => {
        b.classList.remove('expanded');
        b.classList.add('collapsed');
      });
      document.querySelectorAll('.student-accordion-header').forEach(h => {
        h.classList.remove('active');
        h.setAttribute('aria-expanded', 'false');
      });
      if (!isExpanded) {
        body.classList.remove('collapsed');
        body.classList.add('expanded');
        header.classList.add('active');
        header.setAttribute('aria-expanded', 'true');
        header.focus({ preventScroll: true });
        requestAnimationFrame(() => {
          Promise.allSettled(body.getAnimations().map(animation => animation.finished)).then(() => {
            if (!body.classList.contains('expanded')) return;
            const profile = document.getElementById('profile-view');
            const controls = profile?.querySelector('.profile-selector-container');
            if (!profile || !controls) return;
            const gap = parseFloat(getComputedStyle(controls).marginBottom) || 0;
            profile.scrollBy({
              top: item.getBoundingClientRect().top - controls.getBoundingClientRect().bottom - gap,
              behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
            });
          });
        });
      }
    };

    header.addEventListener('click', toggle);
    header.addEventListener('keydown', (e) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        toggle();
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
      <re-icon icon="user-minus" decorative></re-icon>
      <span>Nonaktif (${inactiveList.length})</span>
      <re-icon icon="chevron-down" class="inactive-group-arrow" decorative></re-icon>
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

}

function filterStudents() {
  const searchInput = document.getElementById('search-input');
  if (!searchInput) return;
  const query = searchInput.value.toLowerCase().trim();
  const filtered = allStudents.filter(s => 
    (s.name || '').toLowerCase().includes(query) || 
    (s.studentId || '').toLowerCase().includes(query)
  );
  renderStudents(filtered);
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

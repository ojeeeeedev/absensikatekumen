

const token = getCookie('auth_token');
if (!token) {
  window.location.href = '/';
}

let allStudents = [];

// Note: handleLogout, updateActivity, and checkTopicExpiry are now centralized in session.js




// ============================================================
// Photo Upload Manager
// ============================================================
const PhotoUploader = (() => {
  const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
  const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

  let currentStudentId = null;
  let currentStudentName = null;
  let selectedFile = null;

  // DOM refs (resolved lazily after DOMContentLoaded)
  let modal, sheet, dropzone, fileInput, previewImg, studentLabel,
      dropzoneIcon, dropzoneText, dropzoneSubtext,
      progressWrap, progressBar,
      confirmBtn, cancelBtn, closeBtn;

  function init() {
    modal        = document.getElementById('upload-preview-modal');
    dropzone     = document.getElementById('upload-dropzone');
    fileInput    = document.getElementById('upload-file-input');
    previewImg   = document.getElementById('upload-preview-img');
    studentLabel = document.getElementById('upload-student-label');
    dropzoneIcon = document.getElementById('upload-dropzone-icon');
    dropzoneText = document.getElementById('upload-dropzone-text');
    dropzoneSubtext = document.getElementById('upload-dropzone-subtext');
    progressWrap = document.getElementById('upload-progress-wrap');
    progressBar  = document.getElementById('upload-progress-bar');
    confirmBtn   = document.getElementById('upload-confirm-btn');
    cancelBtn    = document.getElementById('upload-cancel-btn');
    closeBtn     = document.getElementById('upload-close-btn');

    if (!modal) return; // not on profile page

    // Close actions
    closeBtn.addEventListener('click', close);
    cancelBtn.addEventListener('click', close);
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });

    // Keyboard close
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.classList.contains('open')) close();
    });

    // Dropzone click → open native file picker
    dropzone.addEventListener('click', () => fileInput.click());
    dropzone.addEventListener('keydown', (e) => {
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); fileInput.click(); }
    });

    // File input change
    fileInput.addEventListener('change', () => {
      if (fileInput.files.length > 0) handleFileSelect(fileInput.files[0]);
    });

    // Drag & drop
    dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('dragover'); });
    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
      const file = e.dataTransfer?.files?.[0];
      if (file) handleFileSelect(file);
    });

    // Confirm upload
    confirmBtn.addEventListener('click', doUpload);
  }

  function open(studentId, studentName) {
    currentStudentId = studentId;
    currentStudentName = studentName;
    selectedFile = null;

    // Reset UI
    resetDropzone();
    progressWrap.classList.remove('visible');
    progressBar.style.width = '0%';
    confirmBtn.disabled = true;
    confirmBtn.classList.remove('uploading');
    fileInput.value = '';

    // Set student label
    studentLabel.textContent = `${studentName} · ${studentId}`;

    // Show modal
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';

    // Focus close button for accessibility
    setTimeout(() => closeBtn.focus(), 50);
  }

  function close() {
    modal.classList.remove('open');
    document.body.style.overflow = '';
    selectedFile = null;
    currentStudentId = null;
    currentStudentName = null;
    fileInput.value = '';
  }

  function resetDropzone() {
    previewImg.style.display = 'none';
    previewImg.src = '';
    dropzoneIcon.style.display = '';
    dropzoneText.style.display = '';
    dropzoneSubtext.style.display = '';
  }

  function handleFileSelect(file) {
    // Validate type
    if (!ALLOWED_TYPES.includes(file.type)) {
      showToast('Format tidak didukung. Gunakan JPG, PNG, atau WebP.', 'error');
      return;
    }
    // Validate size
    if (file.size > MAX_SIZE_BYTES) {
      showToast('Ukuran file melebihi batas 5MB.', 'error');
      return;
    }

    selectedFile = file;

    // Show preview
    const reader = new FileReader();
    reader.onload = (e) => {
      previewImg.src = e.target.result;
      previewImg.style.display = 'block';
      dropzoneIcon.style.display = 'none';
      dropzoneText.style.display = 'none';
      dropzoneSubtext.style.display = 'none';
    };
    reader.readAsDataURL(file);

    confirmBtn.disabled = false;
  }

  async function doUpload() {
    if (!selectedFile || !currentStudentId) return;

    // Set uploading state
    confirmBtn.classList.add('uploading');
    confirmBtn.disabled = true;
    cancelBtn.disabled = true;
    closeBtn.disabled = true;
    progressWrap.classList.add('visible');
    progressBar.style.width = '30%';

    const formData = new FormData();
    formData.append('studentId', currentStudentId);
    formData.append('photo', selectedFile, selectedFile.name);

    try {
      progressBar.style.width = '60%';

      const res = await fetch('/api/upload-photo', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      progressBar.style.width = '90%';
      const data = await res.json();

      if (data.status === 'ok') {
        progressBar.style.width = '100%';

        // Invalidate image cache for this student
        if (window.ImageCache) {
          window.ImageCache.invalidate(currentStudentId);
        }

        // Update the in-memory student data immediately with the fresh signed URL
        if (data.signedUrl) {
          const student = allStudents.find(s => s.studentId === currentStudentId);
          if (student) {
            student.image = data.signedUrl;
          }
        }

        showToast('Foto berhasil diunggah! ✓', 'success');

        // Close modal and re-render the current student list to show new photo
        setTimeout(() => {
          close();
          filterStudents(); // re-render with updated image URL
        }, 600);
      } else {
        throw new Error(data.message || 'Gagal mengunggah foto');
      }
    } catch (err) {
      console.error('[PhotoUploader] Upload error:', err);
      showToast(`Gagal mengunggah: ${err.message}`, 'error');

      // Reset state
      confirmBtn.classList.remove('uploading');
      confirmBtn.disabled = false;
      cancelBtn.disabled = false;
      closeBtn.disabled = false;
      progressWrap.classList.remove('visible');
      progressBar.style.width = '0%';
    }
  }

  return { init, open, close };
})();


// ============================================================
// Class / Student Loading
// ============================================================

async function loadClasses() {
  try {
    const res = await fetch('/api/classes', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    const data = await res.json();
    if (data.status === 'ok') {
      const select = document.getElementById('class-selector');
      if (select) {
        select.innerHTML = '<option value="" disabled selected>Pilih Kelas...</option>';
        data.classes.forEach(c => {
          const opt = document.createElement('option');
          opt.value = c.code;
          opt.textContent = `Kelompok ${c.name}`;
          select.appendChild(opt);
        });
      }
    } else {
      showToast(data.message || "Gagal memuat daftar kelas", "error");
    }
  } catch (e) {
    console.error("Error loading classes:", e);
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
  
  // Reset scroll position and remove scrolled class on loading new students
  const appSection = document.querySelector('.app-section');
  if (appSection) {
    appSection.scrollTop = 0;
    appSection.classList.remove('scrolled');
  }
  
  if (listContainer) listContainer.innerHTML = '';
  if (loader) loader.style.display = 'flex';
  
  try {
    const res = await fetch(`/api/students?classCode=${classCode}`, {
      headers: {
        'Authorization': `Bearer ${token}`
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
  
  const summaryTotalText = document.getElementById('summary-total-text');
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
  if (summaryContainer && summaryTotalText && summaryActiveText && summaryInactiveText) {
    const selector = document.getElementById('class-selector');
    const classCode = selector ? selector.value : '';
    
    if (classCode) {
      summaryContainer.style.display = 'flex';
      
      // Calculate active/inactive counts from full class list (allStudents) instead of filtered students list
      const activeAll = allStudents.filter(s => !isInactive(s));
      const inactiveAll = allStudents.filter(s => isInactive(s));
      
      const currentTotal = allStudents.length;
      const currentActive = activeAll.length;
      const currentInactive = inactiveAll.length;

      summaryTotalText.textContent = `Total: ${currentTotal}`;
      summaryActiveText.textContent = `Aktif: ${currentActive}`;
      summaryInactiveText.textContent = `Nonaktif: ${currentInactive}`;
    } else {
      summaryContainer.style.display = 'none';
    }
  }
  
  if (processedStudents.length === 0) {
    listContainer.innerHTML = `
      <div class="empty-state">
        <span class="material-icons-outlined empty-icon">person_search</span>
        <p>Tidak ada data katekumen ditemukan.</p>
      </div>
    `;
    return;
  }
  
  processedStudents.forEach((student, index) => {
    const item = document.createElement('div');
    const studentInactive = isInactive(student);
    item.className = studentInactive 
      ? 'student-accordion-item inactive' 
      : 'student-accordion-item';
    
    // Stagger animation delays top-to-bottom
    const delay = Math.min(index * 0.04, 0.8);
    item.style.animationDelay = `${delay}s`;
    
    const header = document.createElement('div');
    header.className = 'student-accordion-header';
    header.setAttribute('tabindex', '0');
    header.setAttribute('role', 'button');
    header.setAttribute('aria-expanded', 'false');
    
    const imgUrl = student.image;
    const cachedPhoto = window.ImageCache ? window.ImageCache.get(student.studentId) : null;
    const displayImgUrl = cachedPhoto || imgUrl;
    const hasPhoto = !!displayImgUrl;
    
    const photoHtml = hasPhoto 
      ? `<img class="student-thumb" src="${escapeHTML(displayImgUrl)}" crossorigin="anonymous" data-student-id="${escapeHTML(student.studentId || '')}" alt="${escapeHTML(student.name)}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" onload="if(!this.src.startsWith('data:') && window.ImageCache && this.dataset.studentId) window.ImageCache.compressAndCacheElement(this.dataset.studentId, this);">
         <div class="student-thumb-placeholder" style="display: none;"><span class="material-icons-outlined">person</span></div>`
      : `<div class="student-thumb-placeholder"><span class="material-icons-outlined">person</span></div>`;
    
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
        <span class="material-icons-outlined expand-arrow">expand_more</span>
      </div>
    `;
    
    const body = document.createElement('div');
    body.className = 'student-accordion-body collapsed';
    
    const largePhotoHtml = hasPhoto
      ? `<img class="student-photo-large" src="${escapeHTML(displayImgUrl)}" crossorigin="anonymous" alt="Foto ${escapeHTML(student.name)}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
         <div class="student-photo-placeholder" style="display: none;"><span class="material-icons-outlined">person</span></div>`
      : `<div class="student-photo-placeholder"><span class="material-icons-outlined">person</span></div>`;
    
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
              <span class="detail-label">
                <span class="material-icons-outlined detail-icon-inline">cake</span>Tempat, Tanggal Lahir
              </span>
              <span class="detail-value">${escapeHTML(student.dob) || '-'}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">
                <span class="material-icons-outlined detail-icon-inline">meeting_room</span>Kelas KI
              </span>
              <span class="detail-value">${kelasKiVal}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">
                <span class="material-icons-outlined detail-icon-inline">person</span>Katekis KK
              </span>
              <span class="detail-value">${katekisKkVal}</span>
            </div>
          </div>

          <!-- Upload Photo Button -->
          <button class="upload-photo-btn" data-student-id="${escapeHTML(student.studentId)}" data-student-name="${escapeHTML(student.name)}" type="button" aria-label="Ganti foto ${escapeHTML(student.name)}">
            <span class="material-icons-outlined">photo_camera</span>
            Ganti Foto
          </button>
        </div>
      </div>
    `;
    
    // Wire up the upload button
    const uploadBtn = body.querySelector('.upload-photo-btn');
    if (uploadBtn) {
      uploadBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        PhotoUploader.open(
          uploadBtn.dataset.studentId,
          uploadBtn.dataset.studentName
        );
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
    listContainer.appendChild(item);
  });
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

function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('show');
  }, 10);
  
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 3000);
}

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  PhotoUploader.init();
  loadClasses();

  // Scroll listener for header minimization
  const appSection = document.querySelector('.app-section');
  if (appSection) {
    appSection.addEventListener('scroll', () => {
      if (appSection.scrollTop > 50) {
        appSection.classList.add('scrolled');
      } else {
        appSection.classList.remove('scrolled');
      }
    });
  }
  
  const selector = document.getElementById('class-selector');
  if (selector) {
    selector.addEventListener('change', (e) => {
      const searchInput = document.getElementById('search-input');
      if (searchInput) {
        searchInput.style.display = 'block';
        searchInput.value = '';
      }
      loadStudents(e.target.value);
    });
  }
  
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.addEventListener('input', filterStudents);
  }
});





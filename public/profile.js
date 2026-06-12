function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
  return null;
}

const token = getCookie('auth_token');
if (!token) {
  window.location.href = '/';
}

let allStudents = [];

// Expose handleLogout globally
window.handleLogout = function(e) {
  if (e) e.preventDefault();
  document.cookie = 'auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax';
  sessionStorage.removeItem('authToken');
  localStorage.setItem('logoutTimestamp', Date.now().toString());
  window.location.href = '/';
};

// Throttled active state update
let lastActivityUpdate = 0;
function updateActivity() {
  const now = Date.now();
  if (now - lastActivityUpdate > 30000) { // throttle to 30s
    lastActivityUpdate = now;
    if (sessionStorage.getItem('authToken')) {
      localStorage.setItem('lastActiveTimestamp', now.toString());
    }
  }
}

// Attach listener for common interactions to track activity
window.addEventListener('click', updateActivity);
window.addEventListener('keydown', updateActivity);
window.addEventListener('touchstart', updateActivity);

function checkTopicExpiry() {
  const loggedIn = !!sessionStorage.getItem('authToken');
  const now = Date.now();
  const tenMinutes = 10 * 60 * 1000;

  if (loggedIn) {
    const logoutTime = localStorage.getItem('logoutTimestamp');
    if (logoutTime) {
      if (now - parseInt(logoutTime) > tenMinutes) {
        localStorage.removeItem('selectedWeek');
        localStorage.removeItem('selectedTopicName');
      }
      localStorage.removeItem('logoutTimestamp');
    }
    localStorage.setItem('lastActiveTimestamp', now.toString());
  } else {
    const lastActive = localStorage.getItem('lastActiveTimestamp');
    if (lastActive) {
      if (now - parseInt(lastActive) > tenMinutes) {
        localStorage.removeItem('selectedWeek');
        localStorage.removeItem('selectedTopicName');
      }
      localStorage.removeItem('lastActiveTimestamp');
    }
  }
}

// Run check on initialization
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', checkTopicExpiry);
} else {
  checkTopicExpiry();
}


function initTheme() {
  const savedTheme = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateLogos(savedTheme);
}

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
  const newTheme = currentTheme === 'light' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('theme', newTheme);
  updateLogos(newTheme);
}

function updateLogos(theme) {
  const logos = document.querySelectorAll('.theme-logo');
  logos.forEach(logo => {
    if (theme === 'light') {
      logo.src = 'assets/pewartaan_normal.png';
    } else {
      logo.src = 'assets/pewartaan_invert.png';
    }
  });
}

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
          <div class="student-name-text-wrapper" style="display: flex; align-items: center; gap: 8px;">
            <div class="student-name-text">${escapeHTML(student.name)}</div>
            ${inactiveBadge}
          </div>
          <div class="student-id-text">${escapeHTML(student.studentId)}</div>
        </div>
      </div>
      <span class="material-icons-outlined expand-arrow">expand_more</span>
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
        </div>
      </div>
    `;
    
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

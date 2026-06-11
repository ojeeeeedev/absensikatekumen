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
          opt.value = c;
          opt.textContent = `Kelas ${c}`;
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
      renderStudents(allStudents);
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
  if (!listContainer) return;
  
  listContainer.innerHTML = '';
  
  if (students.length === 0) {
    listContainer.innerHTML = '<div class="empty-state">Tidak ada data katekumen ditemukan.</div>';
    return;
  }
  
  students.forEach(student => {
    const item = document.createElement('div');
    item.className = 'student-accordion-item';
    
    const header = document.createElement('div');
    header.className = 'student-accordion-header';
    header.setAttribute('tabindex', '0');
    header.setAttribute('role', 'button');
    header.setAttribute('aria-expanded', 'false');
    
    const imgUrl = student.image || 'assets/favicon.png';
    const escapedImgUrl = escapeHTML(imgUrl);
    
    header.innerHTML = `
      <div class="header-left">
        <img class="student-thumb" src="${escapedImgUrl}" alt="${escapeHTML(student.name)}" onerror="this.src='assets/favicon.png'">
        <div class="student-meta">
          <div class="student-name-text">${escapeHTML(student.name)}</div>
          <div class="student-id-text">${escapeHTML(student.studentId)}</div>
        </div>
      </div>
      <span class="material-icons-outlined expand-arrow">expand_more</span>
    `;
    
    const body = document.createElement('div');
    body.className = 'student-accordion-body';
    body.classList.add('collapsed');
    
    body.innerHTML = `
      <div class="student-detail-card">
        <img class="student-photo-large" src="${escapedImgUrl}" alt="Foto ${escapeHTML(student.name)}" onerror="this.src='assets/favicon.png'">
        <h3 class="detail-name">${escapeHTML(student.name)}</h3>
        <p class="detail-id">ID: ${escapeHTML(student.studentId)}</p>
        
        <div class="detail-info-grid">
          <div class="detail-item">
            <span class="detail-label">Tempat, Tanggal Lahir (TTL)</span>
            <span class="detail-value">${escapeHTML(student.dob) || '-'}</span>
          </div>
        </div>
      </div>
    `;
    
    const toggle = () => {
      const isExpanded = !body.classList.contains('collapsed');
      
      document.querySelectorAll('.student-accordion-body').forEach(b => b.classList.add('collapsed'));
      document.querySelectorAll('.student-accordion-header').forEach(h => {
        h.classList.remove('active');
        h.setAttribute('aria-expanded', 'false');
      });
      
      if (!isExpanded) {
        body.classList.remove('collapsed');
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
  
  const selector = document.getElementById('class-selector');
  if (selector) {
    selector.addEventListener('change', (e) => {
      const searchInput = document.getElementById('search-input');
      if (searchInput) searchInput.style.display = 'block';
      loadStudents(e.target.value);
    });
  }
  
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.addEventListener('input', filterStudents);
  }
});

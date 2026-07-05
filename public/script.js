let html5QrcodeScanner = null;
let selectedWeek = null;

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


// Note: handleLogout, updateActivity, and checkTopicExpiry are now centralized in session.js


let scannerStartPromise = null;

// --- STATE MANAGEMENT ---
// State 0: Auth, State 1: Selection, State 2: Scanning
window.setAppState = async function(state) {
  const container = document.getElementById('app-container');
  container.className = 'glass-container';
  const nav = document.getElementById('app-nav');
  
  if (state === 0) {
    container.classList.add('state-auth');
    await stopScanner();
    if (nav) nav.style.display = 'none';
  } else if (state === 1) {
    container.classList.add('state-selection');
    await stopScanner();
    if (nav) nav.style.display = 'flex';
  } else if (state === 2) {
    container.classList.add('state-scanning');
    if (nav) nav.style.display = 'flex';
    
    if (!selectedWeek) {
      container.classList.add('needs-topic');
      const activeTopicText = document.getElementById('active-topic-name');
      if (activeTopicText) {
        activeTopicText.textContent = "Ketuk di sini untuk memilih topik...";
      }
    } else {
      container.classList.remove('needs-topic');
      const topicTrigger = document.getElementById('topic-trigger-large');
      const activeTopicText = document.getElementById('active-topic-name');
      if (activeTopicText && topicTrigger) {
        activeTopicText.textContent = topicTrigger.textContent.replace('arrow_drop_down', '').trim();
      }
    }

    if (selectedWeek) {
      startScanner();
    } else {
      const loader = document.getElementById("camera-loader");
      if (loader) {
        loader.innerHTML = '<span style="color:var(--text-secondary); text-align:center;">Silakan pilih topik terlebih dahulu</span>';
        loader.style.display = "flex";
      }
    }
  }
}



// --- SAFARI VIEWPORT FIX ---
function setViewportHeight() {
  let vh = window.innerHeight * 0.01;
  document.documentElement.style.setProperty('--vh', `${vh}px`);
}
setViewportHeight();
window.addEventListener('resize', setViewportHeight);

// --- MODAL FUNCTIONS ---
window.openTopicModal = function() { document.getElementById('topic-modal').style.display = 'flex'; }
window.closeTopicModal = function() { document.getElementById('topic-modal').style.display = 'none'; }

function setTopicTriggerText(week, name) {
  const btn = document.getElementById('topic-trigger-large');
  if (!btn) return;
  btn.textContent = '';

  const label = document.createElement('span');
  label.textContent = `${week}. ${name}`;

  const icon = document.createElement('span');
  icon.className = 'material-icons-outlined';
  icon.textContent = 'arrow_drop_down';

  btn.append(label, icon);
}

window.selectTopic = function(week, name, element) {
  selectedWeek = week;
  localStorage.setItem('selectedWeek', week);
  localStorage.setItem('selectedTopicName', name);
  setTopicTriggerText(week, name);
  const activeTopicText = document.getElementById('active-topic-name');
  if (activeTopicText) {
    activeTopicText.textContent = `${week}. ${name}`;
  }
  document.querySelectorAll('.topic-option').forEach(el => el.classList.remove('active'));
  element.classList.add('active');
  setTimeout(() => {
    window.closeTopicModal();
    setAppState(2); // Go straight to scanner state on selection
  }, 200);
}

window.filterTopics = function() {
  const searchTerm = document.getElementById('topic-search-input').value.toLowerCase();
  const topics = document.querySelectorAll('.topic-option');
  topics.forEach(topic => {
    const topicText = topic.textContent.toLowerCase();
    topic.style.display = topicText.includes(searchTerm) ? 'block' : 'none';
  });
}

window.togglePasswordVisibility = function() {
  const input = document.getElementById('login-input');
  const icon = document.getElementById('password-toggle');
  if (input.type === 'password') {
    input.type = 'text';
    icon.textContent = 'visibility';
    icon.setAttribute('aria-pressed', 'true');
    icon.setAttribute('aria-label', 'Sembunyikan password');
  } else {
    input.type = 'password';
    icon.textContent = 'visibility_off';
    icon.setAttribute('aria-pressed', 'false');
    icon.setAttribute('aria-label', 'Tampilkan password');
  }
}

window.hideLoginError = function() {
  const errorBox = document.getElementById('login-error-box');
  if (errorBox) {
    errorBox.style.display = 'none';
  }
}

// --- AUTHENTICATION ---
window.handleLogin = async function() {
  const secret = document.getElementById('login-input').value;
  const errorBox = document.getElementById('login-error-box');
  const successIcon = document.getElementById('login-success-icon');
  const loginLoader = document.getElementById('login-loader');

  if (!secret) {
    errorBox.textContent = 'Password tidak boleh kosong.';
    errorBox.style.display = 'block';
    return;
  }

  window.hideLoginError();

  try {
    const response = await fetch("/api/absensi", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: 'login', secret }),
    });
    const data = await response.json();

    if (data.status === 'ok' && data.token) {
      successIcon.style.display = 'block';
      
      setTimeout(() => {
        successIcon.style.display = 'none';
        loginLoader.style.display = 'flex';

        setTimeout(() => {
          sessionStorage.setItem('authToken', data.token);
          // Set the cookie for server-side middleware and profile page access
          document.cookie = `auth_token=${data.token}; path=/; max-age=28800; SameSite=Lax`;
          loginLoader.style.display = 'none';
          
          // Switch to Selection State
          setAppState(2);
          initializeApp();

          // Safe trigger for onboarding
          if (typeof window.checkOnboarding === 'function') {
            window.checkOnboarding();
          }
        }, 250);
      }, 800);
    } else {
      errorBox.textContent = data.message || 'Login gagal.';
      errorBox.style.display = 'block';
      document.getElementById('login-input').style.animation = 'shake 0.4s';
      setTimeout(() => document.getElementById('login-input').style.animation = '', 400);
    }
  } catch (e) {
    console.error("Login request failed:", e);
    errorBox.textContent = 'Error koneksi ke server.';
    errorBox.style.display = 'block';
  }
}



// --- BACKGROUND SCAN QUEUE ENGINE ---
class ScanQueue {
  constructor() {
    try {
      this.queue = JSON.parse(localStorage.getItem('scan_queue') || '[]');
    } catch (e) {
      console.error("Failed to read localStorage:", e);
      this.queue = [];
    }

    // Self-healing: Reset any stuck 'processing' status back to 'pending' on load
    let modified = false;
    this.queue.forEach(item => {
      if (item.status === 'processing') {
        item.status = 'pending';
        modified = true;
      }
    });
    if (modified) this.save();

    this.isProcessing = false;
    this.cooldowns = {}; // For preventing duplicate double scans
    const initialPending = this.queue.filter(item => item.status === 'pending' || item.status === 'processing').length;
    this.totalInBatch = initialPending;
    this.cleanExpiredItems();
    this.expireTimer = setInterval(() => this.cleanExpiredItems(), 15000);
  }

  save() {
    this.clearOldHistory(); // Slice first
    try {
      localStorage.setItem('scan_queue', JSON.stringify(this.queue));
    } catch (e) {
      console.error("Failed to write localStorage:", e);
    }
    this.render();
  }

  add(studentId, week) {
    const timestamp = Date.now();
    
    // Prevent double scan check (cooldown 3s for same studentId)
    if (this.cooldowns[studentId] && (timestamp - this.cooldowns[studentId] < 3000)) {
      console.log(`Scan blocked by cooldown: ${studentId}`);
      return;
    }
    this.cooldowns[studentId] = timestamp;

    const id = 'scan_' + Math.random().toString(36).substring(2, 9) + '_' + timestamp;
    const item = {
      id,
      studentId,
      week,
      status: 'pending',
      name: '',
      image: '',
      errorMsg: '',
      timestamp
    };

    this.queue.unshift(item); // Add to the top of list
    const pendingCount = this.queue.filter(q => q.status === 'pending' || q.status === 'processing').length;
    if (this.totalInBatch === 0 || this.totalInBatch < pendingCount) {
      this.totalInBatch = pendingCount;
    } else {
      this.totalInBatch += 1;
    }
    this.save();
    
    // Trigger immediate sequential processing loop
    this.process();
  }

  async process() {
    if (this.isProcessing) return;

    // Find the oldest pending item
    const pendingItem = [...this.queue].reverse().find(item => item.status === 'pending');
    if (!pendingItem) {
      this.isProcessing = false;
      this.updateBanner();
      resetStatus(); // Revert status bar back to idle when sync queue is empty
      return;
    }

    this.isProcessing = true;
    pendingItem.status = 'processing';
    this.save();

    try {
      const token = sessionStorage.getItem('authToken');
      const response = await fetch("/api/absensi", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json", 
          "Authorization": `Bearer ${token}` 
        },
        body: JSON.stringify({ studentId: pendingItem.studentId, week: pendingItem.week }),
      });

      if (!response.ok) {
        // Insert this check in process() immediately after checking response status:
        if (response.status === 401) {
          pendingItem.status = 'pending';
          this.isProcessing = false;
          this.save();
          sessionStorage.removeItem('authToken');
          // Clear the auth_token cookie
          document.cookie = "auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
          showStatus("Sesi Habis", "error", "Silakan login kembali.");
          if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
          triggerVisualFlash('error');
          if (typeof setAppState === 'function') setAppState(0);
          return; // Stop queue loop
        }

        // Transient server errors (5xx) or rate limits (429) should be retried.
        if (response.status >= 500 || response.status === 429) {
          pendingItem.status = 'pending';
          pendingItem.errorMsg = `HTTP ${response.status} (Menunggu retry)`;
          this.isProcessing = false;
          this.save();
          // Trigger retry after 5 seconds
          setTimeout(() => this.process(), 5000);
          return; // Stop current loop
        } else {
          // Permanent client errors (e.g. 400, 404)
          pendingItem.status = 'error';
          pendingItem.errorMsg = `HTTP ${response.status}`;
          
          showToast(`Gagal: ${pendingItem.errorMsg || 'Gagal sinkronisasi'}`, 'error');

          triggerVisualFlash('error');
          const container = document.getElementById('app-container');
          if (!container || !container.classList.contains('state-scanning')) {
            showStatus("Gagal", "error", pendingItem.errorMsg);
          }
        }
      } else {
        const data = await response.json();
        
        if (data.status === "ok") {
          pendingItem.status = 'success';
          pendingItem.name = data.name;
          const localMatch = this.queue.find(item => item.studentId === pendingItem.studentId && item.image);
          pendingItem.image = data.image || (localMatch ? localMatch.image : '');
          
          showToast(`Berhasil: ${data.name} hadir!`, 'success');

          const container = document.getElementById('app-container');
          if (container && container.classList.contains('state-scanning')) {
            triggerVisualFlash('success');
            if (navigator.vibrate) navigator.vibrate(200);
          } else {
            showStatus(data.name, "success", `Hadir - Topik ${pendingItem.week}`);
            if (navigator.vibrate) navigator.vibrate(200);
          }
        } else if (data.status === "duplicate") {
          pendingItem.status = 'duplicate';
          pendingItem.name = data.name || 'Presensi Sudah Tercatat';
          const localMatch = this.queue.find(item => item.studentId === pendingItem.studentId && item.image);
          pendingItem.image = data.image || (localMatch ? localMatch.image : '');
          
          showToast(`Sudah Hadir - Topik ${pendingItem.week} - ${data.name || 'Katekumen'}`, 'info');

          const container = document.getElementById('app-container');
          if (container && container.classList.contains('state-scanning')) {
            triggerVisualFlash('duplicate');
            if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
          } else {
            showStatus("Sudah Hadir", "error", data.message);
            if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
          }
        } else {
          pendingItem.status = 'error';
          pendingItem.errorMsg = data.message || 'Gagal sinkronisasi';
          
          showToast(`Gagal: ${pendingItem.errorMsg || 'Gagal sinkronisasi'}`, 'error');

          const container = document.getElementById('app-container');
          if (container && container.classList.contains('state-scanning')) {
            triggerVisualFlash('error');
            if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
          } else {
            showStatus("Gagal", "error", pendingItem.errorMsg);
          }
        }
      }
    } catch (error) {
      console.error("Queue sync network error:", error);
      pendingItem.status = 'pending'; // Revert back to pending to retry when online
      this.save();
      
      this.isProcessing = false;
      this.updateBanner();
      setTimeout(() => this.process(), 5000);
      return; // Stop processing loop until back online
    }

    this.isProcessing = false;
    this.save();
    
    // Continue processing remaining items in queue
    setTimeout(() => this.process(), 500);
  }

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

  render() {
    this.updateBanner();
    const listContainer = document.getElementById('queue-list');
    if (!listContainer) return;

    const queueLength = this.queue.length;
    const progressArea = document.getElementById('history-progress-area');
    const dotsContainer = document.getElementById('carousel-dots');
    const trashBtn = document.getElementById('history-trash-btn');
    const prevBtn = document.getElementById('carousel-prev-btn');
    const nextBtn = document.getElementById('carousel-next-btn');

    // Ensure progress area is always visible (V3 Spec)
    if (progressArea) progressArea.style.display = 'block';

    if (queueLength === 0) {
      if (trashBtn) trashBtn.style.display = 'none';
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

      // Hide all legend tags
      const legends = ['legend-success', 'legend-duplicate', 'legend-error', 'legend-pending'];
      legends.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
      });

      // Render Skeleton Card Placeholder
      listContainer.style.justifyContent = 'center';
      listContainer.innerHTML = `
        <div class="queue-row skeleton" aria-hidden="true">
          <span class="skeleton-empty-text">Belum ada riwayat pemindaian</span>
        </div>
      `;
      return;
    }

    // Show trash button if at least one scan has been conducted
    if (trashBtn) trashBtn.style.display = 'flex';

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
    updateLegend('legend-pending', pendingCount, 'Memproses');

    // 4. Render items (up to 10 items)
    const renderItems = this.queue.slice(0, 10);
    listContainer.style.justifyContent = renderItems.length <= 1 ? 'center' : 'flex-start';
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

  clearOldHistory() {
    if (this.queue.length > 20) {
      // Separate pending/processing items and completed items
      const pendingItems = this.queue.filter(item => item.status === 'pending' || item.status === 'processing');
      const completedItems = this.queue.filter(item => item.status !== 'pending' && item.status !== 'processing');
      
      // Calculate how many completed items we are allowed to keep
      const allowedCompletedCount = Math.max(0, 20 - pendingItems.length);
      const prunedCompleted = completedItems.slice(0, allowedCompletedCount);
      
      // Combine them using a Set of allowed IDs to preserve original order
      const allowedIds = new Set([
        ...pendingItems.map(item => item.id),
        ...prunedCompleted.map(item => item.id)
      ]);
      this.queue = this.queue.filter(item => allowedIds.has(item.id));
    }
  }

  cleanExpiredItems() {
    const now = Date.now();
    const thirtyMinutes = 30 * 60 * 1000;
    const initialLength = this.queue.length;

    // Keep items if they are pending/processing (so offline scans are not lost before syncing),
    // or if they are less than 30 minutes old.
    this.queue = this.queue.filter(item => {
      const isPendingOrProcessing = item.status === 'pending' || item.status === 'processing';
      const itemTime = item.timestamp || 0;
      const isExpired = (now - itemTime) >= thirtyMinutes;
      return isPendingOrProcessing || !isExpired;
    });

    if (this.queue.length !== initialLength) {
      this.save();
    }
  }
}

// Instantiate globally
window.scanQueue = new ScanQueue();

// --- TOAST NOTIFICATIONS ---
window.showToast = function(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  let iconName = 'check_circle';
  if (type === 'error') iconName = 'error';
  if (type === 'info') iconName = 'info';

  // Safe element construction to prevent XSS
  const icon = document.createElement('span');
  icon.className = 'material-icons-outlined toast-icon';
  icon.textContent = iconName;

  const text = document.createElement('span');
  text.className = 'toast-message';
  text.textContent = message;

  toast.appendChild(icon);
  toast.appendChild(text);
  container.appendChild(toast);

  let autoDismissTimer;

  // Smooth dismiss helper
  const dismiss = () => {
    if (toast.classList.contains('hide')) return;
    if (autoDismissTimer) clearTimeout(autoDismissTimer);
    toast.removeEventListener('click', dismiss);
    toast.classList.remove('show');
    toast.classList.add('hide');
    setTimeout(() => toast.remove(), 400);
  };

  // Click to dismiss early
  toast.addEventListener('click', dismiss);

  // Trigger entry animation
  setTimeout(() => toast.classList.add('show'), 10);

  // Auto-remove timer
  autoDismissTimer = setTimeout(dismiss, 3000);
}

// --- STATUS HANDLER ---
function showStatus(mainText, type, subText = "") {
  const el = document.getElementById("status");
  if (!el) return;
  
  let iconName = "qr_code_scanner";
  if (type === 'success') iconName = "check_circle_outline";
  else if (type === 'error') iconName = "error_outline";
  else if (type === 'processing') iconName = "hourglass_empty";

  el.innerHTML = "";

  const iconSpan = document.createElement("span");
  iconSpan.className = "material-icons-outlined";
  iconSpan.style.fontSize = "1.25rem";
  iconSpan.textContent = iconName;
  el.appendChild(iconSpan);

  if (subText) {
    const textContainer = document.createElement("div");
    textContainer.className = "status-text-container";

    const mainDiv = document.createElement("div");
    mainDiv.className = "main-text";
    mainDiv.textContent = mainText;

    const subDiv = document.createElement("div");
    subDiv.className = "sub-text";
    subDiv.textContent = subText;

    textContainer.appendChild(mainDiv);
    textContainer.appendChild(subDiv);
    el.appendChild(textContainer);
  } else {
    const mainDiv = document.createElement("div");
    mainDiv.className = "main-text";
    mainDiv.textContent = mainText;
    el.appendChild(mainDiv);
  }
  el.className = type;
}

function resetStatus() { 
  if (typeof scanQueue !== 'undefined') {
    const pendingCount = scanQueue.queue.filter(item => item.status === 'pending' || item.status === 'processing').length;
    if (pendingCount > 0) {
      showStatus("Sinkronisasi sedang berjalan...", "processing", `${pendingCount} item tersisa di antrean.`);
      return;
    }
  }
  showStatus("Silakan pindai kode QR berikutnya", "idle");
}

function safeAtob(str) {
  let cleaned = str.replace(/\s/g, '').replace(/-/g, '+').replace(/_/g, '/');
  const pad = cleaned.length % 4;
  if (pad) {
    if (pad === 1) throw new Error("Invalid base64 structure");
    cleaned += '='.repeat(4 - pad);
  }
  return atob(cleaned);
}

function triggerVisualFlash(type) {
  const readerContainer = document.getElementById('reader-container');
  if (!readerContainer) return;
  
  // Create a temporary overlay element
  const flash = document.createElement('div');
  flash.style.position = 'absolute';
  flash.style.inset = '0';
  flash.style.zIndex = '5';
  flash.style.pointerEvents = 'none';
  flash.style.opacity = '0.35';
  flash.style.transition = 'opacity 0.4s ease';
  
  if (type === 'success') {
    flash.style.backgroundColor = '#2e7d32'; // Green
  } else if (type === 'duplicate') {
    flash.style.backgroundColor = '#f57c00'; // Orange
  } else {
    flash.style.backgroundColor = '#c62828'; // Red
  }
  
  readerContainer.appendChild(flash);
  
  // Trigger reflow and fade out
  setTimeout(() => {
    flash.style.opacity = '0';
    setTimeout(() => flash.remove(), 400);
  }, 100);
}

// --- SCANNER LOGIC ---
async function handleScan(decodedText) {
  if (!selectedWeek) {
    showStatus("Pilih topik terlebih dahulu!", "error");
    openTopicModal();
    return;
  }

  let originalStudentId;
  try {
    originalStudentId = safeAtob(decodedText);
  } catch (e) {
    showStatus("Kode QR Tidak Valid", "error", "Format kode tidak dikenali.");
    if (navigator.vibrate) navigator.vibrate([100, 50]);
    triggerVisualFlash('error');
    setTimeout(() => resetStatus(), 3000); // Revert back to idle/processing status
    return;
  }

  // Optimistic tactile feedback on read
  if (navigator.vibrate) navigator.vibrate(80);

  // Add scan to queue instantly and keep camera running!
  scanQueue.add(originalStudentId, selectedWeek);
}

async function startScanner() {
  if (html5QrcodeScanner) return; // Guard against duplicate instantiations

  const scanConfig = { 
    fps: 30,
    aspectRatio: 1.0,
    disableFlip: false,
    experimentalFeatures: {
      useBarCodeDetectorIfSupported: true
    },
    videoConstraints: {
      facingMode: "environment",
      width: { ideal: 640 },
      height: { ideal: 640 }
    }
  };

  html5QrcodeScanner = new Html5Qrcode("reader", /* verbose= */ false);
  scannerStartPromise = html5QrcodeScanner.start(
    { facingMode: "environment" },
    scanConfig,
    handleScan
  );

  scannerStartPromise.then(() => {
    scannerStartPromise = null;
    const loader = document.getElementById("camera-loader");
    if (loader) loader.style.display = "none";
    resetStatus();
  }).catch(err => {
    scannerStartPromise = null;
    console.error("Camera start failed:", err);
    html5QrcodeScanner = null; // Reset reference so retry can be attempted
    const loader = document.getElementById("camera-loader");
    if (loader) {
      loader.innerHTML = '<div style="color:var(--status-duplicate-text); text-align:center; padding:10px;">Izin kamera ditolak<br>atau kamera tidak tersedia</div>';
    }
  });
}

async function stopScanner() {
  if (html5QrcodeScanner) {
    // If still starting, wait for the start promise to resolve first
    if (scannerStartPromise) {
      try {
        await scannerStartPromise;
      } catch (e) {
        // start failed, startScanner already cleared html5QrcodeScanner
        return;
      }
    }

    const scanner = html5QrcodeScanner;
    html5QrcodeScanner = null; // Reset reference immediately to avoid race conditions
    scannerStartPromise = null;
    try {
      await scanner.stop();
    } catch (err) {
      console.error("Failed to stop scanner:", err);
    } finally {
      const loader = document.getElementById("camera-loader");
      if (loader) loader.style.display = "flex";
    }
  }
}

async function loadTopikList() {
  const listContainer = document.getElementById("topic-list-container");
  if (!listContainer) return;

  try {
    if (typeof STATIC_TOPICS !== 'undefined' && Array.isArray(STATIC_TOPICS)) {
      listContainer.innerHTML = "";
      STATIC_TOPICS.forEach((item) => {
        const div = document.createElement("div");
        div.className = "topic-option";
        if (item.name.includes("(P)")) div.classList.add("topic-p");
        else if (item.name.includes("(KI)")) div.classList.add("topic-ki");
        
        if (item.week === "R1" || item.week === "R2") {
          div.classList.add("topic-rekoleksi");
        }
        div.textContent = `${item.week}. ${item.name}`;
        
        if (item.week === selectedWeek) {
          div.classList.add("active");
        }
        
        // Accessibility attributes
        div.setAttribute("role", "button");
        div.tabIndex = 0;
        
        div.onclick = () => selectTopic(item.week, item.name, div);
        div.onkeydown = (event) => {
          if (event.key === ' ' || event.key === 'Enter') {
            event.preventDefault();
            selectTopic(item.week, item.name, div);
          }
        };
        
        listContainer.appendChild(div);
      });
    } else {
      listContainer.innerHTML = "";
      const errorDiv = document.createElement("div");
      errorDiv.className = "topic-loading-placeholder";
      errorDiv.style.color = "var(--status-duplicate-text)";
      errorDiv.textContent = "Data topik tidak ditemukan.";
      listContainer.appendChild(errorDiv);
    }
  } catch (err) {
    console.error(err);
    listContainer.innerHTML = "";
    const errorDiv = document.createElement("div");
    errorDiv.className = "topic-loading-placeholder";
    errorDiv.style.color = "var(--status-duplicate-text)";
    errorDiv.textContent = "Gagal memuat topik.";
    listContainer.appendChild(errorDiv);
  }
}

async function loadVersion() {
  try {
    const res = await fetch('/api/version');
    if (res.ok) {
      const data = await res.json();
      const versionEl = document.getElementById('footer-version');
      if (versionEl && data.version) {
        versionEl.textContent = `v${data.version}`;
      }
      const loginVersionEl = document.getElementById('login-version');
      if (loginVersionEl && data.version) {
        loginVersionEl.textContent = `v${data.version}`;
      }
    }
  } catch (error) {
    console.error("Failed to load version:", error);
  }
}

async function initializeApp() {
  await loadTopikList();
  scanQueue.render();
  scanQueue.process(); // Process any leftover queue from last load
}

// Initial triggers
window.onload = () => {
  initTheme();
  loadVersion();
  
  // Connect background queue trigger for online state detection
  window.addEventListener('online', () => {
    scanQueue.process();
  });

  const sessionToken = sessionStorage.getItem('authToken');
  if (sessionToken) {
    // Sync the auth_token cookie with the sessionStorage token
    document.cookie = `auth_token=${sessionToken}; path=/; max-age=28800; SameSite=Lax`;
    
    const savedWeek = localStorage.getItem('selectedWeek');
    const savedTopicName = localStorage.getItem('selectedTopicName');
    if (savedWeek && savedTopicName) {
      selectedWeek = savedWeek;
      setTopicTriggerText(savedWeek, savedTopicName);
      const activeTopicText = document.getElementById('active-topic-name');
      if (activeTopicText) {
        activeTopicText.textContent = `${savedWeek}. ${savedTopicName}`;
      }
    }
    
    setAppState(2); // Set to scanner page initially
    initializeApp();
  } else {
    setAppState(0); // Authentication screen
  }
}

window.showStudentModal = function(item) {
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

  modal.style.display = 'flex';
};

window.closeStudentModal = function(event) {
  const modal = document.getElementById('student-detail-modal');
  if (modal) {
    modal.style.display = 'none';
  }
};

window.openDeleteConfirm = function(event) {
  if (event) event.stopPropagation();

  if (typeof scanQueue !== 'undefined') {
    const pendingCount = scanQueue.queue.filter(item => item.status === 'pending' || item.status === 'processing').length;
    const completedCount = scanQueue.queue.length - pendingCount;
    
    if (completedCount === 0) {
      showToast("Belum ada riwayat pemindaian selesai untuk dihapus", "info");
      return;
    }
  }

  const overlay = document.getElementById('history-confirm-overlay');
  if (overlay) {
    overlay.style.display = 'flex';
    // Force a reflow to trigger transition animation
    overlay.offsetHeight;
    overlay.classList.add('show');
  }
};

window.closeDeleteConfirm = function(event) {
  if (event) event.stopPropagation();
  const overlay = document.getElementById('history-confirm-overlay');
  if (overlay) {
    overlay.classList.remove('show');
    setTimeout(() => {
      if (!overlay.classList.contains('show')) {
        overlay.style.display = 'none';
      }
    }, 300);
  }
};

window.confirmDeleteHistory = function(event) {
  if (event) event.stopPropagation();
  
  if (typeof scanQueue !== 'undefined') {
    const pendingCount = scanQueue.queue.filter(item => item.status === 'pending' || item.status === 'processing').length;
    const completedCount = scanQueue.queue.length - pendingCount;
    
    if (completedCount === 0) {
      showToast("Belum ada riwayat pemindaian selesai untuk dihapus", "info");
      window.closeDeleteConfirm();
      return;
    }
    
    scanQueue.queue = scanQueue.queue.filter(item => item.status === 'pending' || item.status === 'processing');
    scanQueue.save();
    showToast("Riwayat pemindaian berhasil dibersihkan", "info");
  }
  
  window.closeDeleteConfirm();
};

// Document click listener to close delete confirmation overlay when clicking outside
document.addEventListener('click', (event) => {
  const overlay = document.getElementById('history-confirm-overlay');
  if (overlay && overlay.classList.contains('show')) {
    const trashBtn = document.getElementById('history-trash-btn');
    if (!overlay.contains(event.target) && (!trashBtn || !trashBtn.contains(event.target))) {
      window.closeDeleteConfirm();
    }
  }
});

let html5QrcodeScanner = null;
let selectedWeek = null;
let scannerStartPromise = null;

// --- STATE MANAGEMENT ---
// State 0: Auth, State 1: Selection, State 2: Scanning
window.setAppState = async function(state) {
  const container = document.getElementById('app-container');
  container.className = 'glass-container';
  
  if (state === 0) {
    container.classList.add('state-auth');
    await stopScanner();
  } else if (state === 1) {
    container.classList.add('state-selection');
    await stopScanner();
  } else if (state === 2) {
    container.classList.add('state-scanning');
    // Set active topic name text
    const topicTrigger = document.getElementById('topic-trigger-large');
    const activeTopicText = document.getElementById('active-topic-name');
    if (activeTopicText && topicTrigger) {
      activeTopicText.textContent = topicTrigger.textContent.replace('arrow_drop_down', '').trim();
    }
    startScanner();
  }
}

// --- THEME MANAGEMENT ---
function initTheme() {
  const savedTheme = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeToggleIcon(savedTheme);
}

// Global toggle theme function (referenced in HTML button)
window.toggleTheme = function() {
  const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
  const newTheme = currentTheme === 'light' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('theme', newTheme);
  updateThemeToggleIcon(newTheme);
}

function updateThemeToggleIcon(theme) {
  const icon = document.querySelector('#theme-toggle span');
  if (icon) {
    icon.textContent = theme === 'light' ? 'dark_mode' : 'light_mode';
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

window.selectTopic = function(week, name, element) {
  selectedWeek = week;
  const btn = document.getElementById('topic-trigger-large');
  if (btn) {
    btn.innerHTML = `<span>${week}. ${name}</span><span class="material-icons-outlined">arrow_drop_down</span>`;
  }
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
          loginLoader.style.display = 'none';
          
          // Switch to Selection State
          setAppState(1);
          initializeApp();
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
          pendingItem.image = data.image || '';
          
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
          pendingItem.name = data.name || 'Sudah Absen';
          pendingItem.image = data.image || '';
          
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
    const warningBar = document.getElementById('queue-warning-bar');
    const progressText = document.getElementById('queue-progress-text');
    const progressBarFill = document.getElementById('queue-progress-bar-fill');

    const pendingCount = this.queue.filter(item => item.status === 'pending' || item.status === 'processing').length;

    if (pendingCount === 0) {
      this.totalInBatch = 0;
    } else if (this.totalInBatch < pendingCount) {
      this.totalInBatch = pendingCount;
    }

    if (warningBar) {
      if (pendingCount > 0) {
        warningBar.style.display = 'flex';
        
        const completedCount = this.totalInBatch - pendingCount;
        const progressPercent = this.totalInBatch > 0 ? (completedCount / this.totalInBatch) * 100 : 0;
        
        if (progressText) {
          progressText.textContent = `${completedCount}/${this.totalInBatch} Selesai`;
        }
        if (progressBarFill) {
          progressBarFill.style.width = `${progressPercent}%`;
        }
      } else {
        warningBar.style.display = 'none';
        if (progressBarFill) {
          progressBarFill.style.width = '0%';
        }
      }
    }
  }

  render() {
    this.updateBanner();
    const listContainer = document.getElementById('queue-list');
    if (!listContainer) return;

    const historyHeader = document.getElementById('history-header');

    if (this.queue.length === 0) {
      if (historyHeader) historyHeader.style.display = 'none';
      listContainer.innerHTML = '';
      const emptyDiv = document.createElement('div');
      emptyDiv.className = 'queue-empty-state';
      emptyDiv.textContent = 'Belum ada data pemindaian.';
      listContainer.appendChild(emptyDiv);
      return;
    }

    if (historyHeader) historyHeader.style.display = 'flex';

    // Keep only the most recent 10 items in DOM to save performance
    const renderItems = this.queue.slice(0, 10);
    listContainer.innerHTML = '';

    renderItems.forEach(item => {
      const row = document.createElement('div');
      row.className = `queue-row ${item.status}`;

      const avatarSrc = item.image || '/assets/favicon.png';
      
      let badgeText = item.status;
      if (item.status === 'success') badgeText = 'Hadir';
      if (item.status === 'duplicate') badgeText = 'Sudah Absen';
      if (item.status === 'error') badgeText = 'Gagal';
      if (item.status === 'pending') badgeText = 'Antre';

      const studentInfo = document.createElement('div');
      studentInfo.className = 'student-info';

      const studentPhoto = document.createElement('img');
      studentPhoto.className = 'student-photo';
      studentPhoto.src = avatarSrc;
      studentPhoto.alt = 'Foto';
      studentPhoto.onerror = function() {
        this.onerror = null;
        this.src = '/assets/favicon.png';
      };
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
      statusBadge.textContent = badgeText;
      row.appendChild(statusBadge);

      listContainer.appendChild(row);
    });
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
    const fiveMinutes = 5 * 60 * 1000;
    const initialLength = this.queue.length;

    // Keep items if they are pending/processing (so offline scans are not lost before syncing),
    // or if they are less than 5 minutes old.
    this.queue = this.queue.filter(item => {
      const isPendingOrProcessing = item.status === 'pending' || item.status === 'processing';
      const itemTime = item.timestamp || 0;
      const isExpired = (now - itemTime) >= fiveMinutes;
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
    setAppState(1);
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
    qrbox: { width: 220, height: 220 },
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

async function initializeApp() {
  await loadTopikList();
  scanQueue.render();
  scanQueue.process(); // Process any leftover queue from last load
}

// Initial triggers
window.onload = () => {
  initTheme();
  
  // Connect background queue trigger for online state detection
  window.addEventListener('online', () => {
    scanQueue.process();
  });

  if (sessionStorage.getItem('authToken')) {
    setAppState(1); // Set to selection page initially
    initializeApp();
  } else {
    setAppState(0); // Authentication screen
  }
}

window.clearScanHistory = function() {
  if (typeof scanQueue === 'undefined') return;

  const pendingCount = scanQueue.queue.filter(item => item.status === 'pending' || item.status === 'processing').length;
  const completedCount = scanQueue.queue.length - pendingCount;
  
  if (scanQueue.queue.length === 0) {
    showToast("Belum ada data pemindaian untuk dihapus", "info");
    return;
  }

  if (completedCount === 0) {
    showToast("Belum ada riwayat pemindaian selesai untuk dihapus", "info");
    return;
  }

  const confirmMsg = pendingCount > 0
    ? `Hapus riwayat? ${pendingCount} item antrean yang belum tersinkronisasi akan tetap dipertahankan.`
    : "Apakah Anda yakin ingin menghapus semua riwayat pemindaian?";

  if (confirm(confirmMsg)) {
    // Clear only completed scans, keep pending/processing to prevent data loss
    scanQueue.queue = scanQueue.queue.filter(item => item.status === 'pending' || item.status === 'processing');
    scanQueue.save();
    showToast("Riwayat pemindaian berhasil dibersihkan", "info");
  }
}
let html5QrcodeScanner = null;
let selectedWeek = null;
let profileModalTimeout = null;
let scanCooldown = false;

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
  } else {
    input.type = 'password';
    icon.textContent = 'visibility_off';
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

async function loadTopikList() {
  const listContainer = document.getElementById("topic-list-container");
  try {
    // Use STATIC_TOPICS from topics.js
    if (typeof STATIC_TOPICS !== 'undefined' && Array.isArray(STATIC_TOPICS)) {
      listContainer.innerHTML = "";
      STATIC_TOPICS.forEach((item) => {
        const div = document.createElement("div");
        div.className = "topic-option";
        if (item.name.includes("(P)")) {
          div.classList.add("topic-p");
        } else if (item.name.includes("(KI)")) {
          div.classList.add("topic-ki");
        }
        if (item.week === "R1" || item.week === "R2") {
          div.classList.add("topic-rekoleksi");
        }
        div.textContent = `${item.week}. ${item.name}`;
        div.onclick = () => selectTopic(item.week, item.name, div);
        listContainer.appendChild(div);
      });
    } else {
      listContainer.innerHTML = `<div class="topic-loading-placeholder" style="color:#d32f2f;">Data topik tidak ditemukan.</div>`;
    }
  } catch (err) {
    console.error(err);
    listContainer.innerHTML = `<div class="topic-loading-placeholder" style="color:#d32f2f;">Gagal memuat topik.</div>`;
  }
}

// --- BACKGROUND SCAN QUEUE ENGINE ---
class ScanQueue {
  constructor() {
    this.queue = JSON.parse(localStorage.getItem('scan_queue') || '[]');
    this.isProcessing = false;
    this.cooldowns = {}; // For preventing duplicate double scans
  }

  save() {
    localStorage.setItem('scan_queue', JSON.stringify(this.queue));
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
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      
      if (data.status === "ok") {
        pendingItem.status = 'success';
        pendingItem.name = data.name;
        pendingItem.image = data.image || '';
        showStatus(data.name, "success", `Hadir - Topik ${pendingItem.week}`);
        if (navigator.vibrate) navigator.vibrate(200);
      } else if (data.status === "duplicate") {
        pendingItem.status = 'duplicate';
        pendingItem.name = data.name || 'Sudah Absen';
        pendingItem.image = data.image || '';
        showStatus("Sudah Hadir", "error", data.message);
        if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
      } else {
        pendingItem.status = 'error';
        pendingItem.errorMsg = data.message || 'Gagal sinkronisasi';
        showStatus("Gagal", "error", pendingItem.errorMsg);
      }
    } catch (error) {
      console.error("Queue sync error:", error);
      pendingItem.status = 'pending'; // Leave in pending to retry when online
      
      // Stop loop temporarily due to network disconnect
      this.isProcessing = false;
      this.updateBanner();
      return;
    }

    this.isProcessing = false;
    this.save();
    
    // Continue processing remaining items in queue
    setTimeout(() => this.process(), 500);
  }

  updateBanner() {
    const warningBar = document.getElementById('queue-warning-bar');
    const remainingText = document.getElementById('queue-remaining-count');
    const statusText = document.getElementById('queue-status-text');

    const pendingCount = this.queue.filter(item => item.status === 'pending' || item.status === 'processing').length;

    if (warningBar && remainingText) {
      if (pendingCount > 0) {
        warningBar.style.display = 'flex';
        remainingText.textContent = pendingCount;
        if (statusText) {
          statusText.textContent = `Menyinkronkan (${pendingCount})`;
          statusText.style.color = 'var(--status-pending-text)';
        }
      } else {
        warningBar.style.display = 'none';
        if (statusText) {
          statusText.textContent = 'Semua Tersinkronisasi';
          statusText.style.color = 'var(--status-success-text)';
        }
      }
    }
  }

  render() {
    this.updateBanner();
    const listContainer = document.getElementById('queue-list');
    if (!listContainer) return;

    if (this.queue.length === 0) {
      listContainer.innerHTML = '<div class="queue-empty-state">Belum ada data pemindaian.</div>';
      return;
    }

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

      row.innerHTML = `
        <div class="student-info">
          <img class="student-photo" src="${avatarSrc}" onerror="this.src='/assets/favicon.png'" alt="Foto">
          <div class="student-text">
            <span class="student-name">${item.name || 'Katekumen'}</span>
            <span class="student-id">${item.studentId} &bull; Topik ${item.week}</span>
          </div>
        </div>
        <span class="status-badge ${item.status}">${badgeText}</span>
      `;
      listContainer.appendChild(row);
    });
  }

  clearOldHistory() {
    // Keep only the last 20 items in localStorage to prevent storage overflow
    if (this.queue.length > 20) {
      this.queue = this.queue.slice(0, 20);
      this.save();
    }
  }
}

// Instantiate globally so other functions can call it
window.scanQueue = new ScanQueue();

// --- STATUS HANDLER (Text Only) ---
function showStatus(mainText, type, subText = "") {
  const el = document.getElementById("status");
  
  // Using Material Icons for visual indicators
  let iconName = "";
  if (type === 'success') iconName = "check_circle_outline";
  else if (type === 'error') iconName = "error_outline";
  else if (type === 'processing') iconName = "hourglass_empty";
  else iconName = "qr_code_scanner"; // Default for idle/camera

  if (subText) {
      el.innerHTML = `
          <span class="material-icons-outlined" style="font-size: 1.5rem;">${iconName}</span>
          <div class="status-text-container">
              <div class="main-text">${mainText}</div>
              <div class="sub-text">${subText}</div>
          </div>
      `;
  } else {
      el.innerHTML = `
          <span class="material-icons-outlined" style="font-size: 1.5rem;">${iconName}</span>
          <div class="main-text">${mainText}</div>
      `;
  }
  el.className = type;
}

function resetStatus() { showStatus("Silakan pindai kode QR berikutnya", "idle"); }

function safeAtob(str) {
  // Remove all whitespace
  let cleaned = str.replace(/\s/g, '');
  // Convert URL-safe base64 to standard base64
  cleaned = cleaned.replace(/-/g, '+').replace(/_/g, '/');
  // Pad with '=' if the length is not a multiple of 4
  const pad = cleaned.length % 4;
  if (pad) {
    if (pad === 1) {
      throw new Error("Invalid base64 structure");
    }
    cleaned += '='.repeat(4 - pad);
  }
  return atob(cleaned);
}

// --- SCANNER LOGIC ---
async function handleScan(decodedText) {
  if (scanCooldown) return; // Prevent multiple scans at once

  // Check if a topic is selected
  if (!selectedWeek) { 
    showStatus("Pilih topik terlebih dahulu!", "error");
    openTopicModal(); 
    return;
  }

  let originalStudentId;
  try {
    // DECODE the Base64 string from the QR code using the robust helper
    originalStudentId = safeAtob(decodedText);
  } catch (e) {
    // This catches errors if the QR code is not a valid Base64 string
    showStatus("Kode QR Tidak Valid", "error", "Format kode tidak dikenali.");
    scanCooldown = true; // Start cooldown to prevent spamming invalid codes
    setTimeout(() => { scanCooldown = false; resetStatus(); }, 4000);
    return;
  }

  scanCooldown = true;
  
  // OPTIMISTIC UI: Give immediate feedback
  if (navigator.vibrate) navigator.vibrate(100); 
  showStatus("Memproses...", "processing", `ID: ${originalStudentId}`);

  try {
    const token = sessionStorage.getItem('authToken');
    const response = await fetch("/api/absensi", {
      method: "POST", 
      headers: { "Content-Type": "application/json", 'Authorization': `Bearer ${token}` }, 
      body: JSON.stringify({ studentId: originalStudentId, week: selectedWeek }),
    });

    if (!response.ok) {
      const responseText = await response.text();
      let errMsg = `HTTP ${response.status}`;
      try {
        const errJson = JSON.parse(responseText);
        if (errJson.message) {
          errMsg += `: ${errJson.message}`;
          if (errJson.details) {
            errMsg += ` (${errJson.details})`;
          }
        }
      } catch (jsonErr) {
        errMsg += `: ${responseText.substring(0, 80)}`;
      }
      throw new Error(errMsg);
    }

    const data = await response.json();

    if (data.status === "ok") {
      // Haptic feedback for server confirmation
      if (navigator.vibrate) navigator.vibrate(200); 
      showStatus(data.name, "success", `ID: ${data.studentId} • Topik ${selectedWeek}`);
      showProfileModal(data.name, data.studentId, selectedWeek, data.image);
    } else if (data.status === "duplicate") {
      if (navigator.vibrate) navigator.vibrate([100, 50, 100]); 
      showStatus("Sudah Hadir", "error", data.message);
    } else {
      if (navigator.vibrate) navigator.vibrate([100, 50, 100]); 
      showStatus("Gagal", "error", data.message || "Terjadi kesalahan");
    }
  } catch (error) {
    console.error("Scan request failed:", error);
    showStatus("Error Koneksi", "error", error.message || "Gagal menghubungi server");
  } finally {
    // Shorter cooldown for better UX
    setTimeout(() => { scanCooldown = false; resetStatus(); }, 3000);
  }
}

async function stopScanner() {
  if (html5QrcodeScanner) {
    try {
      await html5QrcodeScanner.stop();
      html5QrcodeScanner = null;
      const loader = document.getElementById("camera-loader");
      if (loader) loader.style.display = "flex";
    } catch (err) {
      console.error("Failed to stop scanner:", err);
    }
  }
}

async function startScanner() {
  const scanConfig = { 
      fps: 30, // Increased for faster recognition
      qrbox: { width: 250, height: 250 },
      aspectRatio: 1.0,
      disableFlip: false,
      experimentalFeatures: {
          // Use native BarcodeDetector if supported, for faster scans
          useBarCodeDetectorIfSupported: true
      },
      // Pass video constraints directly into the config object
      videoConstraints: {
          facingMode: "environment",
          width: { ideal: 720 },
          height: { ideal: 720 }
      }
  };

  html5QrcodeScanner = new Html5Qrcode("reader", /* verbose= */ false);
  html5QrcodeScanner.start(
    { facingMode: "environment" }, // Request rear camera
    scanConfig,
    handleScan
  ).then(() => {
      document.getElementById("camera-loader").style.display = "none";
      resetStatus();
  }).catch(err => {
      const loader = document.getElementById("camera-loader");
      loader.innerHTML = '<div style="color:#d32f2f; text-align:center">Izin kamera ditolak<br>atau kamera tidak tersedia</div>';
  });
}

async function initializeApp() {
  showStatus("Memuat sistem...", "processing");
  await loadTopikList();
}

window.onload = () => {
  initTheme();
  
  // Connect background queue trigger for online state detection (safe-checked)
  window.addEventListener('online', () => {
    if (typeof scanQueue !== 'undefined') scanQueue.process();
  });

  if (sessionStorage.getItem('authToken')) {
    setAppState(1); // Set to selection page initially
    if (typeof initializeApp === 'function') initializeApp();
  } else {
    setAppState(0); // Authentication screen
  }
}
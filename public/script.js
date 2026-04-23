let html5QrcodeScanner; // Will be initialized later
let scanCooldown = false;
let selectedWeek = null; 
let profileModalTimeout; // To store the timeout ID for auto-closing the profile modal

// --- SAFARI VIEWPORT FIX ---
function setViewportHeight() {
  let vh = window.innerHeight * 0.01;
  document.documentElement.style.setProperty('--vh', `${vh}px`);
}
// Set on initial load
setViewportHeight();
// Reset on resize or orientation change
window.addEventListener('resize', setViewportHeight);

// --- DASHBOARD INTERACTION ---
function handleDashboardClick(event, element) {
  window.open('/api/dashboard', '_blank');
}

// --- MODAL FUNCTIONS ---
function openTopicModal() { document.getElementById('topic-modal').style.display = 'flex'; }
function closeTopicModal() { document.getElementById('topic-modal').style.display = 'none'; }

function showProfileModal(name, id, topic, imageUrl) {
  // Clear any existing timeout to prevent premature closing if a new scan happens quickly
  clearTimeout(profileModalTimeout);

  document.getElementById('profile-name').textContent = name;
  document.getElementById('profile-id').innerHTML = `CODE: ${id} // TOPIC: ${topic}`;
  const img = document.getElementById('profile-image');
  img.src = imageUrl;
  document.getElementById('profile-modal').style.display = 'flex';

  // Reset spinner animation
  const spinner = document.querySelector('.circle-progress');
  if (spinner) {
    spinner.style.animation = 'none';
    spinner.offsetHeight; // Trigger reflow
    spinner.style.animation = 'countdown 4s linear forwards';
  }

  // Set timeout to close the modal after 4 seconds
  profileModalTimeout = setTimeout(closeProfileModal, 4000);
}

function closeProfileModal() {
  document.getElementById('profile-modal').style.display = 'none';
}

function selectTopic(week, name, element) {
  selectedWeek = week;
  document.getElementById('topic-trigger').innerHTML = `<span>${week}. ${name}</span><span class="material-icons-outlined">expand_more</span>`;
  document.querySelectorAll('.topic-option').forEach(el => el.classList.remove('active'));
  element.classList.add('active');
  setTimeout(closeTopicModal, 100);
}

function filterTopics() {
  const searchTerm = document.getElementById('topic-search-input').value.toLowerCase();
  const topics = document.querySelectorAll('.topic-option');
  topics.forEach(topic => {
    const topicText = topic.textContent.toLowerCase();
    if (topicText.includes(searchTerm)) {
      topic.style.display = 'block';
    } else {
      topic.style.display = 'none';
    }
  });
}

function togglePasswordVisibility() {
  const input = document.getElementById('login-input');
  const icon = document.getElementById('password-toggle');
  if (input.type === 'password') {
    input.type = 'text';
    icon.textContent = 'visibility'; // Icon to hide the password
  } else {
    input.type = 'password';
    icon.textContent = 'visibility_off'; // Icon to show the password
  }
}

function hideLoginError() {
  const errorBox = document.getElementById('login-error-box');
  if (errorBox.style.display === 'block') {
    // Animate out
    errorBox.style.animation = 'fadeOutDown 0.3s ease-in forwards';
    setTimeout(() => {
      errorBox.style.display = 'none';
      errorBox.style.animation = 'fadeInUp 0.3s ease-out forwards'; // Reset for next time
    }, 300);
  }
}

// --- AUTHENTICATION ---
async function handleLogin() {
  let errorTimeout; // Variable to hold the timeout
  const secret = document.getElementById('login-input').value;
  const errorBox = document.getElementById('login-error-box');
  const successIcon = document.getElementById('login-success-icon');
  const loginLoader = document.getElementById('login-loader');

  if (!secret) {
    errorBox.textContent = 'Password tidak boleh kosong.';
    errorBox.style.display = 'block';
    return;
  }

  // Hide previous errors smoothly
  hideLoginError();

  try {
    const response = await fetch("/api/absensi", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: 'login', secret }),
    });
    const data = await response.json();

    if (data.status === 'ok' && data.token) {
      // 1. Show success immediately
      successIcon.style.display = 'block';

      setTimeout(() => {
        sessionStorage.setItem('authToken', data.token); // Store token
        document.getElementById('login-container').style.display = 'none';
        document.getElementById('login-footer').style.display = 'none';
        const loginHeader = document.getElementById('login-header');
        if (loginHeader) loginHeader.style.display = 'none';
        const bottomBranding = document.getElementById('bottom-branding');
        if (bottomBranding) bottomBranding.style.display = 'none';
        
        document.getElementById('scanner-ui').style.display = 'flex';
        initializeApp(); // Load the main app
      }, 500);
    } else {
      // Wrong password
      errorBox.textContent = `ACCESS_DENIED: ${data.message || 'INVALID_KEY'}`;
      errorBox.style.display = 'block';
      // Shake effect
      const input = document.getElementById('login-input');
      input.style.borderColor = '#f00';
      setTimeout(() => input.style.borderColor = '', 1000);
      errorTimeout = setTimeout(hideLoginError, 3000);
    }
  } catch (e) {
    errorBox.textContent = 'SYSTEM_ERROR: CONNECTION_FAILED';
    errorBox.style.display = 'block';
    errorTimeout = setTimeout(hideLoginError, 3000);
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

// --- STATUS HANDLER (Text Only) ---
function showStatus(mainText, type, subText = "") {
  const el = document.getElementById("status");
  
  let iconName = "";
  if (type === 'success') iconName = "check_box";
  else if (type === 'error') iconName = "indeterminate_check_box";
  else if (type === 'processing') iconName = "sync";
  else iconName = "qr_code_2";

  const statusContent = subText 
    ? `<span>[${iconName.toUpperCase()}]</span> <span>${mainText} // ${subText}</span>`
    : `<span>[${iconName.toUpperCase()}]</span> <span>${mainText}</span>`;

  el.innerHTML = statusContent;
  el.className = `data-mono ${type}`;
}

function resetStatus() { showStatus("Silakan pindai kode QR berikutnya", "idle"); }

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
    // DECODE the Base64 string from the QR code
    originalStudentId = atob(decodedText);
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
    showStatus("Error Koneksi", "error", "Gagal menghubungi server");
  } finally {
    // Shorter cooldown for better UX
    setTimeout(() => { scanCooldown = false; resetStatus(); }, 3000);
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
  startScanner();
}

// Check if user is already logged in on page load
window.onload = () => {
  if (sessionStorage.getItem('authToken')) {
      document.getElementById('login-container').style.display = 'none';
      const loginHeader = document.getElementById('login-header');
      if (loginHeader) loginHeader.style.display = 'none';
      const bottomBranding = document.getElementById('bottom-branding');
      if (bottomBranding) bottomBranding.style.display = 'none';
      document.getElementById('scanner-ui').style.display = 'flex';
      document.getElementById('login-footer').style.display = 'none';
      initializeApp();
  }
}
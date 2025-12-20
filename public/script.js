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

// --- MODAL FUNCTIONS ---
function openTopicModal() { document.getElementById('topic-modal').style.display = 'flex'; }
function closeTopicModal() { document.getElementById('topic-modal').style.display = 'none'; }

function showProfileModal(name, id, imageUrl) {
  // Clear any existing timeout to prevent premature closing if a new scan happens quickly
  clearTimeout(profileModalTimeout);

  document.getElementById('profile-name').textContent = name;
  document.getElementById('profile-id').textContent = id;
  const img = document.getElementById('profile-image');
  img.src = imageUrl || "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNTAiIGhlaWdodD0iMTUwIiB2aWV3Qm94PSIwIDAgMTUwIDE1MCI+PHJlY3Qgd2lkdGg9IjE1MCIgaGVpZ2h0PSIxNTAiIGZpbGw9IiMzMzMiLz48dGV4dCB4PSI1MCUiIHk9IjUwJSIgZm9udC1mYW1pbHk9InNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTYiIGZpbGw9IiNhYWEiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5ObyBJbWFnZTwvdGV4dD48L3N2Zz4="; 
  document.getElementById('profile-modal').style.display = 'flex';

  // Set timeout to close the modal after 2 seconds (2000 milliseconds)
  profileModalTimeout = setTimeout(closeProfileModal, 2000);
}

function closeProfileModal() {
  document.getElementById('profile-modal').style.display = 'none';
}

function selectTopic(week, name, element) {
  selectedWeek = week;
  document.getElementById('topic-trigger').innerText = `${week}. ${name}`;
  document.getElementById('topic-trigger').style.borderColor = "#9A2126";
  document.querySelectorAll('.topic-option').forEach(el => el.classList.remove('active'));
  element.classList.add('active');
  setTimeout(closeTopicModal, 200);
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
      // 1. Fade in the green checkmark and keep it for 1 second.
      successIcon.style.animation = 'fadeIn 0.5s forwards'; // A slightly longer fade-in
      successIcon.style.display = 'block';

      setTimeout(() => { // This timeout ensures the checkmark is visible for 1 second before proceeding
        successIcon.style.display = 'none'; // Hide checkmark
        
        // 2. Show loading spinner for 0.5s
        loginLoader.style.display = 'flex';

        setTimeout(() => {
          const loginContainer = document.getElementById('login-container');
          const loginFooter = document.getElementById('login-footer');
          const loginHeader = document.getElementById('login-header');
          const bottomLogo = document.getElementById('bottom-logo');

          // 3. Animate login screen out
          loginContainer.style.animation = 'fadeOutDown 0.4s ease-in forwards';
          loginFooter.style.animation = 'fadeOutDown 0.4s ease-in forwards';
          if (loginHeader) loginHeader.style.animation = 'fadeOutDown 0.4s ease-in forwards';
          if (bottomLogo) bottomLogo.style.animation = 'fadeOutDown 0.4s ease-in forwards';

          // 4. After fade out, hide it and show scanner UI
          setTimeout(() => {
            sessionStorage.setItem('authToken', data.token); // Store token
            loginContainer.style.display = 'none';
            loginFooter.style.display = 'none';
            if (loginHeader) loginHeader.style.display = 'none';
            if (bottomLogo) bottomLogo.style.display = 'none';
            loginLoader.style.display = 'none'; // Hide loader
            document.getElementById('scanner-ui').style.display = 'flex';
            initializeApp(); // Load the main app
          }, 400);
        }, 500); // Wait for 0.5 seconds
      }, 1000); // Wait for 1 second
    } else {
      // Wrong password: show red error box
      errorBox.textContent = data.message || 'Login gagal.';
      errorBox.style.display = 'block';
      // Shake the input box
      document.getElementById('login-input').style.animation = 'shake 0.5s';
      setTimeout(() => document.getElementById('login-input').style.animation = '', 500);
      // Set a timeout to hide the error box after 2 seconds
      errorTimeout = setTimeout(hideLoginError, 2000);
    }
  } catch (e) {
    // Also set timeout for connection errors
    errorBox.textContent = 'Error koneksi ke server.';
    errorBox.style.display = 'block';
    errorTimeout = setTimeout(hideLoginError, 2000);
  }
}

async function loadTopikList() {
  const listContainer = document.getElementById("topic-list-container");
  try {
    const token = sessionStorage.getItem('authToken');
    const res = await fetch(`/api/absensi?action=topik&classCode=SAB`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();

    if (data.status === "ok" && Array.isArray(data.topik)) {
      listContainer.innerHTML = "";
      data.topik.forEach((item) => {
        const div = document.createElement("div");
        div.className = "topic-option";
        div.textContent = `${item.week}. ${item.name}`;
        div.onclick = () => selectTopic(item.week, item.name, div);
        listContainer.appendChild(div);
      });
    } else {
      listContainer.innerHTML = `<div style="text-align:center; color:#d32f2f;">Data topik tidak ditemukan.</div>`;
    }
  } catch (err) {
    listContainer.innerHTML = `<div style="text-align:center; color:#d32f2f;">Gagal memuat topik.</div>`;
  }
}

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
          <span class="material-icons-outlined" style="font-size: 1.5rem; margin-right: 10px;">${iconName}</span>
          <div class="status-text-container">
              <div class="main-text">${mainText}</div>
              <div class="sub-text">${subText}</div>
          </div>
      `;
  } else {
      el.innerHTML = `
          <span class="material-icons-outlined" style="font-size: 1.5rem; margin-right: 10px;">${iconName}</span>
          <div class="main-text">${mainText}</div>
      `;
  }
  el.className = type;
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
  showStatus("Memproses...", "processing");

  try {
    const token = sessionStorage.getItem('authToken');
    const response = await fetch("/api/absensi", {
      method: "POST", // Use the DECODED student ID in the request body
      headers: { "Content-Type": "application/json", 'Authorization': `Bearer ${token}` }, // The studentId contains the classCode
      body: JSON.stringify({ studentId: originalStudentId, week: selectedWeek }),
    });

    const text = await response.text();
    let res = JSON.parse(text);

    if (res.status === "ok") {
      showStatus(res.name, "success", `ID: ${res.studentId} • Topik ${selectedWeek}`);
      showProfileModal(res.name, res.studentId, res.image);
    } else if (res.status === "duplicate") {
      showStatus("Sudah Hadir", "error", res.message);
    } else if (response.status === 400) { // Specifically handle invalid classCode from API
      showStatus("Kode QR Tidak Valid", "error", res.message);
    } else {
      showStatus("Gagal", "error", res.message);
    }
  } catch (error) {
    showStatus("Error Koneksi", "error", "Gagal menghubungi server");
  } finally {
    setTimeout(() => { scanCooldown = false; resetStatus(); }, 4000);
  }
}

async function startScanner() {
  const scanConfig = { 
      fps: 10, // Increased for faster recognition
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
      const bottomLogo = document.getElementById('bottom-logo');
      if (bottomLogo) bottomLogo.style.display = 'none';
      document.getElementById('scanner-ui').style.display = 'flex';
      document.getElementById('login-footer').style.display = 'none';
      initializeApp();
  }
}
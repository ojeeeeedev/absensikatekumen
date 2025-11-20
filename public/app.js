const ICONS = {
  camera: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 10.5a2.5 2.5 0 100 5 2.5 2.5 0 000-5zm-6.5 1h-2a.5.5 0 00-.5.5v3a.5.5 0 00.5.5h2a.5.5 0 00.5-.5v-3a.5.5 0 00-.5-.5zM22 6a2 2 0 00-2-2H4a2 2 0 00-2 2v12c0 1.1.9 2 2 2h16a2 2 0 002-2V6zm-2 12H4V6h4.05L9 4.5h6l.95 1.5H20v12z"/></svg>`,
  hourglass: `<svg class="rotate-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M6 2v6h.01L6 8.01 10 12l-4 4 .01.01H6V22h12v-5.99h-.01L18 16l-4-4 4-3.99-.01-.01H18V2H6z"/></svg>`,
  check: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>`,
  error: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>`
};

const CACHE_KEYS = {
  scriptMap: "absensi.scriptMap",
  topics: "absensi.topics"
};

const CACHE_TTL = {
  scriptMap: 1000 * 60 * 60, // 1 hour
  topics: 1000 * 60 * 5 // 5 minutes
};

const html5QrcodeScanner = new Html5Qrcode("reader");
let scanCooldown = false;
let SCRIPT_MAP = {};
let selectedWeek = null;
let topicsController;

function readCache(key, ttl) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed.timestamp || Date.now() - parsed.timestamp > ttl) {
      localStorage.removeItem(key);
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
}

function writeCache(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify({ timestamp: Date.now(), data }));
  } catch {
    /* ignore storage failures */
  }
}

function showStatus(content, type) {
  const el = document.getElementById("status");
  if (!el) return;

  window.requestAnimationFrame(() => {
    let icon = ICONS.camera;
    if (type === "success") icon = ICONS.check;
    else if (type === "error") icon = ICONS.error;
    else if (type === "processing") icon = ICONS.hourglass;

    if (type === "success") {
      el.innerHTML = `<div class="status-icon">${ICONS.check}</div><div class="status-content">${content}</div>`;
    } else {
      el.innerHTML = `<div class="status-icon">${icon}</div><div class="status-content"><div class="student-name">${content}</div></div>`;
    }
    el.className = type;
  });
}

function resetStatus() {
  showStatus("Silakan pindai kode QR berikutnya", "idle");
}

function openTopicModal() {
  const modal = document.getElementById("topic-modal");
  if (modal) modal.style.display = "flex";
}

function closeTopicModal() {
  const modal = document.getElementById("topic-modal");
  if (modal) modal.style.display = "none";
}

function selectTopic(week, name, element) {
  selectedWeek = week;
  const trigger = document.getElementById("topic-trigger");
  if (trigger) {
    trigger.innerText = `${week}. ${name}`;
    trigger.style.borderColor = "#72b7ff";
  }

  document.querySelectorAll(".topic-option").forEach((el) => el.classList.remove("active"));
  if (element) element.classList.add("active");

  setTimeout(closeTopicModal, 200);
}

async function loadScriptMap(forceRefresh = false) {
  if (!forceRefresh) {
    const cached = readCache(CACHE_KEYS.scriptMap, CACHE_TTL.scriptMap);
    if (cached) {
      SCRIPT_MAP = cached;
      return;
    }
  }

  const response = await fetch("/config.json", { cache: "no-cache" });
  if (!response.ok) throw new Error("Config fetch failed");

  const data = await response.json();
  SCRIPT_MAP = data;
  writeCache(CACHE_KEYS.scriptMap, data);
}

function renderTopicList(topics) {
  const listContainer = document.getElementById("topic-list-container");
  if (!listContainer) return;

  listContainer.innerHTML = "";
  topics.forEach((item) => {
    const div = document.createElement("div");
    div.className = "topic-option";
    div.textContent = `${item.week}. ${item.name}`;
    div.onclick = () => selectTopic(item.week, item.name, div);
    listContainer.appendChild(div);
  });

  if (topics.length > 0) {
    const latest = topics[topics.length - 1];
    selectTopic(latest.week, latest.name, listContainer.lastChild);
  }
}

async function loadTopikList(forceRefresh = false) {
  const listContainer = document.getElementById("topic-list-container");
  const cached = !forceRefresh ? readCache(CACHE_KEYS.topics, CACHE_TTL.topics) : null;

  if (cached?.length) {
    renderTopicList(cached);
  } else if (listContainer) {
    listContainer.innerHTML = `<div style="text-align:center; padding:20px; color:#666;">Memuat topik...</div>`;
  }

  try {
    if (topicsController) topicsController.abort();
    topicsController = new AbortController();

    const response = await fetch(`/api/absensi?action=topik&classCode=SAB`, {
      signal: topicsController.signal,
      cache: "no-cache"
    });

    if (!response.ok) throw new Error("Topic fetch failed");
    const data = await response.json();

    if (data.status === "ok" && Array.isArray(data.topik)) {
      renderTopicList(data.topik);
      writeCache(CACHE_KEYS.topics, data.topik);
    } else {
      throw new Error("Invalid topic payload");
    }
  } catch (err) {
    console.error("Topik load error:", err);
    if (!cached && listContainer) {
      listContainer.innerHTML = `<div style="color:#ff4444; text-align:center;">Gagal memuat topik.</div>`;
    }
    showStatus("Gagal memuat daftar topik.", "error");
  }
}

async function handleScan(decodedText) {
  if (scanCooldown) return;

  if (!selectedWeek) {
    showStatus("HARAP PILIH TOPIK TERLEBIH DAHULU!", "error");
    openTopicModal();
    return;
  }

  scanCooldown = true;
  showStatus("Memproses...", "processing");

  const parts = decodedText.split("/");
  const classCode = parts[1]?.toUpperCase();

  if (!classCode || !SCRIPT_MAP[classCode]) {
    showStatus(`Kode Kelas Tidak Valid: ${classCode || "N/A"}`, "error");
    setTimeout(() => {
      scanCooldown = false;
      resetStatus();
    }, 3000);
    return;
  }

  try {
    const response = await fetch("/api/absensi", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId: decodedText, week: selectedWeek, classCode })
    });

    if (!response.ok) throw new Error("Jaringan error");
    const res = await response.json();

    if (res.status === "ok") {
      showStatus(
        `<div class="student-name">${res.name}</div><div class="student-details">ID: ${res.studentId} • Topik ${selectedWeek}</div>`,
        "success"
      );
    } else if (res.status === "duplicate") {
      showStatus(`Sudah Hadir: ${res.message}`, "error");
    } else {
      showStatus(`Gagal: ${res.message}`, "error");
    }
  } catch (error) {
    console.error("Scan error:", error);
    showStatus("Koneksi Error / Gagal menghubungi server", "error");
  } finally {
    setTimeout(() => {
      scanCooldown = false;
      resetStatus();
    }, 4000);
  }
}

async function startScanner() {
  if (Object.keys(SCRIPT_MAP).length === 0) {
    try {
      await loadScriptMap();
    } catch (err) {
      console.error("Script map error:", err);
      showStatus("Gagal memuat konfigurasi.", "error");
      return;
    }
  }

  html5QrcodeScanner
    .start(
      { facingMode: "environment" },
      {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0
      },
      handleScan
    )
    .then(() => {
      const loader = document.getElementById("camera-loader");
      if (loader) loader.style.display = "none";
      resetStatus();
    })
    .catch((err) => {
      console.error("Failed to start scanner:", err);
      const loader = document.getElementById("camera-loader");
      if (loader) {
        loader.innerHTML = '<div style="color:red;text-align:center">Izin kamera ditolak</div>';
      }
      showStatus("Gagal Memulai Kamera", "error");
    });
}

window.addEventListener("load", async () => {
  showStatus("Memuat sistem...", "processing");
  await Promise.all([loadScriptMap(), loadTopikList()]);
  startScanner();
});

// Expose functions for inline handlers
window.openTopicModal = openTopicModal;
window.closeTopicModal = closeTopicModal;
window.selectTopic = selectTopic;


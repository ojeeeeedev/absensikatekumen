let html5QrcodeScanner = null;
let scannerStartPromise = null;
let viewfinderDimTimer = null;
const VIEWFINDER_INACTIVE_MS = 800;

function safeAtob(str) {
  let cleaned = str.replace(/\s/g, '').replace(/-/g, '+').replace(/_/g, '/');
  const pad = cleaned.length % 4;
  if (pad) {
    if (pad === 1) throw new Error("Invalid base64 structure");
    cleaned += '='.repeat(4 - pad);
  }
  return atob(cleaned);
}

function triggerVisualFlash(type, onlyWhenScanning = false) {
  if (onlyWhenScanning && !document.getElementById('app-container')?.classList.contains('state-scanning')) return false;
  const readerContainer = document.getElementById('reader-container');
  if (!readerContainer) return false;
  
  const flash = document.createElement('div');
  const flashType = type === 'success' ? 'success' : type === 'duplicate' ? 'duplicate' : 'error';
  flash.className = `reader-flash ${flashType}`;
  
  readerContainer.appendChild(flash);
  
  // Trigger reflow and fade out
  setTimeout(() => {
    flash.style.opacity = '0';
    setTimeout(() => flash.remove(), 400);
  }, 100);
  return true;
}

function dimViewfinder() {
  const readerContainer = document.getElementById('reader-container');
  if (!readerContainer) return;
  readerContainer.classList.add('scan-inactive');
  clearTimeout(viewfinderDimTimer);
  viewfinderDimTimer = setTimeout(() => readerContainer.classList.remove('scan-inactive'), VIEWFINDER_INACTIVE_MS);
}

window.handleScan = async function handleScan(decodedText) {
  if (!window.selectedWeek) {
    window.openTopicSelector?.();
    return;
  }

  let originalStudentId;
  try {
    originalStudentId = safeAtob(decodedText);
  } catch (e) {
    if (navigator.vibrate) navigator.vibrate([100, 50]);
    triggerVisualFlash('error');
    return;
  }

  // Add scan to queue instantly and keep camera running!
  if (!window.scanQueue.add(originalStudentId, window.selectedWeek)) return;
  dimViewfinder();
  if (navigator.vibrate) navigator.vibrate(80);
};

window.startScanner = async function startScanner() {
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
    window.handleScan
  );

  scannerStartPromise.then(() => {
    scannerStartPromise = null;
    const loader = document.getElementById("camera-loader");
    if (loader) loader.style.display = "none";
  }).catch(err => {
    scannerStartPromise = null;
    console.error("Camera start failed:", err);
    html5QrcodeScanner = null; // Reset reference so retry can be attempted
    const loader = document.getElementById("camera-loader");
    if (loader) {
      loader.innerHTML = '<div style="color:var(--status-duplicate-text); text-align:center; padding:10px;">Izin kamera ditolak<br>atau kamera tidak tersedia</div>';
    }
  });
};

window.stopScanner = async function stopScanner() {
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
};

let html5QrcodeScanner = null;
let selectedWeek = null;
let topicComboboxLarge = null;
let topicComboboxActive = null;
let viewfinderDimTimer = null;
const LAST_QR_SCAN_KEY = 'last_qr_scan';
const SCAN_REPEAT_WINDOW_MS = 5000;
const VIEWFINDER_INACTIVE_MS = 800;

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

const BULK_DELETE_DEAD_ZONE = 8;
const BULK_DELETE_MAX_REVEAL = 72;
const BULK_DELETE_THRESHOLD = 56;

function setBulkDeleteAvailability(available) {
  document.querySelectorAll('.bulk-delete-action').forEach(action => {
    action.hidden = !available;
  });
}

function bindHistoryBulkDelete() {
  const list = document.getElementById('queue-list');
  const carousel = list?.closest('.carousel-container');
  const startAction = document.getElementById('bulk-delete-start');
  const endAction = document.getElementById('bulk-delete-end');
  if (!list || !carousel || !startAction || !endAction || list.dataset.bulkDeleteBound === 'true') return;
  list.dataset.bulkDeleteBound = 'true';

  let startX = null;
  let direction = null;
  let reveal = 0;
  let pointerId = null;
  let suppressClick = false;

  const reset = () => {
    list.style.removeProperty('transform');
    list.classList.remove('bulk-delete-dragging');
    carousel.classList.remove('bulk-delete-revealing');
    startAction.classList.remove('active');
    endAction.classList.remove('active');
    startX = null;
    direction = null;
    reveal = 0;
    pointerId = null;
  };

  const begin = clientX => {
    if (startAction.hidden || endAction.hidden) return;
    startX = clientX;
  };

  const move = (clientX, event) => {
    if (startX === null) return;
    const delta = clientX - startX;
    if (!direction) {
      if (Math.abs(delta) <= BULK_DELETE_DEAD_ZONE) return;
      const atStart = list.scrollLeft <= 5;
      const atEnd = list.scrollLeft + list.clientWidth >= list.scrollWidth - 5;
      if (delta > 0 && atStart) direction = 'start';
      else if (delta < 0 && atEnd) direction = 'end';
      else return;
    }

    event.preventDefault();
    suppressClick = true;
    reveal = Math.min(BULK_DELETE_MAX_REVEAL, Math.max(0, Math.abs(delta)));
    const offset = direction === 'start' ? reveal : -reveal;
    list.style.transform = `translateX(${offset}px)`;
    list.classList.add('bulk-delete-dragging');
    carousel.classList.add('bulk-delete-revealing');
    startAction.classList.toggle('active', direction === 'start');
    endAction.classList.toggle('active', direction === 'end');
  };

  const finish = event => {
    const shouldDelete = direction && reveal >= BULK_DELETE_THRESHOLD;
    const trigger = direction === 'start' ? startAction : endAction;
    reset();
    if (shouldDelete) window.openDeleteConfirm(event, trigger);
  };

  list.addEventListener('touchstart', event => begin(event.touches[0].clientX), { passive: true });
  list.addEventListener('touchmove', event => move(event.touches[0].clientX, event), { passive: false });
  list.addEventListener('touchend', finish);
  list.addEventListener('touchcancel', reset);

  list.addEventListener('pointerdown', event => {
    if (event.pointerType === 'touch') return;
    pointerId = event.pointerId;
    begin(event.clientX);
  });
  list.addEventListener('pointermove', event => {
    if (event.pointerId !== pointerId) return;
    move(event.clientX, event);
    if (direction && !list.hasPointerCapture(pointerId)) list.setPointerCapture(pointerId);
  });
  list.addEventListener('pointerup', event => {
    if (event.pointerId === pointerId) finish(event);
  });
  list.addEventListener('pointercancel', reset);
  list.addEventListener('click', event => {
    if (!suppressClick) return;
    suppressClick = false;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);

  startAction.addEventListener('click', event => window.openDeleteConfirm(event, startAction));
  endAction.addEventListener('click', event => window.openDeleteConfirm(event, endAction));
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
    setViewVisibility('scan');
    document.body.dataset.activeView = 'scan';
    updateActiveNavigation('scan');
    if (window.location.pathname !== '/') history.replaceState({ view: 'scan' }, '', '/');
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
        activeTopicText.textContent = topicTrigger.textContent.trim();
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

const APP_VIEW_PATHS = { scan: '/', profile: '/profile' };
const APP_VIEW_TITLES = {
  scan: 'Sistem Presensi Katekumen Dewasa',
  profile: 'Profil Katekumen - Presensi Katekumen Digital'
};
const APP_VIEW_HEADINGS = { scan: 'Sistem Presensi', profile: 'Profil Katekumen' };
let appViewNavigation = Promise.resolve();

function viewFromPath(pathname = window.location.pathname) {
  return pathname === '/profile' || pathname === '/profile.html' ? 'profile' : 'scan';
}

function setViewVisibility(view) {
  const scanView = document.getElementById('main-app-section');
  const profileView = document.getElementById('profile-view');
  const profileActive = view === 'profile';
  scanView.hidden = profileActive;
  scanView.inert = profileActive;
  profileView.hidden = !profileActive;
  profileView.inert = !profileActive;
}

function updateActiveNavigation(view) {
  document.querySelectorAll('[data-app-view]').forEach(link => {
    const active = link.dataset.appView === view;
    link.classList.toggle('active', active);
    if (active) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
}

async function replaceViewHeading(view, animate) {
  const title = document.getElementById('app-view-title');
  const nextHeading = APP_VIEW_HEADINGS[view];
  title.getAnimations().forEach(animation => animation.cancel());
  if (title.textContent === nextHeading) return;
  if (!animate || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    title.textContent = nextHeading;
    return;
  }
  const fadeOut = title.animate([{ opacity: 1 }, { opacity: 0 }], {
    duration: 60,
    easing: 'ease-out',
    fill: 'forwards'
  });
  await fadeOut.finished;
  fadeOut.cancel();
  title.textContent = nextHeading;
  title.animate([{ opacity: 0 }, { opacity: 1 }], {
    duration: 70,
    easing: 'ease-out'
  });
}

function animateViewEntry(view) {
  const viewElement = document.getElementById(view === 'profile' ? 'profile-view' : 'main-app-section');
  [document.getElementById('main-app-section'), document.getElementById('profile-view')]
    .forEach(element => element.getAnimations().forEach(animation => animation.cancel()));
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  viewElement.animate(
    [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'translateY(0)' }],
    { duration: 180, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' }
  );
}

function animateContainerResize(fromHeight, animate) {
  const container = document.getElementById('app-container');
  container.getAnimations().forEach(animation => animation.cancel());
  const toHeight = container.getBoundingClientRect().height;
  if (!animate || window.matchMedia('(prefers-reduced-motion: reduce)').matches || Math.abs(fromHeight - toHeight) < 1) return;
  container.animate(
    [{ height: `${fromHeight}px` }, { height: `${toHeight}px` }],
    { duration: 240, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' }
  );
}

async function applyAppView(view, { historyMode = 'push', focus = true } = {}) {
  if (!sessionStorage.getItem('authToken')) {
    await setAppState(0);
    return;
  }

  const container = document.getElementById('app-container');
  const nav = document.getElementById('app-nav');

  if (view === 'profile') {
    topicComboboxLarge?.close();
    topicComboboxActive?.close();
    window.closeStudentModal?.();
    window.closeDeleteConfirm?.();
    await stopScanner();
  } else {
    window.closeProfileViewUI?.();
  }

  const fromHeight = container.getBoundingClientRect().height;
  const headingChange = replaceViewHeading(view, focus);
  document.body.dataset.activeView = view;
  setViewVisibility(view);
  updateActiveNavigation(view);
  document.title = APP_VIEW_TITLES[view];
  if (nav) nav.style.display = 'flex';

  if (view === 'profile') {
    const expanded = document.getElementById('class-selector')?.value;
    container.className = `glass-container state-profile${expanded ? ' profile-expanded' : ''}`;
    window.initializeProfileView?.();
  } else {
    await setAppState(2);
  }
  animateContainerResize(fromHeight, focus);
  animateViewEntry(view);
  await headingChange;

  const path = APP_VIEW_PATHS[view];
  if (historyMode === 'replace') history.replaceState({ view }, '', path);
  else if (historyMode === 'push' && window.location.pathname !== path) history.pushState({ view }, '', path);

  if (focus) {
    requestAnimationFrame(() => document.getElementById('app-view-title')?.focus({ preventScroll: true }));
  }
}

window.navigateToAppView = function navigateToAppView(view, options) {
  appViewNavigation = appViewNavigation.then(() => applyAppView(view, options));
  return appViewNavigation;
};

document.querySelectorAll('[data-app-view]').forEach(link => {
  link.addEventListener('click', event => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    window.navigateToAppView(link.dataset.appView);
  });
});

window.addEventListener('popstate', () => {
  window.navigateToAppView(viewFromPath(), { historyMode: 'none' });
});



// --- SAFARI VIEWPORT FIX ---
function setViewportHeight() {
  let vh = window.innerHeight * 0.01;
  document.documentElement.style.setProperty('--vh', `${vh}px`);
}
setViewportHeight();
window.addEventListener('resize', setViewportHeight);

window.selectTopic = function(week, name) {
  selectedWeek = week;
  localStorage.setItem('selectedWeek', week);
  localStorage.setItem('selectedTopicName', name);
  topicComboboxLarge?.setValue(week);
  topicComboboxActive?.setValue(week);
  setTimeout(() => setAppState(2), 200);
}

window.openTopicSelector = function() {
  topicComboboxActive?.open();
}

window.togglePasswordVisibility = function() {
  const input = document.getElementById('login-input');
  const icon = document.getElementById('password-toggle');
  if (input.type === 'password') {
    input.type = 'text';
    icon.setAttribute('icon', 'eye-open');
    icon.setAttribute('aria-pressed', 'true');
    icon.setAttribute('aria-label', 'Sembunyikan password');
  } else {
    input.type = 'password';
    icon.setAttribute('icon', 'eye-off');
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
          
          initializeApp();
          window.navigateToAppView('scan', { historyMode: 'replace', focus: false });

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
/**
 * Persists scans in `scan_queue` and processes the oldest pending item first.
 * Pending items survive reloads; 401 pauses processing for a new login, while
 * network, 429, and 5xx failures remain pending for retry. Completed history is
 * retained for the UI and trimmed by clearOldHistory().
 */
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

  dismiss(id) {
    const index = this.queue.findIndex(item => item.id === id);
    if (index < 0) return false;
    const item = this.queue[index];
    if (item.status === 'pending' || item.status === 'processing') return false;

    this.queue.splice(index, 1);
    this.save();
    showToast('Riwayat pemindaian dihapus', 'info', {
      actionLabel: 'Urungkan',
      duration: 5000,
      onAction: () => this.restore(item, index)
    });
    return true;
  }

  restore(item, index) {
    if (!item || this.queue.some(existing => existing.id === item.id)) return false;
    this.queue.splice(Math.min(index, this.queue.length), 0, item);
    this.save();
    return true;
  }

  clearCompleted() {
    const initialLength = this.queue.length;
    this.queue = this.queue.filter(item => item.status === 'pending' || item.status === 'processing');
    if (this.queue.length === initialLength) return 0;
    this.save();
    return initialLength - this.queue.length;
  }

  add(studentId, week) {
    const timestamp = Date.now();

    let lastScan = null;
    try {
      lastScan = JSON.parse(localStorage.getItem(LAST_QR_SCAN_KEY) || 'null');
    } catch {
      localStorage.removeItem(LAST_QR_SCAN_KEY);
    }
    if (lastScan?.studentId === studentId && lastScan.expiresAt > timestamp) {
      return false;
    }
    const expiresAt = timestamp + SCAN_REPEAT_WINDOW_MS;
    localStorage.setItem(LAST_QR_SCAN_KEY, JSON.stringify({ studentId, expiresAt }));
    setTimeout(() => {
      try {
        const current = JSON.parse(localStorage.getItem(LAST_QR_SCAN_KEY) || 'null');
        if (current?.studentId === studentId && current.expiresAt <= Date.now()) localStorage.removeItem(LAST_QR_SCAN_KEY);
      } catch {
        localStorage.removeItem(LAST_QR_SCAN_KEY);
      }
    }, SCAN_REPEAT_WINDOW_MS);

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
    return true;
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
    const progressBar = document.querySelector('.segmented-progress-bar');
    
    if (pendingCount === 0) {
      this.totalInBatch = 0;
    } else if (this.totalInBatch < pendingCount) {
      this.totalInBatch = pendingCount;
    }

    if (progressBar) {
      const isLoading = pendingCount > 0;
      progressBar.classList.toggle('is-loading', isLoading);
      progressBar.setAttribute('aria-busy', String(isLoading));
    }
  }

  render() {
    this.updateBanner();
    const listContainer = document.getElementById('queue-list');
    if (!listContainer) return;

    const queueLength = this.queue.length;
    const progressArea = document.getElementById('history-progress-area');
    const dotsContainer = document.getElementById('carousel-dots');
    const prevBtn = document.getElementById('carousel-prev-btn');
    const nextBtn = document.getElementById('carousel-next-btn');
    const hasDismissibleHistory = this.queue.some(item => item.status !== 'pending' && item.status !== 'processing');
    setBulkDeleteAvailability(hasDismissibleHistory);

    // Ensure progress area is always visible (V3 Spec)
    if (progressArea) progressArea.style.display = 'block';

    if (queueLength === 0) {
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
      const progressBar = document.querySelector('.segmented-progress-bar');
      if (progressBar) progressBar.setAttribute('aria-valuenow', '0');

      // Hide all legend tags
      const legends = ['legend-success', 'legend-duplicate', 'legend-error', 'legend-pending'];
      legends.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
      });

      // Render empty history state
      listContainer.style.justifyContent = 'center';
      listContainer.innerHTML = `
        <div class="queue-empty-state" role="status">
          <span class="queue-empty-icon" aria-hidden="true">
            <re-icon icon="qr" decorative></re-icon>
          </span>
          <strong>Belum ada riwayat pemindaian</strong>
          <span>Pemindaian terbaru akan muncul di sini.</span>
        </div>
      `;
      return;
    }

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
    const progressBar = document.querySelector('.segmented-progress-bar');
    if (progressBar) {
      const completePct = Math.round(successPct + duplicatePct + errorPct);
      progressBar.setAttribute('aria-valuenow', String(completePct));
    }

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
      const statusTextMap = {
        success: 'hadir',
        duplicate: 'presensi sudah tercatat',
        error: 'gagal',
        processing: 'sedang sinkronisasi',
        pending: 'menunggu sinkronisasi'
      };
      row.setAttribute('aria-label', `Detail pemindaian ${item.name || 'Katekumen'}, ${statusTextMap[item.status] || item.status}`);
      
      row.onclick = () => {
        showStudentModal(item);
      };
      row.onkeydown = (event) => {
        if (event.key === ' ' || event.key === 'Enter') {
          event.preventDefault();
          showStudentModal(item);
        }
      };

      if (item.status !== 'pending' && item.status !== 'processing') {
        row.classList.add('dismissible');
        const dismissButton = document.createElement('button');
        dismissButton.type = 'button';
        dismissButton.className = 'history-dismiss-btn';
        dismissButton.setAttribute('aria-label', `Hapus riwayat ${item.name || item.studentId || 'pemindaian'}`);
        const dismissGlyph = document.createElement('span');
        dismissGlyph.setAttribute('aria-hidden', 'true');
        dismissGlyph.textContent = '×';
        dismissButton.appendChild(dismissGlyph);
        dismissButton.addEventListener('click', event => {
          event.stopPropagation();
          this.dismiss(item.id);
        });
        dismissButton.addEventListener('keydown', event => event.stopPropagation());
        row.appendChild(dismissButton);
      }

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
      
      const statusIconByStatus = {
        success: 'check',
        error: 'close-circle2',
        duplicate: 'refresh',
        pending: 'timer-alt'
      };
      const icon = item.status === 'processing'
        ? Object.assign(document.createElement('app-spinner'), { className: 'app-spinner status-spinner' })
        : window.createAppIcon(statusIconByStatus[item.status] || statusIconByStatus.pending);
      if (item.status === 'processing') icon.setAttribute('aria-hidden', 'true');
      
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

// --- STATUS HANDLER ---
function showStatus(mainText, type, subText = "") {
  const el = document.getElementById("status");
  if (!el) return;
  
  let iconName = "qr";
  if (type === 'success') iconName = "check-circle";
  else if (type === 'error') iconName = "close-circle2";
  else if (type === 'processing') iconName = "timer-alt";

  el.innerHTML = "";

  const iconSpan = window.createAppIcon(iconName);
  iconSpan.style.fontSize = "1.25rem";
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
  
  const flash = document.createElement('div');
  const flashType = type === 'success' ? 'success' : type === 'duplicate' ? 'duplicate' : 'error';
  flash.className = `reader-flash ${flashType}`;
  
  readerContainer.appendChild(flash);
  
  // Trigger reflow and fade out
  setTimeout(() => {
    flash.style.opacity = '0';
    setTimeout(() => flash.remove(), 400);
  }, 100);
}

function dimViewfinder() {
  const readerContainer = document.getElementById('reader-container');
  if (!readerContainer) return;
  readerContainer.classList.add('scan-inactive');
  clearTimeout(viewfinderDimTimer);
  viewfinderDimTimer = setTimeout(() => readerContainer.classList.remove('scan-inactive'), VIEWFINDER_INACTIVE_MS);
}

// --- SCANNER LOGIC ---
async function handleScan(decodedText) {
  if (!selectedWeek) {
    showStatus("Pilih topik terlebih dahulu!", "error");
    openTopicSelector();
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

  // Add scan to queue instantly and keep camera running!
  if (!scanQueue.add(originalStudentId, selectedWeek)) return;
  dimViewfinder();
  if (navigator.vibrate) navigator.vibrate(80);
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

function initializeTopicComboboxes() {
  const topics = typeof STATIC_TOPICS !== 'undefined' && Array.isArray(STATIC_TOPICS) ? STATIC_TOPICS : [];
  const createTopicCombobox = (suffix, placeholder) => {
    const combobox = createSearchCombobox({
      rootId: `topic-combobox-${suffix}`,
      triggerId: suffix === 'large' ? 'topic-trigger-large' : 'topic-combobox-trigger',
      popoverId: suffix === 'large' ? 'topic-combobox-large-popover' : 'topic-combobox-popover',
      searchId: `topic-combobox-${suffix === 'large' ? 'large-' : ''}search`,
      listId: `topic-combobox-${suffix === 'large' ? 'large-' : ''}options`,
      emptyId: `topic-combobox-${suffix === 'large' ? 'large-' : ''}empty`,
      valueId: suffix === 'large' ? 'topic-trigger-large-label' : 'active-topic-name',
      selectId: `topic-selector-${suffix}`,
      placeholder,
      getValue: item => item.week,
      getLabel: item => `${item.week}. ${item.name}`,
      getSearchText: item => `${item.week} ${item.name}`,
      getOptionClass: item => {
        if (item.week.startsWith('R')) return 'topic-option-r';
        if (item.name.includes('(KI)')) return 'topic-option-ki';
        if (item.name.includes('(P)')) return 'topic-option-p';
        return '';
      }
    });
    const select = document.getElementById(`topic-selector-${suffix}`);
    select?.addEventListener('change', () => {
      const topic = topics.find(item => item.week === select.value);
      if (topic) selectTopic(topic.week, topic.name);
    });
    combobox?.setItems(topics, 'Data topik tidak ditemukan');
    return combobox;
  };

  topicComboboxLarge = createTopicCombobox('large', 'Pilih Topik Pertemuan...');
  topicComboboxActive = createTopicCombobox('active', 'Ketuk di sini untuk memilih topik...');
}

function initializeApp() {
  if (!topicComboboxActive) initializeTopicComboboxes();
  bindHistoryBulkDelete();
  scanQueue.render();
  scanQueue.process(); // Process any leftover queue from last load
}

// Initial triggers
window.onload = async () => {
  initTheme();
  loadVersion();
  
  // Connect background queue trigger for online state detection
  window.addEventListener('online', () => {
    scanQueue.process();
  });

  const cookieToken = getCookie('auth_token');
  const sessionToken = sessionStorage.getItem('authToken') || cookieToken;
  if (sessionToken) {
    sessionStorage.setItem('authToken', sessionToken);
    // Sync the auth_token cookie with the sessionStorage token
    document.cookie = `auth_token=${sessionToken}; path=/; max-age=28800; SameSite=Lax`;
    
    initializeApp();
    const savedWeek = localStorage.getItem('selectedWeek');
    const savedTopicName = localStorage.getItem('selectedTopicName');
    if (savedWeek && savedTopicName) {
      selectedWeek = savedWeek;
      topicComboboxLarge?.setValue(savedWeek);
      topicComboboxActive?.setValue(savedWeek);
    }
    
    await window.navigateToAppView(viewFromPath(), { historyMode: 'replace', focus: false });
  } else {
    await setAppState(0); // Authentication screen
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
  setTimeout(() => modal.querySelector('[role="button"], button')?.focus(), 0);
};

window.closeStudentModal = function(event) {
  const modal = document.getElementById('student-detail-modal');
  if (modal) {
    modal.style.display = 'none';
  }
};

let historyDeleteReturnFocus = null;

function setHistoryContentInert(inert) {
  const panel = document.getElementById('queue-history-panel');
  const overlay = document.getElementById('history-confirm-overlay');
  if (!panel || !overlay) return;
  [...panel.children].forEach(child => {
    if (child !== overlay) child.inert = inert;
  });
}

window.openDeleteConfirm = function(event, trigger) {
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
    historyDeleteReturnFocus = trigger || event?.currentTarget || document.activeElement;
    setHistoryContentInert(true);
    overlay.style.display = 'flex';
    // Force a reflow to trigger transition animation
    overlay.offsetHeight;
    overlay.classList.add('show');
    document.getElementById('confirm-btn-yes')?.focus({ preventScroll: true });
  }
};

window.closeDeleteConfirm = function(event) {
  if (event) event.stopPropagation();
  const overlay = document.getElementById('history-confirm-overlay');
  if (overlay) {
    overlay.classList.remove('show');
    setHistoryContentInert(false);
    setTimeout(() => {
      if (!overlay.classList.contains('show')) {
        overlay.style.display = 'none';
        historyDeleteReturnFocus?.focus?.({ preventScroll: true });
        historyDeleteReturnFocus = null;
      }
    }, 280);
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
    
    scanQueue.clearCompleted();
    showToast("Riwayat pemindaian berhasil dibersihkan", "info");
  }
  
  window.closeDeleteConfirm();
};

// Document click listener to close delete confirmation overlay when clicking outside
document.addEventListener('click', (event) => {
  const overlay = document.getElementById('history-confirm-overlay');
  if (overlay && overlay.classList.contains('show')) {
    if (!overlay.contains(event.target)) {
      window.closeDeleteConfirm();
    }
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  const studentModal = document.getElementById('student-detail-modal');
  if (studentModal && studentModal.style.display === 'flex') {
    window.closeStudentModal(event);
  }
  window.closeDeleteConfirm(event);
});

let html5QrcodeScanner = null;
let selectedWeek = null;
let topicComboboxLarge = null;
let topicComboboxActive = null;
let viewfinderDimTimer = null;
const LAST_QR_SCAN_KEY = 'last_qr_scan';
const SCAN_REPEAT_WINDOW_MS = 5000;
const VIEWFINDER_INACTIVE_MS = 800;
// Mirrors classCodeFromStudentId() in api/_supabase-utils.js.
const STUDENT_ID_PATTERN = /^[A-Za-z0-9_-]+\/[A-Za-z0-9]{2,5}\/[A-Za-z0-9_-]+$/;
const INVALID_QR_FEEDBACK_MS = 2500;
const QUEUE_REQUEST_TIMEOUT_MS = 20000;
const QUEUE_MAX_SERVER_ATTEMPTS = 6;
const QUEUE_RETRY_DELAYS_MS = [2000, 5000, 10000, 20000, 30000];
let lastInvalidQrFeedbackAt = 0;

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
let scannerStopPromise = null;
const CAMERA_LOADER_HTML = '<app-spinner class="app-spinner spinner" aria-hidden="true"></app-spinner><span>Memuat Kamera...</span>';

// --- STATE MANAGEMENT ---
// State 0: Auth, State 1: Selection, State 2: Scanning
window.setAppState = async function(state) {
  const container = document.getElementById('app-container');
  container.className = 'glass-container';
  const nav = document.getElementById('app-nav');
  
  if (state === 0) {
    container.classList.add('state-auth');
    // Nothing from the authenticated session may stay open over the login screen.
    window.closeStudentModal?.();
    window.closeProfileViewUI?.();
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
    duration: 100,
    easing: 'cubic-bezier(0.23, 1, 0.32, 1)',
    fill: 'forwards'
  });
  await fadeOut.finished;
  fadeOut.cancel();
  title.textContent = nextHeading;
  title.animate([{ opacity: 0 }, { opacity: 1 }], {
    duration: 160,
    easing: 'cubic-bezier(0.23, 1, 0.32, 1)'
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
  if (!window.hasActiveSession?.()) {
    await setAppState(0);
    return;
  }

  const container = document.getElementById('app-container');
  const nav = document.getElementById('app-nav');

  if (view === 'profile') {
    topicComboboxLarge?.close();
    topicComboboxActive?.close();
    window.closeStudentModal?.();
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
  const viewport = window.visualViewport;
  const height = viewport?.height || window.innerHeight;
  document.documentElement.style.setProperty('--vh', `${height * 0.01}px`);
  document.documentElement.style.setProperty('--viewport-offset', `${viewport?.offsetTop || 0}px`);
}
setViewportHeight();
window.addEventListener('resize', setViewportHeight);
window.visualViewport?.addEventListener('resize', setViewportHeight);
window.visualViewport?.addEventListener('scroll', setViewportHeight);

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
    icon.setAttribute('icon', 'eye');
    icon.setAttribute('aria-pressed', 'true');
    icon.setAttribute('aria-label', 'Sembunyikan password');
  } else {
    input.type = 'password';
    icon.setAttribute('icon', 'eye-off2');
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
let loginInFlight = false;

function restoreSavedTopic() {
  const savedWeek = localStorage.getItem('selectedWeek');
  const savedTopicName = localStorage.getItem('selectedTopicName');
  if (savedWeek && savedTopicName) {
    selectedWeek = savedWeek;
    topicComboboxLarge?.setValue(savedWeek);
    topicComboboxActive?.setValue(savedWeek);
  }
}

window.handleLogin = async function() {
  if (loginInFlight) return;
  const input = document.getElementById('login-input');
  const loginButton = document.getElementById('login-btn');
  const secret = input.value;
  const errorBox = document.getElementById('login-error-box');
  const successIcon = document.getElementById('login-success-icon');
  const loginLoader = document.getElementById('login-loader');

  if (!secret) {
    errorBox.textContent = 'Password tidak boleh kosong.';
    errorBox.style.display = 'block';
    return;
  }

  window.hideLoginError();
  loginInFlight = true;
  if (loginButton) loginButton.disabled = true;
  input.setAttribute('aria-busy', 'true');

  const showLoginError = (message) => {
    errorBox.textContent = message;
    errorBox.style.display = 'block';
    input.style.animation = 'shake 0.4s';
    setTimeout(() => input.style.animation = '', 400);
  };
  const release = () => {
    loginInFlight = false;
    if (loginButton) loginButton.disabled = false;
    input.removeAttribute('aria-busy');
  };

  let response;
  let data;
  try {
    response = await fetch("/api/absensi", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: 'login', secret }),
    });
    data = await response.json().catch(() => null);
  } catch (e) {
    console.error("Login request failed:", e);
    showLoginError('Tidak ada koneksi. Periksa jaringan lalu coba lagi.');
    release();
    return;
  }

  if (!(response.ok && data?.status === 'ok' && window.beginSession(data.expiresAt))) {
    const message = response.status === 401 ? (data?.message || 'Password salah')
      : response.status === 429 ? 'Terlalu banyak percobaan. Tunggu sebentar.'
      : 'Server sedang bermasalah. Coba lagi nanti.';
    showLoginError(message);
    release();
    return;
  }

  // Clear the shared secret so it is not left in the field (or shown) later.
  input.value = '';
  input.type = 'password';
  successIcon.style.display = 'block';

  setTimeout(() => {
    successIcon.style.display = 'none';
    loginLoader.style.display = 'flex';

    setTimeout(() => {
      loginLoader.style.display = 'none';
      window.checkTopicExpiry?.();
      initializeApp();
      restoreSavedTopic();
      window.navigateToAppView('scan', { historyMode: 'replace', focus: false });
      release();
    }, 250);
  }, 800);
}


// --- BACKGROUND SCAN QUEUE ENGINE ---
/**
 * Persists scans in `scan_queue` and processes the oldest eligible pending item.
 *
 * Item states: pending -> processing -> success | duplicate | error
 *   - No token: processing pauses until the next login.
 *   - 401: item returns to pending, session expires, login screen shows.
 *   - Network failure or timeout: item returns to pending, the whole queue
 *     waits (backoff) because connectivity is shared by every item.
 *   - 5xx / 429 / busy: only that item backs off (nextAttemptAt), so one broken
 *     class deployment cannot block other scans. After
 *     QUEUE_MAX_SERVER_ATTEMPTS it becomes an error and the user rescans.
 *   - Other 4xx or a GAS error/not-found: error with the server's message.
 * A single timer (retryTimer) drives retries. Completed history is retained
 * for the UI and trimmed by clearOldHistory().
 *
 * Several tabs share `scan_queue`: save() merges storage first (newest
 * `updatedAt` wins, removed ids stay removed), the storage event mirrors other
 * tabs' scans, and a Web Lock lets only one tab send at a time.
 */
class ScanQueue {
  constructor() {
    this.queue = this.readStoredQueue();
    // Cross-tab bookkeeping: what storage held at our last sync, a snapshot of
    // each item as last synced (to detect local edits), and ids we removed.
    this.lastStoredIds = new Set(this.queue.map(item => item.id));
    this.snapshots = new Map();
    this.removedIds = new Set();
    this.snapshotAll();

    this.isProcessing = false;
    this.retryTimer = null;
    this.offlineNotified = false;
    this.healStaleProcessing();
    this.cleanExpiredItems();
    this.expireTimer = setInterval(() => this.cleanExpiredItems(), 15000);

    // Another tab changed the shared queue: show its scans here as well.
    window.addEventListener('storage', (event) => {
      if (event.key !== 'scan_queue') return;
      this.mergeStored();
      this.snapshotAll();
      this.render();
    });
  }

  readStoredQueue() {
    try {
      const stored = JSON.parse(localStorage.getItem('scan_queue') || '[]');
      return Array.isArray(stored) ? stored : [];
    } catch (e) {
      console.error("Failed to read localStorage:", e);
      return [];
    }
  }

  serialize(item) {
    const { updatedAt: _updatedAt, ...rest } = item;
    return JSON.stringify(rest);
  }

  snapshotAll() {
    this.snapshots = new Map(this.queue.map(item => [item.id, this.serialize(item)]));
  }

  isDirty(item) {
    return this.snapshots.get(item.id) !== this.serialize(item);
  }

  // Merges other tabs' writes into this.queue in place, so references held by
  // in-flight work (e.g. the item being sent) stay valid. Local edits win.
  mergeStored() {
    const stored = this.readStoredQueue();
    const storedIds = new Set(stored.map(item => item.id));
    const localById = new Map(this.queue.map(item => [item.id, item]));
    // Removed by another tab (e.g. dismissed or trimmed) and untouched here.
    this.queue = this.queue.filter(item =>
      !(this.lastStoredIds.has(item.id) && !storedIds.has(item.id) && !this.isDirty(item)));
    for (const storedItem of stored) {
      if (this.removedIds.has(storedItem.id)) continue;
      const local = localById.get(storedItem.id);
      if (!local) {
        this.queue.push(storedItem);
      } else if ((storedItem.updatedAt || 0) > (local.updatedAt || 0) && !this.isDirty(local)) {
        Object.assign(local, storedItem);
      }
    }
    this.queue.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    this.lastStoredIds = storedIds;
  }

  save() {
    const now = Date.now();
    this.queue.forEach(item => { if (this.isDirty(item)) item.updatedAt = now; });
    const currentIds = new Set(this.queue.map(item => item.id));
    this.snapshots.forEach((_, id) => { if (!currentIds.has(id)) this.removedIds.add(id); });

    this.mergeStored();
    this.clearOldHistory(); // Slice first
    const keptIds = new Set(this.queue.map(item => item.id));
    currentIds.forEach(id => { if (!keptIds.has(id)) this.removedIds.add(id); });
    try {
      localStorage.setItem('scan_queue', JSON.stringify(this.queue));
      this.lastStoredIds = keptIds;
    } catch (e) {
      console.error("Failed to write localStorage:", e);
    }
    this.snapshotAll();
    this.render();
  }

  // An item stays 'processing' only while some tab is sending it. One older
  // than a request timeout was abandoned (tab closed or reloaded mid-request);
  // it may already be in the Sheet, so a later "duplicate" means "recorded".
  healStaleProcessing() {
    const staleBefore = Date.now() - QUEUE_REQUEST_TIMEOUT_MS - 5000;
    let healed = false;
    this.queue.forEach(item => {
      if (item.status === 'processing' && !(item.processingStartedAt > staleBefore)) {
        item.status = 'pending';
        item.mayHaveReachedServer = true;
        delete item.processingStartedAt;
        healed = true;
      }
    });
    if (healed) this.save();
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
    this.removedIds.delete(item.id);
    this.queue.splice(Math.min(index, this.queue.length), 0, item);
    this.save();
    return true;
  }

  add(studentId, week) {
    const timestamp = Date.now();

    let lastScan = null;
    try {
      lastScan = JSON.parse(localStorage.getItem(LAST_QR_SCAN_KEY) || 'null');
    } catch {
      localStorage.removeItem(LAST_QR_SCAN_KEY);
    }
    if (lastScan?.studentId === studentId && lastScan.week === week && lastScan.expiresAt > timestamp) {
      return false;
    }
    const alreadyQueued = this.queue.some(item =>
      item.studentId === studentId && item.week === week &&
      (item.status === 'pending' || item.status === 'processing'));
    if (alreadyQueued) return false;

    const expiresAt = timestamp + SCAN_REPEAT_WINDOW_MS;
    localStorage.setItem(LAST_QR_SCAN_KEY, JSON.stringify({ studentId, week, expiresAt }));
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
    this.save();
    
    // Trigger immediate sequential processing loop
    this.process();
    return true;
  }

  scheduleProcess(delayMs) {
    clearTimeout(this.retryTimer);
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      this.process();
    }, Math.max(0, delayMs));
  }

  // Called when connectivity returns: retry everything now.
  resumeNow() {
    this.queue.forEach(item => { if (item.status === 'pending') delete item.nextAttemptAt; });
    this.scheduleProcess(0);
  }

  retryDelay(item) {
    const step = Math.min(Math.max((item.attempts || 1) - 1, 0), QUEUE_RETRY_DELAYS_MS.length - 1);
    return QUEUE_RETRY_DELAYS_MS[step];
  }

  deferItem(item, message, { mayHaveReachedServer = true } = {}) {
    const delayMs = this.retryDelay(item);
    item.status = 'pending';
    delete item.processingStartedAt;
    item.errorMsg = message;
    item.nextAttemptAt = Date.now() + delayMs;
    if (mayHaveReachedServer) item.mayHaveReachedServer = true;
    this.save();
    return delayMs;
  }

  failItem(item, message) {
    item.status = 'error';
    delete item.processingStartedAt;
    item.errorMsg = message;
    delete item.nextAttemptAt;
    showToast(message, 'error', { badge: `Gagal · Topik ${item.week}` });
    const container = document.getElementById('app-container');
    if (container && container.classList.contains('state-scanning')) {
      triggerVisualFlash('error');
      if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
    }
  }

  notifyOffline() {
    if (this.offlineNotified) return;
    this.offlineNotified = true;
    showToast('Koneksi terputus. Pindaian disimpan dan dikirim otomatis.', 'info', { duration: 5000 });
  }

  imageFor(item, data) {
    const localMatch = this.queue.find(other => other.studentId === item.studentId && other.image);
    return data.image || (localMatch ? localMatch.image : '');
  }

  // Only one tab sends at a time (Web Locks); the others pick up its results
  // through the storage event and retry shortly in case it stops.
  async process() {
    if (this.isProcessing) return;
    if (!navigator.locks?.request) return this.processNext();
    return navigator.locks.request('scan-queue-sender', { ifAvailable: true }, async (lock) => {
      if (!lock) {
        this.scheduleProcess(1500);
        return;
      }
      await this.processNext();
    });
  }

  async processNext() {
    if (this.isProcessing) return;

    if (!window.hasActiveSession?.()) {
      // Logged out: keep items pending until the next login calls process().
      this.updateBanner();
      return;
    }

    this.mergeStored();
    this.snapshotAll();
    this.healStaleProcessing();
    const now = Date.now();
    const pendingItems = this.queue.filter(item => item.status === 'pending');
    // Oldest first, skipping items that are backing off.
    const pendingItem = [...pendingItems].reverse().find(item => !(item.nextAttemptAt > now));
    if (!pendingItem) {
      // Nothing to send now. Wake up when a backed-off item is due, or when a
      // 'processing' item left by a reloaded/closed tab becomes stale enough
      // for healStaleProcessing() to recover it.
      const wakeTimes = [
        ...pendingItems.map(item => item.nextAttemptAt),
        ...this.queue.filter(item => item.status === 'processing')
          .map(item => (item.processingStartedAt || 0) + QUEUE_REQUEST_TIMEOUT_MS + 5000 + 50),
      ].filter(Number.isFinite);
      if (wakeTimes.length) this.scheduleProcess(Math.min(...wakeTimes) - now);
      this.updateBanner();
      return;
    }

    this.isProcessing = true;
    pendingItem.status = 'processing';
    pendingItem.processingStartedAt = Date.now();
    pendingItem.attempts = (pendingItem.attempts || 0) + 1;
    this.save();

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), QUEUE_REQUEST_TIMEOUT_MS);
    let response;
    let data;
    try {
      response = await fetch("/api/absensi", {
        method: "POST",
        // The HttpOnly session cookie authenticates this same-origin request.
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId: pendingItem.studentId, week: pendingItem.week }),
        signal: controller.signal,
      });
      data = await response.json().catch(() => null);
    } catch (error) {
      // Offline, DNS failure, or timeout: connectivity is shared, so the whole queue waits.
      console.error("Queue sync network error:", error);
      clearTimeout(timeout);
      this.isProcessing = false;
      const delayMs = this.deferItem(pendingItem, 'Menunggu koneksi');
      this.notifyOffline();
      this.scheduleProcess(delayMs);
      return;
    }
    clearTimeout(timeout);
    this.isProcessing = false;
    this.offlineNotified = false;

    if (response.status === 401) {
      pendingItem.status = 'pending';
      delete pendingItem.processingStartedAt;
      this.save();
      window.expireSession?.();
      if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
      triggerVisualFlash('error');
      if (typeof setAppState === 'function') setAppState(0);
      return; // Resumes from handleLogin.
    }

    const serverFailed = response.status >= 500 || response.status === 429 || (response.ok && !data);
    if (serverFailed) {
      if (pendingItem.attempts >= QUEUE_MAX_SERVER_ATTEMPTS) {
        this.failItem(pendingItem, 'Server tidak merespons. Silakan pindai ulang.');
        this.save();
      } else {
        // A busy answer means nothing was written; anything else may have been.
        this.deferItem(pendingItem, 'Menunggu server', { mayHaveReachedServer: data?.status !== 'busy' });
      }
      this.scheduleProcess(300); // Other items continue while this one backs off.
      return;
    }

    if (!response.ok) {
      this.failItem(pendingItem, data?.message || 'Gagal sinkronisasi');
    } else if (data.status === "ok" || (data.status === "duplicate" && pendingItem.mayHaveReachedServer)) {
      // A "duplicate" for an item whose earlier attempt may have been written
      // is this scan's own record, not a second scan.
      pendingItem.status = 'success';
      delete pendingItem.processingStartedAt;
      pendingItem.name = data.name;
      pendingItem.image = this.imageFor(pendingItem, data);
      pendingItem.errorMsg = '';

      showToast(data.name || 'Katekumen', 'success', {
        badge: `Hadir · Topik ${pendingItem.week}`
      });

      const container = document.getElementById('app-container');
      if (container && container.classList.contains('state-scanning')) {
        triggerVisualFlash('success');
      }
      if (navigator.vibrate) navigator.vibrate(200);
    } else if (data.status === "duplicate") {
      pendingItem.status = 'duplicate';
      delete pendingItem.processingStartedAt;
      pendingItem.name = data.name || 'Presensi Sudah Tercatat';
      pendingItem.image = this.imageFor(pendingItem, data);
      pendingItem.errorMsg = '';

      showToast(data.name || 'Katekumen', 'duplicate', {
        badge: `Duplikat · Topik ${pendingItem.week}`
      });

      const container = document.getElementById('app-container');
      if (container && container.classList.contains('state-scanning')) {
        triggerVisualFlash('duplicate');
      }
      if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
    } else {
      this.failItem(pendingItem, data.message || 'Gagal sinkronisasi');
    }

    this.save();
    this.scheduleProcess(300);
  }

  updateBanner() {
    const pendingCount = this.queue.filter(item => item.status === 'pending' || item.status === 'processing').length;
    const progressBar = document.querySelector('.segmented-progress-bar');
    
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
            <re-icon icon="scanner" decorative></re-icon>
          </span>
          <strong>Belum ada riwayat pemindaian</strong>
          <span>Pemindaian terbaru akan tampil di sini.</span>
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
        row.blur();
        showStudentModal(item);
      };
      row.onkeydown = (event) => {
        if (event.key === ' ' || event.key === 'Enter') {
          event.preventDefault();
          showStudentModal(item, row);
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
    openTopicSelector();
    return;
  }

  let originalStudentId;
  try {
    originalStudentId = safeAtob(decodedText).trim();
  } catch {
    originalStudentId = null;
  }
  if (!originalStudentId || !STUDENT_ID_PATTERN.test(originalStudentId)) {
    // The decoder fires ~30 times a second while a bad code is in view.
    const now = Date.now();
    if (now - lastInvalidQrFeedbackAt < INVALID_QR_FEEDBACK_MS) return;
    lastInvalidQrFeedbackAt = now;
    if (navigator.vibrate) navigator.vibrate([100, 50]);
    triggerVisualFlash('error');
    showToast('QR tidak valid. Gunakan kartu QR katekumen.', 'error');
    return;
  }

  // Add scan to queue instantly and keep camera running!
  if (!scanQueue.add(originalStudentId, selectedWeek)) return;
  dimViewfinder();
  if (navigator.vibrate) navigator.vibrate(80);
}

async function startScanner() {
  // A stop still in flight (e.g. tab hidden during startup) would shut down a
  // camera started now; wait for it, then start only if scanning is still wanted.
  if (scannerStopPromise) {
    await scannerStopPromise;
    if (!shouldScannerRun()) return;
  }
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

  const loader = document.getElementById("camera-loader");
  if (loader) {
    loader.innerHTML = CAMERA_LOADER_HTML;
    loader.style.display = "flex";
  }

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
  }).catch(err => {
    scannerStartPromise = null;
    console.error("Camera start failed:", err);
    html5QrcodeScanner = null; // Reset reference so retry can be attempted
    const loader = document.getElementById("camera-loader");
    if (loader) {
      const denied = /NotAllowed|Permission/i.test(String(err?.name || err));
      const message = denied
        ? 'Izin kamera ditolak.<br>Izinkan akses kamera di pengaturan browser.'
        : 'Kamera tidak tersedia<br>atau sedang dipakai aplikasi lain.';
      loader.innerHTML = `<div class="camera-error" role="alert" style="color:var(--status-duplicate-text); text-align:center; padding:10px;">${message}<br><button type="button" class="camera-retry-btn" style="margin-top:12px; min-height:44px; padding:0 18px; border-radius:999px; border:1px solid currentColor; background:transparent; color:inherit; font:inherit; cursor:pointer;">Coba lagi</button></div>`;
      loader.querySelector('.camera-retry-btn')?.addEventListener('click', () => startScanner());
    }
  });
}

// Release the camera while the tab is hidden; resume when it returns to the scan view.
function shouldScannerRun() {
  const container = document.getElementById('app-container');
  return document.visibilityState === 'visible'
    && !!selectedWeek
    && !!container?.classList.contains('state-scanning')
    && (document.body.dataset.activeView || 'scan') === 'scan';
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    stopScanner();
  } else if (shouldScannerRun()) {
    startScanner();
  }
});

async function stopScanner() {
  if (scannerStopPromise) return scannerStopPromise;
  if (!html5QrcodeScanner) return;
  const stopping = stopScannerNow();
  scannerStopPromise = stopping;
  try {
    await stopping;
  } finally {
    if (scannerStopPromise === stopping) scannerStopPromise = null;
  }
}

async function stopScannerNow() {
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
      getOptionLabelParts: item => [`${item.week}.`, item.name],
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
  scanQueue.render();
  scanQueue.process(); // Process any leftover queue from last load
}

// Initial triggers
window.onload = async () => {
  initTheme();
  loadVersion();
  
  // Connectivity returned: retry queued scans immediately.
  window.addEventListener('online', () => {
    scanQueue.resumeNow();
  });

  if (window.hasActiveSession?.()) {
    initializeApp();
    restoreSavedTopic();

    await window.navigateToAppView(viewFromPath(), { historyMode: 'replace', focus: false });
  } else {
    if (window.sessionExpiresAt?.()) window.expireSession?.();
    await setAppState(0); // Authentication screen
  }
}

// Back/forward cache can restore a page after logout or expiry; re-check it.
window.addEventListener('pageshow', (event) => {
  if (!event.persisted) return;
  if (!window.hasActiveSession?.()) {
    if (window.sessionExpiresAt?.()) window.expireSession?.();
    setAppState(0);
  } else if (shouldScannerRun()) {
    startScanner();
  }
});

let studentModalReturnFocus = null;
let studentModalCloseTimer = null;
const STUDENT_DRAWER_CLOSE_MS = 280;
const STUDENT_DRAWER_DISMISS_DISTANCE = 96;
const STUDENT_DRAWER_DISMISS_VELOCITY = 0.5;

window.showStudentModal = function(item, trigger) {
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

  if (!modal.open) {
    studentModalReturnFocus = trigger || null;
    clearTimeout(studentModalCloseTimer);
    modal.classList.remove('is-open', 'is-closing', 'is-dragging');
    modal.querySelector('.student-modal-content')?.style.removeProperty('--drawer-offset');
    modal.showModal();
    modal.getBoundingClientRect();
    requestAnimationFrame(() => {
      if (!modal.open) return;
      modal.classList.add('is-open');
      modal.focus({ preventScroll: true });
    });
  }
};

window.closeStudentModal = function(event) {
  const modal = document.getElementById('student-detail-modal');
  if (event) event.stopPropagation();
  if (!modal?.open || modal.classList.contains('is-closing')) return;

  clearTimeout(studentModalCloseTimer);
  modal.classList.remove('is-open', 'is-dragging');
  modal.classList.add('is-closing');
  modal.querySelector('.student-modal-content')?.style.removeProperty('--drawer-offset');

  const finishClose = () => {
    if (!modal.open) return;
    modal.close();
    modal.classList.remove('is-closing');
    studentModalReturnFocus?.isConnected && studentModalReturnFocus.focus({ preventScroll: true });
    studentModalReturnFocus = null;
  };
  const delay = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : STUDENT_DRAWER_CLOSE_MS;
  studentModalCloseTimer = setTimeout(finishClose, delay);
};

function bindStudentDrawer() {
  const modal = document.getElementById('student-detail-modal');
  const sheet = modal?.querySelector('.student-modal-content');
  const handle = modal?.querySelector('[data-drawer-handle]');
  if (!modal || !sheet || !handle) return;

  let pointerId = null;
  let startY = 0;
  let startTime = 0;
  let distance = 0;

  const snapBack = () => {
    pointerId = null;
    modal.classList.remove('is-dragging');
    sheet.style.removeProperty('--drawer-offset');
  };

  handle.addEventListener('pointerdown', event => {
    if (event.button !== 0 || !modal.open) return;
    pointerId = event.pointerId;
    startY = event.clientY;
    startTime = performance.now();
    distance = 0;
    modal.classList.add('is-dragging');
    handle.setPointerCapture(pointerId);
  });

  handle.addEventListener('pointermove', event => {
    if (event.pointerId !== pointerId) return;
    distance = Math.max(0, event.clientY - startY);
    sheet.style.setProperty('--drawer-offset', `${distance}px`);
  });

  handle.addEventListener('pointerup', event => {
    if (event.pointerId !== pointerId) return;
    const velocity = distance / Math.max(performance.now() - startTime, 1);
    pointerId = null;
    if (distance >= STUDENT_DRAWER_DISMISS_DISTANCE || (distance >= 24 && velocity >= STUDENT_DRAWER_DISMISS_VELOCITY)) {
      window.closeStudentModal(event);
    } else {
      snapBack();
    }
  });
  handle.addEventListener('pointercancel', snapBack);

  modal.addEventListener('click', event => {
    if (event.target === modal) window.closeStudentModal(event);
  });
  modal.addEventListener('cancel', event => {
    event.preventDefault();
    window.closeStudentModal(event);
  });
}

bindStudentDrawer();

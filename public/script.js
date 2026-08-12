window.selectedWeek = null;
let topicComboboxLarge = null;
let topicComboboxActive = null;

// Note: handleLogout, updateActivity, and checkTopicExpiry are now centralized in session.js

// --- STATE MANAGEMENT ---
// State 0: Auth, State 1: Selection, State 2: Scanning
window.setAppState = async function(state) {
  const container = document.getElementById('app-container');
  container.className = 'glass-container';
  const nav = document.getElementById('app-nav');
  
  if (state === 0) {
    container.classList.add('state-auth');
    await window.stopScanner();
    if (nav) nav.style.display = 'none';
    setViewVisibility('scan');
    document.body.dataset.activeView = 'scan';
    updateActiveNavigation('scan');
    if (window.location.pathname !== '/') history.replaceState({ view: 'scan' }, '', '/');
  } else if (state === 1) {
    container.classList.add('state-selection');
    await window.stopScanner();
    if (nav) nav.style.display = 'flex';
  } else if (state === 2) {
    container.classList.add('state-scanning');
    if (nav) nav.style.display = 'flex';
    
    if (!window.selectedWeek) {
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

    if (window.selectedWeek) {
      window.startScanner();
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
    await window.stopScanner();
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
  window.selectedWeek = week;
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
          document.cookie = `auth_token=${data.token}; path=/; max-age=3600; SameSite=Lax`;
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
  window.renderScanHistory(window.scanQueue.queue);
  window.scanQueue.process(); // Process any leftover queue from last load
}

// Initial triggers
window.onload = async () => {
  initTheme();
  loadVersion();
  
  // Connect background queue trigger for online state detection
  window.addEventListener('online', () => {
    window.scanQueue.process();
  });

  const cookieToken = getCookie('auth_token');
  const sessionToken = sessionStorage.getItem('authToken') || cookieToken;
  if (sessionToken && !window.isSessionTokenExpired?.(sessionToken)) {
    sessionStorage.setItem('authToken', sessionToken);
    // Sync the auth_token cookie with the sessionStorage token
    document.cookie = `auth_token=${sessionToken}; path=/; max-age=3600; SameSite=Lax`;
    
    initializeApp();
    const savedWeek = localStorage.getItem('selectedWeek');
    const savedTopicName = localStorage.getItem('selectedTopicName');
    if (savedWeek && savedTopicName) {
      window.selectedWeek = savedWeek;
      topicComboboxLarge?.setValue(savedWeek);
      topicComboboxActive?.setValue(savedWeek);
    }
    
    await window.navigateToAppView(viewFromPath(), { historyMode: 'replace', focus: false });
  } else {
    if (sessionToken) window.expireSession?.();
    await setAppState(0); // Authentication screen
  }
}

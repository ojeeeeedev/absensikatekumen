// Centralized Session & Activity Management
(function() {
  // Session states (client):
  //   anonymous  - no unexpired SESSION_EXPIRES_KEY in localStorage
  //   authed     - SESSION_EXPIRES_KEY is in the future
  //   expired    - expireSession() ran (401 or expiry); the login screen shows
  //   logged out - handleLogout(); the server clears the cookie
  //
  // The JWT lives only in the HttpOnly `auth_token` cookie set by POST
  // /api/absensi {action:'login'}; scripts cannot read it, so an XSS bug cannot
  // steal the session. Same-origin requests send the cookie automatically.
  // The client keeps only the non-secret expiry time, shared by all tabs just
  // like the cookie is, so a logout or expiry in one tab applies to every tab.
  const SESSION_EXPIRES_KEY = 'sessionExpiresAt'; // epoch seconds

  function tokenExpiry(token) {
    try {
      const encodedPayload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      const payload = JSON.parse(atob(encodedPayload.padEnd(Math.ceil(encodedPayload.length / 4) * 4, '=')));
      return Number.isFinite(payload.exp) ? payload.exp : null;
    } catch {
      return null;
    }
  }

  function isSessionTokenExpired(token) {
    const exp = tokenExpiry(token);
    return exp === null || exp <= Date.now() / 1000;
  }

  function readStorage(storage, key) {
    try { return storage.getItem(key); } catch { return null; }
  }

  function sessionExpiresAt() {
    const value = Number(readStorage(localStorage, SESSION_EXPIRES_KEY));
    return Number.isFinite(value) && value > 0 ? value : null;
  }

  function hasActiveSession() {
    const expiresAt = sessionExpiresAt();
    return expiresAt !== null && expiresAt > Date.now() / 1000;
  }

  function beginSession(expiresAt) {
    const value = Number(expiresAt);
    if (!Number.isFinite(value) || value <= Date.now() / 1000) return false;
    try { localStorage.setItem(SESSION_EXPIRES_KEY, String(Math.floor(value))); } catch { return false; }
    return true;
  }

  function clearLegacyToken() {
    try { sessionStorage.removeItem('authToken'); } catch { /* storage unavailable */ }
    // Script-written cookie from older releases; the HttpOnly one is cleared by the server.
    document.cookie = 'auth_token=; path=/; max-age=0; SameSite=Lax';
  }

  // Sessions started by releases that kept the token in sessionStorage or a
  // script-readable cookie keep working until they expire.
  function adoptLegacySession() {
    if (hasActiveSession()) return;
    const legacyCookie = document.cookie.split('; ').find(value => value.startsWith('auth_token='))?.split('=')[1];
    const legacyToken = readStorage(sessionStorage, 'authToken') || (legacyCookie ? decodeURIComponent(legacyCookie) : null);
    if (legacyToken && !isSessionTokenExpired(legacyToken)) beginSession(tokenExpiry(legacyToken));
    try { sessionStorage.removeItem('authToken'); } catch { /* storage unavailable */ }
  }

  adoptLegacySession();

  window.isSessionTokenExpired = isSessionTokenExpired;
  window.hasActiveSession = hasActiveSession;
  window.beginSession = beginSession;
  window.sessionExpiresAt = sessionExpiresAt;

  window.expireSession = function() {
    window.clearProfileStudentCache?.();
    clearLegacyToken();
    try {
      localStorage.removeItem(SESSION_EXPIRES_KEY);
      localStorage.setItem('logoutTimestamp', Date.now().toString());
    } catch { /* storage unavailable */ }
    const errorBox = document.getElementById('login-error-box');
    if (errorBox) {
      errorBox.textContent = 'Sesi Habis. Silakan login kembali.';
      errorBox.style.display = 'block';
    }
  };

  // Expose handleLogout globally
  window.handleLogout = async function(e) {
    if (e) e.preventDefault();
    window.expireSession();
    // Clears the HttpOnly cookie and the browser's cached student photos.
    try {
      await fetch('/api/absensi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'logout' }),
        keepalive: true,
        signal: AbortSignal.timeout?.(3000),
      });
    } catch { /* offline: the cookie still expires on its own */ }
    window.location.href = '/';
  };

  // The session is shared by all tabs: when another tab logs out or expires,
  // this tab returns to the login screen too.
  window.addEventListener('storage', (event) => {
    if (event.key !== SESSION_EXPIRES_KEY && event.key !== null) return;
    if (hasActiveSession()) return;
    const container = document.getElementById('app-container');
    if (container && !container.classList.contains('state-auth')) window.setAppState?.(0);
  });

  // Throttled active state update
  let lastActivityUpdate = 0;
  function updateActivity() {
    const now = Date.now();
    if (now - lastActivityUpdate > 30000) { // throttle to 30s
      lastActivityUpdate = now;
      if (hasActiveSession()) {
        localStorage.setItem('lastActiveTimestamp', now.toString());
      }
    }
  }

  // Attach listener for common interactions to track activity
  window.addEventListener('click', updateActivity);
  window.addEventListener('keydown', updateActivity);
  window.addEventListener('touchstart', updateActivity);

  function checkTopicExpiry() {
    const loggedIn = hasActiveSession();
    const now = Date.now();
    const tenMinutes = 10 * 60 * 1000;

    if (loggedIn) {
      const logoutTime = localStorage.getItem('logoutTimestamp');
      if (logoutTime) {
        if (now - parseInt(logoutTime) > tenMinutes) {
          localStorage.removeItem('selectedWeek');
          localStorage.removeItem('selectedTopicName');
        }
        localStorage.removeItem('logoutTimestamp');
      }
      localStorage.setItem('lastActiveTimestamp', now.toString());
    } else {
      const lastActive = localStorage.getItem('lastActiveTimestamp');
      if (lastActive) {
        if (now - parseInt(lastActive) > tenMinutes) {
          localStorage.removeItem('selectedWeek');
          localStorage.removeItem('selectedTopicName');
        }
        localStorage.removeItem('lastActiveTimestamp');
      }
    }
  }

  // Run check on initialization
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkTopicExpiry);
  } else {
    checkTopicExpiry();
  }

  window.checkTopicExpiry = checkTopicExpiry;
  window.updateActivity = updateActivity;
})();

// Centralized Session & Activity Management
(function() {
  // Expose handleLogout globally
  window.handleLogout = function(e) {
    if (e) e.preventDefault();
    document.cookie = 'auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax';
    sessionStorage.removeItem('authToken');
    localStorage.setItem('logoutTimestamp', Date.now().toString());
    window.location.href = '/';
  };

  // Throttled active state update
  let lastActivityUpdate = 0;
  function updateActivity() {
    const now = Date.now();
    if (now - lastActivityUpdate > 30000) { // throttle to 30s
      lastActivityUpdate = now;
      if (sessionStorage.getItem('authToken')) {
        localStorage.setItem('lastActiveTimestamp', now.toString());
      }
    }
  }

  // Attach listener for common interactions to track activity
  window.addEventListener('click', updateActivity);
  window.addEventListener('keydown', updateActivity);
  window.addEventListener('touchstart', updateActivity);

  function checkTopicExpiry() {
    const loggedIn = !!sessionStorage.getItem('authToken');
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

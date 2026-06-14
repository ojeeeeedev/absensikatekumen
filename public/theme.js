function initTheme() {
  const savedTheme = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateLogos(savedTheme);
}

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
  const newTheme = currentTheme === 'light' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('theme', newTheme);
  updateLogos(newTheme);
}

window.toggleTheme = toggleTheme;

function updateLogos(theme) {
  const logos = document.querySelectorAll('.theme-logo');
  logos.forEach(logo => {
    if (theme === 'light') {
      logo.src = 'assets/pewartaan_normal.png';
    } else {
      logo.src = 'assets/pewartaan_invert.png';
    }
  });
}

function getCookie(name) {
  const value = '; ' + document.cookie;
  const parts = value.split('; ' + name + '=');
  if (parts.length === 2) return parts.pop().split(';').shift();
  return null;
}

window.getCookie = getCookie;

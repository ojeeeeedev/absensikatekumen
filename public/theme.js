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
  const logoSrc = theme === 'dark' ? 'assets/pewartaan_invert.png' : 'assets/pewartaan_normal.png';
  window.__themeLogoSrc = logoSrc;
  logos.forEach(logo => {
    logo.src = logoSrc;
  });
}

function getCookie(name) {
  const value = '; ' + document.cookie;
  const parts = value.split('; ' + name + '=');
  if (parts.length === 2) return parts.pop().split(';').shift();
  return null;
}

window.getCookie = getCookie;

(() => {
  const savedTheme = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);

  document.addEventListener('DOMContentLoaded', () => {
    const logoSrc = savedTheme === 'dark' ? 'assets/pewartaan_invert.png' : 'assets/pewartaan_normal.png';
    document.querySelectorAll('.theme-logo').forEach((logo) => { logo.src = logoSrc; });

    const container = document.getElementById('app-container');
    if (sessionStorage.getItem('authState') === 'authenticated') {
      container.classList.add('state-scanning');
      if (!localStorage.getItem('selectedWeek')) container.classList.add('needs-topic');
      document.getElementById('app-nav').style.display = 'flex';
    } else {
      container.classList.add('state-auth');
    }

    const activateOnKeyboard = (element, callback) => element?.addEventListener('keydown', (event) => {
      if (event.key !== ' ' && event.key !== 'Enter') return;
      event.preventDefault();
      callback(event);
    });

    document.getElementById('logout-btn')?.addEventListener('click', window.handleLogout);
    document.querySelectorAll('.theme-logo').forEach((logo) => {
      logo.addEventListener('click', window.toggleTheme);
      activateOnKeyboard(logo, window.toggleTheme);
    });
    const loginError = document.getElementById('login-error-box');
    loginError?.addEventListener('mouseenter', window.hideLoginError);
    const loginInput = document.getElementById('login-input');
    loginInput?.addEventListener('input', window.hideLoginError);
    loginInput?.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') window.handleLogin();
    });
    const passwordToggle = document.getElementById('password-toggle');
    passwordToggle?.addEventListener('click', window.togglePasswordVisibility);
    activateOnKeyboard(passwordToggle, window.togglePasswordVisibility);
    document.getElementById('login-btn')?.addEventListener('click', window.handleLogin);
    document.getElementById('confirm-btn-no')?.addEventListener('click', window.closeDeleteConfirm);
    document.getElementById('confirm-btn-yes')?.addEventListener('click', window.confirmDeleteHistory);
    document.getElementById('carousel-prev-btn')?.addEventListener('click', () => window.scrollCarousel(-1));
    document.getElementById('carousel-next-btn')?.addEventListener('click', () => window.scrollCarousel(1));

    const modal = document.getElementById('student-detail-modal');
    modal?.addEventListener('click', window.closeStudentModal);
    document.getElementById('student-modal-content')?.addEventListener('click', (event) => event.stopPropagation());
    const closeModal = document.getElementById('student-modal-close');
    closeModal?.addEventListener('click', window.closeStudentModal);
    activateOnKeyboard(closeModal, window.closeStudentModal);
  });
})();

(function() {
  const ONBOARDING_ENABLED = false;

  const checkOnboarding = () => {
    if (!ONBOARDING_ENABLED) return;

    // Check if they already saw onboarding
    if (localStorage.getItem('hasSeenOnboardingV2')) return;

    if (sessionStorage.getItem('authState') !== 'authenticated') return;

    const appendModal = () => {
      if (document.getElementById('onboarding-modal')) return;
      const modal = document.createElement('div');
      modal.id = 'onboarding-modal';
      modal.className = 'student-modal';
      modal.style.display = 'flex';
      modal.setAttribute('role', 'dialog');
      modal.setAttribute('aria-modal', 'true');
      modal.setAttribute('aria-labelledby', 'onboarding-title');
      
      // Close modal on click outside content
      modal.onclick = (e) => closeOnboardingModal(e);
      
      modal.innerHTML = `
        <div class="modal-content onboarding-modal-content">
          <!-- Small Pewartaan Logo -->
          <img src="assets/pewartaan_normal.png" alt="Logo Pewartaan" class="onboarding-logo" height="48" style="height: 48px; width: auto;">

          <!-- Welcome Header (Inter Font) -->
          <h2 class="onboarding-title" id="onboarding-title">Selamat datang di Sistem Presensi v2</h2>

          <div class="onboarding-scroll-area">
            <!-- Section 1: Fitur Baru yang Memudahkan -->
            <h3 class="onboarding-section-header updates-header">
              <re-icon icon="sparkles" decorative></re-icon>
              Fitur Baru yang Memudahkan
            </h3>
            <div class="updates-list">
              
              <!-- Row 1: Scan QR Berturut-turut -->
              <div class="row-accordion" id="row-scan">
                <button class="row-accordion-header" type="button" aria-expanded="false" aria-controls="row-scan-content">
                  <div class="row-accordion-title">
                    <re-icon icon="bolt" decorative></re-icon>
                    <span>Scan QR Berturut-turut</span>
                  </div>
                  <re-icon icon="chevron-down" class="chevron" decorative></re-icon>
                </button>
                <div class="row-accordion-content" id="row-scan-content">
                  <div class="row-accordion-body">
                    Scan peserta berikutnya langsung tanpa jeda. Data otomatis dikirim di latar belakang.
                  </div>
                </div>
              </div>

              <!-- Row 2: Simpan Offline Otomatis -->
              <div class="row-accordion" id="row-offline">
                <button class="row-accordion-header" type="button" aria-expanded="false" aria-controls="row-offline-content">
                  <div class="row-accordion-title">
                    <re-icon icon="wifi-off" decorative></re-icon>
                    <span>Simpan Offline Otomatis</span>
                  </div>
                  <re-icon icon="chevron-down" class="chevron" decorative></re-icon>
                </button>
                <div class="row-accordion-content" id="row-offline-content">
                  <div class="row-accordion-body">
                    Scan tetap jalan walau internet lambat/putus. Data aman dan terkirim otomatis saat online.
                  </div>
                </div>
              </div>

              <!-- Row 3: Daftar & Profil Katekumen -->
              <div class="row-accordion" id="row-profile">
                <button class="row-accordion-header" type="button" aria-expanded="false" aria-controls="row-profile-content">
                  <div class="row-accordion-title">
                    <re-icon icon="user-id" decorative></re-icon>
                    <span>Daftar & Profil Katekumen</span>
                  </div>
                  <re-icon icon="chevron-down" class="chevron" decorative></re-icon>
                </button>
                <div class="row-accordion-content" id="row-profile-content">
                  <div class="row-accordion-body">
                    Halaman khusus untuk melihat daftar seluruh peserta kelas, katekis, kelompok KI, dan foto mereka.
                  </div>
                </div>
              </div>

              <!-- Row 4: Tampilan Informasi Rapi -->
              <div class="row-accordion" id="row-detail">
                <button class="row-accordion-header" type="button" aria-expanded="false" aria-controls="row-detail-content">
                  <div class="row-accordion-title">
                    <re-icon icon="layers" decorative></re-icon>
                    <span>Tampilan Informasi Rapi</span>
                  </div>
                  <re-icon icon="chevron-down" class="chevron" decorative></re-icon>
                </button>
                <div class="row-accordion-content" id="row-detail-content">
                  <div class="row-accordion-body">
                    Detail data katekumen kini langsung muncul di bagian bawah layar secara instan.
                  </div>
                </div>
              </div>

            </div>

            <!-- Section 2: Penyederhanaan Sistem -->
            <h3 class="onboarding-section-header removals-header">
              <re-icon icon="refresh" decorative></re-icon>
              Penyederhanaan Sistem
            </h3>
            <div class="removals-list">
              
              <!-- Row 5: Buka Scanner Lebih Cepat -->
              <div class="row-accordion" id="row-speed">
                <button class="row-accordion-header" type="button" aria-expanded="false" aria-controls="row-speed-content">
                  <div class="row-accordion-title">
                    <re-icon icon="speedometer" decorative></re-icon>
                    <span>Buka Scanner Lebih Cepat</span>
                  </div>
                  <re-icon icon="chevron-down" class="chevron" decorative></re-icon>
                </button>
                <div class="row-accordion-content" id="row-speed-content">
                  <div class="row-accordion-body">
                    Topik pertemuan terakhir otomatis disimpan. Tidak perlu memilih ulang setiap membuka web.
                  </div>
                </div>
              </div>

              <!-- Row 6: Navigasi Menu Simpel -->
              <div class="row-accordion" id="row-nav">
                <button class="row-accordion-header" type="button" aria-expanded="false" aria-controls="row-nav-content">
                  <div class="row-accordion-title">
                    <re-icon icon="streets-nav" decorative></re-icon>
                    <span>Navigasi Menu Simpel</span>
                  </div>
                  <re-icon icon="chevron-down" class="chevron" decorative></re-icon>
                </button>
                <div class="row-accordion-content" id="row-nav-content">
                  <div class="row-accordion-body">
                    Menu bawah layar baru memudahkan ganti halaman secara instan tanpa tombol ribet.
                  </div>
                </div>
              </div>

            </div>
          </div>
          <button class="onboarding-btn" id="onboarding-dismiss-btn">Mulai Gunakan</button>
        </div>
      `;
      document.body.appendChild(modal);

      // Stop propagation programmatically
      const content = modal.querySelector('.onboarding-modal-content');
      if (content) {
        content.onclick = (e) => e.stopPropagation();
      }

      // Bind row click handlers programmatically
      const rows = modal.querySelectorAll('.row-accordion');
      rows.forEach(row => {
        const header = row.querySelector('.row-accordion-header');
        if (header) {
          header.onclick = () => toggleOnboardingRow(row.id);
        }
      });

      // Bind dismiss button
      const dismissBtn = document.getElementById('onboarding-dismiss-btn');
      if (dismissBtn) {
        dismissBtn.onclick = () => closeOnboardingModal(null);
      }

      // Register escape key handler
      window.addEventListener('keydown', handleEscapeKey);
    };

    // Dynamically inject stylesheet if not already loaded, wait for it to load to prevent unstyled logo flash
    if (!document.getElementById('onboarding-style')) {
      const link = document.createElement('link');
      link.id = 'onboarding-style';
      link.rel = 'stylesheet';
      link.href = 'onboarding.css';
      link.onload = appendModal;
      link.onerror = appendModal; // Fallback in case loading fails
      document.head.appendChild(link);
    } else {
      appendModal();
    }
  };

  const toggleOnboardingRow = (id) => {
    const el = document.getElementById(id);
    if (!el) return;
    
    const isOpen = el.classList.contains('open');
    
    // Close all other rows
    const container = document.querySelector('.onboarding-scroll-area');
    if (container) {
      const all = container.querySelectorAll('.row-accordion');
      all.forEach(acc => {
        acc.classList.remove('open');
        const button = acc.querySelector('.row-accordion-header');
        if (button) button.setAttribute('aria-expanded', 'false');
      });
    }
    
    // Toggle selected row
    if (!isOpen) {
      el.classList.add('open');
      const button = el.querySelector('.row-accordion-header');
      if (button) button.setAttribute('aria-expanded', 'true');
    }
  };

  const handleEscapeKey = (e) => {
    if (e.key === 'Escape') {
      closeOnboardingModal(null);
    }
  };

  const closeOnboardingModal = (event) => {
    if (event && event.stopPropagation) {
      event.stopPropagation();
    }
    const modal = document.getElementById('onboarding-modal');
    if (modal) {
      modal.remove();
      localStorage.setItem('hasSeenOnboardingV2', 'true');
    }
    window.removeEventListener('keydown', handleEscapeKey);
  };

  // Expose check function globally
  window.checkOnboarding = checkOnboarding;

  // Run on load if token already exists
  window.addEventListener('DOMContentLoaded', () => {
    setTimeout(checkOnboarding, 600);
  });
})();

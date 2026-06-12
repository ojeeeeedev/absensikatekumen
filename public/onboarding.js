(function() {
  // Check if they already saw onboarding
  if (localStorage.getItem('hasSeenOnboardingV2')) return;

  const checkOnboarding = () => {
    const sessionToken = sessionStorage.getItem('authToken');
    if (!sessionToken) return;

    // Dynamically inject stylesheet if not already loaded
    if (!document.getElementById('onboarding-style')) {
      const link = document.createElement('link');
      link.id = 'onboarding-style';
      link.rel = 'stylesheet';
      link.href = 'onboarding.css';
      document.head.appendChild(link);
    }

    // Dynamically inject onboarding modal HTML
    if (!document.getElementById('onboarding-modal')) {
      const modal = document.createElement('div');
      modal.id = 'onboarding-modal';
      modal.className = 'student-modal';
      modal.style.display = 'flex';
      modal.onclick = (e) => closeOnboardingModal(e);
      
      modal.innerHTML = `
        <div class="modal-content onboarding-modal-content" onclick="event.stopPropagation()">
          <div class="onboarding-header">
            <span class="material-icons-outlined onboarding-welcome-icon" aria-hidden="true">celebration</span>
            <h2 class="onboarding-title">Selamat datang di Sistem Presensi v2</h2>
            <p class="onboarding-subtitle">Panduan singkat pembaruan aplikasi Anda:</p>
          </div>

          <div class="onboarding-scroll-area">
            <div class="onboarding-section">
              <h3 class="onboarding-section-title updates-title">
                <span class="material-icons-outlined" aria-hidden="true">auto_awesome</span>
                Fitur Baru yang Memudahkan
              </h3>
              <div class="onboarding-list">
                <div class="onboarding-item">
                  <span class="material-icons-outlined onboarding-item-icon updates-icon" aria-hidden="true">bolt</span>
                  <div class="onboarding-item-text">
                    <strong>Scan QR Berturut-turut:</strong> Scan peserta berikutnya langsung tanpa jeda. Data otomatis dikirim di latar belakang.
                  </div>
                </div>
                <div class="onboarding-item">
                  <span class="material-icons-outlined onboarding-item-icon updates-icon" aria-hidden="true">wifi_off</span>
                  <div class="onboarding-item-text">
                    <strong>Simpan Offline Otomatis:</strong> Scan tetap jalan walau internet lambat/putus. Data aman dan terkirim otomatis saat online.
                  </div>
                </div>
                <div class="onboarding-item">
                  <span class="material-icons-outlined onboarding-item-icon updates-icon" aria-hidden="true">badge</span>
                  <div class="onboarding-item-text">
                    <strong>Daftar & Profil Katekumen:</strong> Halaman khusus untuk melihat daftar seluruh peserta kelas, katekis, kelompok KI, dan foto mereka.
                  </div>
                </div>
                <div class="onboarding-item">
                  <span class="material-icons-outlined onboarding-item-icon updates-icon" aria-hidden="true">layers</span>
                  <div class="onboarding-item-text">
                    <strong>Tampilan Informasi Rapi:</strong> Detail data katekumen kini langsung muncul di bagian bawah layar secara instan.
                  </div>
                </div>
              </div>
            </div>

            <div class="onboarding-section">
              <h3 class="onboarding-section-title removals-title">
                <span class="material-icons-outlined" aria-hidden="true">published_with_changes</span>
                Penyederhanaan Sistem
              </h3>
              <div class="onboarding-list">
                <div class="onboarding-item">
                  <span class="material-icons-outlined onboarding-item-icon removals-icon" aria-hidden="true">speed</span>
                  <div class="onboarding-item-text">
                    <strong>Buka Scanner Lebih Cepat:</strong> Topik pertemuan terakhir otomatis disimpan. Tidak perlu memilih ulang setiap membuka web.
                  </div>
                </div>
                <div class="onboarding-item">
                  <span class="material-icons-outlined onboarding-item-icon removals-icon" aria-hidden="true">navigation</span>
                  <div class="onboarding-item-text">
                    <strong>Navigasi Menu Simpel:</strong> Menu bawah layar baru memudahkan ganti halaman secara instan tanpa tombol ribet.
                  </div>
                </div>
              </div>
            </div>
          </div>
          <button class="onboarding-btn" id="onboarding-dismiss-btn">Mulai Gunakan</button>
        </div>
      `;
      document.body.appendChild(modal);

      document.getElementById('onboarding-dismiss-btn').onclick = () => closeOnboardingModal(null);
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
  };

  // Expose check function globally
  window.checkOnboarding = checkOnboarding;

  // Run on load if token already exists
  window.addEventListener('DOMContentLoaded', () => {
    setTimeout(checkOnboarding, 600);
  });
})();

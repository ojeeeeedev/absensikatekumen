(function() {
  const token = sessionStorage.getItem('authToken') || (window.getCookie ? window.getCookie('auth_token') : null);
  const classSelector = document.getElementById('dashboard-class-selector');
  const refreshBtn = document.getElementById('dashboard-refresh-btn');
  const loader = document.getElementById('dashboard-loader');
  const emptyState = document.getElementById('dashboard-empty');
  const content = document.getElementById('dashboard-content');
  const alertBox = document.getElementById('dashboard-alert');
  const riskSearchInput = document.getElementById('risk-search-input');
  const selectedClassKey = 'dashboardSelectedClass';
  let currentRiskRows = [];
  const classNames = {};

  const zoneCopy = {
    green: { label: 'Aman', helper: 'Kehadiran di atas 85%', className: 'is-green' },
    yellow: { label: 'Perhatian', helper: 'Perlu perhatian ringan', className: 'is-yellow' },
    red: { label: 'Pengawasan', helper: 'Kehadiran 50-65%', className: 'is-red' },
    black: { label: 'Penindakan', helper: 'Kehadiran di bawah 50%', className: 'is-black' }
  };

  function escapeHTML(value) {
    return String(value === null || value === undefined ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function showAlert(message) {
    if (!alertBox) return;
    alertBox.textContent = message;
    alertBox.hidden = false;
  }

  function hideAlert() {
    if (alertBox) alertBox.hidden = true;
  }

  function setLoading(isLoading) {
    document.body.classList.toggle('dashboard-loading', isLoading);
    if (loader) loader.hidden = !isLoading;
    if (content && isLoading) {
      content.setAttribute('aria-busy', 'true');
      content.hidden = true;
    }
    if (content && !isLoading) content.removeAttribute('aria-busy');
    if (emptyState) emptyState.hidden = isLoading || !!classSelector.value;
    if (refreshBtn) refreshBtn.disabled = isLoading;
  }

  function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  async function loadClasses() {
    if (!token) {
      window.location.href = '/';
      return;
    }

    try {
      const res = await fetch('/api/classes', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error(`Gagal memuat kelas (${res.status})`);
      const data = await res.json();
      if (data.status !== 'ok') throw new Error(data.message || 'Gagal memuat kelas');

      classSelector.innerHTML = '<option value="" disabled selected>Pilih Kelas...</option>';
      data.classes.forEach((item) => {
        const option = document.createElement('option');
        option.value = item.code;
        option.textContent = `Kelompok ${item.name}`;
        classSelector.appendChild(option);
        classNames[item.code] = item.name;
      });

      const requestedClass = new URLSearchParams(window.location.search).get('classCode');
      const savedClass = localStorage.getItem(selectedClassKey);
      const defaultClass = requestedClass || savedClass;
      if (defaultClass && Array.from(classSelector.options).some((option) => option.value === defaultClass.toUpperCase())) {
        classSelector.value = defaultClass.toUpperCase();
        loadDashboard(classSelector.value, { silent: true });
      }
    } catch (err) {
      showAlert(err.message || 'Gagal memuat daftar kelas');
    }
  }

  async function loadDashboard(classCode, options = {}) {
    if (!classCode) return;
    hideAlert();
    setLoading(true);

    try {
      localStorage.setItem(selectedClassKey, classCode);
      updateClassUrl(classCode);
      const res = await fetch(`/api/dashboard-data?classCode=${encodeURIComponent(classCode)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error(`Gagal memuat dashboard (${res.status})`);
      const data = await res.json();
      if (data.status !== 'ok') throw new Error(data.message || 'Gagal memuat dashboard');
      renderDashboard(data);
      if (data.fallback && data.message) showAlert(data.message);
      if (!options.silent) showToast('Dashboard diperbarui', 'success');
    } catch (err) {
      showAlert(err.message || 'Gagal memuat dashboard');
      if (content) content.hidden = true;
    } finally {
      setLoading(false);
    }
  }

  function renderDashboard(data) {
    const metadata = data.metadata || {};
    const summary = data.summary || {};
    const attendance = data.attendance || {};
    const zones = normalizeZones(attendance.zones || []);
    const recentTopics = attendance.topicHistory || attendance.recentTopics || [];
    const lowTopics = attendance.lowAttendanceTopics || attendance.attentionTopics || [];
    const latestTopic = attendance.latestTopic || recentTopics[0] || null;

    setText('meta-kelompok', cohortLabel(metadata.kelompok, data.classCode));
    setText('meta-period', periodLabel(metadata));
    setText('meta-priest', metadata.priest || '-');
    setText('meta-updated', metadata.lastUpdated ? `Terakhir diperbarui ${formatDateLabel(metadata.lastUpdated)}` : 'Belum ada timestamp');

    renderMetricCards(summary, zones, latestTopic);
    renderAttendanceOverview(zones, Number(summary.total || 0));
    renderTopicList('recent-topics', recentTopics, { latest: true });
    renderTopicList('lowest-topics', lowTopics, { compact: true });
    currentRiskRows = attendance.riskParticipants || [];
    renderRiskList(currentRiskRows);
    renderBreakdown('gender-breakdown', summary.gender || []);
    renderBreakdown('religion-breakdown', summary.religion || []);
    renderBreakdown('marital-breakdown', summary.maritalStatus || []);

    if (emptyState) emptyState.hidden = true;
    if (content) content.hidden = false;
  }

  function renderMetricCards(summary, zones, latestTopic) {
    const green = zoneByKey(zones, 'green');
    const yellow = zoneByKey(zones, 'yellow');
    const red = zoneByKey(zones, 'red');
    const black = zoneByKey(zones, 'black');
    const watched = Number(red.count || 0) + Number(black.count || 0);
    const latestRate = latestTopic ? latestTopic.percentage || formatPercent(latestTopic.rate) : '-';
    const cards = [
      metricCard('Total Peserta', Number(summary.total || 0), 'Peserta aktif dalam kelompok ini', 'neutral'),
      metricCard('Zona Hijau', Number(green.count || 0), 'Kehadiran di atas 85%', 'green', green.percentage),
      metricCard('Zona Kuning', Number(yellow.count || 0), 'Perlu perhatian ringan', 'yellow', yellow.percentage),
      metricCard('Dalam Pengawasan', watched, 'Kehadiran di bawah ambang aman', watched ? 'red' : 'green'),
      metricCard('Topik Terbaru', latestRate, latestTopic?.topic || 'Belum ada data', latestTopic ? zoneKeyForRate(latestTopic.rate) : 'neutral')
    ];
    setHTML('metric-cards', cards.join(''));
  }

  function metricCard(label, value, helper, tone, meta = '') {
    return `
      <article class="metric-card tone-${escapeHTML(tone || 'neutral')}">
        <span>${escapeHTML(label)}</span>
        <strong>${escapeHTML(value)}</strong>
        <small>${escapeHTML(meta || helper)}</small>
      </article>
    `;
  }

  function renderAttendanceOverview(zones, total) {
    const rows = ['green', 'yellow', 'red', 'black'].map((key) => zoneByKey(zones, key));
    const segments = rows.map((row) => {
      const width = clampPercent(row.rate);
      const copy = zoneCopy[row.key];
      const percentage = row.percentage || formatPercent(row.rate);
      const tooltip = `${copy.label}: ${Number(row.count || 0)} peserta / ${percentage}. ${copy.helper}`;
      return `
        <span
          class="zone-segment ${copy.className}"
          style="width:${width}%"
          tabindex="0"
          role="img"
          aria-label="${escapeHTML(tooltip)}"
          data-tooltip="${escapeHTML(tooltip)}">
        </span>
      `;
    }).join('');
    const labels = rows.map((row) => {
      const copy = zoneCopy[row.key];
      const percentage = row.percentage || formatPercent(row.rate);
      return `
        <div class="zone-legend-item ${copy.className}">
          <span><i></i>${escapeHTML(copy.label)}</span>
          <strong>${Number(row.count || 0)} / ${escapeHTML(percentage)}</strong>
        </div>
      `;
    }).join('');

    setHTML('attendance-overview', `
      <div class="health-score">
        <div>
          <span>Ringkasan kesehatan</span>
          <strong>${Number(total || 0)} peserta</strong>
        </div>
        <p>Zona presensi dihitung dari topik yang sudah berjalan.</p>
      </div>
      <div class="stacked-zone-bar" aria-label="Distribusi zona presensi">${segments}</div>
      <div class="zone-legend" aria-label="Ringkasan zona presensi">${labels}</div>
    `);
  }

  function renderTopicList(id, rows, options = {}) {
    const container = document.getElementById(id);
    if (!container) return;
    if (!rows.length) {
      container.innerHTML = emptyStateMarkup('event_busy', 'Belum ada data topik', 'Data presensi akan muncul setelah kelas berjalan.');
      return;
    }

    container.innerHTML = rows.map((row, index) => {
      const rate = Number(row.rate || 0);
      const zone = zoneKeyForRate(rate);
      const topicTitle = row.topicName || 'Tanpa judul topik';
      const isLatest = options.latest && index === 0;
      return `
        <article class="topic-card ${isLatest ? 'is-latest' : ''}">
          <div class="topic-main">
            <span>${escapeHTML(row.topic || '-')}</span>
            <strong>${escapeHTML(topicTitle)}</strong>
            <small>${escapeHTML(row.ratio || `${row.presentCount || 0}/${row.totalCount || 0}`)} hadir</small>
          </div>
          <div class="topic-stat">
            <strong>${escapeHTML(row.percentage || formatPercent(rate))}</strong>
          </div>
          <div class="mini-progress" aria-hidden="true"><i class="tone-${zone}" style="width:${clampPercent(rate)}%"></i></div>
        </article>
      `;
    }).join('');
  }

  function renderRiskList(rows) {
    const list = document.getElementById('risk-list');
    if (!list) return;
    const query = String(riskSearchInput?.value || '').trim().toLowerCase();
    const filtered = query
      ? rows.filter((row) => String(row.name || '').toLowerCase().includes(query))
      : rows;

    if (!rows.length) {
      list.innerHTML = emptyStateMarkup('verified_user', 'Tidak ada peserta dalam pengawasan', 'Semua peserta masih berada di zona aman atau perhatian.');
      return;
    }
    if (!filtered.length) {
      list.innerHTML = emptyStateMarkup('search_off', 'Nama tidak ditemukan', 'Coba gunakan kata kunci lain.');
      return;
    }

    list.innerHTML = filtered.map((row) => {
      const rate = Number(row.rate || 0);
      const zone = zoneKeyForRate(rate);
      const waLink = whatsappLink(row.contact);
      const missed = row.total !== undefined && row.present !== undefined ? Math.max(0, Number(row.total) - Number(row.present)) : null;
      const image = row.image
        ? `<img src="${escapeHTML(row.image)}" alt="Foto ${escapeHTML(row.name || 'peserta')}" loading="lazy" onerror="this.replaceWith(this.nextElementSibling)">`
        : '';
      return `
        <article class="watch-card">
          <div class="watch-photo">${image}<span class="material-icons-outlined">person</span></div>
          <div class="watch-main">
            <strong>${escapeHTML(row.name || 'Tanpa nama')}</strong>
            <span>${escapeHTML(row.katekisKk || row.kelasKi || '-')}</span>
            ${missed === null ? '' : `<small>${missed} topik belum hadir</small>`}
          </div>
          <div class="watch-meta">
            <span class="status-badge tone-${zone}">${zoneLabel(zone)}</span>
            <strong>${escapeHTML(row.percentage || formatPercent(rate))}</strong>
            ${waLink ? `<a class="wa-link" href="${waLink}" target="_blank" rel="noopener" aria-label="Hubungi ${escapeHTML(row.name || 'peserta')} via WhatsApp"><span class="material-icons-outlined">chat</span></a>` : ''}
          </div>
        </article>
      `;
    }).join('');
  }

  function renderBreakdown(id, rows) {
    const container = document.getElementById(id);
    if (!container) return;
    const visible = rows.filter((row) => Number(row.count || 0) > 0);
    if (!visible.length) {
      container.innerHTML = emptyStateMarkup('bar_chart', 'Belum ada data', 'Data akan muncul setelah sinkronisasi.');
      return;
    }

    container.innerHTML = visible.map((row) => {
      const rate = Number(row.rate || 0);
      return `
        <div class="breakdown-row">
          <div>
            <span>${escapeHTML(row.label)}</span>
            <strong>${Number(row.count || 0)}</strong>
            <em>${escapeHTML(row.percentage || formatPercent(rate))}</em>
          </div>
          <div class="breakdown-bar" aria-hidden="true"><i style="width:${clampPercent(rate)}%"></i></div>
        </div>
      `;
    }).join('');
  }

  function emptyStateMarkup(icon, title, helper) {
    return `
      <div class="empty-state">
        <span class="material-icons-outlined">${escapeHTML(icon)}</span>
        <strong>${escapeHTML(title)}</strong>
        <small>${escapeHTML(helper)}</small>
      </div>
    `;
  }

  function normalizeZones(rows) {
    return ['green', 'yellow', 'red', 'black'].map((key) => {
      const row = rows.find((item) => item.key === key || zoneKeyFromLabel(item.label) === key) || {};
      return {
        key,
        label: row.label || zoneCopy[key].label,
        count: Number(row.count || 0),
        rate: Number(row.rate || 0),
        percentage: row.percentage || formatPercent(row.rate)
      };
    });
  }

  function zoneByKey(rows, key) {
    return rows.find((row) => row.key === key) || { key, count: 0, rate: 0, percentage: '0.0%' };
  }

  function zoneKeyForRate(rate) {
    const value = Number(rate || 0);
    if (value > 85) return 'green';
    if (value >= 65) return 'yellow';
    if (value >= 50) return 'red';
    return 'black';
  }

  function zoneKeyFromLabel(label) {
    const text = String(label || '').toLowerCase();
    if (text.includes('hijau')) return 'green';
    if (text.includes('kuning')) return 'yellow';
    if (text.includes('merah')) return 'red';
    return 'black';
  }

  function zoneLabel(key) {
    return zoneCopy[key]?.label || 'Penindakan';
  }

  function periodLabel(metadata) {
    const intake = metadata.intakeYear || metadata.tahun || '';
    const baptism = metadata.baptismYear || metadata.baptis || '';
    if (intake && baptism) return `${intake} - ${baptism}`;
    return intake || baptism || '-';
  }

  function cohortLabel(kelompok, classCode) {
    const raw = String(kelompok || '').trim();
    const code = String(classCode || classSelector.value || '').trim().toUpperCase();
    if (raw && raw.toUpperCase() !== code) return raw;
    return classNames[code] || raw || code || '-';
  }

  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  function setHTML(id, value) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = value;
  }

  function whatsappLink(contact) {
    const digits = String(contact || '').replace(/\D/g, '');
    if (!digits) return '';
    const normalized = digits.startsWith('0') ? `62${digits.slice(1)}` : digits.startsWith('62') ? digits : `62${digits}`;
    return `https://wa.me/${normalized}`;
  }

  function formatPercent(value) {
    return `${Math.round(Number(value || 0) * 10) / 10}%`;
  }

  function clampPercent(value) {
    return Math.max(0, Math.min(100, Number(value || 0)));
  }

  function formatDateLabel(value) {
    const normalized = String(value || '').replace(' ', 'T');
    const date = new Date(normalized);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function updateClassUrl(classCode) {
    const url = new URL(window.location.href);
    url.searchParams.set('classCode', classCode);
    window.history.replaceState({}, '', url);
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (token && !sessionStorage.getItem('authToken')) {
      sessionStorage.setItem('authToken', token);
    }
    initTheme();
    loadClasses();

    classSelector.addEventListener('change', (event) => {
      loadDashboard(event.target.value);
    });

    refreshBtn.addEventListener('click', () => {
      if (classSelector.value) loadDashboard(classSelector.value);
    });

    if (riskSearchInput) {
      riskSearchInput.addEventListener('input', () => renderRiskList(currentRiskRows));
    }
  });
})();

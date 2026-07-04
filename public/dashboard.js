(function() {
  const token = sessionStorage.getItem('authToken') || (window.getCookie ? window.getCookie('auth_token') : null);
  const classSelector = document.getElementById('dashboard-class-selector');
  const refreshBtn = document.getElementById('dashboard-refresh-btn');
  const loader = document.getElementById('dashboard-loader');
  const emptyState = document.getElementById('dashboard-empty');
  const content = document.getElementById('dashboard-content');
  const alertBox = document.getElementById('dashboard-alert');
  const selectedClassKey = 'dashboardSelectedClass';

  const chartColors = ['#3b82f6', '#f4b400', '#d8574f', '#34a853', '#8b5cf6', '#00a3a3', '#9aa0a6'];
  const zoneColors = {
    green: '#78b85f',
    yellow: '#d9b844',
    red: '#d8574f',
    black: '#2f3033'
  };

  function escapeHTML(value) {
    return String(value || '')
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
    if (loader) loader.hidden = !isLoading;
    if (content && isLoading) content.setAttribute('aria-busy', 'true');
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
      if (data.fallback && data.message) {
        showAlert(data.message);
      }
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

    setText('meta-tahun', metadata.tahun || '-');
    setText('meta-kelompok', metadata.kelompok || data.classCode || '-');
    setText('meta-baptis', metadata.baptis || '-');
    setText('meta-updated', metadata.lastUpdated ? `Terakhir diperbarui ${formatDateLabel(metadata.lastUpdated)}` : 'Belum ada timestamp');
    setText('summary-total', summary.total || 0);

    renderGender(summary.gender || []);
    renderCategoryTable('religion-table', summary.religion || []);
    renderCategoryTable('marital-table', summary.maritalStatus || []);
    renderZoneCards(attendance.zones || []);
    renderTopicTable('recent-table', attendance.recentTopics || []);
    renderTopicTable('attention-table', attendance.attentionTopics || []);
    renderRiskTable(attendance.riskParticipants || []);
    renderDonut('religion-chart', summary.religion || [], chartColors, summary.total || 0);
    renderDonut('status-chart', attendance.zones || [], zoneSeriesColors(attendance.zones || []), summary.total || 0);

    if (emptyState) emptyState.hidden = true;
    if (content) content.hidden = false;
  }

  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  function renderGender(rows) {
    const container = document.getElementById('gender-summary');
    if (!container) return;
    if (!rows.length) {
      container.innerHTML = '<div class="split-badge"><span>Belum ada data</span><strong>0</strong></div>';
      return;
    }

    container.innerHTML = rows.slice(0, 4).map((row) => `
      <div class="split-badge">
        <span>${escapeHTML(row.label)}</span>
        <strong>${Number(row.count || 0)}</strong>
      </div>
    `).join('');
  }

  function renderCategoryTable(id, rows) {
    const tbody = document.getElementById(id);
    if (!tbody) return;
    if (!rows.length) {
      tbody.innerHTML = '<tr><td class="empty-row" colspan="3">Belum ada data.</td></tr>';
      return;
    }

    tbody.innerHTML = rows.map((row) => `
      <tr>
        <td>${escapeHTML(row.label)}</td>
        <td>${Number(row.count || 0)}</td>
        <td>${escapeHTML(row.percentage || formatPercent(row.rate))}</td>
      </tr>
    `).join('');
  }

  function renderZoneCards(rows) {
    const container = document.getElementById('zone-cards');
    if (!container) return;
    const fallback = [
      { key: 'green', label: 'Zona Hijau (Aman)', count: 0, percentage: '0.0%' },
      { key: 'yellow', label: 'Zona Kuning (Perhatian)', count: 0, percentage: '0.0%' },
      { key: 'red', label: 'Zona Merah (Pengawasan)', count: 0, percentage: '0.0%' },
      { key: 'black', label: 'Zona Hitam (Penindakan)', count: 0, percentage: '0.0%' }
    ];
    const source = rows.length ? rows : fallback;

    container.innerHTML = source.map((row) => `
      <div class="zone-card zone-${escapeHTML(row.key || zoneKeyFromLabel(row.label))}">
        <span>${escapeHTML(row.label)}</span>
        <strong>${Number(row.count || 0)} <em>${escapeHTML(row.percentage || formatPercent(row.rate))}</em></strong>
        <div class="zone-meter" aria-hidden="true"><i style="width:${clampPercent(row.rate)}%"></i></div>
      </div>
    `).join('');
  }

  function renderTopicTable(id, rows) {
    const tbody = document.getElementById(id);
    if (!tbody) return;
    if (!rows.length) {
      tbody.innerHTML = '<tr><td class="empty-row" colspan="4">Belum ada data.</td></tr>';
      return;
    }

    tbody.innerHTML = rows.map((row) => {
      const rate = Number(row.rate || 0);
      return `
        <tr>
          <td>
            <strong>${escapeHTML(row.topic)}</strong>
            ${row.topicName ? `<small>${escapeHTML(row.topicName)}</small>` : ''}
          </td>
          <td><span class="type-pill">${escapeHTML(row.type || topicType(row))}</span></td>
          <td>${escapeHTML(row.ratio || `${row.presentCount || 0}/${row.totalCount || 0}`)}</td>
          <td><span class="rate-pill ${rateClass(rate)}">${escapeHTML(row.percentage || formatPercent(rate))}</span></td>
        </tr>
      `;
    }).join('');
  }

  function renderRiskTable(rows) {
    const tbody = document.getElementById('risk-table');
    if (!tbody) return;
    if (!rows.length) {
      tbody.innerHTML = '<tr><td class="empty-row" colspan="4">Tidak ada peserta dalam pengawasan.</td></tr>';
      return;
    }

    tbody.innerHTML = rows.map((row) => {
      const rate = Number(row.rate || 0);
      return `
        <tr>
          <td>
            <strong>${escapeHTML(row.name || 'Tanpa nama')}</strong><br>
            <span class="student-id">${escapeHTML(row.studentId || '-')}</span>
          </td>
          <td>${escapeHTML(row.katekisKk || row.kelasKi || '-')}</td>
          <td><span class="zone-pill ${rateClass(rate)}">${escapeHTML(row.zone || '-')}</span></td>
          <td><span class="rate-pill ${rateClass(rate)}">${escapeHTML(row.percentage || formatPercent(rate))}</span></td>
        </tr>
      `;
    }).join('');
  }

  function renderDonut(id, rows, colors, total) {
    const container = document.getElementById(id);
    if (!container) return;
    const filtered = rows.filter((row) => Number(row.count || 0) > 0);
    if (!filtered.length) {
      container.innerHTML = '<div class="empty-row">Belum ada data chart.</div>';
      return;
    }

    const sum = filtered.reduce((acc, row) => acc + Number(row.count || 0), 0);
    let offset = 25;
    const radius = 15.9155;
    const circumference = 100;
    const segments = filtered.map((row, index) => {
      const value = sum > 0 ? Number(row.count || 0) / sum * 100 : 0;
      const stroke = colors[index % colors.length];
      const segment = `<circle r="${radius}" cx="18" cy="18" fill="transparent" stroke="${stroke}" stroke-width="8" stroke-dasharray="${value} ${circumference - value}" stroke-dashoffset="${offset}" />`;
      offset -= value;
      return segment;
    }).join('');

    const legend = filtered.map((row, index) => `
      <span class="legend-chip">
        <span class="legend-dot" style="background:${colors[index % colors.length]}"></span>
        <span>${escapeHTML(row.shortLabel || row.label)}</span>
        <strong>${escapeHTML(row.percentage || formatPercent(row.rate))}</strong>
      </span>
    `).join('');

    container.innerHTML = `
      <div class="donut-wrap">
        <svg viewBox="0 0 36 36" role="img" aria-label="Diagram donat">
          <title>Distribusi ${Number(total || sum)} peserta</title>
          <circle r="${radius}" cx="18" cy="18" fill="transparent" stroke="var(--border-glass)" stroke-width="8" />
          <g transform="rotate(-90 18 18)">${segments}</g>
          <text x="18" y="17.3" text-anchor="middle" class="donut-center">${Number(total || sum)}</text>
          <text x="18" y="21.2" text-anchor="middle" class="donut-label-sub">peserta</text>
        </svg>
        <div class="donut-legend">${legend}</div>
      </div>
    `;
  }

  function zoneSeriesColors(rows) {
    return rows.map((row) => zoneColors[row.key] || zoneColors[zoneKeyFromLabel(row.label)] || '#9aa0a6');
  }

  function zoneKeyFromLabel(label) {
    const text = String(label || '').toLowerCase();
    if (text.includes('hijau')) return 'green';
    if (text.includes('kuning')) return 'yellow';
    if (text.includes('merah')) return 'red';
    return 'black';
  }

  function rateClass(rate) {
    if (rate > 85) return 'rate-good';
    if (rate >= 65) return 'rate-watch';
    return 'rate-bad';
  }

  function formatPercent(value) {
    return `${Math.round(Number(value || 0) * 10) / 10}%`;
  }

  function clampPercent(value) {
    return Math.max(0, Math.min(100, Number(value || 0)));
  }

  function formatDateLabel(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  }

  function updateClassUrl(classCode) {
    const url = new URL(window.location.href);
    url.searchParams.set('classCode', classCode);
    window.history.replaceState({}, '', url);
  }

  function topicType(row) {
    const topicText = String(row.topic || '');
    const match = topicText.match(/(?:Topik\s*)?([A-Z]?\d+|R\d+)/i);
    const week = match ? match[1].toUpperCase() : '';
    const topic = Array.isArray(STATIC_TOPICS) ? STATIC_TOPICS.find((item) => String(item.week).toUpperCase() === week) : null;
    if (!topic) return 'KK';
    if (/\(KI\)/i.test(topic.name)) return 'KI';
    if (/\(P\)/i.test(topic.name)) return 'Pastor';
    if (/rekoleksi|refleksi/i.test(topic.name)) return 'Rekoleksi';
    return 'KK';
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
  });
})();

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
    green: { label: 'Aman', helper: 'Kehadiran di atas 85%', className: 'is-green', tone: 'green' },
    yellow: { label: 'Perhatian', helper: 'Perlu perhatian ringan', className: 'is-yellow', tone: 'yellow' },
    red: { label: 'Pengawasan', helper: 'Kehadiran 50-65%', className: 'is-red', tone: 'red' },
    black: { label: 'Penindakan', helper: 'Kehadiran di bawah 50%', className: 'is-black', tone: 'black' }
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
    alertBox.innerHTML = `
      <strong>Dashboard tidak bisa dimuat.</strong>
      <span>${escapeHTML(message || 'Data Anda tidak berubah. Coba muat ulang dashboard.')}</span>
    `;
    alertBox.hidden = false;
  }

  function hideAlert() {
    if (alertBox) alertBox.hidden = true;
  }

  function setLoading(isLoading) {
    document.body.classList.toggle('dashboard-loading', isLoading);
    if (loader) loader.hidden = !isLoading;
    if (refreshBtn) refreshBtn.disabled = isLoading;
    if (content) {
      if (isLoading) {
        content.hidden = false;
        content.setAttribute('aria-busy', 'true');
        renderDashboardSkeleton();
      } else {
        content.removeAttribute('aria-busy');
      }
    }
    if (emptyState) emptyState.hidden = isLoading || !!classSelector.value;
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

      classSelector.innerHTML = '<option value="" disabled selected>Pilih kelas...</option>';
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
    setText('meta-updated', metadata.lastUpdated ? `Diperbarui ${formatDateLabel(metadata.lastUpdated)}` : 'Belum ada timestamp');

    currentRiskRows = sortedRiskRows(attendance.riskParticipants || []);
    renderMetricCards(summary, zones, latestTopic, currentRiskRows);
    renderRiskList(currentRiskRows);
    renderAttendanceOverview(zones, Number(summary.total || 0));
    renderTopicList('recent-topics', recentTopics.slice(0, 3), { latest: true });
    renderTopicList('lowest-topics', lowTopics.slice(0, 3), { compact: true });
    renderBreakdown('gender-breakdown', summary.gender || []);
    renderBreakdown('religion-breakdown', summary.religion || []);
    renderBreakdown('marital-breakdown', summary.maritalStatus || []);

    if (emptyState) emptyState.hidden = true;
    if (content) content.hidden = false;
  }

  function renderDashboardSkeleton() {
    setText('meta-kelompok', classSelector.value ? classNames[classSelector.value] || classSelector.value : '-');
    setText('meta-period', 'Memuat...');
    setText('meta-priest', 'Memuat...');
    setText('meta-updated', 'Memuat data terbaru...');
    setHTML('metric-cards', [1, 2, 3].map(() => `
      <article class="metric-card is-loading" aria-hidden="true">
        <span></span><strong></strong><small></small>
      </article>
    `).join(''));
    setHTML('risk-list', skeletonRows(4));
    setHTML('attendance-overview', `
      <div class="health-score is-loading" aria-hidden="true"><div><span></span><strong></strong></div><p></p></div>
      <div class="stacked-zone-bar is-loading" aria-hidden="true"></div>
      <div class="zone-legend is-loading" aria-hidden="true">${skeletonLegend()}</div>
    `);
    setHTML('recent-topics', skeletonRows(3));
    setHTML('lowest-topics', skeletonRows(3));
    setHTML('gender-breakdown', skeletonRows(2));
    setHTML('religion-breakdown', skeletonRows(2));
    setHTML('marital-breakdown', skeletonRows(2));
  }

  function renderMetricCards(summary, zones, latestTopic, riskRows) {
    const yellow = zoneByKey(zones, 'yellow');
    const red = zoneByKey(zones, 'red');
    const black = zoneByKey(zones, 'black');
    const watched = Number(red.count || 0) + Number(black.count || 0);
    const worstRisk = riskRows[0];
    const latestRate = latestTopic ? latestTopic.percentage || formatPercent(latestTopic.rate) : '-';
    const cards = [
      metricCard({
        label: 'Dalam Pengawasan',
        value: watched,
        context: watched ? `${watched} peserta perlu follow-up` : 'Tidak ada peserta di zona merah/hitam',
        tone: watched ? 'red' : 'green',
        status: watched ? 'Tindak lanjut' : 'Aman'
      }),
      metricCard({
        label: 'Perlu Perhatian',
        value: Number(yellow.count || 0),
        context: `${yellow.percentage || '0.0%'} peserta berada di zona kuning`,
        tone: yellow.count ? 'yellow' : 'green',
        status: yellow.count ? 'Pantau' : 'Stabil'
      }),
      metricCard({
        label: 'Topik Terbaru',
        value: latestRate,
        context: latestTopic ? `${latestTopic.topic || 'Topik'} - ${latestTopic.topicName || 'Tanpa judul'}` : `${Number(summary.total || 0)} peserta aktif`,
        tone: latestTopic ? zoneKeyForRate(latestTopic.rate) : 'neutral',
        status: worstRisk ? `Terendah: ${worstRisk.percentage || formatPercent(worstRisk.rate)}` : 'Tidak ada risiko'
      })
    ];
    setHTML('metric-cards', cards.join(''));
  }

  function metricCard({ label, value, context, tone, status }) {
    return `
      <article class="metric-card tone-${escapeHTML(tone || 'neutral')}">
        <div class="metric-card-head">
          <span>${escapeHTML(label)}</span>
          ${status ? `<em>${escapeHTML(status)}</em>` : ''}
        </div>
        <strong>${escapeHTML(value)}</strong>
        <small>${escapeHTML(context)}</small>
      </article>
    `;
  }

  function renderAttendanceOverview(zones, total) {
    const rows = ['green', 'yellow', 'red', 'black'].map((key) => zoneByKey(zones, key));
    const yellow = zoneByKey(rows, 'yellow');
    const red = zoneByKey(rows, 'red');
    const black = zoneByKey(rows, 'black');
    const attentionCount = Number(yellow.count || 0) + Number(red.count || 0) + Number(black.count || 0);
    const actionCount = Number(red.count || 0) + Number(black.count || 0);
    const summaryText = actionCount
      ? `${actionCount} peserta butuh tindakan prioritas.`
      : attentionCount
        ? `${attentionCount} peserta perlu dipantau.`
        : 'Kelas berada dalam kondisi aman.';
    const segments = rows.map((row) => {
      const width = clampPercent(row.rate);
      const copy = zoneCopy[row.key];
      const percentage = row.percentage || formatPercent(row.rate);
      return `
        <span
          class="zone-segment ${copy.className}"
          style="width:${width}%"
          aria-hidden="true"
          title="${escapeHTML(`${copy.label}: ${Number(row.count || 0)} peserta / ${percentage}`)}">
        </span>
      `;
    }).join('');
    const labels = rows.map((row) => {
      const copy = zoneCopy[row.key];
      const percentage = row.percentage || formatPercent(row.rate);
      return `
        <div class="zone-legend-item ${copy.className}">
          <span><i aria-hidden="true"></i>${escapeHTML(copy.label)}</span>
          <strong>${Number(row.count || 0)} / ${escapeHTML(percentage)}</strong>
        </div>
      `;
    }).join('');

    setHTML('attendance-overview', `
      <div class="health-score">
        <div>
          <span>Ringkasan kesehatan</span>
          <strong>${escapeHTML(summaryText)}</strong>
        </div>
        <p>${Number(total || 0)} peserta aktif dihitung dari topik yang sudah berjalan.</p>
      </div>
      <div class="stacked-zone-bar" role="img" aria-label="${escapeHTML(zoneSummaryLabel(rows))}">${segments}</div>
      <div class="zone-legend" aria-label="Ringkasan zona presensi">${labels}</div>
    `);
  }

  function renderTopicList(id, rows, options = {}) {
    const container = document.getElementById(id);
    if (!container) return;
    if (!rows.length) {
      container.innerHTML = emptyStateMarkup('event-busy', 'Belum ada data topik', 'Data presensi akan muncul setelah kelas berjalan.');
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
          <div class="topic-stat tone-${zone}">
            <strong>${escapeHTML(row.percentage || formatPercent(rate))}</strong>
            <span>${escapeHTML(zoneLabel(zone))}</span>
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
      ? rows.filter((row) => [row.name, row.studentId, row.katekisKk, row.kelasKi].some((value) => String(value || '').toLowerCase().includes(query)))
      : rows;

    if (!rows.length) {
      list.innerHTML = emptyStateMarkup('check-circle', 'Tidak ada peserta dalam pengawasan', 'Semua peserta masih berada di zona aman atau perhatian.');
      return;
    }
    if (!filtered.length) {
      list.innerHTML = emptyStateMarkup('user-search', 'Nama tidak ditemukan', 'Coba gunakan nama, ID, kelas, atau katekis lain.');
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
      const reason = missed === null
        ? `${row.percentage || formatPercent(rate)} kehadiran`
        : `${missed} topik belum hadir`;
      return `
        <article class="watch-card">
          <div class="watch-photo">${image}<re-icon icon="user" decorative></re-icon></div>
          <div class="watch-main">
            <strong>${escapeHTML(row.name || 'Tanpa nama')}</strong>
            <span>${escapeHTML(row.katekisKk || row.kelasKi || row.studentId || '-')}</span>
            <small>${escapeHTML(reason)}</small>
          </div>
          <div class="watch-meta">
            <span class="status-badge tone-${zone}">${zoneLabel(zone)}</span>
            <strong>${escapeHTML(row.percentage || formatPercent(rate))}</strong>
            ${waLink ? `<a class="wa-link" href="${waLink}" target="_blank" rel="noopener" aria-label="Hubungi ${escapeHTML(row.name || 'peserta')} via WhatsApp"><re-icon icon="chat" decorative></re-icon></a>` : ''}
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
      container.innerHTML = emptyStateMarkup('bar-chart', 'Belum ada data', 'Data akan muncul setelah sinkronisasi.');
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
        <re-icon icon="${escapeHTML(icon)}" decorative></re-icon>
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

  function sortedRiskRows(rows) {
    return rows.slice().sort((a, b) => Number(a.rate || 0) - Number(b.rate || 0));
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
    if (text.includes('hijau') || text.includes('aman') || text.includes('aktif')) return 'green';
    if (text.includes('kuning') || text.includes('perhatian')) return 'yellow';
    if (text.includes('merah') || text.includes('pengawasan')) return 'red';
    return 'black';
  }

  function zoneLabel(key) {
    return zoneCopy[key]?.label || 'Penindakan';
  }

  function zoneSummaryLabel(rows) {
    return rows.map((row) => {
      const copy = zoneCopy[row.key];
      return `${copy.label}: ${Number(row.count || 0)} peserta, ${row.percentage || formatPercent(row.rate)}`;
    }).join('. ');
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

  function skeletonRows(count) {
    return Array.from({ length: count }, () => '<div class="skeleton-row" aria-hidden="true"></div>').join('');
  }

  function skeletonLegend() {
    return Array.from({ length: 4 }, () => '<div class="skeleton-row" aria-hidden="true"></div>').join('');
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

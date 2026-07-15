import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const port = 6600 + process.pid % 300;
const baseUrl = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ['app.js'], {
  cwd: process.cwd(),
  env: { ...process.env, PORT: String(port) },
  stdio: 'ignore'
});

async function waitForServer() {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      if ((await fetch(baseUrl)).ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Local server did not start');
}

async function drag(page, startX, endX, y) {
  await page.mouse.move(startX, y);
  await page.mouse.down();
  await page.mouse.move(endX, y, { steps: 6 });
  await page.mouse.up();
}

let browser;
try {
  await waitForServer();
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.addCookies([{ name: 'auth_token', value: 'preview', domain: '127.0.0.1', path: '/' }]);
  await context.addInitScript(() => {
    sessionStorage.setItem('authToken', 'preview');
    localStorage.setItem('hasSeenOnboardingV2', 'true');
    localStorage.setItem('selectedWeek', '0');
    localStorage.setItem('selectedTopicName', 'Pembukaan Kelas');
    localStorage.setItem('scan_queue', JSON.stringify([
      { id: 'success-1', studentId: '2026/TST/001', week: '0', status: 'success', name: 'Maria Kristiana Kaidun Dengan Nama Sangat Panjang', image: '/assets/favicon.png', timestamp: Date.now() },
      { id: 'duplicate-1', studentId: '2026/TST/002', week: '0', status: 'duplicate', name: 'Yohanes', image: '', timestamp: Date.now() },
      { id: 'error-1', studentId: '2026/TST/003', week: '0', status: 'error', name: 'Paulus', image: '', timestamp: Date.now() }
    ]));
  });

  const page = await context.newPage();
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    window.setAppState(2);
    scanQueue.queue.push({ id: 'pending-1', studentId: '2026/TST/004', week: '0', status: 'processing', name: 'Pending', image: '', timestamp: Date.now() });
    scanQueue.isProcessing = true;
    scanQueue.save();
  });

  const photoGeometry = await page.locator('.queue-row .student-photo').first().evaluate(photo => {
    const style = getComputedStyle(photo);
    return { width: photo.offsetWidth, height: photo.offsetHeight, radius: style.borderRadius };
  });
  if (photoGeometry.width !== 56 || photoGeometry.height !== 56 || photoGeometry.radius !== '12px') {
    throw new Error(`History photo is not a squircle: ${JSON.stringify(photoGeometry)}`);
  }
  const compactCard = await page.locator('.queue-row').filter({ hasText: 'Maria' }).evaluate(card => {
    const name = card.querySelector('.student-name');
    const nameStyle = getComputedStyle(name);
    return {
      cardHeight: card.getBoundingClientRect().height,
      cardWidth: card.getBoundingClientRect().width,
      infoWidth: card.querySelector('.student-info').getBoundingClientRect().width,
      textWidth: card.querySelector('.student-text').getBoundingClientRect().width,
      nameHeight: name.getBoundingClientRect().height,
      nameWidth: name.clientWidth,
      nameScrollWidth: name.scrollWidth,
      nameClipped: name.scrollWidth > name.clientWidth,
      overflow: nameStyle.overflow,
      textOverflow: nameStyle.textOverflow,
      whiteSpace: nameStyle.whiteSpace,
    };
  });
  if (compactCard.cardHeight !== 74 || compactCard.nameHeight > 18 || !compactCard.nameClipped || compactCard.overflow !== 'hidden' || compactCard.textOverflow !== 'ellipsis' || compactCard.whiteSpace !== 'nowrap') {
    throw new Error(`History card is not compact with a clipped name: ${JSON.stringify(compactCard)}`);
  }
  const spinnerStates = await page.locator('#login-loader .app-spinner, #history-sync-spinner, .status-spinner').evaluateAll(spinners => spinners.map(spinner => ({
    color: getComputedStyle(spinner).color,
    stroke: getComputedStyle(spinner.shadowRoot.querySelector('svg')).stroke,
  })));
  if (spinnerStates.length !== 3 || spinnerStates.some(spinner => spinner.color !== spinner.stroke) || await page.locator('.grid-column-scan-loader').count()) {
    throw new Error(`Scan spinners were not replaced: ${JSON.stringify(spinnerStates)}`);
  }
  const infoTrigger = page.locator('#progress-info-trigger');
  const breakdown = page.locator('#progress-breakdown');
  if (await page.locator('.progress-legend').isVisible() || await infoTrigger.isDisabled()) {
    throw new Error('Progress breakdown is visible by default or its trigger is disabled');
  }
  await infoTrigger.click();
  const breakdownState = await page.evaluate(() => {
    const trigger = document.getElementById('progress-info-trigger').getBoundingClientRect();
    const bar = document.querySelector('.segmented-progress-bar').getBoundingClientRect();
    const visibleItems = Array.from(document.querySelectorAll('.progress-legend .legend-item'))
      .filter(item => getComputedStyle(item).display !== 'none')
      .map(item => item.textContent.replace(/\s+/g, ' ').trim());
    return {
      expanded: document.getElementById('progress-info-trigger').getAttribute('aria-expanded'),
      triggerLeftOfBar: trigger.right <= bar.left,
      direction: getComputedStyle(document.querySelector('.progress-legend')).flexDirection,
      visibleItems,
    };
  });
  if (breakdownState.expanded !== 'true' || !breakdownState.triggerLeftOfBar || breakdownState.direction !== 'column' || breakdownState.visibleItems.length !== 4) {
    throw new Error(`Progress breakdown popover is incorrect: ${JSON.stringify(breakdownState)}`);
  }
  await page.keyboard.press('Escape');
  if (await breakdown.isVisible() || await infoTrigger.getAttribute('aria-expanded') !== 'false' || !await infoTrigger.evaluate(trigger => trigger === document.activeElement)) {
    throw new Error('Escape did not close the progress breakdown and restore focus');
  }
  const cardBorders = await page.locator('.queue-row').evaluateAll(rows => rows.map(row => {
    const style = getComputedStyle(row);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    const context = canvas.getContext('2d');
    context.fillStyle = style.borderTopColor;
    context.fillRect(0, 0, 1, 1);
    return {
      widths: [style.borderTopWidth, style.borderRightWidth, style.borderBottomWidth, style.borderLeftWidth],
      color: style.borderTopColor,
      alpha: context.getImageData(0, 0, 1, 1).data[3] / 255,
    };
  }));
  if (cardBorders.some(border => border.widths.some(width => width !== '1px') || border.alpha < 0.7 || border.alpha > 0.74) || new Set(cardBorders.map(border => border.color)).size !== cardBorders.length) {
    throw new Error(`History cards do not have subtle 1px semantic borders: ${JSON.stringify(cardBorders)}`);
  }
  if (await page.locator('.history-dismiss-btn').count() !== 3) throw new Error('Pending history received a dismiss button');

  const dismissGeometry = await page.locator('.history-dismiss-btn').first().evaluate(button => {
    const card = button.closest('.queue-row').getBoundingClientRect();
    const hitTarget = button.getBoundingClientRect();
    const glyph = button.querySelector('span');
    const glyphRect = glyph.getBoundingClientRect();
    const status = button.closest('.queue-row').querySelector('.status-badge').getBoundingClientRect();
    const photo = button.closest('.queue-row').querySelector('.student-photo').getBoundingClientRect();
    return {
      rightInset: Math.round(card.right - hitTarget.right),
      hitWidth: hitTarget.width,
      glyphFontSize: getComputedStyle(glyph).fontSize,
      glyphBackground: getComputedStyle(glyph).backgroundColor,
      statusRightInset: Math.round(card.right - status.right),
      statusBottomInset: Math.round(card.bottom - status.bottom),
      statusBelowGlyph: status.top > glyphRect.bottom,
      glyphTopDelta: Math.round(glyphRect.top - photo.top),
    };
  });
  if (dismissGeometry.rightInset > 4 || dismissGeometry.hitWidth !== 44 || dismissGeometry.glyphFontSize !== '13.6px' || dismissGeometry.glyphBackground !== 'rgba(0, 0, 0, 0)' || dismissGeometry.statusRightInset > 12 || dismissGeometry.statusBottomInset > 10 || !dismissGeometry.statusBelowGlyph || Math.abs(dismissGeometry.glyphTopDelta) > 1) {
    throw new Error(`History card controls are not aligned vertically on the right: ${JSON.stringify(dismissGeometry)}`);
  }

  const dots = page.locator('.carousel-dot');
  const dotShapes = await dots.evaluateAll(elements => elements.map(element => {
    const style = getComputedStyle(element, '::before');
    return { active: element.classList.contains('active'), width: style.width, height: style.height };
  }));
  if (!dotShapes.some(dot => dot.active && dot.width === '18px' && dot.height === '6px') || !dotShapes.some(dot => !dot.active && dot.width === '6px' && dot.height === '6px')) {
    throw new Error(`Carousel indicators are not an active pill and inactive circles: ${JSON.stringify(dotShapes)}`);
  }
  const dotSpacing = await page.locator('#carousel-dots').evaluate(container => {
    const style = getComputedStyle(container);
    const dots = Array.from(container.children);
    const first = dots[0].getBoundingClientRect();
    const second = dots[1].getBoundingClientRect();
    const carousel = document.querySelector('.carousel-container-outer').getBoundingClientRect();
    const footer = document.querySelector('.app-footer').getBoundingClientRect();
    const dotCenter = first.top + first.height / 2;
    return {
      gap: style.gap,
      trackHeight: container.getBoundingClientRect().height,
      hitHeight: first.height,
      centerDistance: Math.round((second.left + second.width / 2) - (first.left + first.width / 2)),
      historyGap: dotCenter - 3 - carousel.bottom,
      footerGap: footer.top - dotCenter - 3,
    };
  });
  if (dotSpacing.gap !== '0px' || dotSpacing.trackHeight !== 6 || dotSpacing.hitHeight !== 44 || dotSpacing.centerDistance !== 20 || dotSpacing.footerGap > 13 || Math.abs(dotSpacing.historyGap - dotSpacing.footerGap) > 1) {
    throw new Error(`Carousel indicators are not compact: ${JSON.stringify(dotSpacing)}`);
  }
  await page.locator('.queue-row').filter({ hasText: 'Maria' }).locator('.history-dismiss-btn').click();
  const dismissalState = await page.evaluate(() => ({
    storedIds: JSON.parse(localStorage.getItem('scan_queue')).map(item => item.id),
    liveIds: scanQueue.queue.map(item => item.id),
  }));
  if (dismissalState.storedIds.includes('success-1')) throw new Error(`Card dismissal was not persisted: ${JSON.stringify(dismissalState)}`);
  await page.getByRole('button', { name: 'Urungkan' }).click();
  if (!await page.evaluate(() => JSON.parse(localStorage.getItem('scan_queue')).some(item => item.id === 'success-1'))) throw new Error('Undo did not restore history');

  const repeatScanState = await page.evaluate(async () => {
    localStorage.removeItem('last_qr_scan');
    const queueBefore = scanQueue.queue.length;
    const toastsBefore = document.querySelectorAll('.toast').length;
    const encodedStudentId = btoa('2026/TST/009');
    await handleScan(encodedStudentId);
    const stored = JSON.parse(localStorage.getItem('last_qr_scan'));
    await handleScan(encodedStudentId);
    return {
      queueIncrease: scanQueue.queue.length - queueBefore,
      toastIncrease: document.querySelectorAll('.toast').length - toastsBefore,
      storedStudentId: stored.studentId,
      storageDuration: stored.expiresAt - Date.now(),
      dimmed: document.getElementById('reader-container').classList.contains('scan-inactive'),
    };
  });
  if (repeatScanState.queueIncrease !== 1 || repeatScanState.toastIncrease !== 0 || repeatScanState.storedStudentId !== '2026/TST/009' || repeatScanState.storageDuration < 4900 || repeatScanState.storageDuration > 5000 || !repeatScanState.dimmed) {
    throw new Error(`Scan cooldown state is incorrect: ${JSON.stringify(repeatScanState)}`);
  }
  await page.waitForFunction(() => getComputedStyle(document.getElementById('reader-container'), '::after').opacity === '0.8', null, { timeout: 500 });
  await page.waitForFunction(() => !document.getElementById('reader-container').classList.contains('scan-inactive'), null, { timeout: 1000 });
  await page.evaluate(() => {
    scanQueue.queue = scanQueue.queue.filter(item => item.studentId !== '2026/TST/009');
    scanQueue.save();
    localStorage.removeItem('last_qr_scan');
  });

  await page.evaluate(() => {
    for (let index = 1; index <= 5; index += 1) showToast(`Toast ${index}`, 'info', { duration: 60000 });
  });
  const toastState = await page.locator('#toast-container').evaluate(container => ({
    count: container.children.length,
    first: container.firstElementChild?.textContent,
    top: getComputedStyle(container).top,
    rectTop: container.getBoundingClientRect().top,
  }));
  if (toastState.count !== 4 || !toastState.first.includes('Toast 5') || toastState.top === 'auto' || toastState.rectTop > 24) {
    throw new Error(`Toast stack is incorrect: ${JSON.stringify(toastState)}`);
  }

  const list = page.locator('#queue-list');
  await list.evaluate(element => element.scrollTo({ left: 0, behavior: 'instant' }));
  const listBox = await list.boundingBox();
  await drag(page, listBox.x + 24, listBox.x + 54, listBox.y + listBox.height / 2);
  if (await page.locator('#history-confirm-overlay').getAttribute('class').then(value => value.includes('show'))) throw new Error('Short edge drag opened confirmation');
  await page.waitForTimeout(250);
  await drag(page, listBox.x + 24, listBox.x + 94, listBox.y + listBox.height / 2);
  const overlay = page.locator('#history-confirm-overlay');
  const startGestureState = await page.evaluate(() => ({
    overlayClass: document.getElementById('history-confirm-overlay').className,
    actionHidden: document.getElementById('bulk-delete-start').hidden,
    scrollLeft: document.getElementById('queue-list').scrollLeft,
    clientWidth: document.getElementById('queue-list').clientWidth,
    scrollWidth: document.getElementById('queue-list').scrollWidth,
  }));
  if (!startGestureState.overlayClass.includes('show')) throw new Error(`Start edge gesture failed: ${JSON.stringify(startGestureState)}`);
  await overlay.waitFor({ state: 'visible' });
  const confirmationText = (await overlay.textContent()).replace(/\s+/g, ' ').trim();
  if (!confirmationText.includes('Hapus riwayat pemindaian? Semua QR code yang berhasil dipindai tidak akan terpengaruh oleh aksi ini')) {
    throw new Error('Bulk-delete confirmation copy is incorrect');
  }
  await page.getByRole('button', { name: 'Batal' }).click();
  await page.waitForTimeout(300);
  if (await page.evaluate(() => document.activeElement?.id) !== 'bulk-delete-start') throw new Error('Confirmation focus was not restored');
  await page.keyboard.press('Enter');
  await overlay.waitFor({ state: 'visible' });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  if (await overlay.isVisible()) throw new Error('Escape did not close bulk-delete confirmation');

  await list.evaluate(element => element.scrollTo({ left: element.scrollWidth, behavior: 'instant' }));
  await page.waitForTimeout(50);
  await drag(page, listBox.x + listBox.width - 24, listBox.x + listBox.width - 94, listBox.y + listBox.height / 2);
  await overlay.waitFor({ state: 'visible' });
  await page.getByRole('button', { name: 'Hapus', exact: true }).click();
  const remainingQueue = await page.evaluate(() => JSON.parse(localStorage.getItem('scan_queue')));
  if (remainingQueue.length !== 1 || remainingQueue[0].id !== 'pending-1') throw new Error('Bulk delete did not preserve pending history');

  await page.evaluate(() => {
    scanQueue.queue = [];
    scanQueue.render();
  });
  if (!await infoTrigger.isDisabled() || await breakdown.isVisible()) throw new Error('Empty history left the progress breakdown available');
  const emptyHistory = await page.locator('.queue-empty-state').evaluate(emptyState => ({
    icon: emptyState.querySelector('re-icon')?.getAttribute('icon'),
    text: emptyState.textContent.replace(/\s+/g, ' ').trim(),
    alignItems: getComputedStyle(emptyState).alignItems,
    textAlign: getComputedStyle(emptyState).textAlign,
  }));
  if (emptyHistory.icon !== 'qr' || emptyHistory.alignItems !== 'center' || emptyHistory.textAlign !== 'center' || !emptyHistory.text.includes('Pemindaian terbaru akan muncul di sini.')) {
    throw new Error(`Empty scan history is not centered with meaningful content: ${JSON.stringify(emptyHistory)}`);
  }

  await page.setViewportSize({ width: 320, height: 720 });
  if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw new Error('Scan history overflows at 320px');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(() => showToast('Reduced motion', 'info', { duration: 60000 }));
  const toastTransitionSeconds = await page.locator('.toast').first().evaluate(toast => parseFloat(getComputedStyle(toast).transitionDuration));
  if (toastTransitionSeconds > 0.02) throw new Error('Toast does not respect reduced motion');

  const profilePage = await context.newPage();
  await profilePage.route('**/api/classes', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ status: 'ok', classes: [{ code: 'TST', name: 'Test' }] })
  }));
  await profilePage.route('**/api/students?*', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ status: 'ok', students: [
      { studentId: '2026/TST/001', name: 'Dengan Foto', image: '/assets/favicon.png', status: 'active' },
      { studentId: '2026/TST/002', name: 'Tanpa Foto', image: '', status: 'active' }
    ] })
  }));
  await profilePage.goto(`${baseUrl}/profile`, { waitUntil: 'networkidle' });
  await profilePage.locator('#class-combobox-trigger').click();
  await profilePage.locator('#class-combobox-popover [role="option"]').click();
  await profilePage.locator('.student-accordion-item').first().waitFor();
  for (const selector of ['.student-thumb', '.student-thumb-placeholder']) {
    const radius = await profilePage.locator(selector).first().evaluate(element => getComputedStyle(element).borderRadius);
    if (radius !== '12px') throw new Error(`${selector} is not a squircle`);
  }
  await profilePage.evaluate(() => showToast('Profile toast', 'success', { duration: 60000 }));
  const profileToastTop = await profilePage.locator('#toast-container').evaluate(container => getComputedStyle(container).top);
  if (profileToastTop === 'auto') throw new Error('Profile did not use the shared top toast');

  console.log('scan history ui smoke ok');
} finally {
  await browser?.close();
  server.kill();
}

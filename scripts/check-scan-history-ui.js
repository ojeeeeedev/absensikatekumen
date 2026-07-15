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

async function dragVertical(page, x, startY, endY) {
  await page.mouse.move(x, startY);
  await page.mouse.down();
  await page.mouse.move(x, endY, { steps: 6 });
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
  if (photoGeometry.width !== 56 || photoGeometry.height !== 56 || photoGeometry.radius !== '8px') {
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
  const spinnerStates = await page.locator('#login-loader .app-spinner, .status-spinner').evaluateAll(spinners => spinners.map(spinner => ({
    color: getComputedStyle(spinner).color,
    stroke: getComputedStyle(spinner.shadowRoot.querySelector('svg')).stroke,
  })));
  if (spinnerStates.length !== 2 || spinnerStates.some(spinner => spinner.color !== spinner.stroke) || await page.locator('#history-sync-spinner, .grid-column-scan-loader').count()) {
    throw new Error(`Scan spinners were not replaced: ${JSON.stringify(spinnerStates)}`);
  }
  const loadingProgress = await page.locator('.segmented-progress-bar').evaluate(bar => ({
    busy: bar.getAttribute('aria-busy'),
    loading: bar.classList.contains('is-loading'),
    animation: getComputedStyle(bar, '::after').animationName,
  }));
  if (loadingProgress.busy !== 'true' || !loadingProgress.loading || loadingProgress.animation !== 'progressBreath') {
    throw new Error(`Progress bar does not show the loading state: ${JSON.stringify(loadingProgress)}`);
  }
  const visibleLegendItems = await page.locator('.progress-legend .legend-item').evaluateAll(items => items.filter(item => getComputedStyle(item).display !== 'none').length);
  if (!await page.locator('.progress-legend').isVisible() || visibleLegendItems !== 4 || await page.locator('#progress-info-trigger, #progress-breakdown').count()) {
    throw new Error('Inline progress details were not restored');
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
    return {
      rightInset: Math.round(card.right - hitTarget.right),
      topInset: Math.round(hitTarget.top - card.top),
      hitWidth: hitTarget.width,
      glyphFontSize: getComputedStyle(glyph).fontSize,
      glyphBackground: getComputedStyle(glyph).backgroundColor,
      statusRightInset: Math.round(card.right - status.right),
      statusBottomInset: Math.round(card.bottom - status.bottom),
      glyphAboveStatus: glyphRect.bottom < status.top,
      rightEdgeDelta: Math.round(glyphRect.right - status.right),
      glyphRightInset: Math.round(card.right - glyphRect.right),
      glyphTopInset: Math.round(glyphRect.top - card.top),
    };
  });
  if (dismissGeometry.rightInset !== 3 || dismissGeometry.topInset !== 1 || dismissGeometry.hitWidth !== 44 || dismissGeometry.glyphFontSize !== '16px' || dismissGeometry.glyphBackground !== 'rgba(0, 0, 0, 0)' || dismissGeometry.statusRightInset !== 13 || dismissGeometry.statusBottomInset !== 9 || !dismissGeometry.glyphAboveStatus || Math.abs(dismissGeometry.rightEdgeDelta) > 1 || dismissGeometry.glyphRightInset < 12 || dismissGeometry.glyphTopInset < 12) {
    throw new Error(`History card controls are not aligned vertically on the right: ${JSON.stringify(dismissGeometry)}`);
  }

  const mariaCard = page.locator('.queue-row').filter({ hasText: 'Maria' });
  const drawer = page.locator('#student-detail-modal');
  await mariaCard.click({ position: { x: 120, y: 36 } });
  const firstFrameBottom = await drawer.evaluate(modal => Math.round(innerHeight - modal.getBoundingClientRect().bottom));
  if (firstFrameBottom !== 0) throw new Error(`Student detail drawer was not bottom-anchored on first render: ${firstFrameBottom}`);
  await page.waitForTimeout(320);
  const drawerState = await drawer.evaluate(modal => {
    const drawerRect = modal.getBoundingClientRect();
    const sheet = modal.querySelector('.student-modal-content').getBoundingClientRect();
    const handle = modal.querySelector('.student-modal-swipe-handle').getBoundingClientRect();
    return {
      tag: modal.tagName,
      open: modal.open,
      active: modal.classList.contains('is-open'),
      drawerBottom: Math.round(innerHeight - drawerRect.bottom),
      sheetBottom: Math.round(innerHeight - sheet.bottom),
      handleWidth: handle.width,
      handleHeight: handle.height,
      closeButtons: modal.querySelectorAll('.student-modal-close').length,
      touchAction: getComputedStyle(modal.querySelector('[data-drawer-handle]')).touchAction,
      focused: document.activeElement?.id,
      transformY: new DOMMatrix(getComputedStyle(modal.querySelector('.student-modal-content')).transform).m42,
      backdrop: getComputedStyle(modal, '::backdrop').backgroundColor,
    };
  });
  if (drawerState.tag !== 'DIALOG' || !drawerState.open || !drawerState.active || drawerState.drawerBottom !== 0 || drawerState.sheetBottom !== 0 || drawerState.handleWidth !== 40 || drawerState.handleHeight !== 4 || drawerState.closeButtons !== 0 || drawerState.touchAction !== 'none' || drawerState.focused !== 'student-detail-modal' || Math.abs(drawerState.transformY) > 1 || drawerState.backdrop === 'rgba(0, 0, 0, 0)') {
    throw new Error(`Student detail drawer did not open correctly: ${JSON.stringify(drawerState)}`);
  }

  let handleBox = await page.locator('[data-drawer-handle]').boundingBox();
  await dragVertical(page, handleBox.x + handleBox.width / 2, handleBox.y + 12, handleBox.y + 28);
  await page.waitForTimeout(320);
  if (!await drawer.evaluate(modal => modal.open && Math.abs(new DOMMatrix(getComputedStyle(modal.querySelector('.student-modal-content')).transform).m42) < 1)) {
    throw new Error('Short drawer swipe did not snap back');
  }

  handleBox = await page.locator('[data-drawer-handle]').boundingBox();
  await dragVertical(page, handleBox.x + handleBox.width / 2, handleBox.y + 12, handleBox.y + 124);
  await page.waitForTimeout(320);
  if (await drawer.evaluate(modal => modal.open) || !await mariaCard.evaluate(card => card === document.activeElement)) {
    throw new Error('Long drawer swipe did not dismiss and restore focus');
  }

  await mariaCard.press('Enter');
  await page.waitForTimeout(50);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(320);
  if (await drawer.evaluate(modal => modal.open) || !await mariaCard.evaluate(card => card === document.activeElement)) {
    throw new Error('Escape did not close the drawer and restore focus');
  }

  await mariaCard.click({ position: { x: 120, y: 36 } });
  await page.waitForTimeout(50);
  await page.mouse.click(8, 8);
  await page.waitForTimeout(320);
  if (await drawer.evaluate(modal => modal.open)) throw new Error('Backdrop tap did not close the drawer');

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
    const card = document.querySelector('.queue-row').getBoundingClientRect();
    const footer = document.querySelector('.app-footer').getBoundingClientRect();
    const footerText = document.querySelector('.footer-text').getBoundingClientRect();
    const dotCenter = first.top + first.height / 2;
    return {
      gap: style.gap,
      trackHeight: container.getBoundingClientRect().height,
      hitHeight: first.height,
      centerDistance: Math.round((second.left + second.width / 2) - (first.left + first.width / 2)),
      historyGap: dotCenter - 3 - card.bottom,
      footerGap: footer.top - dotCenter - 3,
      footerTextGap: footerText.top - footer.top,
    };
  });
  if (dotSpacing.gap !== '0px' || dotSpacing.trackHeight !== 6 || dotSpacing.hitHeight !== 44 || dotSpacing.centerDistance !== 20 || Math.max(dotSpacing.historyGap, dotSpacing.footerGap, dotSpacing.footerTextGap) - Math.min(dotSpacing.historyGap, dotSpacing.footerGap, dotSpacing.footerTextGap) > 1) {
    throw new Error(`Carousel indicators are not compact: ${JSON.stringify(dotSpacing)}`);
  }
  await page.setViewportSize({ width: 390, height: 664 });
  const shortViewportLayout = await page.evaluate(() => {
    const rect = selector => document.querySelector(selector).getBoundingClientRect();
    const reader = rect('#reader-container');
    const panel = rect('#queue-history-panel');
    const topic = rect('#topic-combobox-active');
    const dots = rect('#carousel-dots');
    const footer = rect('.app-footer');
    const footerText = rect('.footer-text');
    const main = document.getElementById('main-app-section');
    return {
      readerWidth: reader.width,
      panelWidth: panel.width,
      topicWidth: topic.width,
      dotFooterGap: footer.top - dots.bottom,
      footerTextGap: footerText.top - footer.top,
      scrollable: main.scrollHeight > main.clientHeight,
    };
  });
  if (Math.abs(shortViewportLayout.readerWidth - 216.3125) >= 1 || Math.abs(shortViewportLayout.panelWidth - shortViewportLayout.topicWidth) >= 1 || Math.abs(shortViewportLayout.dotFooterGap - shortViewportLayout.footerTextGap) >= 1 || shortViewportLayout.scrollable) {
    throw new Error(`Short scan layout does not reclaim the footer gap: ${JSON.stringify(shortViewportLayout)}`);
  }
  await page.setViewportSize({ width: 390, height: 700 });
  const tallShortLayout = await page.evaluate(() => {
    const rect = selector => document.querySelector(selector).getBoundingClientRect();
    const reader = rect('#reader-container');
    const dots = rect('#carousel-dots');
    const footer = rect('.app-footer');
    const footerText = rect('.footer-text');
    const main = document.getElementById('main-app-section');
    return {
      readerWidth: reader.width,
      dotFooterGap: footer.top - dots.bottom,
      footerTextGap: footerText.top - footer.top,
      scrollable: main.scrollHeight > main.clientHeight,
    };
  });
  if (Math.abs(tallShortLayout.readerWidth - 252) >= 1 || Math.abs(tallShortLayout.dotFooterGap - tallShortLayout.footerTextGap) >= 1 || tallShortLayout.scrollable) {
    throw new Error(`Tall short scan layout does not reclaim the footer gap: ${JSON.stringify(tallShortLayout)}`);
  }
  await page.setViewportSize({ width: 390, height: 844 });
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

  await page.mouse.move(1, 1);
  await page.evaluate(() => {
    document.activeElement?.blur();
    for (let index = 1; index <= 5; index += 1) showToast(`Toast ${index}`, 'info', { duration: 60000 });
  });
  await page.waitForTimeout(350);
  const toastState = await page.locator('#toast-container').evaluate(container => ({
    count: container.children.length,
    newest: container.lastElementChild?.textContent,
    bottom: getComputedStyle(container).bottom,
    bottomGap: innerHeight - container.getBoundingClientRect().bottom,
    dismissButtons: container.querySelectorAll('.toast-dismiss[aria-label="Tutup notifikasi"]').length,
    backdropFilter: getComputedStyle(container.lastElementChild).backdropFilter,
    backgroundAlpha: (() => {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 1;
      const context = canvas.getContext('2d');
      context.fillStyle = getComputedStyle(container.lastElementChild).backgroundColor;
      context.fillRect(0, 0, 1, 1);
      return context.getImageData(0, 0, 1, 1).data[3] / 255;
    })(),
    newestScale: new DOMMatrix(getComputedStyle(container.lastElementChild).transform).a,
    previousScale: new DOMMatrix(getComputedStyle(container.children[container.children.length - 2]).transform).a,
    collapsedOverlap: container.children[container.children.length - 2].getBoundingClientRect().bottom
      > container.lastElementChild.getBoundingClientRect().top,
  }));
  if (toastState.count !== 4 || !toastState.newest.includes('Toast 5') || toastState.bottom === 'auto' || toastState.bottomGap < 15 || toastState.bottomGap > 24 || toastState.dismissButtons !== 4 || toastState.backdropFilter === 'none' || toastState.backgroundAlpha < 0.65 || toastState.backgroundAlpha > 0.75 || Math.abs(toastState.newestScale - 1) > 0.01 || toastState.previousScale >= toastState.newestScale || !toastState.collapsedOverlap) {
    throw new Error(`Toast stack is incorrect: ${JSON.stringify(toastState)}`);
  }
  await page.locator('.toast').last().locator('.toast-dismiss').focus();
  await page.waitForTimeout(300);
  const toastExpanded = await page.locator('#toast-container').evaluate(container => {
    const newest = container.lastElementChild.getBoundingClientRect();
    const previous = container.children[container.children.length - 2].getBoundingClientRect();
    return previous.bottom < newest.top;
  });
  if (!toastExpanded) throw new Error('Toast stack did not expand on keyboard focus');
  await page.locator('.toast').last().locator('.toast-dismiss').click();
  await page.waitForTimeout(300);
  if (await page.locator('.toast').count() !== 3) throw new Error('Toast dismiss button did not remove the notification');
  await page.mouse.move(1, 1);
  await page.waitForTimeout(300);

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
  if (await page.locator('.segmented-progress-bar').getAttribute('aria-busy') !== 'false' || await page.locator('.segmented-progress-bar').evaluate(bar => bar.classList.contains('is-loading'))) {
    throw new Error('Progress bar loading state persisted after the queue emptied');
  }
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
  await page.evaluate(() => showStudentModal({ studentId: '2026/TST/010', week: '0', status: 'success', name: 'Reduced Motion', image: '' }));
  await page.waitForTimeout(30);
  const drawerTransitionSeconds = await drawer.evaluate(modal => parseFloat(getComputedStyle(modal.querySelector('.student-modal-content')).transitionDuration));
  await page.keyboard.press('Escape');
  await page.waitForTimeout(30);
  if (drawerTransitionSeconds > 0.02 || await drawer.evaluate(modal => modal.open)) throw new Error('Drawer does not respect reduced motion');
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
    if (radius !== '8px') throw new Error(`${selector} does not align with its card corners`);
  }
  await profilePage.evaluate(() => showToast('Profile toast', 'success', { duration: 60000 }));
  const profileToastBottom = await profilePage.locator('#toast-container').evaluate(container => getComputedStyle(container).bottom);
  if (profileToastBottom === 'auto') throw new Error('Profile did not use the shared bottom toast');

  console.log('scan history ui smoke ok');
} finally {
  await browser?.close();
  server.kill();
}

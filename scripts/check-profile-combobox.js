import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const port = 5600 + process.pid % 1000;
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

let browser;
try {
  await waitForServer();
  const legacyProfileResponse = await fetch(`${baseUrl}/profile.html`, { redirect: 'manual' });
  if (legacyProfileResponse.status !== 308 || legacyProfileResponse.headers.get('location') !== '/profile') {
    throw new Error('Legacy profile route did not redirect to /profile');
  }
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.addCookies([{ name: 'auth_token', value: 'preview', domain: '127.0.0.1', path: '/' }]);
  await context.addInitScript(() => {
    sessionStorage.setItem('authToken', 'preview');
    localStorage.setItem('hasSeenOnboardingV2', 'true');
  });
  const page = await context.newPage();
  await page.route('**/api/classes', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ status: 'ok', classes: [
      { code: 'SAB', name: 'Sabtu Pagi' },
      { code: 'MAL', name: 'Malam' }
    ] })
  }));
  await page.route('**/api/students?*', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ status: 'ok', students: Array.from({ length: 16 }, (_, index) => ({
      studentId: `2026/MAL/${String(index + 1).padStart(3, '0')}`,
      name: `Katekumen ${index + 1}`,
      image: '',
      status: 'active'
    })) })
  }));

  await page.goto(`${baseUrl}/profile`, { waitUntil: 'networkidle' });
  const navbarHandle = await page.locator('#app-nav').elementHandle();
  const headerHandle = await page.locator('#app-shell-header').elementHandle();
  const initialShell = await page.evaluate(() => ({
    navTop: document.getElementById('app-nav').getBoundingClientRect().top,
    header: document.getElementById('app-shell-header').getBoundingClientRect().toJSON(),
    logoLeft: document.querySelector('#app-shell-header .header-logo').getBoundingClientRect().left,
    textLeft: document.querySelector('#app-shell-header .header-text').getBoundingClientRect().left,
    headerGroupCenterOffset: Math.abs(
      (document.querySelector('#app-shell-header .header-logo').getBoundingClientRect().left
        + document.querySelector('#app-shell-header .header-text').getBoundingClientRect().right) / 2
      - (document.getElementById('app-shell-header').getBoundingClientRect().left
        + document.getElementById('app-shell-header').getBoundingClientRect().right) / 2
    ),
    headerVerticalGapDelta: (() => {
      const container = document.getElementById('app-container').getBoundingClientRect();
      const header = document.getElementById('app-shell-header').getBoundingClientRect();
      const logo = document.querySelector('#app-shell-header .header-logo').getBoundingClientRect();
      const text = document.querySelector('#app-shell-header .header-text').getBoundingClientRect();
      const contentTop = Math.min(logo.top, text.top);
      const contentBottom = Math.max(logo.bottom, text.bottom);
      return Math.abs((contentTop - container.top) - (header.bottom - contentBottom));
    })(),
    heading: document.getElementById('app-view-title').textContent,
    supportingText: [...document.querySelectorAll('#app-shell-header :is(h2, h3)')].map(element => element.textContent),
    supportingLineHeight: document.querySelector('#app-shell-header h2').getBoundingClientRect().height,
    tabTrackRadius: getComputedStyle(document.querySelector('.nav-tabs')).borderRadius,
    tabPillRadius: getComputedStyle(document.querySelector('.nav-tabs'), '::before').borderRadius,
    tabPillOffset: new DOMMatrix(getComputedStyle(document.querySelector('.nav-tabs'), '::before').transform).m41,
    tabBounds: (() => {
      const track = document.querySelector('.nav-tabs').getBoundingClientRect();
      const tabs = [...document.querySelectorAll('.nav-tabs .nav-item')].map(tab => tab.getBoundingClientRect());
      return {
        trackHeight: track.height,
        heights: tabs.map(tab => tab.height),
        widths: tabs.map(tab => tab.width),
        topInsets: tabs.map(tab => tab.top - track.top),
        bottomInsets: tabs.map(tab => track.bottom - tab.bottom),
        edgeInsets: [tabs[0].left - track.left, track.right - tabs[1].right]
      };
    })(),
    tabAlignment: [...document.querySelectorAll('.nav-tabs .nav-item')].map(tab => {
      const tabRect = tab.getBoundingClientRect();
      const iconRect = tab.querySelector('re-icon').getBoundingClientRect();
      const labelRect = tab.querySelector('span').getBoundingClientRect();
      return {
        iconWidth: iconRect.width,
        iconHeight: iconRect.height,
        baselineOffset: Math.abs((iconRect.top + iconRect.bottom) / 2 - (labelRect.top + labelRect.bottom) / 2),
        centerOffset: Math.abs((iconRect.left + labelRect.right) / 2 - (tabRect.left + tabRect.right) / 2)
      };
    }),
    containerHeight: document.getElementById('app-container').getBoundingClientRect().height,
    emptyBottomGap: document.getElementById('app-container').getBoundingClientRect().bottom
      - document.querySelector('#profile-view .welcome-placeholder').getBoundingClientRect().bottom,
    profileActive: !document.getElementById('profile-view').hidden,
    scanHidden: document.getElementById('main-app-section').hidden,
    activeNav: document.querySelector('[aria-current="page"]')?.dataset.appView
  }));
  const tabsAligned = initialShell.tabAlignment.every(tab => tab.iconWidth === 20 && tab.iconHeight === 20 && tab.baselineOffset < 1 && tab.centerOffset < 1);
  const tabBoundsAligned = initialShell.tabBounds.heights.every(height => height < initialShell.tabBounds.trackHeight)
    && Math.abs(initialShell.tabBounds.heights[0] - initialShell.tabBounds.heights[1]) < 1
    && Math.abs(initialShell.tabBounds.widths[0] - initialShell.tabBounds.widths[1]) < 1
    && initialShell.tabBounds.topInsets.every((inset, index) => Math.abs(inset - initialShell.tabBounds.bottomInsets[index]) < 1)
    && Math.abs(initialShell.tabBounds.edgeInsets[0] - initialShell.tabBounds.edgeInsets[1]) < 1;
  if (!initialShell.profileActive || !initialShell.scanHidden || initialShell.activeNav !== 'profile' || initialShell.tabTrackRadius !== '16px' || initialShell.tabPillRadius !== '12px' || initialShell.tabPillOffset <= 0 || initialShell.headerGroupCenterOffset >= 1 || initialShell.headerVerticalGapDelta >= 1 || !tabsAligned || !tabBoundsAligned || initialShell.supportingText.join('|') !== 'Katekumen Dewasa - Paroki Katedral St. Petrus|Keuskupan Bandung' || initialShell.supportingLineHeight > 16) {
    throw new Error(`Direct profile route did not activate the profile view: ${JSON.stringify(initialShell)}`);
  }
  if (initialShell.emptyBottomGap > 22) {
    throw new Error(`Compact profile left excess space below its empty state: ${JSON.stringify(initialShell)}`);
  }
  const compactResize = await page.evaluate(async () => {
    const navigation = window.navigateToAppView('scan');
    const opacitySamples = [];
    for (let index = 0; index < 8; index += 1) {
      await new Promise(resolve => setTimeout(resolve, 20));
      opacitySamples.push(Number(getComputedStyle(document.getElementById('main-app-section')).opacity));
    }
    await navigation;
    const animation = document.getElementById('app-container').getAnimations().find(candidate =>
      candidate.effect.getKeyframes().some(frame => frame.height)
    );
    if (!animation) return null;
    const [from, to] = animation.effect.getKeyframes();
    await animation.finished;
    return { from: parseFloat(from.height), to: parseFloat(to.height), opacitySamples };
  });
  const opacityRestarted = compactResize?.opacitySamples.some((opacity, index, samples) => index > 0 && opacity + 0.01 < samples[index - 1]);
  if (!compactResize || compactResize.to <= compactResize.from || opacityRestarted) {
    throw new Error(`Main container did not animate from compact Profile to Scan: ${JSON.stringify(compactResize)}`);
  }
  await page.evaluate(async () => {
    await window.navigateToAppView('profile');
    await Promise.all(document.getElementById('app-container').getAnimations().map(animation => animation.finished));
  });
  const profileSpinners = page.locator('#students-loader .app-spinner, #upload-preview-modal .app-spinner');
  const profileSpinnerColors = await profileSpinners.first().evaluate(spinner => {
    const light = getComputedStyle(spinner).color;
    document.documentElement.setAttribute('data-theme', 'dark');
    const dark = getComputedStyle(spinner).color;
    const stroke = getComputedStyle(spinner.shadowRoot.querySelector('svg')).stroke;
    document.documentElement.setAttribute('data-theme', 'light');
    return { light, dark, stroke };
  });
  const profileSpinnerCount = await profileSpinners.count();
  const legacyProfileSpinnerCount = await page.locator('#profile-view .grid-column-scan-loader, #upload-preview-modal .grid-column-scan-loader').count();
  if (profileSpinnerCount !== 2 || profileSpinnerColors.light === profileSpinnerColors.dark || profileSpinnerColors.dark !== profileSpinnerColors.stroke || legacyProfileSpinnerCount) {
    throw new Error(`Profile spinners do not follow the theme: ${JSON.stringify({ ...profileSpinnerColors, profileSpinnerCount, legacyProfileSpinnerCount })}`);
  }
  const profileSpacing = await page.evaluate(() => {
    const header = document.getElementById('app-shell-header').getBoundingClientRect();
    const container = document.querySelector('#profile-view .profile-selector-container').getBoundingClientRect();
    const root = document.getElementById('class-combobox').getBoundingClientRect();
    const triggerElement = document.getElementById('class-combobox-trigger');
    const trigger = triggerElement.getBoundingClientRect();
    const placeholder = document.querySelector('#profile-view .welcome-placeholder').getBoundingClientRect();
    return {
      above: trigger.top - header.bottom,
      below: placeholder.top - trigger.bottom,
      pickerWidth: root.width,
      sideClearance: (container.width - root.width) / 2,
      animationName: getComputedStyle(triggerElement).animationName,
    };
  });
  if (Math.abs(profileSpacing.above - profileSpacing.below) >= 1 || profileSpacing.animationName === 'none') {
    throw new Error(`Profile selector spacing is not uniform: ${JSON.stringify(profileSpacing)}`);
  }
  await page.locator('#class-combobox-trigger').click();
  await page.locator('#class-combobox-search').fill('mal');
  const options = await page.locator('#class-combobox-options [role="option"]').allTextContents();
  if (options.length !== 1 || !options[0].includes('Malam')) throw new Error('Class filtering failed');
  await page.locator('#class-combobox-search').press('ArrowDown');
  await page.keyboard.press('Enter');
  const selectedClass = await page.locator('#class-selector').inputValue();
  if (selectedClass !== 'MAL') {
    const activeElement = await page.evaluate(() => ({ id: document.activeElement?.id, text: document.activeElement?.textContent }));
    throw new Error(`Class selection failed: ${JSON.stringify({ selectedClass, activeElement })}`);
  }
  if (await page.locator('#class-combobox-trigger').getAttribute('aria-expanded') !== 'false') throw new Error('Combobox did not close');
  if (await page.locator('#class-combobox-trigger').evaluate(trigger => getComputedStyle(trigger).animationName) !== 'none') throw new Error('Selected class trigger is still glowing');
  await page.waitForFunction(() => document.querySelectorAll('.student-accordion-item').length === 16);
  const expandedShell = await page.evaluate(() => {
    const nav = document.getElementById('app-nav').getBoundingClientRect();
    const container = document.getElementById('app-container').getBoundingClientRect();
    const profile = document.getElementById('profile-view');
    return {
      navTop: nav.top,
      containerHeight: container.height,
      expanded: document.getElementById('app-container').classList.contains('profile-expanded'),
      scrollable: profile.scrollHeight > profile.clientHeight
    };
  });
  if (!expandedShell.expanded || !expandedShell.scrollable || expandedShell.containerHeight <= initialShell.containerHeight || Math.abs(expandedShell.navTop - initialShell.navTop) >= 1) {
    throw new Error(`Profile shell did not grow below the anchored navbar: ${JSON.stringify({ initialShell, expandedShell })}`);
  }

  await page.locator('[data-app-view="scan"]').click();
  await page.waitForURL(`${baseUrl}/`);
  await page.locator('[data-app-view="profile"]').click();
  await page.waitForURL(`${baseUrl}/profile`);
  await page.waitForFunction(() => document.activeElement?.id === 'app-view-title');
  await page.waitForFunction(() => getComputedStyle(document.getElementById('app-view-title')).opacity === '1');
  const persistentShell = await navbarHandle.evaluate(navbar => ({
    sameNode: navbar === document.getElementById('app-nav'),
    navTop: navbar.getBoundingClientRect().top,
    selectedClass: document.getElementById('class-selector').value
  }));
  if (!persistentShell.sameNode || persistentShell.selectedClass !== 'MAL' || Math.abs(persistentShell.navTop - initialShell.navTop) >= 1) {
    throw new Error(`Tab navigation replaced or moved persistent state: ${JSON.stringify(persistentShell)}`);
  }
  const persistentHeader = await headerHandle.evaluate((header, initial) => ({
    sameNode: header === document.getElementById('app-shell-header'),
    rect: header.getBoundingClientRect().toJSON(),
    heading: document.getElementById('app-view-title').textContent,
    titleOutline: getComputedStyle(document.getElementById('app-view-title')).outlineStyle,
    logoLeft: header.querySelector('.header-logo').getBoundingClientRect().left,
    textLeft: header.querySelector('.header-text').getBoundingClientRect().left,
    animated: document.getElementById('profile-view').getAnimations().length > 0
  }), initialShell.header);
  if (!persistentHeader.sameNode || persistentHeader.heading !== 'Profil Katekumen' || persistentHeader.titleOutline !== 'none' || !persistentHeader.animated || Math.abs(persistentHeader.rect.x - initialShell.header.x) >= 1 || Math.abs(persistentHeader.rect.width - initialShell.header.width) >= 1 || Math.abs(persistentHeader.rect.height - initialShell.header.height) >= 1 || Math.abs(persistentHeader.logoLeft - initialShell.logoLeft) >= 1 || Math.abs(persistentHeader.textLeft - initialShell.textLeft) >= 1) {
    throw new Error(`Shared header shifted or failed to animate: ${JSON.stringify({ initial: initialShell.header, current: persistentHeader })}`);
  }

  await page.goBack();
  await page.waitForURL(`${baseUrl}/`);
  await page.goForward();
  await page.waitForURL(`${baseUrl}/profile`);
  if (await page.locator('#class-selector').inputValue() !== 'MAL') throw new Error('Browser history lost profile state');

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.locator('[data-app-view="scan"]').click();
  await page.waitForURL(`${baseUrl}/`);
  const reducedMotionAnimations = await page.evaluate(() =>
    document.getElementById('app-view-title').getAnimations().length
    + document.getElementById('main-app-section').getAnimations().length
    + document.getElementById('app-container').getAnimations().length
  );
  if (reducedMotionAnimations !== 0) throw new Error('Reduced-motion navigation still animated');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.evaluate(() => {
    window.__scannerLifecycle = { starts: 0, stops: 0 };
    window.Html5Qrcode = class {
      start() {
        window.__scannerLifecycle.starts += 1;
        return Promise.resolve();
      }
      stop() {
        window.__scannerLifecycle.stops += 1;
        return Promise.resolve();
      }
    };
    window.selectTopic('1', 'Perkenalan');
  });
  await page.waitForFunction(() => window.__scannerLifecycle.starts === 1);
  await page.locator('[data-app-view="profile"]').click();
  await page.waitForFunction(() => window.__scannerLifecycle.stops === 1);
  await page.locator('[data-app-view="scan"]').click();
  await page.waitForFunction(() => window.__scannerLifecycle.starts === 2);
  await page.locator('[data-app-view="profile"]').click();
  await page.waitForURL(`${baseUrl}/profile`);
  await page.evaluate(() => Promise.all([
    window.navigateToAppView('scan'),
    window.navigateToAppView('profile'),
    window.navigateToAppView('scan'),
    window.navigateToAppView('profile')
  ]));
  const rapidNavigation = await page.evaluate(() => ({
    ...window.__scannerLifecycle,
    activeView: document.querySelector('[aria-current="page"]')?.dataset.appView,
    profileHidden: document.getElementById('profile-view').hidden
  }));
  if (rapidNavigation.starts !== 4 || rapidNavigation.stops !== 4 || rapidNavigation.activeView !== 'profile' || rapidNavigation.profileHidden) {
    throw new Error(`Rapid navigation broke scanner lifecycle: ${JSON.stringify(rapidNavigation)}`);
  }
  const classTriggerHeight = await page.locator('#class-combobox-trigger').evaluate(trigger => trigger.getBoundingClientRect().height);
  await page.locator('#class-combobox-trigger').click();
  const classSelectedBackground = await page.locator('#class-combobox-popover [aria-selected="true"]').evaluate(option => getComputedStyle(option).backgroundColor);
  await page.locator('#class-combobox-search').press('Escape');

  const scanPage = await context.newPage();
  await scanPage.goto(baseUrl, { waitUntil: 'networkidle' });
  await scanPage.evaluate(() => window.setAppState(1));
  await scanPage.locator('#topic-trigger-large').click();
  const largeTopicPopover = scanPage.locator('#topic-combobox-large-popover');
  await largeTopicPopover.locator('.search-combobox-search').fill('Perkenalan');
  if (await largeTopicPopover.locator('[role="option"]').count() !== 1) throw new Error('Large topic combobox filtering failed');
  await largeTopicPopover.locator('.search-combobox-search').press('Escape');
  await scanPage.evaluate(() => window.setAppState(2));
  await scanPage.locator('#topic-combobox-trigger').click();
  const topicPopover = scanPage.locator('#topic-combobox-popover');
  const firstTopic = topicPopover.locator('[role="option"]').first();
  const idleBackground = await firstTopic.evaluate(option => getComputedStyle(option).backgroundColor);
  await firstTopic.hover();
  const hoverBackground = await firstTopic.evaluate(option => getComputedStyle(option).backgroundColor);
  if (idleBackground === hoverBackground) throw new Error('Topic hover container is missing');
  const regularBorder = await firstTopic.evaluate(option => getComputedStyle(option).borderTopColor);
  const specialBorders = [];
  for (const className of ['topic-option-ki', 'topic-option-p', 'topic-option-r']) {
    const option = topicPopover.locator(`.${className}`).first();
    const idleBorder = await option.evaluate(item => getComputedStyle(item).borderTopColor);
    const borderStyle = await option.evaluate(item => {
      const style = getComputedStyle(item);
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 1;
      const context = canvas.getContext('2d');
      context.fillStyle = style.borderTopColor;
      context.fillRect(0, 0, 1, 1);
      return { width: style.borderTopWidth, alpha: context.getImageData(0, 0, 1, 1).data[3] / 255 };
    });
    const specialIdleBackground = await option.evaluate(item => getComputedStyle(item).backgroundColor);
    await option.hover();
    const specialHoverBackground = await option.evaluate(item => getComputedStyle(item).backgroundColor);
    if (idleBorder === regularBorder || specialIdleBackground === idleBackground || borderStyle.width !== '1px' || borderStyle.alpha < 0.7 || borderStyle.alpha > 0.74) throw new Error(`${className} persistent style is missing`);
    if (specialIdleBackground === specialHoverBackground) throw new Error(`${className} hover state is missing`);
    specialBorders.push(idleBorder);
  }
  if (new Set(specialBorders).size !== 3) throw new Error('Special topic border colors are not distinct');
  const pOption = topicPopover.locator('.topic-option-p').first();
  const pIdleBackground = await pOption.evaluate(option => getComputedStyle(option).backgroundColor);
  await pOption.click();
  if (await scanPage.locator('#topic-combobox-trigger').evaluate(trigger => getComputedStyle(trigger).animationName) !== 'none') throw new Error('Selected topic trigger is still glowing');
  await scanPage.locator('#topic-combobox-trigger').click();
  const selectedP = topicPopover.locator('.topic-option-p[aria-selected="true"]');
  if (await selectedP.evaluate(option => getComputedStyle(option).backgroundColor) === pIdleBackground) throw new Error('Selected P topic fill is missing');
  const topicLayout = await scanPage.evaluate(() => {
    const header = document.getElementById('app-shell-header').getBoundingClientRect();
    const root = document.getElementById('topic-combobox-active').getBoundingClientRect();
    const panel = document.getElementById('scanning-panel').getBoundingClientRect();
    const triggerElement = document.getElementById('topic-combobox-trigger');
    const trigger = triggerElement.getBoundingClientRect();
    const reader = document.getElementById('reader-container').getBoundingClientRect();
    const progress = document.querySelector('.segmented-progress-bar').getBoundingClientRect();
    const options = document.querySelector('#topic-combobox-popover .search-combobox-options').getBoundingClientRect();
    let topGlowClearance = Infinity;
    for (let ancestor = triggerElement.parentElement; ancestor; ancestor = ancestor.parentElement) {
      if (/hidden|clip|auto|scroll/.test(getComputedStyle(ancestor).overflowY)) {
        topGlowClearance = Math.min(topGlowClearance, trigger.top - ancestor.getBoundingClientRect().top);
      }
    }
    return {
      contained: root.left >= panel.left - 1 && root.right <= panel.right + 1,
      pickerWidth: root.width,
      sideClearance: root.left - panel.left,
      centered: Math.abs((root.left + root.right) / 2 - (panel.left + panel.right) / 2) < 1,
      above: trigger.top - header.bottom,
      below: reader.top - trigger.bottom,
      scannerBottomGap: progress.top - reader.bottom,
      triggerHeight: trigger.height,
      progressWidth: progress.width,
      optionsHeight: options.height,
      animationName: getComputedStyle(triggerElement).animationName,
      topGlowClearance,
    };
  });
  const matchesProfileHeight = Math.abs(topicLayout.triggerHeight - classTriggerHeight) < 1;
  const matchesProfileWidth = Math.abs(topicLayout.pickerWidth - profileSpacing.pickerWidth) < 1;
  const matchesProgressWidth = Math.abs(topicLayout.progressWidth - topicLayout.pickerWidth) < 1;
  const matchesProfileClearance = Math.abs(topicLayout.sideClearance - profileSpacing.sideClearance) < 1;
  const selectedTopicIsStatic = topicLayout.animationName === 'none';
  const hasUniformSpacing = Math.abs(topicLayout.above - topicLayout.below) < 1;
  const hasUniformScannerSpacing = Math.abs(topicLayout.below - topicLayout.scannerBottomGap) < 1;
  if (!topicLayout.contained || !topicLayout.centered || !matchesProfileHeight || !matchesProfileWidth || !matchesProgressWidth || !matchesProfileClearance || !selectedTopicIsStatic || !hasUniformSpacing || !hasUniformScannerSpacing || topicLayout.topGlowClearance < 8 || topicLayout.optionsHeight < 330) {
    throw new Error(`Topic combobox layout does not match the profile selector: ${JSON.stringify(topicLayout)}`);
  }
  await topicPopover.locator('.search-combobox-search').fill('Pentakosta');
  const topics = await topicPopover.locator('[role="option"]').allTextContents();
  if (topics.length !== 1 || !topics[0].includes('Pentakosta')) throw new Error('Topic filtering failed');
  await topicPopover.locator('[role="option"]').click();
  if (await scanPage.evaluate(() => localStorage.getItem('selectedWeek')) !== '29') throw new Error('Topic selection failed');
  if (!await scanPage.locator('#active-topic-name').textContent().then(text => text.includes('Pentakosta'))) throw new Error('Topic label did not sync');
  if (await scanPage.locator('#topic-combobox-trigger').getAttribute('aria-expanded') !== 'false') throw new Error('Topic combobox did not close');
  await scanPage.reload({ waitUntil: 'networkidle' });
  if (!await scanPage.locator('#active-topic-name').textContent().then(text => text.includes('Pentakosta'))) throw new Error('Saved topic did not restore');
  await scanPage.locator('#topic-combobox-trigger').click();
  const selectedTopic = scanPage.locator('#topic-combobox-popover [role="option"][aria-selected="true"]');
  if (!await selectedTopic.textContent().then(text => text.includes('Pentakosta'))) throw new Error('Selected topic was not marked');
  if (await selectedTopic.evaluate(option => getComputedStyle(option).backgroundColor) !== classSelectedBackground) throw new Error('Topic selected container does not match the class picker');
  await Promise.all([
    page.setViewportSize({ width: 1280, height: 844 }),
    scanPage.setViewportSize({ width: 1280, height: 844 }),
  ]);
  await Promise.all([
    page.reload({ waitUntil: 'networkidle' }),
    scanPage.reload({ waitUntil: 'networkidle' }),
  ]);
  await scanPage.evaluate(() => window.setAppState(2));
  const [classSize, topicSize, progressWidth] = await Promise.all([
    page.locator('#class-combobox-trigger').evaluate(trigger => ({ width: trigger.offsetWidth, height: trigger.offsetHeight })),
    scanPage.locator('#topic-combobox-trigger').evaluate(trigger => ({ width: trigger.offsetWidth, height: trigger.offsetHeight })),
    scanPage.locator('.segmented-progress-bar').evaluate(progress => progress.offsetWidth),
  ]);
  if (JSON.stringify(classSize) !== JSON.stringify(topicSize) || classSize.width !== 378 || classSize.height !== 44 || progressWidth !== 378) {
    throw new Error(`Desktop picker geometry mismatch: ${JSON.stringify({ classSize, topicSize, progressWidth })}`);
  }
  console.log('search combobox smoke ok');
} finally {
  await browser?.close();
  server.kill();
}

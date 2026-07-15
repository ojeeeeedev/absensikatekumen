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
    const addEventListener = EventTarget.prototype.addEventListener;
    window.__profileScrollListeners = 0;
    EventTarget.prototype.addEventListener = function(type, listener, options) {
      if (type === 'scroll' && this instanceof Element && this.id === 'profile-view') window.__profileScrollListeners += 1;
      return addEventListener.call(this, type, listener, options);
    };
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
    body: JSON.stringify({ status: 'ok', students: Array.from({ length: 35 }, (_, index) => ({
      studentId: `2026/MAL/${String(index + 1).padStart(3, '0')}`,
      name: `Katekumen ${index + 1}`,
      image: '',
      kelasKi: index < 31 ? 'active' : 'inactive'
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
    supportingFontSizes: [...document.querySelectorAll('#app-shell-header :is(h2, h3)')].map(element => getComputedStyle(element).fontSize),
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
    containerBottomGap: innerHeight - document.getElementById('app-container').getBoundingClientRect().bottom,
    bodyPaddingBottom: parseFloat(getComputedStyle(document.body).paddingBottom),
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
  if (!initialShell.profileActive || !initialShell.scanHidden || initialShell.activeNav !== 'profile' || initialShell.tabTrackRadius !== '16px' || initialShell.tabPillRadius !== '12px' || initialShell.tabPillOffset <= 0 || initialShell.headerGroupCenterOffset >= 1 || initialShell.headerVerticalGapDelta >= 1 || !tabsAligned || !tabBoundsAligned || initialShell.supportingText.join('|') !== 'Katekumen Dewasa - Paroki St. Petrus|Keuskupan Bandung' || new Set(initialShell.supportingFontSizes).size !== 1 || initialShell.supportingLineHeight > 16) {
    throw new Error(`Direct profile route did not activate the profile view: ${JSON.stringify(initialShell)}`);
  }
  if (Math.abs(initialShell.containerBottomGap - initialShell.bodyPaddingBottom) >= 1) {
    throw new Error(`Profile shell does not fill the visible viewport: ${JSON.stringify(initialShell)}`);
  }
  const compactResize = await page.evaluate(async () => {
    const container = document.getElementById('app-container');
    const fromHeight = container.getBoundingClientRect().height;
    const navigation = window.navigateToAppView('scan');
    const opacitySamples = [];
    for (let index = 0; index < 8; index += 1) {
      await new Promise(resolve => setTimeout(resolve, 20));
      opacitySamples.push(Number(getComputedStyle(document.getElementById('main-app-section')).opacity));
    }
    await navigation;
    const animation = container.getAnimations().find(candidate =>
      candidate.effect.getKeyframes().some(frame => frame.height)
    );
    return { from: fromHeight, to: container.getBoundingClientRect().height, heightAnimation: Boolean(animation), opacitySamples };
  });
  const opacityRestarted = compactResize.opacitySamples.some((opacity, index, samples) => index > 0 && opacity + 0.01 < samples[index - 1]);
  if (Math.abs(compactResize.to - compactResize.from) >= 1 || compactResize.heightAnimation || opacityRestarted) {
    throw new Error(`Full-height shell shifted while navigating from Profile to Scan: ${JSON.stringify(compactResize)}`);
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
    const list = document.getElementById('students-list').getBoundingClientRect();
    const placeholderStyle = getComputedStyle(document.querySelector('#profile-view .welcome-placeholder'));
    return {
      above: trigger.top - header.bottom,
      selectorTop: container.top,
      triggerTop: trigger.top,
      centerDelta: Math.abs((placeholder.top + placeholder.bottom) / 2 - (list.top + list.bottom) / 2),
      placeholderBackground: placeholderStyle.backgroundColor,
      placeholderBorder: placeholderStyle.borderTopWidth,
      placeholderShadow: placeholderStyle.boxShadow,
      pickerWidth: root.width,
      sideClearance: (container.width - root.width) / 2,
      animationName: getComputedStyle(triggerElement).animationName,
    };
  });
  if (profileSpacing.centerDelta >= 1 || profileSpacing.placeholderBackground !== 'rgba(0, 0, 0, 0)' || profileSpacing.placeholderBorder !== '0px' || profileSpacing.placeholderShadow !== 'none' || profileSpacing.animationName === 'none') {
    throw new Error(`Profile empty state is not centered and unboxed: ${JSON.stringify(profileSpacing)}`);
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
  await page.waitForFunction(() => document.querySelectorAll('.student-accordion-item').length === 35);
  const expandedShell = await page.evaluate(() => {
    const nav = document.getElementById('app-nav').getBoundingClientRect();
    const container = document.getElementById('app-container').getBoundingClientRect();
    const profile = document.getElementById('profile-view');
    return {
      navTop: nav.top,
      containerHeight: container.height,
      triggerTop: document.getElementById('class-combobox-trigger').getBoundingClientRect().top,
      expanded: document.getElementById('app-container').classList.contains('profile-expanded'),
      scrollable: profile.scrollHeight > profile.clientHeight
    };
  });
  if (!expandedShell.expanded || !expandedShell.scrollable || Math.abs(expandedShell.containerHeight - initialShell.containerHeight) >= 1 || Math.abs(expandedShell.navTop - initialShell.navTop) >= 1 || Math.abs(expandedShell.triggerTop - profileSpacing.triggerTop) >= 1) {
    throw new Error(`Profile shell did not preserve the full-height viewport layout: ${JSON.stringify({ initialShell, expandedShell })}`);
  }

  const stickyProfileHeader = await page.evaluate(async () => {
    const profile = document.getElementById('profile-view');
    const selectorElement = document.querySelector('#profile-view .profile-selector-container');
    const summaryElement = document.getElementById('students-summary');
    const restingHeight = selectorElement.getBoundingClientRect().height;
    const samples = [];
    for (const scrollTop of [0, 6, 12, 24, 100]) {
      profile.scrollTop = scrollTop;
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      samples.push({
        scrollTop: profile.scrollTop,
        selectorHeight: selectorElement.getBoundingClientRect().height,
        selectorTop: selectorElement.getBoundingClientRect().top,
        triggerTop: document.getElementById('class-combobox-trigger').getBoundingClientRect().top,
      });
    }
    const header = document.getElementById('app-shell-header').getBoundingClientRect();
    const selector = selectorElement.getBoundingClientRect();
    const classTrigger = document.getElementById('class-combobox-trigger').getBoundingClientRect();
    const infoBar = document.getElementById('profile-info-bar').getBoundingClientRect();
    const summary = summaryElement.getBoundingClientRect();
    const summaryBadges = [...summaryElement.children];
    const summaryBadgeRects = summaryBadges.map(element => element.getBoundingClientRect());
    const search = document.getElementById('search-input').getBoundingClientRect();
    const searchIcon = document.querySelector('.profile-search-field > re-icon').getBoundingClientRect();
    const firstCard = document.querySelector('.student-accordion-item').getBoundingClientRect();
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    const context = canvas.getContext('2d');
    context.fillStyle = getComputedStyle(selectorElement).backgroundColor;
    context.fillRect(0, 0, 1, 1);
    return {
      headerBottom: header.bottom,
      selectorTop: selector.top,
      restingHeight,
      scrolledHeight: selector.height,
      controlGap: infoBar.top - classTrigger.bottom,
      rowGap: summary.left - search.right,
      badgeGap: summaryBadgeRects[1].top - summaryBadgeRects[0].bottom,
      summaryHeight: summary.height,
      summaryWidth: summary.width,
      searchHeight: search.height,
      searchIconInside: searchIcon.left >= search.left && searchIcon.right < search.right,
      summaryCount: summaryElement.children.length,
      summaryIcons: summaryBadges.map(element => element.querySelectorAll('re-icon').length),
      summaryValues: summaryBadges.map(element => element.textContent.trim()),
      summaryLabels: summaryBadges.map(element => element.getAttribute('aria-label')),
      numberWidths: summaryBadges.map(element => element.querySelector('span').getBoundingClientRect().width),
      totalRemoved: !document.querySelector('.summary-total, #summary-total-text'),
      profileScrollListeners: window.__profileScrollListeners,
      backgroundAlpha: context.getImageData(0, 0, 1, 1).data[3] / 255,
      backdropFilter: getComputedStyle(selectorElement).backdropFilter,
      selectorTransitionDuration: getComputedStyle(selectorElement).transitionDuration,
      cardBehindControls: firstCard.top < selector.bottom,
      samples,
    };
  });
  const selectorHeightStable = Math.max(...stickyProfileHeader.samples.map(sample => sample.selectorHeight))
    - Math.min(...stickyProfileHeader.samples.map(sample => sample.selectorHeight)) < 1;
  const selectorTopStable = Math.max(...stickyProfileHeader.samples.map(sample => sample.selectorTop))
    - Math.min(...stickyProfileHeader.samples.map(sample => sample.selectorTop)) < 1;
  const triggerTopStable = Math.max(...stickyProfileHeader.samples.map(sample => sample.triggerTop))
    - Math.min(...stickyProfileHeader.samples.map(sample => sample.triggerTop)) < 1;
  if (!selectorTopStable || !triggerTopStable || Math.abs(stickyProfileHeader.selectorTop - profileSpacing.selectorTop) >= 1 || !selectorHeightStable || Math.abs(stickyProfileHeader.scrolledHeight - stickyProfileHeader.restingHeight) >= 1 || stickyProfileHeader.controlGap !== 12 || stickyProfileHeader.rowGap !== 4 || stickyProfileHeader.badgeGap !== 0 || stickyProfileHeader.summaryHeight !== stickyProfileHeader.searchHeight || stickyProfileHeader.summaryHeight !== 44 || stickyProfileHeader.summaryWidth < 64 || !stickyProfileHeader.searchIconInside || stickyProfileHeader.summaryCount !== 2 || stickyProfileHeader.summaryIcons.some(count => count !== 2) || stickyProfileHeader.summaryValues.join('|') !== '31|4' || stickyProfileHeader.summaryLabels.join('|') !== '31 katekumen aktif|4 katekumen nonaktif' || stickyProfileHeader.numberWidths.some(width => width < 12) || !stickyProfileHeader.totalRemoved || stickyProfileHeader.profileScrollListeners !== 0 || stickyProfileHeader.backgroundAlpha < 0.9 || stickyProfileHeader.backdropFilter === 'none' || stickyProfileHeader.selectorTransitionDuration !== '0s' || !stickyProfileHeader.cardBehindControls) {
    throw new Error(`Sticky profile controls are not compact and collision-free: ${JSON.stringify(stickyProfileHeader)}`);
  }

  await page.locator('#class-combobox-trigger').click();
  const dropdownStack = await page.evaluate(() => {
    const search = document.getElementById('class-combobox-search');
    const option = document.querySelector('#class-combobox-options [role="option"]');
    const searchRect = search.getBoundingClientRect();
    const optionRect = option.getBoundingClientRect();
    return {
      searchOnTop: document.elementFromPoint(searchRect.left + 12, searchRect.top + 12) === search,
      optionOnTop: option.contains(document.elementFromPoint(optionRect.left + 12, optionRect.top + optionRect.height / 2)),
    };
  });
  if (!dropdownStack.searchOnTop || !dropdownStack.optionOnTop) {
    throw new Error(`Profile controls painted over the class dropdown: ${JSON.stringify(dropdownStack)}`);
  }
  await page.keyboard.press('Escape');

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
    const appContainer = document.getElementById('app-container').getBoundingClientRect();
    const footer = document.querySelector('.app-footer').getBoundingClientRect();
    const footerText = document.querySelector('.footer-text').getBoundingClientRect();
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
      scannerSize: reader.width,
      footerHeight: appContainer.bottom - footer.top,
      footerTopGap: footerText.top - footer.top,
      footerBottomGap: appContainer.bottom - footerText.bottom,
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
  const hasHistorySeparation = topicLayout.scannerBottomGap >= topicLayout.below;
  const footerIsCompactAndCentered = topicLayout.footerHeight <= 40 && Math.abs(topicLayout.footerTopGap - topicLayout.footerBottomGap) < 1;
  if (!topicLayout.contained || !topicLayout.centered || !matchesProfileHeight || !matchesProfileWidth || !matchesProgressWidth || !matchesProfileClearance || !selectedTopicIsStatic || !hasUniformSpacing || !hasHistorySeparation || !footerIsCompactAndCentered || topicLayout.scannerSize < 287 || topicLayout.topGlowClearance < 8 || topicLayout.optionsHeight < 330) {
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
  await scanPage.keyboard.press('Escape');

  const viewportSizes = [
    { width: 320, height: 568 },
    { width: 390, height: 664 },
    { width: 390, height: 844 },
    { width: 430, height: 932 },
    { width: 768, height: 1024 },
    { width: 1280, height: 844 },
    { width: 390, height: 664 },
    { width: 390, height: 844 },
  ];
  if (!await scanPage.locator('meta[name="viewport"]').getAttribute('content').then(content => content.includes('viewport-fit=cover'))) {
    throw new Error('Viewport metadata does not enable safe-area coverage');
  }
  for (const viewport of viewportSizes) {
    await Promise.all([page.setViewportSize(viewport), scanPage.setViewportSize(viewport)]);
    await scanPage.evaluate(() => window.setAppState(2));
    const scanViewport = await scanPage.evaluate(() => {
      const container = document.getElementById('app-container').getBoundingClientRect();
      const reader = document.getElementById('reader-container').getBoundingClientRect();
      const history = document.getElementById('queue-history-panel').getBoundingClientRect();
      const main = document.getElementById('main-app-section');
      return {
        bottomGap: innerHeight - container.bottom,
        bodyPaddingBottom: parseFloat(getComputedStyle(document.body).paddingBottom),
        cameraWidth: reader.width,
        cameraHeight: reader.height,
        historyHeight: history.height,
        mainOverflowY: getComputedStyle(main).overflowY,
        mainClientHeight: main.clientHeight,
        mainScrollHeight: main.scrollHeight,
        mainScrollable: main.scrollHeight > main.clientHeight,
        horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
      };
    });
    if (Math.abs(scanViewport.bottomGap - scanViewport.bodyPaddingBottom) >= 1
      || scanViewport.horizontalOverflow
      || Math.abs(scanViewport.cameraWidth - scanViewport.cameraHeight) >= 1
      || scanViewport.cameraWidth < 179
      || scanViewport.cameraWidth > 341
      || (viewport.width === 390 && viewport.height === 664 && scanViewport.mainScrollable)
      || (viewport.width === 390 && viewport.height === 844 && (Math.abs(scanViewport.cameraWidth - 340) >= 1 || scanViewport.mainScrollable))
      || (viewport.height <= 700 && (scanViewport.mainOverflowY !== 'auto' || scanViewport.historyHeight < 111))) {
      throw new Error(`Scan viewport layout failed at ${viewport.width}x${viewport.height}: ${JSON.stringify(scanViewport)}`);
    }
    if (scanViewport.mainScrollable) {
      const footerVisibleAtEnd = await scanPage.evaluate(() => {
        const main = document.getElementById('main-app-section');
        main.scrollTop = main.scrollHeight;
        return document.querySelector('.app-footer').getBoundingClientRect().bottom
          <= document.getElementById('app-container').getBoundingClientRect().bottom + 1;
      });
      if (!footerVisibleAtEnd) throw new Error(`Scan footer is unreachable at ${viewport.width}x${viewport.height}`);
    }
    await scanPage.evaluate(() => window.setAppState(1));
    const selectionBottomGap = await scanPage.evaluate(() => innerHeight - document.getElementById('app-container').getBoundingClientRect().bottom);
    if (Math.abs(selectionBottomGap - scanViewport.bodyPaddingBottom) >= 1) {
      throw new Error(`Topic selection does not fill the viewport at ${viewport.width}x${viewport.height}`);
    }
    await scanPage.evaluate(() => window.setAppState(2));

    const profileViewport = await page.evaluate(() => {
      const container = document.getElementById('app-container').getBoundingClientRect();
      const infoBar = document.getElementById('profile-info-bar').getBoundingClientRect();
      const search = document.querySelector('.profile-search-field').getBoundingClientRect();
      const summary = document.getElementById('students-summary').getBoundingClientRect();
      return {
        bottomGap: innerHeight - container.bottom,
        bodyPaddingBottom: parseFloat(getComputedStyle(document.body).paddingBottom),
        horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
        controlsShareRow: Math.abs((search.top + search.bottom) / 2 - (summary.top + summary.bottom) / 2) < 1,
        controlsContained: search.left >= infoBar.left && summary.right <= infoBar.right,
      };
    });
    if (Math.abs(profileViewport.bottomGap - profileViewport.bodyPaddingBottom) >= 1 || profileViewport.horizontalOverflow || !profileViewport.controlsShareRow || !profileViewport.controlsContained) {
      throw new Error(`Profile viewport layout failed at ${viewport.width}x${viewport.height}: ${JSON.stringify(profileViewport)}`);
    }
  }
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

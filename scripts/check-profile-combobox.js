import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { chromium, webkit } from 'playwright';

const colorSource = readFileSync(new URL('../public/style.css', import.meta.url), 'utf8');
const requiredColorDeclarations = [
  '--slate-1: #fcfcfd;',
  '--slate-12: #1c2024;',
  '--slate-1: #111113;',
  '--slate-12: #edeef0;',
  '--marian-9: #1d3f8f;',
  '--marian-9: #70a2ff;',
  '--chart-5: var(--teal-9);',
  '--popover: var(--slate-2);',
];
if (requiredColorDeclarations.some(declaration => !colorSource.includes(declaration))) {
  throw new Error('Radix color source declarations are incomplete');
}

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

async function scrollToListEnd(locator) {
  return locator.evaluate(list => {
    list.scrollTop = list.scrollHeight;
    const last = list.lastElementChild.getBoundingClientRect();
    const bounds = list.getBoundingClientRect();
    return {
      scrollTop: list.scrollTop,
      maxScrollTop: list.scrollHeight - list.clientHeight,
      lastBottom: last.bottom,
      visibleBottom: Math.min(bounds.bottom, visualViewport.height)
    };
  });
}

let browser;
try {
  accordionCheck: {
  await waitForServer();
  const legacyProfileResponse = await fetch(`${baseUrl}/profile.html`, { redirect: 'manual' });
  if (legacyProfileResponse.status !== 308 || legacyProfileResponse.headers.get('location') !== '/profile') {
    throw new Error('Legacy profile route did not redirect to /profile');
  }
  const browserType = process.env.PLAYWRIGHT_BROWSER === 'webkit' ? webkit : chromium;
  browser = await browserType.launch({ headless: true });
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
  const profileConsoleErrors = [];
  page.on('pageerror', error => profileConsoleErrors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') profileConsoleErrors.push(message.text()); });
  let releaseProfilePhoto;
  let profilePhotoRequests = 0;
  const profilePhotoGate = new Promise(resolve => { releaseProfilePhoto = resolve; });
  await page.route('**/api/photo?*', async route => {
    profilePhotoRequests += 1;
    await profilePhotoGate;
    await route.fulfill({
      contentType: 'image/png',
      body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64')
    });
  });
  let profileClasses = [
    { code: 'SAB', name: 'Sabtu Pagi' },
    { code: 'MAL', name: 'Malam' },
    ...Array.from({ length: 28 }, (_, index) => ({ code: `K${index + 1}`, name: `Kelas ${index + 1}` }))
  ];
  await page.route('**/api/classes', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ status: 'ok', classes: profileClasses })
  }));
  await page.route('**/api/students?*', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ status: 'ok', students: Array.from({ length: 35 }, (_, index) => ({
      studentId: `2026/MAL/${String(index + 1).padStart(3, '0')}`,
      name: index === 2
        ? 'Katekis Induk Khusus'
        : index === 3
          ? 'Katekis Kecil Khusus'
          : index === 20
            ? 'Katekumen Dengan Nama Sangat Panjang'
            : `Katekumen ${index + 1}`,
      image: index === 0 ? '/api/photo?studentId=2026%2FMAL%2F001' : '',
      kelasKi: index === 0 ? 'Katekis Induk Khusus' : index < 31 ? 'active' : 'inactive',
      katekisKk: index === 1 ? 'Katekis Kecil Khusus' : ''
    })) })
  }));
  await page.route('**/api/upload-photo', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ status: 'ok', image: '/api/photo?studentId=2026%2FMAL%2F001&uploaded=1' })
  }));

  await page.goto(`${baseUrl}/profile`, { waitUntil: 'networkidle' });
  const colorAudit = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    const rgb = color => {
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = '#000';
      context.fillStyle = color;
      context.fillRect(0, 0, 1, 1);
      return [...context.getImageData(0, 0, 1, 1).data].slice(0, 3);
    };
    const luminance = color => rgb(color).map(value => {
      const channel = value / 255;
      return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    }).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
    const contrast = (foreground, background) => {
      const [light, dark] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
      return (light + 0.05) / (dark + 0.05);
    };
    const resolve = value => {
      const probe = document.createElement('span');
      probe.style.color = value;
      document.body.append(probe);
      const resolved = getComputedStyle(probe).color;
      probe.remove();
      return resolved;
    };
    const results = [];
    for (const theme of ['light', 'dark']) {
      document.documentElement.setAttribute('data-theme', theme);
      const values = Object.fromEntries([
        'slate-1', 'slate-2', 'slate-3', 'slate-6', 'slate-9', 'slate-11', 'slate-12',
        'marian-1', 'marian-3', 'marian-7', 'marian-9', 'marian-11', 'marian-12',
        'green-3', 'green-11', 'green-12', 'amber-3', 'amber-11', 'amber-12', 'red-3', 'red-11', 'purple-3', 'purple-11'
      ].map(name => [name, resolve(`var(--${name})`)]));
      const disabled = document.createElement('button');
      disabled.disabled = true;
      document.body.append(disabled);
      const disabledStyle = getComputedStyle(disabled);
      results.push({
        theme,
        roles: {
          background: resolve('var(--background)'),
          popover: resolve('var(--popover)'),
          primary: resolve('var(--primary)'),
        },
        values,
        contrast: {
          primaryText: contrast(values['slate-12'], values['slate-1']),
          secondaryText: contrast(values['slate-11'], values['slate-1']),
          primaryButton: contrast(theme === 'light' ? '#fff' : values['marian-1'], values['marian-9']),
          successBadge: contrast(values['green-12'], values['green-3']),
          warningBadge: contrast(values['amber-12'], values['amber-3']),
          errorBadge: contrast(values['red-11'], values['red-3']),
          specialTopic: contrast(values['purple-11'], values['purple-3']),
        },
        disabled: {
          background: disabledStyle.backgroundColor,
          border: disabledStyle.borderTopColor,
          text: disabledStyle.color,
          opacity: disabledStyle.opacity,
        },
      });
      disabled.remove();
    }
    document.documentElement.setAttribute('data-theme', 'light');
    return results;
  });
  for (const audit of colorAudit) {
    if (audit.roles.background !== audit.values['slate-1'] || audit.roles.popover !== audit.values['slate-2'] || audit.roles.primary !== audit.values['marian-9']) {
      throw new Error(`Semantic color aliases are incorrect in ${audit.theme}: ${JSON.stringify(audit)}`);
    }
    if (Object.values(audit.contrast).some(ratio => ratio < 4.5)) {
      throw new Error(`Text contrast is below WCAG AA in ${audit.theme}: ${JSON.stringify(audit.contrast)}`);
    }
    if (audit.disabled.background !== audit.values['slate-3'] || audit.disabled.border !== audit.values['slate-6'] || audit.disabled.text !== audit.values['slate-9'] || audit.disabled.opacity !== '1') {
      throw new Error(`Disabled control colors are incorrect in ${audit.theme}: ${JSON.stringify(audit.disabled)}`);
    }
  }
  const navbarHandle = await page.locator('#app-nav').elementHandle();
  const headerHandle = await page.locator('#app-shell-header').elementHandle();
  const initialShell = await page.evaluate(() => ({
    navTop: document.getElementById('app-nav').getBoundingClientRect().top,
    header: document.getElementById('app-shell-header').getBoundingClientRect().toJSON(),
    logoLeft: document.querySelector('#app-shell-header .header-logo').getBoundingClientRect().left,
    textLeft: document.querySelector('#app-shell-header .header-text').getBoundingClientRect().left,
    headerGroupCenterOffset: Math.abs(
      (document.querySelector('#app-shell-header .header-logo').getBoundingClientRect().left
        + Math.max(...[...document.querySelectorAll('#app-shell-header .header-text > *')].map(element => {
          const range = document.createRange();
          range.selectNodeContents(element);
          return range.getBoundingClientRect().right;
        }))) / 2
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
  const profileThemeTransition = await page.evaluate(async () => {
    const panel = document.querySelector('#profile-view .profile-selector-container');
    const fromTheme = document.documentElement.getAttribute('data-theme');
    const samples = [];
    window.toggleTheme();
    for (let index = 0; index < 8; index += 1) {
      await new Promise(resolve => setTimeout(resolve, 40));
      const style = getComputedStyle(panel);
      samples.push({ background: style.backgroundColor, image: style.backgroundImage, backdrop: style.backdropFilter });
    }
    window.toggleTheme();
    await new Promise(resolve => setTimeout(resolve, 320));
    return { fromTheme, samples };
  });
  if (profileThemeTransition.samples.some(sample => sample.background === 'rgb(0, 0, 0)' || sample.background === 'rgba(0, 0, 0, 0)' || sample.image !== 'none' || sample.backdrop !== 'none')) {
    throw new Error(`Profile controls flashed an incorrect theme surface: ${JSON.stringify(profileThemeTransition)}`);
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
      animationName: getComputedStyle(triggerElement, '::after').animationName,
      triggerAnimationName: getComputedStyle(triggerElement).animationName,
    };
  });
  if (profileSpacing.centerDelta >= 1 || profileSpacing.placeholderBackground !== 'rgba(0, 0, 0, 0)' || profileSpacing.placeholderBorder !== '0px' || profileSpacing.placeholderShadow !== 'none' || profileSpacing.animationName === 'none' || profileSpacing.triggerAnimationName !== 'none') {
    throw new Error(`Profile empty state is not centered and unboxed: ${JSON.stringify(profileSpacing)}`);
  }
  await page.locator('#class-combobox-trigger').click();
  await page.locator('#class-combobox-popover').waitFor({ state: 'visible' });
  const classNativeScroll = await page.locator('#class-combobox-options').evaluate(list => {
    const popover = list.closest('.search-combobox-popover');
    const popoverStyle = getComputedStyle(popover);
    const listStyle = getComputedStyle(list);
    return {
      parentId: popover.parentElement.id,
      position: popoverStyle.position,
      transitionDuration: popoverStyle.transitionDuration,
      transform: popoverStyle.transform,
      overflowY: listStyle.overflowY,
    };
  });
  if (classNativeScroll.parentId !== 'class-combobox' || classNativeScroll.position !== 'absolute' || classNativeScroll.transitionDuration !== '0s' || classNativeScroll.transform !== 'none' || classNativeScroll.overflowY !== 'auto') {
    throw new Error(`Class popover does not use native in-place scrolling: ${JSON.stringify(classNativeScroll)}`);
  }
  await page.waitForTimeout(32);
  const classTail = await page.locator('#class-combobox-popover').evaluate(popover => {
    const list = popover.querySelector('.scroll-tail-viewport');
    const style = getComputedStyle(list);
    const overlayStyle = getComputedStyle(popover, '::after');
    return {
      active: popover.classList.contains('has-scroll-tail'),
      headActive: popover.classList.contains('has-scroll-head'),
      viewportActive: list.classList.contains('has-scroll-tail'),
      viewportHeadActive: list.classList.contains('has-scroll-head'),
      maskImage: style.maskImage || style.webkitMaskImage,
      maskRepeat: style.maskRepeat || style.webkitMaskRepeat,
      overlayContent: overlayStyle.content,
      backdropFilter: overlayStyle.backdropFilter || overlayStyle.webkitBackdropFilter,
    };
  });
  if (!classTail.active || classTail.headActive || !classTail.viewportActive || classTail.viewportHeadActive || !classTail.maskImage.includes('linear-gradient') || classTail.maskRepeat !== 'no-repeat' || classTail.overlayContent !== 'none' || classTail.backdropFilter !== 'none') {
    throw new Error(`Class scroll-tail cue is incorrect: ${JSON.stringify(classTail)}`);
  }
  await page.setViewportSize({ width: 320, height: 568 });
  const classListEnd = await scrollToListEnd(page.locator('#class-combobox-options'));
  if (classListEnd.scrollTop < classListEnd.maxScrollTop - 1 || classListEnd.lastBottom > classListEnd.visibleBottom + 1) {
    throw new Error(`Class list end is clipped by the mobile keyboard viewport: ${JSON.stringify(classListEnd)}`);
  }
  await page.waitForTimeout(32);
  if (await page.locator('#class-combobox-popover').evaluate(popover => popover.classList.contains('has-scroll-tail'))) {
    throw new Error('Class scroll-tail cue remained visible at the end of the list');
  }
  if (!await page.locator('#class-combobox-popover').evaluate(popover => popover.classList.contains('has-scroll-head'))) {
    throw new Error('Class scroll-head cue is missing after scrolling');
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#class-combobox-search').fill('mal');
  await page.waitForTimeout(32);
  if (await page.locator('#class-combobox-popover').evaluate(popover => popover.classList.contains('has-scroll-tail'))) {
    throw new Error('Class scroll-tail cue appeared for filtered non-overflowing content');
  }
  const options = await page.locator('#class-combobox-options [role="option"]').allTextContents();
  if (options.length !== 1 || !options[0].includes('Malam')) throw new Error('Class filtering failed');
  await page.locator('#class-combobox-search').press('ArrowDown');
  await page.keyboard.press('Enter');
  const classExitState = await page.locator('#class-combobox-popover').evaluate(popover => ({
    hidden: popover.hidden,
    inert: popover.inert,
  }));
  if (!classExitState.hidden || !classExitState.inert) {
    throw new Error(`Class popover did not close immediately: ${JSON.stringify(classExitState)}`);
  }
  await page.locator('#class-combobox-popover').waitFor({ state: 'hidden' });
  const selectedClass = await page.locator('#class-selector').inputValue();
  if (selectedClass !== 'MAL') {
    const activeElement = await page.evaluate(() => ({ id: document.activeElement?.id, text: document.activeElement?.textContent }));
    throw new Error(`Class selection failed: ${JSON.stringify({ selectedClass, activeElement })}`);
  }
  if (await page.locator('#class-combobox-trigger').getAttribute('aria-expanded') !== 'false') throw new Error('Combobox did not close');
  if (await page.locator('#class-combobox-trigger').evaluate(trigger => getComputedStyle(trigger, '::after').animationName) !== 'none') throw new Error('Selected class trigger is still glowing');
  await page.waitForFunction(() => document.querySelectorAll('.student-accordion-item').length === 35);
  const reachLinks = await page.locator('.profile-reach-link').evaluateAll(links => links.map(link => ({
    href: link.getAttribute('href'),
    target: link.target,
    rel: link.rel,
    text: link.textContent.trim(),
    label: link.getAttribute('aria-label'),
    width: link.getBoundingClientRect().width,
    height: link.getBoundingClientRect().height,
    backgroundImage: getComputedStyle(link).backgroundImage,
  })));
  if (reachLinks.length !== 35 || reachLinks.some((link, index) =>
    link.href !== `/api/reach?studentId=2026%2FMAL%2F${String(index + 1).padStart(3, '0')}`
    || link.target !== '_blank'
    || !link.rel.split(' ').includes('noopener')
    || !link.rel.split(' ').includes('noreferrer')
    || link.text !== 'Chat via WhatsApp'
    || !link.label?.startsWith('Chat dengan ')
    || Math.abs(link.width - 207) >= 1
    || Math.abs(link.height - 48) >= 1
    || !link.backgroundImage.includes('whatsapp-button-green.svg')
    || /(?:\+?62|08)\d{8,}/.test(JSON.stringify(link)))) {
    throw new Error(`Profile reach links expose contact data or have unsafe handoff attributes: ${JSON.stringify(reachLinks[0])}`);
  }
  const darkReachBackground = await page.evaluate(() => {
    document.documentElement.setAttribute('data-theme', 'dark');
    const background = getComputedStyle(document.querySelector('.profile-reach-link')).backgroundImage;
    document.documentElement.setAttribute('data-theme', 'light');
    return background;
  });
  if (!darkReachBackground.includes('whatsapp-button-white.svg')) {
    throw new Error(`Dark theme does not use the white WhatsApp branding asset: ${darkReachBackground}`);
  }
  const progressivePhotoState = await page.locator('.student-accordion-item').first().evaluate(item => {
    const frame = item.querySelector('.student-thumb-frame');
    const spinner = frame.querySelector('.profile-photo-spinner');
    const image = frame.querySelector('.student-thumb');
    return {
      name: item.querySelector('.student-name-text').textContent,
      busy: frame.getAttribute('aria-busy'),
      spinnerDisplay: getComputedStyle(spinner).display,
      imageLoaded: image.classList.contains('loaded')
    };
  });
  if (progressivePhotoState.name !== 'Katekumen 1' || progressivePhotoState.busy !== 'true' || progressivePhotoState.spinnerDisplay === 'none' || progressivePhotoState.imageLoaded) {
    throw new Error(`Names did not render ahead of profile photos: ${JSON.stringify(progressivePhotoState)}`);
  }
  releaseProfilePhoto();
  await page.waitForFunction(() => {
    const frame = document.querySelector('.student-thumb-frame');
    return frame?.getAttribute('aria-busy') === 'false'
      && frame.querySelector('.student-thumb')?.classList.contains('loaded')
      && getComputedStyle(frame.querySelector('.profile-photo-spinner')).display === 'none';
  });
  const photoMotion = await page.locator('.student-thumb').first().evaluate(image => {
    const style = getComputedStyle(image);
    return { property: style.transitionProperty, duration: parseFloat(style.transitionDuration), easing: style.transitionTimingFunction };
  });
  if (photoMotion.property !== 'opacity' || Math.abs(photoMotion.duration - 0.12) > 0.001 || !photoMotion.easing.includes('cubic-bezier(0.23, 1, 0.32, 1)')) {
    throw new Error(`Profile photo fade is incorrect: ${JSON.stringify(photoMotion)}`);
  }

  const uploadProfile = page.locator('.student-accordion-item').first();
  await uploadProfile.locator('.student-accordion-header').click();
  const replacementFrame = uploadProfile.locator('.student-photo-large-frame');
  const replacementInput = replacementFrame.locator('.photo-replace-input');
  await replacementFrame.locator('re-icon[icon="gallery-add"] svg').first().waitFor({ state: 'attached' });
  if (await replacementFrame.locator('.photo-replace-menu span').textContent() !== 'Ubah Foto') {
    throw new Error('Inline photo replacement helper text is missing');
  }
  const replacementFile = { name: 'photo.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64') };
  const detailLayout = await uploadProfile.locator('.detail-info-grid').evaluate(grid => {
    const labels = [...grid.querySelectorAll('.detail-label')];
    const colons = [...grid.querySelectorAll('.detail-colon')].map(colon => colon.getBoundingClientRect().left);
    const iconSize = parseFloat(getComputedStyle(labels[0].querySelector('re-icon')).fontSize);
    const values = [...grid.querySelectorAll('.detail-value')];
    const idValue = grid.querySelector('.detail-id-value');
    return {
      rowCount: labels.length,
      colonSpread: Math.max(...colons) - Math.min(...colons),
      labelSize: parseFloat(getComputedStyle(labels[0]).fontSize),
      iconSize,
      opacity: parseFloat(getComputedStyle(labels[0]).opacity),
      idIconWeight: grid.querySelector('re-icon[icon="user-id"]')?.getAttribute('weight'),
      idLabel: labels.at(-1)?.textContent.replace(/\s+/g, ''),
      idValue: idValue?.textContent,
      idColor: idValue ? getComputedStyle(idValue).color : '',
      detailColor: getComputedStyle(values[0]).color,
      idFont: idValue ? getComputedStyle(idValue).fontFamily : '',
      duplicateName: !!grid.closest('.student-detail-card').querySelector('.detail-name'),
    };
  });
  if (detailLayout.rowCount !== 4 || detailLayout.colonSpread > 1 || detailLayout.labelSize < 12 || detailLayout.iconSize < 16 || detailLayout.opacity < 1 || detailLayout.idIconWeight !== 'filled' || detailLayout.idLabel !== 'ID:' || detailLayout.idValue !== '2026/MAL/001' || detailLayout.idColor !== detailLayout.detailColor || !detailLayout.idFont.toLowerCase().includes('mono') || detailLayout.duplicateName) {
    throw new Error(`Profile detail labels are not aligned or legible: ${JSON.stringify(detailLayout)}`);
  }
  const modal = page.locator('#upload-preview-modal');
  const waitForUploadOpen = async () => {
    await replacementFrame.hover();
    await replacementInput.setInputFiles([]);
    await replacementInput.setInputFiles(replacementFile);
    await page.waitForFunction(() => document.getElementById('upload-preview-modal')?.classList.contains('is-visible'));
  };
  const waitForUploadClosed = async () => {
    await modal.waitFor({ state: 'hidden' });
    const state = await modal.evaluate(element => ({ open: element.classList.contains('open'), overflow: document.body.style.overflow }));
    if (state.open || state.overflow) throw new Error(`Upload sheet cleanup failed: ${JSON.stringify(state)}`);
  };
  await replacementFrame.hover();
  if (!await replacementFrame.evaluate(frame => frame.classList.contains('is-replace-open'))) throw new Error('Inline photo replacement menu did not open on hover');
  await page.mouse.move(0, 0);
  await page.waitForTimeout(220);
  if (await replacementFrame.evaluate(frame => frame.classList.contains('is-replace-open') || getComputedStyle(frame.querySelector('.photo-replace-menu')).opacity !== '0')) {
    throw new Error('Inline photo replacement menu did not fade out after hover ended');
  }
  await waitForUploadOpen();
  const uploadMotion = await modal.evaluate(element => {
    const overlay = getComputedStyle(element);
    const sheet = getComputedStyle(element.querySelector('.upload-preview-sheet'));
    return {
      overlay: { property: overlay.transitionProperty, duration: parseFloat(overlay.transitionDuration) },
      sheet: { properties: sheet.transitionProperty.split(',').map(value => value.trim()), durations: sheet.transitionDuration.split(',').map(value => parseFloat(value)), easing: sheet.transitionTimingFunction },
      overflow: document.body.style.overflow,
    };
  });
  if (uploadMotion.overlay.property !== 'opacity' || Math.abs(uploadMotion.overlay.duration - 0.28) > 0.001 || !uploadMotion.sheet.properties.includes('opacity') || !uploadMotion.sheet.properties.includes('transform') || uploadMotion.sheet.durations.some(duration => Math.abs(duration - 0.28) > 0.001) || !uploadMotion.sheet.easing.includes('cubic-bezier(0.23, 1, 0.32, 1)') || uploadMotion.overflow !== 'hidden') {
    throw new Error(`Upload sheet entrance motion is incorrect: ${JSON.stringify(uploadMotion)}`);
  }
  const uploadSheetBox = await page.locator('.upload-preview-sheet').boundingBox();
  const closeButton = page.locator('#upload-close-btn');
  const closeStyle = await closeButton.evaluate(button => {
    const style = getComputedStyle(button);
    const title = button.parentElement.querySelector('.upload-preview-title').getBoundingClientRect();
    const sheet = button.closest('.upload-preview-sheet').getBoundingClientRect();
    return {
      width: parseFloat(style.width),
      height: parseFloat(style.height),
      radius: style.borderRadius,
      color: style.color,
      titleOffset: Math.abs((title.left + title.width / 2) - (sheet.left + sheet.width / 2)),
    };
  });
  if (closeStyle.width !== closeStyle.height || closeStyle.radius !== '50%' || closeStyle.titleOffset > 1) {
    throw new Error(`Upload header layout is incorrect: ${JSON.stringify(closeStyle)}`);
  }
  await closeButton.click();
  const closingUpload = await modal.evaluate(element => ({ open: element.classList.contains('open'), closing: element.classList.contains('is-closing'), inert: element.inert, visible: element.classList.contains('is-visible'), overflow: document.body.style.overflow }));
  if (!closingUpload.open || !closingUpload.closing || !closingUpload.inert || closingUpload.visible || closingUpload.overflow !== 'hidden') {
    throw new Error(`Upload sheet exit state is incorrect: ${JSON.stringify(closingUpload)}`);
  }
  await waitForUploadClosed();
  await waitForUploadOpen();
  await page.keyboard.press('Escape');
  await waitForUploadClosed();
  await waitForUploadOpen();
  await modal.click({ position: { x: 5, y: 5 } });
  await waitForUploadClosed();
  await waitForUploadOpen();
  await page.locator('#upload-file-input').setInputFiles(replacementFile);
  const confirmButton = page.locator('#upload-confirm-btn');
  await confirmButton.hover();
  await page.mouse.down();
  await page.waitForTimeout(80);
  const confirmPressed = await confirmButton.evaluate(button => getComputedStyle(button).transform);
  await page.mouse.move(uploadSheetBox.x + 10, uploadSheetBox.y + 10);
  await page.mouse.up();
  if (Number(confirmPressed.match(/^matrix\(([^,]+)/)?.[1] ?? 1) >= 1) throw new Error(`Upload confirm press feedback is incorrect: ${confirmPressed}`);
  await confirmButton.click();
  await waitForUploadClosed();
  const loadedPhotoRequests = profilePhotoRequests;
  await page.evaluate(() => {
    window.__persistentProfilePhoto = document.querySelector('.student-thumb[data-student-id="2026/MAL/001"]');
  });
  const assertProfileSearch = async (query, expectedIds) => {
    await page.locator('#search-input').fill(query);
    await page.waitForFunction(ids => {
      const renderedIds = [...document.querySelectorAll('.student-accordion-item:not([hidden]) .student-id-text')]
        .map(element => element.textContent.trim());
      return JSON.stringify(renderedIds) === JSON.stringify(ids);
    }, expectedIds);
  };
  await assertProfileSearch('Katekis Induk Khusus', ['2026/MAL/001', '2026/MAL/003']);
  await assertProfileSearch('ki:Katekis Induk Khusus', ['2026/MAL/001']);
  await assertProfileSearch('Katekis Kecil Khusus', ['2026/MAL/002', '2026/MAL/004']);
  await assertProfileSearch('kk:Katekis Kecil Khusus', ['2026/MAL/002']);
  await assertProfileSearch('Katekumen 32', ['2026/MAL/032']);
  const filteredInactiveGroup = await page.locator('.inactive-group-wrapper').evaluate(group => ({
    hidden: group.hidden,
    label: group.querySelector('.inactive-group-count').textContent,
  }));
  if (filteredInactiveGroup.hidden || filteredInactiveGroup.label !== 'Nonaktif (1)') {
    throw new Error(`Inactive search results were not preserved: ${JSON.stringify(filteredInactiveGroup)}`);
  }
  await assertProfileSearch('Tidak Ada Katekumen', []);
  const emptySearchState = await page.evaluate(() => ({
    emptyVisible: !document.querySelector('#students-list > .empty-state').hidden,
    inactiveGroupHidden: document.querySelector('.inactive-group-wrapper').hidden,
  }));
  if (!emptySearchState.emptyVisible || !emptySearchState.inactiveGroupHidden) {
    throw new Error(`Empty profile search state is incorrect: ${JSON.stringify(emptySearchState)}`);
  }
  await assertProfileSearch('', Array.from({ length: 35 }, (_, index) =>
    `2026/MAL/${String(index + 1).padStart(3, '0')}`
  ));
  const persistentPhotoState = await page.evaluate(() => ({
    sameNode: document.querySelector('.student-thumb[data-student-id="2026/MAL/001"]') === window.__persistentProfilePhoto,
    complete: window.__persistentProfilePhoto?.complete,
    naturalWidth: window.__persistentProfilePhoto?.naturalWidth,
    inactiveLabel: document.querySelector('.inactive-group-count').textContent,
  }));
  if (!persistentPhotoState.sameNode || !persistentPhotoState.complete || persistentPhotoState.naturalWidth === 0 || persistentPhotoState.inactiveLabel !== 'Nonaktif (4)' || profilePhotoRequests !== loadedPhotoRequests) {
    throw new Error(`Profile photos did not persist through search: ${JSON.stringify({ ...persistentPhotoState, loadedPhotoRequests, profilePhotoRequests })}`);
  }
  const expandedShell = await page.evaluate(() => {
    const nav = document.getElementById('app-nav').getBoundingClientRect();
    const container = document.getElementById('app-container').getBoundingClientRect();
    const profile = document.getElementById('profile-view');
    const list = document.getElementById('students-list');
    return {
      navTop: nav.top,
      containerHeight: container.height,
      triggerTop: document.getElementById('class-combobox-trigger').getBoundingClientRect().top,
      expanded: document.getElementById('app-container').classList.contains('profile-expanded'),
      listScrollable: list.scrollHeight > list.clientHeight,
      profileScrollable: profile.scrollHeight > profile.clientHeight,
      profileOverflow: getComputedStyle(profile).overflowY,
      listOverflow: getComputedStyle(list).overflowY
    };
  });
  if (!expandedShell.expanded || !expandedShell.listScrollable || expandedShell.profileScrollable || expandedShell.profileOverflow !== 'hidden' || expandedShell.listOverflow !== 'auto' || Math.abs(expandedShell.containerHeight - initialShell.containerHeight) >= 1 || Math.abs(expandedShell.navTop - initialShell.navTop) >= 1 || Math.abs(expandedShell.triggerTop - profileSpacing.triggerTop) >= 1) {
    throw new Error(`Profile shell did not preserve the full-height viewport layout: ${JSON.stringify({ initialShell, expandedShell })}`);
  }

  const profileTail = await page.evaluate(async () => {
    const profile = document.getElementById('profile-view');
    const list = document.getElementById('students-list');
    list.scrollTop = 0;
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const style = getComputedStyle(list);
    const overlayStyle = getComputedStyle(profile, '::after');
    return {
      active: profile.classList.contains('has-scroll-tail'),
      headActive: profile.classList.contains('has-scroll-head'),
      viewportActive: list.classList.contains('has-scroll-tail'),
      viewportHeadActive: list.classList.contains('has-scroll-head'),
      maskImage: style.maskImage || style.webkitMaskImage,
      maskRepeat: style.maskRepeat || style.webkitMaskRepeat,
      overlayContent: overlayStyle.content,
      backdropFilter: overlayStyle.backdropFilter || overlayStyle.webkitBackdropFilter,
    };
  });
  if (!profileTail.active || profileTail.headActive || !profileTail.viewportActive || profileTail.viewportHeadActive || !profileTail.maskImage.includes('linear-gradient') || profileTail.maskRepeat !== 'no-repeat' || profileTail.overlayContent !== 'none' || profileTail.backdropFilter !== 'none') {
    throw new Error(`Profile scroll-tail cue is incorrect: ${JSON.stringify(profileTail)}`);
  }
  await page.locator('#students-list').evaluate(async list => {
    list.scrollTop = list.scrollHeight;
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
  if (await page.locator('#profile-view').evaluate(profile => profile.classList.contains('has-scroll-tail'))) {
    throw new Error('Profile scroll-tail cue remained visible at the end of the list');
  }
  if (!await page.locator('#profile-view').evaluate(profile => profile.classList.contains('has-scroll-head'))) {
    throw new Error('Profile scroll-head cue is missing after scrolling');
  }
  await page.locator('#students-list').evaluate(list => { list.scrollTop = 0; });

  const stickyProfileHeader = await page.evaluate(async () => {
    const profile = document.getElementById('profile-view');
    const list = document.getElementById('students-list');
    const selectorElement = document.querySelector('#profile-view .profile-selector-container');
    const summaryElement = document.getElementById('students-summary');
    const restingHeight = selectorElement.getBoundingClientRect().height;
    const samples = [];
    for (const scrollTop of [0, 6, 12, 24, 100, 300]) {
      list.scrollTop = scrollTop;
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      samples.push({
        scrollTop: list.scrollTop,
        profileScrollTop: profile.scrollTop,
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
    const gapPoint = document.elementFromPoint((selector.left + selector.right) / 2, (header.bottom + selector.top) / 2);
    return {
      headerBottom: header.bottom,
      selectorTop: selector.top,
      selectorBottom: selector.bottom,
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
      numberAlignments: summaryBadges.map(element => getComputedStyle(element.querySelector('span')).textAlign),
      summaryGeometry: summaryBadges.map(element => {
        const badge = element.getBoundingClientRect();
        const children = [...element.children].map(child => child.getBoundingClientRect());
        return {
          columnGap: getComputedStyle(element).columnGap,
          iconWidths: children.slice(0, 2).map(rect => rect.width),
          gaps: [children[1].left - children[0].right, children[2].left - children[1].right],
          numberCenter: (children[2].left + children[2].right) / 2,
          edgeClearance: [children[0].left - badge.left, badge.right - children[2].right],
        };
      }),
      totalRemoved: !document.querySelector('.summary-total, #summary-total-text'),
      profileScrollListeners: window.__profileScrollListeners,
      backgroundAlpha: context.getImageData(0, 0, 1, 1).data[3] / 255,
      backdropFilter: getComputedStyle(selectorElement).backdropFilter,
      selectorTransitionDuration: getComputedStyle(selectorElement).transitionDuration,
      listTop: list.getBoundingClientRect().top,
      listScrollbarColor: getComputedStyle(list).scrollbarColor,
      gapOccluded: selectorElement.contains(gapPoint),
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
  const profileStayedStill = stickyProfileHeader.samples.every(sample => sample.profileScrollTop === 0);
  const summaryColumnsAligned = Math.max(...stickyProfileHeader.summaryGeometry.map(row => row.numberCenter)) - Math.min(...stickyProfileHeader.summaryGeometry.map(row => row.numberCenter)) < 1;
  const summarySpacingUniform = stickyProfileHeader.summaryGeometry.every(row => row.columnGap === '3px' && row.iconWidths.every(width => width === 11) && row.gaps.every(gap => Math.abs(gap - 3) < 1));
  const summaryContentClear = stickyProfileHeader.summaryGeometry.every(row => row.edgeClearance.every(clearance => clearance >= 10));
  if (!selectorTopStable || !triggerTopStable || !profileStayedStill || Math.abs(stickyProfileHeader.selectorTop - profileSpacing.selectorTop) >= 1 || !selectorHeightStable || Math.abs(stickyProfileHeader.scrolledHeight - stickyProfileHeader.restingHeight) >= 1 || stickyProfileHeader.controlGap !== 12 || stickyProfileHeader.rowGap !== 4 || stickyProfileHeader.badgeGap !== 0 || stickyProfileHeader.summaryHeight !== stickyProfileHeader.searchHeight || stickyProfileHeader.summaryHeight !== 44 || stickyProfileHeader.summaryWidth < 68 || !stickyProfileHeader.searchIconInside || stickyProfileHeader.summaryCount !== 2 || stickyProfileHeader.summaryIcons.some(count => count !== 2) || stickyProfileHeader.summaryValues.join('|') !== '31|4' || stickyProfileHeader.summaryLabels.join('|') !== '31 katekumen aktif|4 katekumen nonaktif' || stickyProfileHeader.numberWidths.some(width => width < 12) || stickyProfileHeader.numberAlignments.some(alignment => alignment !== 'center') || !summaryColumnsAligned || !summarySpacingUniform || !summaryContentClear || !stickyProfileHeader.totalRemoved || stickyProfileHeader.profileScrollListeners !== 0 || stickyProfileHeader.backgroundAlpha < 0.99 || stickyProfileHeader.backdropFilter !== 'none' || stickyProfileHeader.selectorTransitionDuration !== '0.3s, 0.3s' || stickyProfileHeader.listTop < stickyProfileHeader.selectorBottom || stickyProfileHeader.listScrollbarColor === 'auto' || !stickyProfileHeader.gapOccluded || !stickyProfileHeader.cardBehindControls) {
    throw new Error(`Sticky profile controls are not compact and collision-free: ${JSON.stringify(stickyProfileHeader)}`);
  }

  const firstProfile = page.locator('.student-accordion-item').first();
  const accordionSemantics = await page.evaluate(() => {
    const items = [...document.querySelectorAll('.student-accordion-item')];
    return {
      buttons: items.every(item => {
        const header = item.querySelector('.student-accordion-header');
        const body = item.querySelector('.student-accordion-body');
        return header?.tagName === 'BUTTON'
          && header.type === 'button'
          && header.getAttribute('aria-controls') === body?.id
          && body?.getAttribute('role') === 'region'
          && body?.getAttribute('aria-labelledby') === header.id;
      }),
      dimensions: [...document.querySelectorAll('.student-thumb, .student-photo-large')].every(image =>
        (image.classList.contains('student-thumb') && image.getAttribute('width') === '40' && image.getAttribute('height') === '40')
        || (image.classList.contains('student-photo-large') && image.getAttribute('width') === '120' && image.getAttribute('height') === '150')),
      intrinsicGrid: getComputedStyle(items[0].querySelector('.student-accordion-body')).gridTemplateRows === '0px',
      clip: (() => {
        const clip = items[0].querySelector('.student-accordion-clip');
        return !!clip && getComputedStyle(clip).minHeight === '0px' && getComputedStyle(clip).overflow === 'hidden';
      })(),
    };
  });
  if (!accordionSemantics.buttons || !accordionSemantics.dimensions || !accordionSemantics.intrinsicGrid || !accordionSemantics.clip) {
    throw new Error(`Profile accordion semantics are incomplete: ${JSON.stringify(accordionSemantics)}`);
  }
  await page.locator('#students-list').evaluate(list => { list.scrollTop = 0; });
  const hoverBefore = await firstProfile.evaluate(item => ({
    top: item.getBoundingClientRect().top,
    borderColor: getComputedStyle(item).borderTopColor
  }));
  await firstProfile.hover();
  await page.waitForTimeout(150);
  const hoverState = await firstProfile.evaluate(item => ({
    top: item.getBoundingClientRect().top,
    shadow: getComputedStyle(item).boxShadow,
    borderColor: getComputedStyle(item).borderTopColor
  }));
  if (Math.abs(hoverState.top - hoverBefore.top) >= 1 || hoverState.shadow !== 'none' || hoverState.borderColor === hoverBefore.borderColor) {
    throw new Error(`Profile card hover moved or painted outside its scroll container: ${JSON.stringify({ hoverBefore, hoverState })}`);
  }

  const focusedProfile = page.locator('.student-accordion-item').nth(20);
  const collapsedChevronCenterInset = await focusedProfile.evaluate(item => {
    const itemRect = item.getBoundingClientRect();
    const arrowRect = item.querySelector('.expand-arrow').getBoundingClientRect();
    return itemRect.right - (arrowRect.left + arrowRect.right) / 2;
  });
  await focusedProfile.locator('.student-accordion-header').dispatchEvent('click', { detail: 1 });
  const pointerOpenMotion = await focusedProfile.evaluate(item => [
    ...item.querySelector('.student-accordion-body').getAnimations(),
    ...item.querySelector('.student-accordion-inner').getAnimations(),
    ...item.querySelector('.expand-arrow').getAnimations()
  ].filter(animation => animation.transitionProperty !== 'visibility').map(animation => ({
    property: animation.transitionProperty,
    duration: animation.effect.getTiming().duration,
    easing: animation.effect.getTiming().easing
  })));
  if (JSON.stringify(pointerOpenMotion.map(animation => animation.property).sort()) !== JSON.stringify(['grid-template-rows', 'opacity', 'transform', 'transform'])
    || pointerOpenMotion.some(animation => animation.duration !== 420 || animation.easing !== 'cubic-bezier(0.22, 1, 0.36, 1)')) {
    throw new Error(`Profile accordion opening motion is not composited and aligned: ${JSON.stringify(pointerOpenMotion)}`);
  }
  const openingTrajectory = await page.evaluate(async () => {
    const list = document.getElementById('students-list');
    const header = document.querySelectorAll('.student-accordion-header')[20];
    const slack = getComputedStyle(list).getPropertyValue('--profile-scroll-slack');
    const samples = [];
    for (let index = 0; index < 26; index += 1) {
      await new Promise(resolve => requestAnimationFrame(resolve));
      samples.push({ top: header.getBoundingClientRect().top, scrollTop: list.scrollTop, slack: getComputedStyle(list).getPropertyValue('--profile-scroll-slack') });
    }
    await new Promise(resolve => setTimeout(resolve, 100));
    const settledScrollTop = list.scrollTop;
    await new Promise(resolve => setTimeout(resolve, 140));
    return { slack, samples, settledScrollTop, lateScrollTop: list.scrollTop };
  });
  if (!openingTrajectory.slack || openingTrajectory.samples.some(sample => sample.slack !== openingTrajectory.slack)
    || openingTrajectory.lateScrollTop !== openingTrajectory.settledScrollTop
    || openingTrajectory.samples.some((sample, index) => index > 0 && sample.top > openingTrajectory.samples[index - 1].top + 1)) {
    throw new Error(`Profile accordion focus trajectory was interrupted or changed late: ${JSON.stringify(openingTrajectory)}`);
  }
  await page.waitForFunction(() => {
    const item = document.querySelectorAll('.student-accordion-item')[20];
    const header = item.querySelector('.student-accordion-header');
    const expectedTop = document.getElementById('students-list').getBoundingClientRect().top;
    return header.getAttribute('aria-expanded') === 'true'
      && Math.abs(item.getBoundingClientRect().top - expectedTop - 16) < 2;
  });
  if (await focusedProfile.locator('.student-accordion-header').evaluate(header => header === document.activeElement)) {
    throw new Error('Pointer accordion click moved DOM focus');
  }
  await page.waitForFunction(() => {
    const header = document.querySelectorAll('.student-accordion-header')[20];
    const detail = header.nextElementSibling.querySelector('.student-detail-card');
    return Math.abs(detail.getBoundingClientRect().top - header.getBoundingClientRect().bottom - 8) < 1;
  });
  const compactExpandedHeader = await focusedProfile.locator('.student-accordion-header').evaluate(header => {
    const arrow = header.querySelector('.expand-arrow');
    const headerRect = header.getBoundingClientRect();
    const arrowRect = arrow.getBoundingClientRect();
    const item = header.closest('.student-accordion-item');
    const itemRect = item.getBoundingClientRect();
    const body = header.nextElementSibling;
    const bodyRect = body.getBoundingClientRect();
    const detailRect = body.querySelector('.student-detail-card').getBoundingClientRect();
    const dividerStyle = getComputedStyle(header, '::after');
    const name = header.querySelector('.student-name-text');
    const nameRect = name.getBoundingClientRect();
    const nameStyle = getComputedStyle(name);
    return {
      label: header.getAttribute('aria-label'),
      height: headerRect.height,
      width: headerRect.width,
      itemWidth: itemRect.width,
      position: getComputedStyle(header).position,
      identityDisplay: getComputedStyle(header.querySelector('.header-left')).display,
      name: header.querySelector('.student-name-text').textContent,
      nameDisplay: getComputedStyle(header.querySelector('.student-name-text')).display,
      nameFont: nameStyle.fontFamily,
      nameSize: parseFloat(nameStyle.fontSize),
      nameFits: name.scrollWidth <= name.clientWidth + 1,
      nameCenterOffset: Math.abs((nameRect.left + nameRect.right) / 2 - (headerRect.left + headerRect.right) / 2),
      nameVerticalOffset: Math.abs((nameRect.top + nameRect.bottom) / 2 - (headerRect.top + headerRect.bottom) / 2),
      thumbDisplay: getComputedStyle(header.querySelector('.student-photo-frame, .student-thumb-placeholder')).display,
      idDisplay: getComputedStyle(header.querySelector('.student-id-text')).display,
      arrowDisplay: getComputedStyle(arrow).display,
      arrowWidth: arrowRect.width,
      arrowHeight: arrowRect.height,
      arrowCenterInset: itemRect.right - (arrowRect.left + arrowRect.right) / 2,
      background: getComputedStyle(header).backgroundColor,
      bodyBackgroundImage: getComputedStyle(body).backgroundImage,
      dividerTop: dividerStyle.top,
      dividerWidth: dividerStyle.borderTopWidth,
      bodyTopOffset: bodyRect.top - itemRect.top,
      detailTopGap: detailRect.top - headerRect.bottom,
      topLeftIsHeader: header.contains(document.elementFromPoint(itemRect.left + 8, itemRect.top + 8)),
      bottomLeftIsHeader: header.contains(document.elementFromPoint(itemRect.left + 8, itemRect.top + 62))
    };
  });
  if (!compactExpandedHeader.label?.includes('Katekumen Dengan Nama Sangat Panjang, 2026/MAL/021') || compactExpandedHeader.height !== 64 || Math.abs(compactExpandedHeader.width - compactExpandedHeader.itemWidth) > 2 || compactExpandedHeader.position !== 'absolute' || compactExpandedHeader.identityDisplay === 'none' || compactExpandedHeader.name !== 'Katekumen Dengan Nama Sangat Panjang' || compactExpandedHeader.nameDisplay === 'none' || !compactExpandedHeader.nameFont.includes('DM Serif Display') || compactExpandedHeader.nameSize >= 20 || compactExpandedHeader.nameSize < 12 || !compactExpandedHeader.nameFits || compactExpandedHeader.nameCenterOffset >= 1 || compactExpandedHeader.nameVerticalOffset >= 1 || compactExpandedHeader.thumbDisplay !== 'none' || compactExpandedHeader.idDisplay !== 'none' || compactExpandedHeader.arrowDisplay === 'none' || compactExpandedHeader.arrowWidth === 0 || compactExpandedHeader.arrowHeight === 0 || Math.abs(compactExpandedHeader.arrowCenterInset - collapsedChevronCenterInset) >= 1 || compactExpandedHeader.background !== 'rgba(0, 0, 0, 0)' || compactExpandedHeader.bodyBackgroundImage === 'none' || compactExpandedHeader.dividerTop !== '60px' || compactExpandedHeader.dividerWidth !== '1px' || compactExpandedHeader.bodyTopOffset > 1 || Math.abs(compactExpandedHeader.detailTopGap - 8) >= 1 || !compactExpandedHeader.topLeftIsHeader || !compactExpandedHeader.bottomLeftIsHeader) {
    throw new Error(`Expanded profile header is not a full-width accessible collapse control: ${JSON.stringify(compactExpandedHeader)}`);
  }
  const sameCardViewport = await page.locator('#students-list').evaluate(list => ({ scrollTop: list.scrollTop, slack: getComputedStyle(list).getPropertyValue('--profile-scroll-slack') }));
  await page.evaluate(() => { window.__readClosingCleanupProbe = () => {
    const item = document.querySelectorAll('.student-accordion-item')[20];
    const read = () => {
      const header = item.querySelector('.student-accordion-header');
      const name = header.querySelector('.student-name-text');
      const thumb = header.querySelector('.student-photo-frame, .student-thumb-placeholder');
      const id = header.querySelector('.student-id-text');
      const left = header.querySelector('.header-left');
      const arrow = header.querySelector('.expand-arrow');
      const body = item.querySelector('.student-accordion-body');
      const rect = element => { const value = element.getBoundingClientRect(); return { top: value.top, left: value.left, width: value.width, height: value.height }; };
      const styleSnapshot = element => { const style = getComputedStyle(element); return { display: style.display, position: style.position, padding: style.padding, fontFamily: style.fontFamily, fontSize: style.fontSize, fontWeight: style.fontWeight, textAlign: style.textAlign, transform: style.transform, opacity: style.opacity }; };
      return {
        classes: { header: header.className, body: body.className },
        item: rect(item), header: rect(header), name: rect(name), thumb: rect(thumb), id: rect(id), left: rect(left), arrow: rect(arrow), body: rect(body),
        styles: { header: styleSnapshot(header), name: styleSnapshot(name), thumb: styleSnapshot(thumb), id: styleSnapshot(id), left: styleSnapshot(left), arrow: styleSnapshot(arrow) }
      };
    };
    return read();
  }; });
  await focusedProfile.locator('.student-accordion-header').click();
  const pointerCloseMotion = await focusedProfile.evaluate(item => ({
    closing: item.querySelector('.student-accordion-body').classList.contains('closing'),
    animations: [
      ...item.querySelector('.student-accordion-body').getAnimations(),
      ...item.querySelector('.student-accordion-inner').getAnimations(),
      ...item.querySelector('.expand-arrow').getAnimations(),
      ...item.querySelector('.student-name-text').getAnimations(),
      ...[...item.querySelectorAll('.student-photo-frame, .student-thumb-placeholder, .student-id-text')].flatMap(element => element.getAnimations())
    ].filter(animation => animation.transitionProperty !== 'visibility').map(animation => ({
      property: animation.transitionProperty,
      duration: animation.effect.getTiming().duration,
      easing: animation.effect.getTiming().easing
    }))
  }));
  if (!pointerCloseMotion.closing || pointerCloseMotion.animations.length !== 7
    || pointerCloseMotion.animations.some(animation => animation.duration < 288 || animation.duration > 292 || animation.easing !== 'cubic-bezier(0.4, 0, 0.2, 1)')) {
    throw new Error(`Profile accordion closing motion is not composited and aligned: ${JSON.stringify(pointerCloseMotion)}`);
  }
  await page.waitForTimeout(280);
  const closingCleanupBefore = await page.evaluate(() => window.__readClosingCleanupProbe());
  await page.waitForFunction(() => !document.querySelectorAll('.student-accordion-item')[20].querySelector('.student-accordion-body').classList.contains('closing'));
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));
  const closingCleanupAfter = await page.evaluate(() => window.__readClosingCleanupProbe());
  const closingGeometryDelta = ['item', 'header', 'name', 'thumb', 'id', 'left', 'arrow', 'body'].map(key => Math.max(
    Math.abs(closingCleanupBefore[key].top - closingCleanupAfter[key].top),
    Math.abs(closingCleanupBefore[key].left - closingCleanupAfter[key].left),
    Math.abs(closingCleanupBefore[key].width - closingCleanupAfter[key].width),
    Math.abs(closingCleanupBefore[key].height - closingCleanupAfter[key].height)
  ));
  const closingOpacityDelta = ['name', 'thumb', 'id', 'left', 'arrow'].map(key => Math.abs(
    parseFloat(closingCleanupBefore.styles[key].opacity) - parseFloat(closingCleanupAfter.styles[key].opacity)
  ));
  if (Math.max(...closingGeometryDelta.slice(1, 7)) > 1 || Math.max(...closingOpacityDelta) > 0.02
    || closingCleanupAfter.styles.header.position !== 'static'
    || closingCleanupAfter.styles.name.fontFamily !== closingCleanupBefore.styles.name.fontFamily
    || closingCleanupAfter.styles.thumb.display !== closingCleanupBefore.styles.thumb.display
    || closingCleanupAfter.styles.id.display !== closingCleanupBefore.styles.id.display
    || closingCleanupAfter.styles.arrow.transform !== 'none') {
    throw new Error(`Accordion closing cleanup changed visible header presentation: ${JSON.stringify({ closingCleanupBefore, closingCleanupAfter, closingGeometryDelta, closingOpacityDelta })}`);
  }
  const sameCardAfterClose = await page.locator('#students-list').evaluate(list => ({ scrollTop: list.scrollTop, slack: getComputedStyle(list).getPropertyValue('--profile-scroll-slack') }));
  if (sameCardAfterClose.slack !== '0px') {
    throw new Error(`Closed accordion retained focus slack: ${JSON.stringify({ sameCardViewport, sameCardAfterClose })}`);
  }
  await page.waitForTimeout(50);
  await focusedProfile.locator('.student-accordion-header').click();
  if (await focusedProfile.locator('.student-accordion-header').getAttribute('aria-expanded') !== 'true') {
    throw new Error('Interrupted accordion close did not reverse cleanly');
  }
  await page.waitForTimeout(180);
  const originalTheme = await page.evaluate(() => document.documentElement.dataset.theme || '');
  for (const width of [320, 390, 420]) {
    await page.setViewportSize({ width, height: 844 });
    for (const theme of ['light', 'dark']) {
      const responsiveState = await page.evaluate(async selectedTheme => {
        document.documentElement.dataset.theme = selectedTheme;
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        const header = document.querySelector('.student-accordion-header.active');
        const item = header.closest('.student-accordion-item');
        const arrow = header.querySelector('.expand-arrow').getBoundingClientRect();
        const itemRect = item.getBoundingClientRect();
        return {
          overflow: item.scrollWidth - item.clientWidth,
          identityDisplay: getComputedStyle(header.querySelector('.header-left')).display,
          arrowWidth: arrow.width,
          arrowHeight: arrow.height,
          overflowSelectors: [...item.querySelectorAll('*')]
            .filter(element => {
              const rect = element.getBoundingClientRect();
              return rect.right > itemRect.right + 1 || rect.left < itemRect.left - 1;
            })
            .slice(0, 8)
            .map(element => `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ''}${[...element.classList].map(name => `.${name}`).join('')}`)
        };
      }, theme);
      if (responsiveState.overflow > 1 || responsiveState.identityDisplay === 'none' || responsiveState.arrowWidth === 0 || responsiveState.arrowHeight === 0) {
        throw new Error(`Expanded profile header failed at ${width}px in ${theme} theme: ${JSON.stringify(responsiveState)}`);
      }
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(theme => {
    if (theme) document.documentElement.dataset.theme = theme;
    else delete document.documentElement.dataset.theme;
  }, originalTheme);
  await focusedProfile.locator('.student-accordion-header').press('Enter');
  const keyboardCloseAnimations = await focusedProfile.evaluate(item => [
    ...item.querySelector('.student-accordion-inner').getAnimations(),
    ...item.querySelector('.expand-arrow').getAnimations()
  ].length);
  await page.waitForFunction(() => {
    const header = document.querySelectorAll('.student-accordion-header')[20];
    return header.getAttribute('aria-expanded') === 'false'
      && getComputedStyle(header.querySelector('.header-left')).display !== 'none';
  });
  await focusedProfile.locator('.student-accordion-header').press('Enter');
  await page.waitForFunction(() => {
    const item = document.querySelectorAll('.student-accordion-item')[20];
    const list = document.getElementById('students-list');
    const listRect = list.getBoundingClientRect();
    const itemRect = item.getBoundingClientRect();
    return item.querySelector('.student-accordion-header').getAttribute('aria-expanded') === 'true'
      && itemRect.top >= listRect.top - 1
      && itemRect.bottom <= listRect.bottom + 1;
  });

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await focusedProfile.locator('.student-accordion-header').click();
  const reducedMotionClose = await focusedProfile.evaluate(item => ({
    expanded: item.querySelector('.student-accordion-header').getAttribute('aria-expanded'),
    bodyHeight: item.querySelector('.student-accordion-body').getBoundingClientRect().height
  }));
  if (reducedMotionClose.expanded !== 'false' || reducedMotionClose.bodyHeight !== 0) {
    throw new Error(`Reduced-motion accordion close was not immediate: ${JSON.stringify(reducedMotionClose)}`);
  }
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await focusedProfile.locator('.student-accordion-header').press('Enter');

  const adjacentFocusedProfile = page.locator('.student-accordion-item').nth(21);
  await adjacentFocusedProfile.locator('.student-accordion-header').click();
  await page.waitForFunction(() => {
    const item = document.querySelectorAll('.student-accordion-item')[21];
    const header = item.querySelector('.student-accordion-header');
    const expectedTop = document.getElementById('students-list').getBoundingClientRect().top;
    return header.getAttribute('aria-expanded') === 'true'
      && Math.abs(item.getBoundingClientRect().top - expectedTop - 16) < 2;
  });

  const secondFocusedProfile = page.locator('.student-accordion-item').nth(25);
  await secondFocusedProfile.locator('.student-accordion-header').click();
  const switchAnimations = await page.evaluate(() => [21, 25].flatMap(index => {
    const item = document.querySelectorAll('.student-accordion-item')[index];
    return [
      ...item.querySelector('.student-accordion-inner').getAnimations(),
      ...item.querySelector('.expand-arrow').getAnimations()
    ];
  }).length);
  if (switchAnimations < 2) throw new Error('Direct accordion switch did not coordinate both sides');
  await page.waitForFunction(() => {
    const item = document.querySelectorAll('.student-accordion-item')[25];
    const header = item.querySelector('.student-accordion-header');
    const expectedTop = document.getElementById('students-list').getBoundingClientRect().top;
    return header.getAttribute('aria-expanded') === 'true'
      && Math.abs(item.getBoundingClientRect().top - expectedTop - 16) < 2;
  });

  const aboveFocusedProfile = page.locator('.student-accordion-item').nth(5);
  await aboveFocusedProfile.locator('.student-accordion-header').click();
  await page.waitForFunction(() => {
    const item = document.querySelectorAll('.student-accordion-item')[5];
    const header = item.querySelector('.student-accordion-header');
    const expectedTop = document.getElementById('students-list').getBoundingClientRect().top;
    return header.getAttribute('aria-expanded') === 'true'
      && Math.abs(item.getBoundingClientRect().top - expectedTop - 16) < 2;
  });

  const lastFocusedProfile = page.locator('.student-accordion-item').nth(34);
  await lastFocusedProfile.locator('.student-accordion-header').click();
  await page.waitForFunction(() => {
    const item = document.querySelectorAll('.student-accordion-item')[34];
    const header = item.querySelector('.student-accordion-header');
    const expectedTop = document.getElementById('students-list').getBoundingClientRect().top;
    return header.getAttribute('aria-expanded') === 'true'
      && Math.abs(item.getBoundingClientRect().top - expectedTop - 16) < 2;
  });

  for (const index of [3, 9, 15, 21, 27, 33, 5, 11, 17, 23]) {
    await page.locator('.student-accordion-item').nth(index).locator('.student-accordion-header').click();
  }
  await page.waitForTimeout(500);
  const rapidTapState = await page.evaluate(() => ({
    expanded: document.querySelectorAll('.student-accordion-header[aria-expanded="true"]').length,
    closing: document.querySelectorAll('.student-accordion-body.closing').length,
    visibleRegions: document.querySelectorAll('.student-accordion-body[aria-hidden="false"]').length,
  }));
  if (rapidTapState.expanded !== 1 || rapidTapState.closing !== 0 || rapidTapState.visibleRegions !== 1) {
    throw new Error(`Rapid accordion taps left stale state: ${JSON.stringify(rapidTapState)}`);
  }
  const keyboardProfile = page.locator('.student-accordion-item').nth(5).locator('.student-accordion-header');
  await keyboardProfile.focus();
  await keyboardProfile.press('Space');
  await page.waitForFunction(() => document.querySelectorAll('.student-accordion-header')[5].getAttribute('aria-expanded') === 'true');
  if (await keyboardProfile.evaluate(header => header !== document.activeElement)) throw new Error('Space accordion activation lost focus');
  await keyboardProfile.press('Space');
  await page.waitForFunction(() => {
    const item = document.querySelectorAll('.student-accordion-item')[5];
    return item.querySelector('.student-accordion-header').getAttribute('aria-expanded') === 'false'
      && !item.querySelector('.student-accordion-body').classList.contains('closing');
  });
  const slackAfterSpace = await page.locator('#students-list').evaluate(list => getComputedStyle(list).getPropertyValue('--profile-scroll-slack'));
  if (slackAfterSpace !== '0px') throw new Error(`Closed accordion retained focus slack: ${slackAfterSpace}`);
  if (process.env.ACCORDION_ONLY === '1') {
    if (profileConsoleErrors.length) throw new Error(`Profile accordion emitted console errors: ${profileConsoleErrors.join(' | ')}`);
    console.log('profile accordion smoke ok');
    break accordionCheck;
  }

  await page.locator('#class-combobox-trigger').click();
  await page.locator('#class-combobox-popover').waitFor({ state: 'visible' });
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
  await page.locator('#class-combobox-search').press('Escape');
  await page.locator('#class-combobox-popover').waitFor({ state: 'hidden' });

  await page.evaluate(() => {
    const animate = Element.prototype.animate;
    window.__headingAnimationTimings = [];
    Element.prototype.animate = function(keyframes, options) {
      if (this.id === 'app-view-title') {
        window.__headingAnimationTimings.push({ duration: options.duration, easing: options.easing });
      }
      return animate.call(this, keyframes, options);
    };
  });
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
    headingAnimationTimings: window.__headingAnimationTimings
  }), initialShell.header);
  const expectedHeadingTimings = [100, 160, 100, 160];
  const headingMotionMatches = persistentHeader.headingAnimationTimings.length === expectedHeadingTimings.length
    && persistentHeader.headingAnimationTimings.every((timing, index) => timing.duration === expectedHeadingTimings[index] && timing.easing === 'cubic-bezier(0.23, 1, 0.32, 1)');
  if (!persistentHeader.sameNode || persistentHeader.heading !== 'Profil Katekumen' || persistentHeader.titleOutline !== 'none' || !headingMotionMatches || Math.abs(persistentHeader.rect.x - initialShell.header.x) >= 1 || Math.abs(persistentHeader.rect.width - initialShell.header.width) >= 1 || Math.abs(persistentHeader.rect.height - initialShell.header.height) >= 1 || Math.abs(persistentHeader.logoLeft - initialShell.logoLeft) >= 1 || Math.abs(persistentHeader.textLeft - initialShell.textLeft) >= 1) {
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
  await page.locator('#class-combobox-popover').waitFor({ state: 'visible' });
  const classSelectedBackground = await page.locator('#class-combobox-popover [aria-selected="true"]').evaluate(option => getComputedStyle(option).backgroundColor);
  await page.locator('#class-combobox-search').press('Escape');

  const scanPage = await context.newPage();
  await scanPage.goto(baseUrl, { waitUntil: 'networkidle' });
  await scanPage.evaluate(() => window.setAppState(1));
  await scanPage.locator('#topic-trigger-large').click();
  await scanPage.locator('#topic-combobox-large-popover').waitFor({ state: 'visible' });
  const largeTopicPopover = scanPage.locator('#topic-combobox-large-popover');
  await scanPage.waitForTimeout(32);
  if (!await largeTopicPopover.evaluate(popover => popover.classList.contains('has-scroll-tail'))) throw new Error('Large topic scroll-tail cue is missing');
  await scrollToListEnd(largeTopicPopover.locator('.search-combobox-options'));
  await scanPage.waitForTimeout(32);
  if (await largeTopicPopover.evaluate(popover => popover.classList.contains('has-scroll-tail'))) throw new Error('Large topic scroll-tail cue remained visible at the end');
  if (!await largeTopicPopover.evaluate(popover => popover.classList.contains('has-scroll-head'))) throw new Error('Large topic scroll-head cue is missing after scrolling');
  await largeTopicPopover.locator('.search-combobox-search').fill('Perkenalan');
  if (await largeTopicPopover.locator('[role="option"]').count() !== 1) throw new Error('Large topic combobox filtering failed');
  await largeTopicPopover.locator('.search-combobox-search').press('Escape');
  await scanPage.evaluate(() => window.setAppState(2));
  await scanPage.locator('#topic-combobox-trigger').click();
  await scanPage.locator('#topic-combobox-popover').waitFor({ state: 'visible' });
  const topicPopover = scanPage.locator('#topic-combobox-popover');
  await scanPage.waitForTimeout(32);
  if (!await topicPopover.evaluate(popover => popover.classList.contains('has-scroll-tail'))) throw new Error('Active topic scroll-tail cue is missing');
  await scrollToListEnd(topicPopover.locator('.search-combobox-options'));
  await scanPage.waitForTimeout(32);
  if (await topicPopover.evaluate(popover => popover.classList.contains('has-scroll-tail'))) throw new Error('Active topic scroll-tail cue remained visible at the end');
  if (!await topicPopover.evaluate(popover => popover.classList.contains('has-scroll-head'))) throw new Error('Active topic scroll-head cue is missing after scrolling');
  await topicPopover.locator('.search-combobox-options').evaluate(list => { list.scrollTop = 0; });
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
    if (idleBorder === regularBorder || specialIdleBackground === idleBackground || borderStyle.width !== '1px' || borderStyle.alpha !== 1) throw new Error(`${className} persistent style is missing`);
    if (specialIdleBackground === specialHoverBackground) throw new Error(`${className} hover state is missing`);
    specialBorders.push(idleBorder);
  }
  if (new Set(specialBorders).size !== 3) throw new Error('Special topic border colors are not distinct');
  const pOption = topicPopover.locator('.topic-option-p').first();
  const pIdleBackground = await pOption.evaluate(option => getComputedStyle(option).backgroundColor);
  await pOption.click();
  if (await scanPage.locator('#topic-combobox-trigger').evaluate(trigger => getComputedStyle(trigger, '::after').animationName) !== 'none') throw new Error('Selected topic trigger is still glowing');
  await scanPage.locator('#topic-combobox-trigger').click();
  await scanPage.locator('#topic-combobox-popover').waitFor({ state: 'visible' });
  const selectedP = topicPopover.locator('.topic-option-p[aria-selected="true"]');
  if (await selectedP.evaluate(option => getComputedStyle(option).backgroundColor) === pIdleBackground) throw new Error('Selected P topic fill is missing');
  const topicLayout = await scanPage.evaluate(() => {
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
      below: reader.top - trigger.bottom,
      scannerBottomGap: progress.top - reader.bottom,
      scannerSize: reader.width,
      footerHeight: appContainer.bottom - footer.top,
      footerTopGap: footerText.top - footer.top,
      footerBottomGap: appContainer.bottom - footerText.bottom,
      triggerHeight: trigger.height,
      progressWidth: progress.width,
      optionsHeight: options.height,
      animationName: getComputedStyle(triggerElement, '::after').animationName,
      topGlowClearance,
    };
  });
  const matchesProfileHeight = Math.abs(topicLayout.triggerHeight - classTriggerHeight) < 1;
  const matchesProfileWidth = Math.abs(topicLayout.pickerWidth - profileSpacing.pickerWidth) < 1;
  const matchesProgressWidth = Math.abs(topicLayout.progressWidth - topicLayout.pickerWidth) < 1;
  const matchesProfileClearance = Math.abs(topicLayout.sideClearance - profileSpacing.sideClearance) < 1;
  const selectedTopicIsStatic = topicLayout.animationName === 'none';
  const scannerIsCentered = Math.abs(topicLayout.below - topicLayout.scannerBottomGap) < 1
    && topicLayout.below >= 16;
  const footerIsCompactAndCentered = topicLayout.footerHeight <= 40 && Math.abs(topicLayout.footerTopGap - topicLayout.footerBottomGap) < 1;
  if (!topicLayout.contained || !topicLayout.centered || !matchesProfileHeight || !matchesProfileWidth || !matchesProgressWidth || !matchesProfileClearance || !selectedTopicIsStatic || !scannerIsCentered || !footerIsCompactAndCentered || topicLayout.scannerSize < 287 || topicLayout.topGlowClearance < 8 || topicLayout.optionsHeight < 330) {
    throw new Error(`Topic combobox layout does not match the profile selector: ${JSON.stringify(topicLayout)}`);
  }
  await scanPage.setViewportSize({ width: 390, height: 844 });
  await scanPage.waitForFunction(() => {
    const popover = document.getElementById('topic-combobox-popover').getBoundingClientRect();
    return popover.top >= 8 && popover.bottom <= visualViewport.height - 8;
  });
  const topicListEnd = await scrollToListEnd(topicPopover.locator('.search-combobox-options'));
  if (topicListEnd.scrollTop < topicListEnd.maxScrollTop - 1 || topicListEnd.lastBottom > topicListEnd.visibleBottom + 1) {
    throw new Error(`Topic list end is clipped on mobile: ${JSON.stringify(topicListEnd)}`);
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
    { width: 519, height: 837 },
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
    await Promise.all([page, scanPage].map(currentPage => currentPage.waitForFunction(() => Math.abs(parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--vh')) * 100 - visualViewport.height) < 1)));
    await scanPage.evaluate(() => window.setAppState(2));
    const scanViewport = await scanPage.evaluate(() => {
      const nav = document.getElementById('app-nav').getBoundingClientRect();
      const container = document.getElementById('app-container').getBoundingClientRect();
      const reader = document.getElementById('reader-container').getBoundingClientRect();
      const history = document.getElementById('queue-history-panel').getBoundingClientRect();
      const trigger = document.getElementById('topic-combobox-trigger').getBoundingClientRect();
      const progress = document.querySelector('.segmented-progress-bar').getBoundingClientRect();
      const main = document.getElementById('main-app-section');
      const bodyPaddingTop = parseFloat(getComputedStyle(document.body).paddingTop);
      const bodyPaddingBottom = parseFloat(getComputedStyle(document.body).paddingBottom);
      return {
        containerHeight: container.height,
        expectedContainerHeight: Math.min(innerHeight - container.top - bodyPaddingBottom, 768),
        shellCenterOffset: Math.abs((nav.top + container.bottom) / 2 - (bodyPaddingTop + innerHeight - bodyPaddingBottom) / 2),
        cameraWidth: reader.width,
        cameraHeight: reader.height,
        scannerTopGap: reader.top - trigger.bottom,
        scannerBottomGap: progress.top - reader.bottom,
        historyHeight: history.height,
        mainOverflowY: getComputedStyle(main).overflowY,
        mainClientHeight: main.clientHeight,
        mainScrollHeight: main.scrollHeight,
        mainScrollable: main.scrollHeight > main.clientHeight,
        horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
      };
    });
    if (Math.abs(scanViewport.containerHeight - scanViewport.expectedContainerHeight) >= 1
      || scanViewport.shellCenterOffset >= 1
      || scanViewport.horizontalOverflow
      || Math.abs(scanViewport.cameraWidth - scanViewport.cameraHeight) >= 1
      || scanViewport.cameraWidth < 179
      || scanViewport.cameraWidth > 341
      || Math.abs(scanViewport.scannerTopGap - scanViewport.scannerBottomGap) >= 1
      || scanViewport.scannerTopGap < 16
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
    const selectionViewport = await scanPage.evaluate(() => {
      const nav = document.getElementById('app-nav').getBoundingClientRect();
      const container = document.getElementById('app-container').getBoundingClientRect();
      const bodyPaddingTop = parseFloat(getComputedStyle(document.body).paddingTop);
      const bodyPaddingBottom = parseFloat(getComputedStyle(document.body).paddingBottom);
      return {
        height: container.height,
        expectedHeight: Math.min(innerHeight - container.top - bodyPaddingBottom, 768),
        shellCenterOffset: Math.abs((nav.top + container.bottom) / 2 - (bodyPaddingTop + innerHeight - bodyPaddingBottom) / 2),
      };
    });
    if (Math.abs(selectionViewport.height - selectionViewport.expectedHeight) >= 1 || selectionViewport.shellCenterOffset >= 1) {
      throw new Error(`Topic selection does not respect the app height cap at ${viewport.width}x${viewport.height}`);
    }
    await scanPage.evaluate(() => window.setAppState(2));

    const profileViewport = await page.evaluate(() => {
      const nav = document.getElementById('app-nav').getBoundingClientRect();
      const container = document.getElementById('app-container').getBoundingClientRect();
      const infoBar = document.getElementById('profile-info-bar').getBoundingClientRect();
      const search = document.querySelector('.profile-search-field').getBoundingClientRect();
      const summary = document.getElementById('students-summary').getBoundingClientRect();
      const bodyPaddingTop = parseFloat(getComputedStyle(document.body).paddingTop);
      const bodyPaddingBottom = parseFloat(getComputedStyle(document.body).paddingBottom);
      return {
        containerHeight: container.height,
        expectedContainerHeight: Math.min(innerHeight - container.top - bodyPaddingBottom, 768),
        shellCenterOffset: Math.abs((nav.top + container.bottom) / 2 - (bodyPaddingTop + innerHeight - bodyPaddingBottom) / 2),
        horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
        controlsShareRow: Math.abs((search.top + search.bottom) / 2 - (summary.top + summary.bottom) / 2) < 1,
        controlsContained: search.left >= infoBar.left && summary.right <= infoBar.right,
      };
    });
    if (Math.abs(profileViewport.containerHeight - profileViewport.expectedContainerHeight) >= 1 || profileViewport.shellCenterOffset >= 1 || profileViewport.horizontalOverflow || !profileViewport.controlsShareRow || !profileViewport.controlsContained) {
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

  await scanPage.locator('#topic-combobox-trigger').click();
  await scanPage.locator('#topic-combobox-popover').waitFor({ state: 'visible' });
  await scanPage.locator('#topic-combobox-trigger').click();
  const closedTopic = await scanPage.locator('#topic-combobox-popover').evaluate(popover => ({ hidden: popover.hidden, inert: popover.inert }));
  if (!closedTopic.hidden || !closedTopic.inert) throw new Error(`Topic popover did not close immediately: ${JSON.stringify(closedTopic)}`);
  await scanPage.locator('#topic-combobox-trigger').click();
  await scanPage.locator('#topic-combobox-popover').waitFor({ state: 'visible' });
  await scanPage.locator('#topic-combobox-search').press('Escape');

  const unauthenticatedContext = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'no-preference' });
  const loginPage = await unauthenticatedContext.newPage();
  await loginPage.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  const loginButton = loginPage.locator('#login-btn');
  await loginButton.waitFor({ state: 'visible' });
  await loginPage.locator('#login-input').focus();
  await loginPage.setViewportSize({ width: 390, height: 420 });
  await loginPage.waitForFunction(() => Math.abs(parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--vh')) * 100 - visualViewport.height) < 1);
  const keyboardLayout = await loginPage.evaluate(() => {
    const input = document.getElementById('login-input').getBoundingClientRect();
    const body = document.body.getBoundingClientRect();
    return {
      inputTop: input.top,
      inputBottom: input.bottom,
      viewportTop: visualViewport.offsetTop,
      viewportBottom: visualViewport.offsetTop + visualViewport.height,
      bodyTop: body.top,
      bodyHeight: body.height,
    };
  });
  if (keyboardLayout.inputTop < keyboardLayout.viewportTop || keyboardLayout.inputBottom > keyboardLayout.viewportBottom || Math.abs(keyboardLayout.bodyTop - keyboardLayout.viewportTop) > 1 || Math.abs(keyboardLayout.bodyHeight - (keyboardLayout.viewportBottom - keyboardLayout.viewportTop)) > 1) {
    throw new Error(`Login field is clipped by the mobile keyboard viewport: ${JSON.stringify(keyboardLayout)}`);
  }
  await loginPage.setViewportSize({ width: 390, height: 844 });
  const loginTransition = await loginButton.evaluate(button => {
    const style = getComputedStyle(button);
    return { properties: style.transitionProperty.split(',').map(value => value.trim()), duration: style.transitionDuration };
  });
  if (!loginTransition.properties.includes('transform') || loginTransition.properties.includes('all') || !loginTransition.duration.includes('0.12s')) throw new Error(`Login press transition is incorrect: ${JSON.stringify(loginTransition)}`);
  const loginBox = await loginButton.boundingBox();
  await loginPage.mouse.move(loginBox.x + loginBox.width / 2, loginBox.y + loginBox.height / 2);
  await loginPage.mouse.down();
  await loginPage.waitForTimeout(80);
  const loginPressed = await loginButton.evaluate(button => ({ active: button.matches(':active'), transform: getComputedStyle(button).transform }));
  await loginPage.mouse.move(1, 1);
  await loginPage.mouse.up();
  if (!loginPressed.active || Number(loginPressed.transform.match(/^matrix\(([^,]+)/)?.[1] ?? 1) >= 1) throw new Error(`Login press feedback is missing: ${JSON.stringify(loginPressed)}`);
  await loginPage.emulateMedia({ reducedMotion: 'reduce' });
  await loginButton.hover();
  await loginPage.mouse.down();
  await loginPage.waitForTimeout(80);
  const reducedLogin = await loginButton.evaluate(button => ({ transform: getComputedStyle(button).transform, opacity: parseFloat(getComputedStyle(button).opacity) }));
  await loginPage.mouse.move(1, 1);
  await loginPage.mouse.up();
  if (reducedLogin.transform !== 'none' || reducedLogin.opacity >= 1) throw new Error(`Reduced-motion login feedback is incorrect: ${JSON.stringify(reducedLogin)}`);
  await unauthenticatedContext.close();

  profileClasses = profileClasses.slice(0, 6);
  await page.reload({ waitUntil: 'networkidle' });
  if (!await page.locator('#class-combobox-search').evaluate(search => search.hidden)) {
    throw new Error('Class search is visible with fewer than seven classes');
  }
  await page.locator('#class-combobox-trigger').click();
  await page.locator('#class-combobox-popover').waitFor({ state: 'visible' });
  await page.waitForFunction(() => document.activeElement?.matches('#class-combobox-options [role="option"]'));
  await page.keyboard.press('Escape');

  profileClasses.push({ code: 'K7', name: 'Kelas 7' });
  await page.reload({ waitUntil: 'networkidle' });
  if (await page.locator('#class-combobox-search').evaluate(search => search.hidden)) {
    throw new Error('Class search is hidden with seven classes');
  }
  console.log('search combobox smoke ok');
  }
} finally {
  await browser?.close();
  server.kill();
}

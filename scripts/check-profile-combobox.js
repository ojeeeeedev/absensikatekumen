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
    body: JSON.stringify({ status: 'ok', students: [] })
  }));

  await page.goto(`${baseUrl}/profile`, { waitUntil: 'networkidle' });
  const profileSpinnerColors = await page.locator('.app-spinner').first().evaluate(spinner => {
    const light = getComputedStyle(spinner).color;
    document.documentElement.setAttribute('data-theme', 'dark');
    const dark = getComputedStyle(spinner).color;
    const stroke = getComputedStyle(spinner.shadowRoot.querySelector('svg')).stroke;
    document.documentElement.setAttribute('data-theme', 'light');
    return { light, dark, stroke };
  });
  if (await page.locator('.app-spinner').count() !== 2 || profileSpinnerColors.light === profileSpinnerColors.dark || profileSpinnerColors.dark !== profileSpinnerColors.stroke || await page.locator('.grid-column-scan-loader').count()) {
    throw new Error(`Profile spinners do not follow the theme: ${JSON.stringify(profileSpinnerColors)}`);
  }
  const profileSpacing = await page.evaluate(() => {
    const header = document.querySelector('#profile-page .header-container').getBoundingClientRect();
    const container = document.querySelector('#profile-page .profile-selector-container').getBoundingClientRect();
    const root = document.getElementById('class-combobox').getBoundingClientRect();
    const triggerElement = document.getElementById('class-combobox-trigger');
    const trigger = triggerElement.getBoundingClientRect();
    const placeholder = document.querySelector('#profile-page .welcome-placeholder').getBoundingClientRect();
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
  const options = await page.locator('[role="option"]').allTextContents();
  if (options.length !== 1 || !options[0].includes('Malam')) throw new Error('Class filtering failed');
  await page.locator('#class-combobox-search').press('ArrowDown');
  await page.keyboard.press('Enter');
  if (await page.locator('#class-selector').inputValue() !== 'MAL') throw new Error('Class selection failed');
  if (await page.locator('#class-combobox-trigger').getAttribute('aria-expanded') !== 'false') throw new Error('Combobox did not close');
  if (await page.locator('#class-combobox-trigger').evaluate(trigger => getComputedStyle(trigger).animationName) !== 'none') throw new Error('Selected class trigger is still glowing');
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
    const header = document.querySelector('#main-app-section .header-container').getBoundingClientRect();
    const root = document.getElementById('topic-combobox-active').getBoundingClientRect();
    const panel = document.getElementById('scanning-panel').getBoundingClientRect();
    const triggerElement = document.getElementById('topic-combobox-trigger');
    const trigger = triggerElement.getBoundingClientRect();
    const reader = document.getElementById('reader-container').getBoundingClientRect();
    const progress = document.querySelector('.segmented-progress-bar').getBoundingClientRect();
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
  if (!topicLayout.contained || !topicLayout.centered || !matchesProfileHeight || !matchesProfileWidth || !matchesProgressWidth || !matchesProfileClearance || !selectedTopicIsStatic || !hasUniformSpacing || !hasUniformScannerSpacing || topicLayout.topGlowClearance < 8) {
    throw new Error(`Topic combobox layout does not match the profile selector: ${JSON.stringify(topicLayout)}`);
  }
  await topicPopover.locator('.search-combobox-search').fill('Pentakosta');
  const topics = await topicPopover.locator('[role="option"]').allTextContents();
  if (topics.length !== 1 || !topics[0].includes('Pentakosta')) throw new Error('Topic filtering failed');
  await topicPopover.locator('.search-combobox-search').press('ArrowDown');
  await scanPage.keyboard.press('Enter');
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
  if (classSize.width !== 378 || classSize.height !== 44 || JSON.stringify(topicSize) !== JSON.stringify(classSize) || progressWidth !== 378) {
    throw new Error(`Desktop picker geometry mismatch: ${JSON.stringify({ classSize, topicSize, progressWidth })}`);
  }
  console.log('search combobox smoke ok');
} finally {
  await browser?.close();
  server.kill();
}

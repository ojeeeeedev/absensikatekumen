import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const PORT = 5511;
const baseURL = `http://localhost:${PORT}`;

const sampleDashboard = {
  status: 'ok',
  classCode: 'SAB',
  metadata: {
    kelompok: 'Santo Sabinus',
    intakeYear: '2025',
    baptismYear: '2026',
    priest: 'R. P. Leo van Beurden, O.S.C.',
    lastUpdated: '2026-07-04 19:42:10'
  },
  summary: {
    total: 31,
    gender: [{ label: 'P', count: 18, rate: 58.1, percentage: '58.1%' }],
    religion: [{ label: 'Islam', count: 14, rate: 45.2, percentage: '45.2%' }],
    maritalStatus: [{ label: 'Belum Diketahui', count: 31, rate: 100, percentage: '100.0%' }]
  },
  attendance: {
    zones: [
      { key: 'green', label: 'Zona Hijau (Aman)', count: 18, rate: 58.1, percentage: '58.1%' },
      { key: 'yellow', label: 'Zona Kuning (Perhatian)', count: 10, rate: 32.3, percentage: '32.3%' },
      { key: 'red', label: 'Zona Merah (Pengawasan)', count: 3, rate: 9.7, percentage: '9.7%' },
      { key: 'black', label: 'Zona Hitam (Penindakan)', count: 0, rate: 0, percentage: '0.0%' }
    ],
    latestTopic: { topic: 'Topik 29', topicName: 'Pentakosta', presentCount: 11, totalCount: 31, ratio: '11/31', rate: 35.5, percentage: '35.5%' },
    topicHistory: [
      { topic: 'Topik 29', topicName: 'Pentakosta', presentCount: 11, totalCount: 31, ratio: '11/31', rate: 35.5, percentage: '35.5%' },
      { topic: 'Topik 28', topicName: 'Kebangkitan Yesus', presentCount: 9, totalCount: 31, ratio: '9/31', rate: 29, percentage: '29.0%' }
    ],
    lowAttendanceTopics: [
      { topic: 'Topik 28', topicName: 'Kebangkitan Yesus', presentCount: 9, totalCount: 31, ratio: '9/31', rate: 29, percentage: '29.0%' },
      { topic: 'Topik 29', topicName: 'Pentakosta', presentCount: 11, totalCount: 31, ratio: '11/31', rate: 35.5, percentage: '35.5%' }
    ],
    riskParticipants: [
      { studentId: '2025/SAB/001', name: 'Ariana Putri', kelasKi: 'KI A', katekisKk: 'KK Paulus', contact: '081234567890', zone: 'Zona Merah', rate: 50, percentage: '50.0%' },
      { studentId: '2025/SAB/002', name: 'Bima Santoso', kelasKi: 'KI B', katekisKk: 'KK Petrus', contact: '081298765432', zone: 'Zona Merah', rate: 55, percentage: '55.0%' }
    ]
  }
};

const sampleStudents = [
  { studentId: '2025/SAB/001', name: 'Ariana Putri', kelasKi: 'KI A', katekisKk: 'KK Paulus' },
  { studentId: '2025/SAB/002', name: 'Bima Santoso', kelasKi: 'KI B', katekisKk: 'KK Petrus' }
];

function waitForServer() {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const tick = async () => {
      try {
        const res = await fetch(baseURL);
        if (res.ok) return resolve();
      } catch {
        // keep polling
      }
      if (Date.now() - started > 15000) return reject(new Error('Local server did not start in time'));
      setTimeout(tick, 250);
    };
    tick();
  });
}

async function installRoutes(page) {
  await page.route('https://fonts.googleapis.com/**', (route) => route.fulfill({ contentType: 'text/css', body: '' }));
  await page.route('https://fonts.gstatic.com/**', (route) => route.abort());
  await page.route('https://unpkg.com/reicon/cdn/reicon.min.js', (route) => route.fulfill({
    contentType: 'application/javascript',
    body: 'customElements.define("re-icon", class extends HTMLElement {});'
  }));
  await page.route('**/api/classes', (route) => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ status: 'ok', classes: [{ code: 'SAB', name: 'Santo Sabinus' }] })
  }));
  await page.route('**/api/dashboard-data**', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 150));
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(sampleDashboard) });
  });
  await page.route('**/api/students**', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 150));
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ status: 'ok', students: sampleStudents }) });
  });
}

async function assertDashboard(page, width, height) {
  await page.setViewportSize({ width, height });
  await page.context().addCookies([{ name: 'auth_token', value: 'fake', domain: 'localhost', path: '/' }]);
  await installRoutes(page);
  await page.goto(`${baseURL}/dashboard?classCode=SAB`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.scan-loading-text');
  const loadingAnimation = await page.$eval('#dashboard-loader .scan-loading-text', (el) => getComputedStyle(el).animationName);
  if (!loadingAnimation.includes('text-column-scan')) throw new Error('Dashboard loading text is not using column-scan animation');
  await page.waitForSelector('.watch-card');
  const metrics = await page.locator('.metric-card').count();
  if (metrics !== 3) throw new Error(`Expected 3 priority metric cards, found ${metrics}`);
  await page.fill('#risk-search-input', 'Ariana');
  const watchRows = await page.locator('.watch-card').count();
  if (watchRows !== 1) throw new Error(`Expected filtered watchlist to show 1 row, found ${watchRows}`);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  if (overflow) throw new Error(`Dashboard has horizontal overflow at ${width}x${height}`);
  const activeText = await page.locator('.dashboard-nav .nav-item.active').innerText();
  if (!activeText.includes('Dashboard')) throw new Error('Dashboard nav active state missing');
}

async function assertProfileLoader(page) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.context().addCookies([{ name: 'auth_token', value: 'fake', domain: 'localhost', path: '/' }]);
  await installRoutes(page);
  await page.goto(`${baseURL}/profile`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => [...document.querySelectorAll('#class-selector option')].some((option) => option.value === 'SAB'));
  await page.selectOption('#class-selector', 'SAB');
  await page.waitForSelector('#students-loader .scan-loading-text');
  const animation = await page.$eval('#students-loader .scan-loading-text', (el) => getComputedStyle(el).animationName);
  if (!animation.includes('text-column-scan')) throw new Error('Profile loading text is not using column-scan animation');
}

const server = spawn(process.execPath, ['app.js'], {
  cwd: fileURLToPath(new URL('..', import.meta.url)),
  env: { ...process.env, PORT: String(PORT) },
  stdio: ['ignore', 'pipe', 'pipe']
});

try {
  await waitForServer();
  const browser = await chromium.launch({ headless: true });
  try {
    const desktop = await browser.newPage();
    await assertDashboard(desktop, 1440, 900);
    await desktop.close();

    const mobile = await browser.newPage();
    await assertDashboard(mobile, 390, 844);
    await mobile.emulateMedia({ colorScheme: 'dark' });
    await mobile.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
    const darkOverflow = await mobile.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    if (darkOverflow) throw new Error('Dashboard dark mode has horizontal overflow on mobile');
    await mobile.close();

    const profile = await browser.newPage();
    await assertProfileLoader(profile);
    await profile.close();
  } finally {
    await browser.close();
  }
  console.log('dashboard ui smoke ok');
} finally {
  server.kill('SIGTERM');
}

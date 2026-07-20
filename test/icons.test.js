import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ICON_SOURCE_FILES, replaceIconReferences, saveIcon } from '../scripts/save-login-icon.js';

const publicDir = new URL('../public/', import.meta.url);
const index = fs.readFileSync(new URL('index.html', publicDir), 'utf8');
const renderer = fs.readFileSync(new URL('icons.html', publicDir), 'utf8');
const loader = fs.readFileSync(new URL('reicon-loader.js', publicDir), 'utf8');
const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const reiconCdn = 'https://unpkg.com/reicon/cdn/reicon.min.js';

describe('Reicon editor', () => {
  it('loads app icons from official per-icon modules', () => {
    expect(index).toContain('<script src="reicon-loader.js"></script>');
    expect(renderer).toContain(`<script src="${reiconCdn}"></script>`);
    expect(loader).toContain('https://unpkg.com/reicon@${VERSION}/icons/${componentName(name)}.js');
  });

  it('reloads the icon saver during local editing', () => {
    expect(app).toContain("import(`./scripts/save-login-icon.js?updated=${Date.now()}`)");
  });

  it('renders only app icons with grid-driven replacement', () => {
    expect(renderer).toContain('https://unpkg.com/reicon@1.1.1/icons/${componentName(name)}.js');
    expect(renderer).toContain('const availableIcons = new Set(Reicon.icons);');
    expect(renderer).toContain('id="icon-name"');
    expect(renderer).toContain('id="icon-weight"');
    expect(renderer).not.toContain('id="icon-target"');
    expect(renderer).toContain('id="target-list"');
    expect(renderer).not.toContain('id="icon-list"');
    expect(renderer).toContain("weight: weight === 'filled' ? 'Filled' : 'Outline'");
    expect(renderer).toContain("weightSelect.addEventListener('change', () => updatePreview());");
    expect(renderer).toContain('Save selected icon');
    expect(renderer).toContain("fetch('/api/dev/icons'");
    expect(renderer).toContain("body: JSON.stringify({ currentName: selectedIcon, name: currentName, weight: weightSelect.value })");
    expect(renderer).toContain("contentType.includes('application/json')");
    expect(renderer).toContain('Save API unavailable. Restart npm start and try again.');
    expect(renderer).toContain("usageByIcon[name] || 'Used by the app'");
    const indexIcons = new Set([...index.matchAll(/<re-icon\b[^>]*\bicon=["']([^"']+)/g)].map(match => match[1]));
    const usageByIcon = JSON.parse(renderer.match(/const usageByIcon = (\{[\s\S]*?\});/)[1]);
    expect([...indexIcons].filter(name => !usageByIcon[name])).toEqual([]);
    expect(['check', 'close-circle', 'refresh', 'timer-alt'].filter(name => !usageByIcon[name])).toEqual([]);
  });

  it('replaces app icon contexts without replacing unrelated strings', () => {
    const source = [
      '<re-icon icon="user" decorative></re-icon>',
      "icon.setAttribute('icon', 'user');",
      "const role = 'user';",
    ].join('\n');
    const result = replaceIconReferences(source, 'user', 'users3', 'filled');

    expect(result.replaced).toBe(2);
    expect(result.source).toContain('<re-icon icon="users3" decorative weight="filled">');
    expect(result.source).toContain("icon.setAttribute('icon', 'users3');");
    expect(result.source).toContain("const role = 'user';");
  });

  it('replaces icons stored in named icon maps', () => {
    const source = "const statusIconByStatus = { success: 'check', error: 'close-circle' };";
    const result = replaceIconReferences(source, 'check', 'verified', 'outline');

    expect(result.replaced).toBe(1);
    expect(result.source).toContain("success: 'verified'");
  });

  it('persists a replacement across the app source files', async () => {
    const rootDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'icon-editor-'));
    await fsPromises.mkdir(path.join(rootDir, 'public'));
    await Promise.all(ICON_SOURCE_FILES.map(file => fsPromises.writeFile(path.join(rootDir, 'public', file), '')));
    await fsPromises.writeFile(path.join(rootDir, 'public', 'index.html'), '<re-icon icon="camera-add" class="upload-icon" decorative></re-icon>');
    const fetchImpl = async () => ({ ok: true });

    await saveIcon({ currentName: 'camera-add', name: 'imageplus', weight: 'filled', rootDir, fetchImpl });

    const savedIndex = await fsPromises.readFile(path.join(rootDir, 'public', 'index.html'), 'utf8');
    expect(savedIndex).toContain('<re-icon icon="imageplus" class="upload-icon" decorative weight="filled">');
  });
});

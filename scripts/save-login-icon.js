import fs from 'node:fs/promises';
import path from 'node:path';

const REICON_VERSION = '1.1.1';
const ICON_NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const ICON_SOURCE_FILES = ['index.html', 'icons.js', 'onboarding.js', 'profile.js', 'script.js', 'toast.js'];

function componentName(name) {
  return name.split('-').map(part => part[0].toUpperCase() + part.slice(1)).join('');
}

const replaceQuotedIcon = (source, currentName, name, onReplace) => source.replace(
  new RegExp(`(["'])${currentName}\\1`, 'g'),
  (_, quote) => {
    onReplace();
    return `${quote}${name}${quote}`;
  },
);

export function replaceIconReferences(source, currentName, name, weight) {
  let replaced = 0;
  let nextSource = source.replace(/<re-icon\b[^>]*>/g, (tag) => {
    const icon = tag.match(/\bicon=(["'])([^"']+)\1/);
    if (!icon || icon[2] !== currentName) return tag;
    replaced += 1;
    let nextTag = tag
      .replace(/\bicon=(["'])[^"']+\1/, `icon="${name}"`)
      .replace(/\sweight=(["'])(?:outline|filled)\1/, '');
    if (weight === 'filled') nextTag = nextTag.replace(/>$/, ' weight="filled">');
    return nextTag;
  });

  nextSource = nextSource.replace(/setAttribute\(\s*["']icon["']\s*,\s*["'][^"']+["']\s*\)/g, (call) => {
    if (!call.includes(`'${currentName}'`) && !call.includes(`"${currentName}"`)) return call;
    return replaceQuotedIcon(call, currentName, name, () => { replaced += 1; });
  });

  nextSource = nextSource.replace(/const\s+iconName\s*=\s*[^;]+;|const\s+(?:icon[\w$]*|[A-Za-z_$][\w$]*Icon[\w$]*)\s*=\s*\{[\s\S]*?\};/g, (block) => (
    replaceQuotedIcon(block, currentName, name, () => { replaced += 1; })
  ));

  return { source: nextSource, replaced };
}

export async function saveIcon({ currentName, name, weight, rootDir = process.cwd(), fetchImpl = fetch }) {
  if (!ICON_NAME_PATTERN.test(currentName) || !ICON_NAME_PATTERN.test(name) || !['outline', 'filled'].includes(weight)) {
    throw new Error('Invalid icon name or weight.');
  }

  const response = await fetchImpl(`https://unpkg.com/reicon@${REICON_VERSION}/icons/${componentName(name)}.js`);
  if (!response.ok) throw new Error(`Reicon icon not found: ${name}.`);

  const publicDir = path.join(rootDir, 'public');
  const changes = [];
  let replaced = 0;
  for (const file of ICON_SOURCE_FILES) {
    const filePath = path.join(publicDir, file);
    const source = await fs.readFile(filePath, 'utf8');
    const result = replaceIconReferences(source, currentName, name, weight);
    if (result.replaced) changes.push({ filePath, source: result.source });
    replaced += result.replaced;
  }
  if (!replaced) throw new Error(`App icon not found: ${currentName}.`);

  await Promise.all(changes.map(change => fs.writeFile(`${change.filePath}.tmp`, change.source)));
  await Promise.all(changes.map(change => fs.rename(`${change.filePath}.tmp`, change.filePath)));
  return { currentName, name, weight, replaced };
}

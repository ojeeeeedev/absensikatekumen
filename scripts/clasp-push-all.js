import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const CLASP_JSON_PATH = path.resolve('.clasp.json');

const DEPLOYMENTS = [
  { class: 'SAB', scriptId: '1yLEwBuUD_-iq0r5TYGhgqFioZQPXzh4MfFtngCvEUT4_DlH1zfo0njr9' },
  { class: 'TOM', scriptId: '1rpgGakEY262k-UAknem7Doy1BexUqimTzOdpvd8qQWAn-OzEskV15F4T' }
];

function main() {
  if (!fs.existsSync(CLASP_JSON_PATH)) {
    console.error('.clasp.json not found!');
    process.exit(1);
  }

  const originalContent = fs.readFileSync(CLASP_JSON_PATH, 'utf8');
  let claspConfig;
  try {
    claspConfig = JSON.parse(originalContent);
  } catch (e) {
    console.error('Failed to parse .clasp.json:', e);
    process.exit(1);
  }

  try {
    for (const dep of DEPLOYMENTS) {
      console.log(`\n===========================================`);
      console.log(`Pushing code to ${dep.class} script...`);
      console.log(`Script ID: ${dep.scriptId}`);
      console.log(`===========================================`);

      // Update .clasp.json with the target scriptId
      claspConfig.scriptId = dep.scriptId;
      fs.writeFileSync(CLASP_JSON_PATH, JSON.stringify(claspConfig, null, 2), 'utf8');

      // Run clasp push
      console.log(`Running: npx @google/clasp push...`);
      execSync('npx @google/clasp push', { stdio: 'inherit' });
      console.log(`Successfully pushed to ${dep.class}!`);
    }
  } catch (err) {
    console.error(`Error during clasp push:`, err.message);
  } finally {
    // Restore original .clasp.json
    console.log(`\nRestoring original .clasp.json...`);
    fs.writeFileSync(CLASP_JSON_PATH, originalContent, 'utf8');
    console.log('Restored.');
  }
}

main();

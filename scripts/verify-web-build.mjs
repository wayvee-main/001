import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

function filesUnder(path) {
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
    const target = join(path, entry.name);
    return entry.isDirectory() ? filesUnder(target) : [target];
  });
}

const javascript = filesUnder('dist').filter((path) => path.endsWith('.js'));
const bundle = javascript.map((path) => readFileSync(path, 'utf8')).join('\n');
const serviceWorker = readFileSync('dist/sw.js', 'utf8');
const problems = [];

if (!bundle.includes('supabase.co')) problems.push('exported JavaScript does not contain the Supabase project URL');
if (!bundle.includes('sb_publishable_')) problems.push('exported JavaScript does not contain a Supabase publishable key');
if (!bundle.includes('Continue with Google')) problems.push('Google authentication action is missing from the export');
if (bundle.includes('Continue with Apple')) problems.push('Apple authentication unexpectedly returned');
if (serviceWorker.includes('__WAYVEE_BUILD__')) problems.push('service worker build token was not stamped');

if (problems.length) {
  console.error(`Web export verification failed:\n- ${problems.join('\n- ')}`);
  process.exit(1);
}

console.log('Web export verification passed.');

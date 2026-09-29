import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const projectRoot = process.cwd();
const distRoot = path.join(projectRoot, 'dist');
const serviceWorkerPath = path.join(distRoot, 'sw.js');
const buildToken = '__WAYVEE_BUILD__';

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collectFiles(absolutePath));
    else files.push(path.relative(distRoot, absolutePath).replaceAll('\\', '/'));
  }

  return files;
}

const assetFiles = [
  ...await collectFiles(path.join(distRoot, '_expo', 'static', 'js')),
  ...await collectFiles(path.join(distRoot, '_expo', 'static', 'css')),
].sort();

const buildId = createHash('sha256').update(assetFiles.join('\n')).digest('hex').slice(0, 12);
const serviceWorker = await readFile(serviceWorkerPath, 'utf8');

if (!serviceWorker.includes(buildToken)) {
  throw new Error(`Expected ${buildToken} in ${serviceWorkerPath}.`);
}

await writeFile(serviceWorkerPath, serviceWorker.replaceAll(buildToken, buildId));
console.log(`Stamped service worker build ${buildId}.`);

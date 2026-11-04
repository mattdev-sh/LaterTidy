import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { zipSync } from 'fflate';

const { version } = JSON.parse(await readFile('package.json', 'utf8'));

async function walk(dir, out = {}) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) await walk(path, out);
    else if (entry.name !== '.DS_Store') out[relative('dist', path)] = new Uint8Array(await readFile(path));
  }
  return out;
}

const files = await walk('dist');
await mkdir('release', { recursive: true });
const target = `release/latertidy-${version}.zip`;
await writeFile(target, zipSync(files, { level: 9, mtime: new Date('2026-01-01') }));
console.log(`${target}: ${Object.keys(files).length} files`);

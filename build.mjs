import { build, context } from 'esbuild';
import { cp, mkdir, readFile, rm, writeFile, access } from 'node:fs/promises';

const watch = process.argv.includes('--watch');
const pkg = JSON.parse(await readFile('package.json', 'utf8'));

async function copyStatic() {
  await mkdir('dist/icons', { recursive: true });
  const manifest = JSON.parse(await readFile('manifest.json', 'utf8'));
  manifest.version = pkg.version;
  await writeFile('dist/manifest.json', JSON.stringify(manifest, null, 2));
  await cp('_locales', 'dist/_locales', { recursive: true });
  for (const file of ['LICENSE', 'THIRD_PARTY_NOTICES']) {
    await cp(file, `dist/${file}`);
  }
  for (const size of [16, 32, 48, 128]) {
    const from = `assets/icons/icon-${size}.png`;
    await access(from).then(() => cp(from, `dist/icons/icon-${size}.png`), () => console.warn(`missing ${from}`));
  }
}

const options = {
  entryPoints: { bridge: 'src/entry/bridge.ts', content: 'src/entry/content.tsx', background: 'src/entry/background.ts' },
  outdir: 'dist',
  bundle: true,
  format: 'iife',
  target: 'chrome111',
  jsx: 'automatic',
  jsxImportSource: 'preact',
  minify: !watch,
  sourcemap: watch ? 'inline' : false,
  loader: { '.css': 'text', '.svg': 'text' },
  legalComments: 'none',
  logLevel: 'info',
  plugins: [{ name: 'static', setup: (b) => b.onEnd(copyStatic) }],
};

await rm('dist', { recursive: true, force: true });
if (watch) await (await context(options)).watch();
else await build(options);

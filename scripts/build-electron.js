const esbuild = require('esbuild');
const path = require('path');
const fs = require('fs');

async function build() {
  const distElectron = path.join(__dirname, '..', 'dist-electron');
  if (!fs.existsSync(distElectron)) {
    fs.mkdirSync(distElectron, { recursive: true });
  }

  console.log('[Build] Compiling Electron main process...');
  await esbuild.build({
    entryPoints: [path.join(__dirname, '..', 'electron', 'main.ts')],
    outfile: path.join(distElectron, 'main.js'),
    bundle: true,
    platform: 'node',
    target: 'node20',
    external: ['electron'],
    format: 'cjs',
    sourcemap: false,
  });

  console.log('[Build] Compiling Electron preload script...');
  await esbuild.build({
    entryPoints: [path.join(__dirname, '..', 'electron', 'preload.ts')],
    outfile: path.join(distElectron, 'preload.js'),
    bundle: true,
    platform: 'node',
    target: 'node20',
    external: ['electron'],
    format: 'cjs',
    sourcemap: false,
  });

  console.log('[Build] Electron build complete!');
}

build().catch((err) => {
  console.error('[Build] Compilation failed:', err);
  process.exit(1);
});

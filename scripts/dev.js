const { spawn } = require('child_process');
const path = require('path');
const http = require('http');

async function runDev() {
  console.log('[Dev] Compiling Electron main & preload scripts...');
  require('./build-electron.js');

  console.log('[Dev] Starting Vite dev server...');
  const vite = spawn('npx', ['vite'], {
    shell: true,
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'development' }
  });

  const waitForVite = () => {
    return new Promise((resolve) => {
      const check = () => {
        const req = http.get('http://127.0.0.1:5173', (res) => {
          resolve();
        });
        req.on('error', () => {
          setTimeout(check, 400);
        });
      };
      check();
    });
  };

  console.log('[Dev] Waiting for Vite server to be ready on port 5173...');
  await waitForVite();
  console.log('[Dev] Vite is ready! Launching Electron...');

  const electron = spawn('npx', ['electron', '.'], {
    shell: true,
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'development' }
  });

  electron.on('close', () => {
    console.log('[Dev] Electron window closed. Shutting down Vite...');
    vite.kill();
    process.exit(0);
  });
}

runDev().catch(err => {
  console.error('[Dev] Error:', err);
  process.exit(1);
});

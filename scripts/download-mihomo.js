const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

async function download() {
  const coreDir = path.join(__dirname, '..', 'core');
  if (!fs.existsSync(coreDir)) {
    fs.mkdirSync(coreDir, { recursive: true });
  }

  console.log('Fetching latest release from MetaCubeX/mihomo...');
  const options = {
    headers: {
      'User-Agent': 'Gravity-VPN-Builder'
    }
  };

  const getJson = (url) => new Promise((resolve, reject) => {
    https.get(url, options, (res) => {
      let data = '';
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(getJson(res.headers.location));
      }
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });

  const release = await getJson('https://api.github.com/repos/MetaCubeX/mihomo/releases/latest');
  const asset = release.assets.find(a => /^mihomo-windows-amd64-compatible.*\.zip$/i.test(a.name))
    || release.assets.find(a => /windows-amd64.*\.zip$/i.test(a.name));

  if (!asset) {
    throw new Error('Could not find Windows amd64 zip asset in release');
  }

  console.log(`Found asset: ${asset.name} (${asset.browser_download_url})`);
  const zipPath = path.join(coreDir, 'mihomo.zip');

  const downloadFile = (url, dest) => new Promise((resolve, reject) => {
    https.get(url, options, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(downloadFile(res.headers.location, dest));
      }
      const file = fs.createWriteStream(dest);
      res.pipe(file);
      file.on('finish', () => {
        file.close(resolve);
      });
    }).on('error', reject);
  });

  console.log('Downloading...');
  await downloadFile(asset.browser_download_url, zipPath);
  console.log('Download complete. Extracting using tar / powershell...');

  // Extract
  try {
    execSync(`tar -xf "${zipPath}" -C "${coreDir}"`, { stdio: 'inherit' });
  } catch {
    execSync(`powershell -command "Expand-Archive -Path '${zipPath}' -DestinationPath '${coreDir}' -Force"`, { stdio: 'inherit' });
  }

  if (fs.existsSync(zipPath)) {
    fs.unlinkSync(zipPath);
  }

  // Rename extracted exe to mihomo.exe if needed
  const files = fs.readdirSync(coreDir);
  console.log('Files in core:', files);
  const exeFile = files.find(f => f.toLowerCase().endsWith('.exe'));
  if (exeFile && exeFile !== 'mihomo.exe') {
    fs.renameSync(path.join(coreDir, exeFile), path.join(coreDir, 'mihomo.exe'));
    console.log(`Renamed ${exeFile} to mihomo.exe`);
  }

  const mihomoPath = path.join(coreDir, 'mihomo.exe');
  if (fs.existsSync(mihomoPath)) {
    const stats = fs.statSync(mihomoPath);
    console.log(`Success! mihomo.exe is ready at ${mihomoPath} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
  } else {
    throw new Error('mihomo.exe not found after extraction');
  }
}

download().catch(err => {
  console.error('Error downloading mihomo:', err);
  process.exit(1);
});

const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const cacheDir = path.join(process.env.LOCALAPPDATA, 'electron-builder', 'Cache', 'winCodeSign');
const destDir = path.join(cacheDir, 'winCodeSign-2.6.0');
const sevenZip = path.join(__dirname, '..', 'node_modules', '7zip-bin', 'win', 'x64', '7za.exe');

console.log('Cache dir:', cacheDir);
const files = fs.readdirSync(cacheDir);
const zFile = files.find(f => f.endsWith('.7z'));

if (zFile) {
  const archivePath = path.join(cacheDir, zFile);
  console.log(`Extracting ${archivePath} into ${destDir} excluding darwin dylibs...`);
  try {
    execSync(`"${sevenZip}" x -bd -xr!*darwin* "${archivePath}" "-o${destDir}" -aoa`, { stdio: 'inherit' });
    console.log('winCodeSign extracted successfully!');
  } catch (err) {
    console.log('7z returned status:', err.status);
  }
} else {
  console.log('No .7z found in cacheDir');
}

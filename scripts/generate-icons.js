const fs = require('fs');
const path = require('path');
const { Resvg } = require('@resvg/resvg-js');
const pngToIcoModule = require('png-to-ico');
const pngToIco = pngToIcoModule.default || pngToIcoModule;

async function generate() {
  const assetsDir = path.join(__dirname, '..', 'assets');
  const svgPath = path.join(assetsDir, 'icon.svg');
  const svg = fs.readFileSync(svgPath, 'utf8');

  // Generate 256x256 PNG
  const resvg256 = new Resvg(svg, {
    fitTo: { mode: 'width', value: 256 }
  });
  const png256Data = resvg256.render().asPng();
  const png256Path = path.join(assetsDir, 'icon-256.png');
  fs.writeFileSync(png256Path, png256Data);

  // Generate 512x512 PNG
  const resvg512 = new Resvg(svg, {
    fitTo: { mode: 'width', value: 512 }
  });
  const png512Data = resvg512.render().asPng();
  const png512Path = path.join(assetsDir, 'icon.png');
  fs.writeFileSync(png512Path, png512Data);

  // Generate 64x64 PNG for tray
  const resvg64 = new Resvg(svg, {
    fitTo: { mode: 'width', value: 64 }
  });
  const png64Data = resvg64.render().asPng();
  const png64Path = path.join(assetsDir, 'tray-icon.png');
  fs.writeFileSync(png64Path, png64Data);

  // Generate ICO
  const icoBuf = await pngToIco([png256Path]);
  const icoPath = path.join(assetsDir, 'icon.ico');
  fs.writeFileSync(icoPath, icoBuf);

  console.log('Successfully generated icon.png, icon.ico, and tray-icon.png in assets/');
}

generate().catch(err => {
  console.error('Failed to generate icons:', err);
  process.exit(1);
});

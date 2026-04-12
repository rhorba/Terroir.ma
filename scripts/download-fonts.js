#!/usr/bin/env node
/**
 * Downloads required font assets for PDF certificate generation.
 * Run once after cloning: npm run fonts:download
 *
 * Fonts downloaded:
 *   Amiri-Regular.ttf  — Arabic text in PDF (OFL license)
 *   DejaVuSans.ttf     — Latin + Tifinagh text in PDF (free license)
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const os = require('os');

const FONTS_DIR = path.join(__dirname, '..', 'assets', 'fonts');

const SOURCES = [
  {
    name: 'Amiri-Regular.ttf',
    zipUrl: 'https://github.com/aliftype/amiri/releases/download/1.003/Amiri-1.003.zip',
    zipEntry: 'Amiri-1.003/Amiri-Regular.ttf',
  },
  {
    name: 'DejaVuSans.ttf',
    zipUrl: 'https://github.com/dejavu-fonts/dejavu-fonts/releases/download/version_2_37/dejavu-sans-ttf-2.37.zip',
    zipEntry: 'dejavu-sans-ttf-2.37/ttf/DejaVuSans.ttf',
  },
];

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const follow = (u) =>
      https.get(u, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          file.destroy();
          return follow(res.headers.location);
        }
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode} for ${u}`));
          return;
        }
        res.pipe(file);
        file.on('finish', () => file.close(resolve));
      }).on('error', reject);
    follow(url);
  });
}

async function main() {
  if (!fs.existsSync(FONTS_DIR)) {
    fs.mkdirSync(FONTS_DIR, { recursive: true });
  }

  for (const { name, zipUrl, zipEntry } of SOURCES) {
    const dest = path.join(FONTS_DIR, name);
    if (fs.existsSync(dest)) {
      console.log(`  ✓ ${name} already present — skipping`);
      continue;
    }

    console.log(`  ↓ Downloading ${name}...`);
    const tmp = path.join(os.tmpdir(), `terroir-font-${Date.now()}.zip`);
    try {
      await download(zipUrl, tmp);
      execSync(`unzip -o "${tmp}" "${zipEntry}" -d "${os.tmpdir()}/terroir-font-extract/"`, {
        stdio: 'pipe',
      });
      const extracted = path.join(os.tmpdir(), 'terroir-font-extract', zipEntry);
      fs.copyFileSync(extracted, dest);
      console.log(`  ✓ ${name} installed (${Math.round(fs.statSync(dest).size / 1024)} KB)`);
    } finally {
      if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
    }
  }

  console.log('\nAll fonts ready. PDF certificate generation is now functional.');
}

main().catch((err) => {
  console.error('Font download failed:', err.message);
  process.exit(1);
});

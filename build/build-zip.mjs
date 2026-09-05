import * as esbuild from 'esbuild';
import { minify } from 'terser';
import { Packer } from 'roadroller';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as zlib from 'node:zlib';

const MAX_BYTES = 13312;

async function build() {
  console.log('🌈 Building RAINBOW CLAW for JS13k & Wavedash...');
  const distDir = path.resolve('dist');
  emptyDir(distDir);

  // 1. Bundle TypeScript with esbuild
  const bundleResult = await esbuild.build({
    entryPoints: ['src/main.ts'],
    bundle: true,
    write: false,
    format: 'iife',
    target: 'es2022',
    minify: false,
  });

  const bundledJs = bundleResult.outputFiles[0].text;
  console.log(`📦 Bundled JS size: ${bundledJs.length} bytes`);

  // 2. Deep Minify with Terser
  const terserResult = await minify(bundledJs, {
    ecma: 2020,
    module: false,
    toplevel: true,
    compress: {
      passes: 6,
      unsafe: true,
      unsafe_arrows: true,
      unsafe_comps: true,
      unsafe_math: true,
      unsafe_methods: true,
      booleans: false,
      drop_debugger: true,
      pure_getters: true,
      reduce_vars: true,
      dead_code: true,
    },
    mangle: {
      toplevel: true,
      eval: true,
    },
    format: {
      wrap_iife: false,
      comments: false,
    }
  });

  const minifiedJs = terserResult.code || bundledJs;
  console.log(`⚡ Terser minified: ${minifiedJs.length} bytes`);

  // 3. Roadroller JS Cruncher
  console.log('🚗 Packing with Roadroller...');
  let finalJs = minifiedJs;
  try {
    const packer = new Packer([
      {
        data: minifiedJs,
        type: 'js',
        action: 'eval',
      },
    ]);
    await packer.optimize(2);
    const { firstLine, secondLine } = packer.makeDecoder();
    finalJs = firstLine + secondLine;
    console.log(`✨ Roadroller reduction: ${minifiedJs.length} -> ${finalJs.length} bytes`);
  } catch (err) {
    console.warn('⚠️ Roadroller fallback:', err);
  }

  // 4. Inline into minimal HTML inside dist/
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover"><title>Rainbow Claw</title><style>*{margin:0;padding:0;box-sizing:border-box}html,body{width:100%;height:100%;overflow:hidden;background:#050508;display:flex;align-items:center;justify-content:center;touch-action:none;-webkit-touch-callout:none;user-select:none;-webkit-user-select:none}canvas{display:block;image-rendering:pixelated;image-rendering:crisp-edges;max-width:100vw;max-height:100vh;aspect-ratio:4/3;object-fit:contain;box-shadow:0 0 50px rgba(0,0,0,0.9)}</style></head><body><canvas id="c" width="400" height="300"></canvas><script>${finalJs}<\/script></body></html>`;

  const htmlPath = path.join(distDir, 'index.html');
  fs.writeFileSync(htmlPath, html, 'utf-8');

  const htmlBytes = Buffer.byteLength(html, 'utf-8');
  console.log(`📄 Inlined HTML size: ${htmlBytes} bytes (${(htmlBytes / 1024).toFixed(2)} KB)`);

  const leftover = fs.readdirSync(distDir).filter((name) => name !== 'index.html');
  if (leftover.length > 0) {
    throw new Error(`dist/ must contain only index.html before Wavedash upload. Leftover: ${leftover.join(', ')}`);
  }

  // 5. Create JS13k standard ZIP file
  const zipBuffer = createSingleFileZip('index.html', Buffer.from(html, 'utf-8'));
  
  const zipDir = path.resolve('zip');
  if (!fs.existsSync(zipDir)) {
    fs.mkdirSync(zipDir, { recursive: true });
  }
  fs.writeFileSync(path.join(zipDir, 'game.zip'), zipBuffer);
  fs.writeFileSync(path.resolve('game.zip'), zipBuffer);

  const zipBytes = zipBuffer.length;
  const remaining = MAX_BYTES - zipBytes;
  const pct = ((zipBytes / MAX_BYTES) * 100).toFixed(1);

  console.log(`\n📦 JS13k ZIP Size: ${zipBytes} / ${MAX_BYTES} bytes (${pct}% used)`);
  console.log(`📁 Outputs:`);
  console.log(`   • Web Dir (for Wavedash upload): dist/index.html (${(htmlBytes / 1024).toFixed(2)} KB)`);
  console.log(`   • JS13k Zip Package: game.zip (${(zipBytes / 1024).toFixed(2)} KB)`);

  if (remaining >= 0) {
    console.log(`✅ UNDER BUDGET! ${remaining} bytes remaining.\n`);
  } else {
    console.error(`❌ OVER BUDGET by ${-remaining} bytes!\n`);
    process.exit(1);
  }
}

function emptyDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
}

function createSingleFileZip(filename, fileData) {
  const compressed = zlib.deflateRawSync(fileData, { level: 9, memLevel: 9 });
  const crc = crc32(fileData);
  const now = new Date();
  
  const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
  const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
  const nameBuffer = Buffer.from(filename, 'utf-8');

  const localHeader = Buffer.alloc(30 + nameBuffer.length);
  localHeader.writeUInt32LE(0x04034b50, 0);
  localHeader.writeUInt16LE(20, 4);
  localHeader.writeUInt16LE(0, 6);
  localHeader.writeUInt16LE(8, 8);
  localHeader.writeUInt16LE(dosTime, 10);
  localHeader.writeUInt16LE(dosDate, 12);
  localHeader.writeUInt32LE(crc, 14);
  localHeader.writeUInt32LE(compressed.length, 18);
  localHeader.writeUInt32LE(fileData.length, 22);
  localHeader.writeUInt16LE(nameBuffer.length, 26);
  localHeader.writeUInt16LE(0, 28);
  nameBuffer.copy(localHeader, 30);

  const offset = 0;
  const centralDir = Buffer.alloc(46 + nameBuffer.length);
  centralDir.writeUInt32LE(0x02014b50, 0);
  centralDir.writeUInt16LE(20, 4);
  centralDir.writeUInt16LE(20, 6);
  centralDir.writeUInt16LE(0, 8);
  centralDir.writeUInt16LE(8, 10);
  centralDir.writeUInt16LE(dosTime, 12);
  centralDir.writeUInt16LE(dosDate, 14);
  centralDir.writeUInt32LE(crc, 16);
  centralDir.writeUInt32LE(compressed.length, 20);
  centralDir.writeUInt32LE(fileData.length, 24);
  centralDir.writeUInt16LE(nameBuffer.length, 28);
  centralDir.writeUInt16LE(0, 30);
  centralDir.writeUInt16LE(0, 32);
  centralDir.writeUInt16LE(0, 34);
  centralDir.writeUInt16LE(0, 36);
  centralDir.writeUInt32LE(0, 38);
  centralDir.writeUInt32LE(offset, 42);
  nameBuffer.copy(centralDir, 46);

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(1, 8);
  eocd.writeUInt16LE(1, 10);
  eocd.writeUInt32LE(centralDir.length, 12);
  eocd.writeUInt32LE(localHeader.length + compressed.length, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([localHeader, compressed, centralDir, eocd]);
}

const crcTable = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) {
    c = ((c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
  }
  crcTable[i] = c;
}

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ buf[i]) & 0xFF];
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

build().catch(err => {
  console.error('Build error:', err);
  process.exit(1);
});

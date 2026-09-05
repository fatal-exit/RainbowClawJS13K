import * as esbuild from 'esbuild';
import { minify } from 'terser';
import { Packer } from 'roadroller';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as zlib from 'node:zlib';
import { execSync, execFileSync } from 'node:child_process';

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
      passes: 8,
      unsafe: true,
      unsafe_arrows: true,
      unsafe_comps: true,
      unsafe_math: true,
      unsafe_methods: true,
      unsafe_proto: true,
      booleans: true,
      drop_debugger: true,
      pure_getters: true,
      reduce_vars: true,
      dead_code: true,
      hoist_funs: true,
      inline: 3,
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
    ], {
      allowFreeVars: true,
    });
    await packer.optimize(2);
    const { firstLine, secondLine } = packer.makeDecoder();
    finalJs = firstLine + secondLine;
    console.log(`✨ Roadroller reduction: ${minifiedJs.length} -> ${finalJs.length} bytes`);
  } catch (err) {
    console.warn('⚠️ Roadroller fallback:', err);
  }

  const html = `<!doctype html><meta name=viewport content=width=device-width,initial-scale=1><title>Rainbow Claw</title><style>body{margin:0;height:100vh;background:#050508;display:grid;place-items:center;touch-action:none}canvas{aspect-ratio:4/3;max-width:100vw;max-height:100vh;image-rendering:pixelated}</style><canvas id=c></canvas><script>${finalJs}<\/script>`;

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
  const rootZipPath = path.resolve('game.zip');
  const dirZipPath = path.join(zipDir, 'game.zip');
  fs.writeFileSync(dirZipPath, zipBuffer);
  fs.writeFileSync(rootZipPath, zipBuffer);

  const initialZipBytes = zipBuffer.length;
  let finalZipBytes = initialZipBytes;

  // 6. Post-process with advzip (AdvanceCOMP)
  let advzipSuccess = false;
  const advzipTool = await findAdvzip();
  if (advzipTool) {
    const displayName = advzipTool.args.length > 0 ? `${advzipTool.bin} ${advzipTool.args.join(' ')}` : advzipTool.bin;
    console.log(`\n🗜️  Running advzip post-processing (${displayName} -z -4 -i 250)...`);
    try {
      execFileSync(advzipTool.bin, [...advzipTool.args, '-z', '-4', '-i', '250', rootZipPath], { stdio: 'pipe' });
      fs.copyFileSync(rootZipPath, dirZipPath);
      finalZipBytes = fs.statSync(rootZipPath).size;
      const savedBytes = initialZipBytes - finalZipBytes;
      const pctSaved = ((savedBytes / initialZipBytes) * 100).toFixed(2);
      console.log(`📦 Before advzip: ${initialZipBytes.toLocaleString()} bytes`);
      console.log(`📦 After advzip:  ${finalZipBytes.toLocaleString()} bytes (saved ${savedBytes} bytes / ${pctSaved}%)`);
      advzipSuccess = true;
    } catch (err) {
      console.warn('⚠️  advzip execution failed, falling back to original zlib zip:', err.message);
      fs.writeFileSync(rootZipPath, zipBuffer);
      fs.writeFileSync(dirZipPath, zipBuffer);
      finalZipBytes = initialZipBytes;
    }
  } else {
    console.warn('\n⚠️  advzip not found in PATH or node_modules. Using default zlib compression.');
  }

  // 7. Verify resulting zip archive integrity
  console.log(`🔍 Verifying zip archive integrity...`);
  verifyZipIntegrity(rootZipPath, advzipTool, advzipSuccess, html);

  const zipBytes = finalZipBytes;
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
  // Deterministic timestamp: 2026-09-01 00:00:00
  const dosTime = 0;
  const dosDate = ((2026 - 1980) << 9) | (9 << 5) | 1;
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

async function findAdvzip() {
  // 1. Direct advzip-bin package export (guaranteed across all environments)
  try {
    const advzipBinModule = await import('advzip-bin');
    const binPath = advzipBinModule.default;
    if (binPath && fs.existsSync(binPath)) {
      execFileSync(binPath, ['-V'], { stdio: 'pipe' });
      return { bin: binPath, args: [] };
    }
  } catch {}

  // 2. Local node_modules/.bin binary wrapper
  const localBin = path.resolve('node_modules', '.bin', process.platform === 'win32' ? 'advzip.cmd' : 'advzip');
  if (fs.existsSync(localBin)) {
    try {
      execFileSync(localBin, ['-V'], { stdio: 'pipe' });
      return { bin: localBin, args: [] };
    } catch {}
  }

  // 3. Global advzip on system PATH
  try {
    execFileSync('advzip', ['-V'], { stdio: 'pipe' });
    return { bin: 'advzip', args: [] };
  } catch {}

  // 4. npx runner fallback
  try {
    execFileSync('npx', ['advzip', '-V'], { stdio: 'pipe' });
    return { bin: 'npx', args: ['advzip'] };
  } catch {}

  return null;
}

function verifyZipIntegrity(zipPath, advzipTool, advzipSuccess, originalHtml) {
  // 1. If advzip was active and succeeded, verify via advzip pedantic test (-t -p)
  if (advzipSuccess && advzipTool) {
    try {
      execFileSync(advzipTool.bin, [...advzipTool.args, '-t', '-p', zipPath], { stdio: 'pipe' });
      console.log(`🛡️  Archive verified via advzip pedantic test (-t -p)!`);
    } catch (e) {
      throw new Error(`advzip integrity test failed: ${e.message}`);
    }
  }

  // 2. Cross-verify with Info-ZIP unzip if available
  try {
    execFileSync('unzip', ['-t', '-q', zipPath], { stdio: 'pipe' });
    console.log(`🛡️  Archive verified via Info-ZIP unzip test (-t)!`);
  } catch {
    // Info-ZIP unzip CLI not present
  }

  // 3. Deep binary PKZIP header check
  const data = fs.readFileSync(zipPath);
  if (data.length < 22 || data.readUInt32LE(0) !== 0x04034b50) {
    throw new Error(`Invalid ZIP magic header in ${zipPath}`);
  }

  // 4. Decompress payload and verify 100% byte-for-byte fidelity with dist/index.html
  const fnLen = data.readUInt16LE(26);
  const extraLen = data.readUInt16LE(28);
  const compressedSize = data.readUInt32LE(18);
  const compressedOffset = 30 + fnLen + extraLen;
  const compressedData = data.subarray(compressedOffset, compressedOffset + compressedSize);
  const decompressed = zlib.inflateRawSync(compressedData);

  const expectedBytes = Buffer.from(originalHtml, 'utf-8');
  if (!decompressed.equals(expectedBytes)) {
    throw new Error(`Integrity error: decompressed zip payload does not match source index.html!`);
  }
  console.log(`🛡️  Payload verified: decompressed bytes match dist/index.html exactly (${decompressed.length.toLocaleString()} bytes)!`);
}

build().catch(err => {
  console.error('Build error:', err);
  process.exit(1);
});

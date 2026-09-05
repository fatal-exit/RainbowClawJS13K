import * as http from 'node:http';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as esbuild from 'esbuild';

const PORT = 3000;
const DEV_DIR = path.resolve('.dev');

fs.mkdirSync(DEV_DIR, { recursive: true });

const ctx = await esbuild.context({
  entryPoints: ['src/main.ts'],
  bundle: true,
  outfile: path.join(DEV_DIR, 'bundle.js'),
  format: 'iife',
  target: 'es2022',
  sourcemap: true,
});

await ctx.watch();

const server = http.createServer((req, res) => {
  let urlPath = req.url.split('?')[0];
  if (urlPath === '/' || urlPath === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover"><title>RAINBOW CLAW (DEV)</title><style>*{margin:0;padding:0;box-sizing:border-box}html,body{width:100%;height:100%;overflow:hidden;background:#050508;display:flex;align-items:center;justify-content:center;touch-action:none;-webkit-touch-callout:none;user-select:none;-webkit-user-select:none}canvas{display:block;image-rendering:pixelated;image-rendering:crisp-edges;width:min(100vw,calc(100vh*4/3));height:min(100vh,calc(100vw*3/4));max-width:100vw;max-height:100vh;aspect-ratio:4/3;object-fit:contain;box-shadow:0 0 50px rgba(0,0,0,0.9)}</style></head><body><canvas id="c" width="400" height="300"></canvas><script src="/bundle.js"><\/script></body></html>`);
    return;
  }

  if (urlPath === '/bundle.js' || urlPath === '/bundle.js.map') {
    const file = path.join(DEV_DIR, urlPath.slice(1));
    if (fs.existsSync(file)) {
      res.writeHead(200, { 'Content-Type': urlPath.endsWith('.map') ? 'application/json' : 'application/javascript' });
      res.end(fs.readFileSync(file));
      return;
    }
  }

  res.writeHead(404);
  res.end('Not Found');
});

server.listen(PORT, () => {
  console.log(`🚀 Rainbow Claw dev server running at http://localhost:${PORT}`);
});

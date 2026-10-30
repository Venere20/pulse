const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const localDemo = require('./local-demo-browser.js');
const root = path.resolve(__dirname, '../.feature-build/design-system-2-web');
const port = Number(process.env.PULSE_DEMO_PORT || 4178);
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.css': 'text/css' };
const server = http.createServer((request, response) => {
  let url; try { url = decodeURIComponent(new URL(request.url, 'http://localhost').pathname); } catch { response.writeHead(400); return response.end(); }
  // Never expose anything outside the disposable web export.
  const destination = path.resolve(root, '.' + url);
  if (destination !== root && !destination.startsWith(root + path.sep)) { response.writeHead(403); return response.end(); }
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Content-Security-Policy', "connect-src 'self' blob: data:; worker-src 'none'; form-action 'self'");
  if (url === '/sw.js') { response.writeHead(404); return response.end(); }
  if (url === '/__demo/bridge.js') { response.setHeader('Content-Type', mime['.js']); return response.end(`(${localDemo.toString()})();`); }
  if (url === '/__demo/photo.svg') { response.setHeader('Content-Type', mime['.svg']); return response.end('<svg xmlns="http://www.w3.org/2000/svg" width="900" height="600"><defs><linearGradient id="s" x2="0" y2="1"><stop stop-color="#E99BB0"/><stop offset="1" stop-color="#473044"/></linearGradient></defs><rect width="900" height="600" fill="url(#s)"/><circle cx="670" cy="180" r="65" fill="#F6EFF4"/><path d="M0 420L220 220L430 440L600 300L900 470V600H0Z" fill="#342A3B"/><text x="40" y="550" fill="#F6EFF4" font-family="sans-serif" font-size="36">Il nostro viaggio · demo</text></svg>'); }
  const file = fs.existsSync(destination) && fs.statSync(destination).isFile() ? destination : path.join(root, 'index.html');
  fs.readFile(file, (error, data) => {
    if (error) { response.writeHead(500); return response.end('Esegui prima npm run build:web -- --output-dir .feature-build/design-system-2-web'); }
    response.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream');
    if (path.extname(file) === '.html') {
      let html = data.toString().replace(/<script\b([^>]*?)\bsrc="([^"]+)"([^>]*)>/g, '<script$1data-demo-src="$2"$3>');
      html = html.replace('<head>', '<head><script src="/__demo/bridge.js"></script>');
      return response.end(html);
    }
    response.end(data);
  });
});
if (require.main === module) server.listen(port, '127.0.0.1', () => console.log(`Pulse demo locale: http://127.0.0.1:${port} — admin / admin`));
module.exports = server;

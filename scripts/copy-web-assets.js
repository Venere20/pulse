// Copia le icone dell'app nella cartella public/, che il sito serve alla radice (/icon.png, /badge.png).
// Servono al manifest (installazione come app) e alle notifiche web. Viene eseguito in automatico da "npm run web".
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const files = [
  ['assets/pulse/web/pulse-512.png', 'public/icon.png'],
  ['assets/pulse/badge.png', 'public/badge.png'],
  ['assets/pulse/favicon.png', 'public/favicon.png'],
  ['assets/pulse/favicon.ico', 'public/favicon.ico'],
  ['assets/pulse/web/pulse-180.png', 'public/apple-touch-icon.png'],
  ['assets/pulse/web/pulse-192.png', 'public/icon-192.png'],
  ['assets/pulse/web/pulse-512.png', 'public/icon-512.png'],
];
for (const name of fs.readdirSync(path.join(root, 'assets/pulse/web'))) {
  if (name.endsWith('.png')) files.push(['assets/pulse/web/' + name, 'public/icons/' + name]);
}

fs.mkdirSync(path.join(root, 'public'), { recursive: true });
for (const [from, to] of files) {
  const src = path.join(root, from);
  if (!fs.existsSync(src)) {
    throw new Error(`[web-assets] manca ${from}`);
  }
  fs.mkdirSync(path.dirname(path.join(root, to)), { recursive: true });
  fs.copyFileSync(src, path.join(root, to));
  console.log(`[web-assets] ${from} -> ${to}`);
}

import { existsSync, cpSync, mkdirSync, writeFileSync } from 'node:fs';
const root = ['dist/client', '.output/public', 'dist'].find(p => existsSync(`${p}/index.html`));
if (!root) throw new Error('Static index.html was not generated; deployment stopped.');
mkdirSync('pages-dist', { recursive: true });
cpSync(root, 'pages-dist', { recursive: true });
cpSync(`${root}/index.html`, 'pages-dist/404.html');
writeFileSync('pages-dist/.nojekyll', '');

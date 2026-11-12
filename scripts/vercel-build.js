const { execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const distDir = path.join(root, 'dist');
const distAdminDir = path.join(root, 'dist-admin');

function run(command) {
  execSync(command, { cwd: root, stdio: 'inherit' });
}

// 1. Build Storefront React SPA + copy public assets into dist/
run('npx vite build');

// 2. Build React Admin Console into dist-admin/
run('npx vite build --config vite.admin.config.js');

// 3. Merge React Admin Console output into dist/ so /admin & /admin.html serve the React Admin UI
const builtAdminHtml = path.join(distAdminDir, 'admin.html');
if (!fs.existsSync(builtAdminHtml)) {
  throw new Error('Expected dist-admin/admin.html after admin build.');
}
fs.copyFileSync(builtAdminHtml, path.join(distDir, 'admin.html'));

const adminAssetsDir = path.join(distAdminDir, 'assets');
const distAssetsDir = path.join(distDir, 'assets');
fs.mkdirSync(distAssetsDir, { recursive: true });
for (const entry of fs.readdirSync(adminAssetsDir, { withFileTypes: true })) {
  const srcPath = path.join(adminAssetsDir, entry.name);
  const dstPath = path.join(distAssetsDir, entry.name);
  if (entry.isFile()) {
    fs.copyFileSync(srcPath, dstPath);
  }
}

// 4. Remove stale legacy vanilla HTML pages copied from public/ so .html routes hit the React SPA rewrite
for (const legacyHtml of ['about.html', 'checkout.html', 'product.html', 'shop.html']) {
  const target = path.join(distDir, legacyHtml);
  if (fs.existsSync(target)) {
    fs.rmSync(target, { force: true });
  }
}

console.log('Vercel combined Storefront + Admin build ready in dist/');


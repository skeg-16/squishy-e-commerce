const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const pages = ['index.html', 'shop.html', 'product.html', 'checkout.html', 'about.html'];
const scripts = ['api.js', 'cart.js', 'catalog.js', 'products.js', 'product.js', 'shop.js', 'payment.js', 'shopee-checkout.js'];
function build() {
  const output = path.join(root, 'public');
  fs.rmSync(output, { recursive: true, force: true });
  fs.mkdirSync(path.join(output, 'js'), { recursive: true });
  fs.mkdirSync(path.join(output, 'css'), { recursive: true });
  for (const page of pages) fs.copyFileSync(path.join(root, page), path.join(output, page));
  for (const script of scripts) fs.copyFileSync(path.join(root, 'js', script), path.join(output, 'js', script));
  fs.copyFileSync(path.join(root, 'css/style.css'), path.join(output, 'css/style.css'));
  fs.cpSync(path.join(root, 'assets'), path.join(output, 'assets'), { recursive: true });
}
if (require.main === module) build();
module.exports = { build };

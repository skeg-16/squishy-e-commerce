const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const pages = ['index.html', 'shop.html', 'product.html', 'checkout.html', 'about.html'];
const scripts = ['api.js', 'cart.js', 'catalog.js', 'products.js', 'product.js', 'shop.js', 'payment.js', 'shopee-checkout.js'];
function build() {
  const output = path.join(root, 'public');
  fs.mkdirSync(path.join(output, 'js'), { recursive: true });
  fs.mkdirSync(path.join(output, 'css'), { recursive: true });
  for (const page of pages) {
    const source =
      page === 'index.html' && fs.existsSync(path.join(root, 'index2.html'))
        ? path.join(root, 'index2.html')
        : path.join(root, page);
    if (fs.existsSync(source)) fs.copyFileSync(source, path.join(output, page));
  }
  for (const script of scripts) if (fs.existsSync(path.join(root, 'js', script))) fs.copyFileSync(path.join(root, 'js', script), path.join(output, 'js', script));
  if (fs.existsSync(path.join(root, 'css/style.css'))) fs.copyFileSync(path.join(root, 'css/style.css'), path.join(output, 'css/style.css'));
  if (fs.existsSync(path.join(root, 'assets'))) fs.cpSync(path.join(root, 'assets'), path.join(output, 'assets'), { recursive: true });
}
if (require.main === module) build();
module.exports = { build };

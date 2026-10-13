/* dooyoor 站点静态校验：资源完整性、类名一致性、共享组件逐字一致性
   用法：node verify.js <siteRoot>
*/
'use strict';

const fs = require('fs');
const path = require('path');

const root = process.argv[2] || '.';
const errors = [];
const warnings = [];
const info = [];

function walk(dir, out) {
  out = out || [];
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return out; }
  for (const ent of entries) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else if (ent.isFile()) out.push(p);
  }
  return out;
}

const allFiles = walk(root).map(f => f.replace(/\\/g, '/'));
const rel = f => path.relative(root, f).replace(/\\/g, '/');
const exists = p => { try { return fs.statSync(p).isFile(); } catch (e) { return false; } };

const htmls = allFiles.filter(f => f.endsWith('.html'));
const svgs = allFiles.filter(f => f.endsWith('.svg'));
const cssFile = path.join(root, 'css', 'style.css');

info.push('HTML 文件: ' + htmls.length);
info.push('SVG 文件: ' + svgs.length);

/* ---------- 1. 空文件 / 过小文件 ---------- */
for (const f of allFiles) {
  const size = fs.statSync(f).size;
  if (size === 0 && path.basename(f) !== '.nojekyll') errors.push('空文件: ' + rel(f));
  else if (f.endsWith('.html') && size < 1200) warnings.push('HTML 过小，可能未写完: ' + rel(f) + ' (' + size + 'B)');
  else if (f.endsWith('.js') && size < 300) warnings.push('JS 过小: ' + rel(f) + ' (' + size + 'B)');
  else if (f.endsWith('.svg')) {
    if (size > 6144) warnings.push('SVG 超过 6KB: ' + rel(f) + ' (' + size + 'B)');
    if (size < 150) warnings.push('SVG 过小，可能是占位: ' + rel(f) + ' (' + size + 'B)');
  }
}

/* ---------- 2. CSS 类名集合 ---------- */
let cssText = '';
if (exists(cssFile)) {
  cssText = fs.readFileSync(cssFile, 'utf8');
} else {
  errors.push('缺少 css/style.css');
}
const cssClasses = new Set();
for (const m of cssText.matchAll(/\.(-?[A-Za-z_][A-Za-z0-9_-]*)/g)) cssClasses.add(m[1]);

/* ---------- 3. 逐页检查 ---------- */
const attrRe = /\b(?:href|src)\s*=\s*"([^"]*)"/g;
const classRe = /\bclass\s*=\s*"([^"]*)"/g;

const expectedPage = {
  'index.html': 'index',
  'shop.html': 'shop',
  'product.html': 'product',
  'about.html': 'about',
  'cart.html': 'cart',
  'contact.html': 'contact',
  'verify.html': 'verify',
  'login.html': 'login',
  'register.html': 'register',
  'account.html': 'account',
  'preowned.html': 'preowned',
  'admin.html': 'admin'
};

/* admin.html 是规范批准的例外：它是后台，不复用前台共享组件，也不引 main.js。 */
const isAdmin = base => base === 'admin.html';

const sharedParts = { header: {}, footer: {}, drawer: {}, search: {}, bottomnav: {} };

function extract(html, openTag, closeTag) {
  const i = html.indexOf(openTag);
  if (i === -1) return null;
  const j = html.indexOf(closeTag, i);
  if (j === -1) return null;
  return html.slice(i, j + closeTag.length).replace(/\s+/g, ' ').trim();
}

for (const file of htmls) {
  const name = rel(file);
  const base = path.basename(file);
  const html = fs.readFileSync(file, 'utf8');

  if (!/<html[^>]*lang="zh-CN"/.test(html)) errors.push(name + ': 缺少 lang="zh-CN"');
  if (!/name="viewport"/.test(html)) errors.push(name + ': 缺少 viewport meta');
  if (!/charset="utf-8"/i.test(html)) errors.push(name + ': 缺少 charset');

  const wanted = expectedPage[base];
  if (wanted) {
    const m = html.match(/<body[^>]*data-page="([^"]*)"/);
    if (!m) errors.push(name + ': body 缺少 data-page');
    else if (m[1] !== wanted) errors.push(name + ': data-page="' + m[1] + '" 应为 "' + wanted + '"');
  }

  for (const part of (isAdmin(base) ? [] : [
    ['header', '<header class="site-header"', '</header>'],
    ['footer', '<footer class="site-footer"', '</footer>'],
    ['drawer', '<div class="drawer"', '</aside>'],
    ['search', '<div class="search-overlay"', '</div>\n  </div>'],
    ['bottomnav', '<nav class="bottom-nav"', '</nav>']
  ])) {
    const key = part[0];
    let chunk = null;
    if (key === 'drawer') {
      const i = html.indexOf('<div class="drawer"');
      const j = html.indexOf('</aside>', i);
      chunk = (i !== -1 && j !== -1) ? html.slice(i, j + 8).replace(/\s+/g, ' ').trim() : null;
    } else if (key === 'search') {
      const i = html.indexOf('<div class="search-overlay"');
      // 结束边界用紧随其后的 <main>。早期版本用 <div class="toast" 作边界，
      // 而 toast 在 body 末尾，会把整个 <main> 正文吞进比对范围，
      // 导致所有页面互相「不一致」的假报错。
      const j = html.indexOf('<main id="main"', i);
      chunk = (i !== -1 && j !== -1) ? html.slice(i, j).replace(/\s+/g, ' ').trim() : null;
    } else {
      chunk = extract(html, part[1], part[2]);
    }
    if (!chunk) errors.push(name + ': 找不到共享组件 ' + key);
    else sharedParts[key][base] = chunk;
  }

  for (const m of html.matchAll(attrRe)) {
    const v = m[1].trim();
    if (!v || v.startsWith('#') || v.startsWith('http') || v.startsWith('mailto:') || v.startsWith('tel:') || v.startsWith('data:') || v.startsWith('javascript:')) continue;
    const target = v.split('#')[0].split('?')[0];
    if (!target) continue;
    const resolved = path.join(path.dirname(file), decodeURIComponent(target));
    if (!exists(resolved)) errors.push(name + ': 引用不存在的文件 -> ' + v);
  }

  for (const m of html.matchAll(classRe)) {
    for (const cls of m[1].split(/\s+/)) {
      if (!cls) continue;
      if (!cssClasses.has(cls)) errors.push(name + ': 使用了 style.css 中未定义的类 .' + cls);
    }
  }

  if (/<script[^>]+src="https?:/.test(html)) errors.push(name + ': 存在外链脚本');
  if (/<link[^>]+href="https?:/.test(html)) errors.push(name + ': 存在外链样式/字体');
  if (/\son(click|load|change|submit)\s*=/.test(html)) errors.push(name + ': 存在内联事件属性');
  if (/<img(?![^>]*\balt=)[^>]*>/.test(html)) errors.push(name + ': 存在没有 alt 的 img');
}

/* ---------- 4. 共享组件跨页一致性 ---------- */
for (const key of Object.keys(sharedParts)) {
  const map = sharedParts[key];
  const names = Object.keys(map);
  if (names.length < 2) continue;
  const first = map[names[0]];
  for (const n of names) {
    if (map[n] !== first) {
      errors.push('共享组件 ' + key + ' 在 ' + n + ' 与 ' + names[0] + ' 不一致');
    }
  }
}

/* ---------- 5. JS 文件存在性与页面脚本顺序 ---------- */
const scriptOrder = ['js/site-config.js', 'js/cart.js', 'js/main.js', 'js/fav.js', 'js/auth.js', 'js/wallet.js', 'js/orders.js', 'js/preowned.js'];
const adminScriptOrder = ['js/site-config.js', 'js/cart.js', 'js/admin.js'];
for (const file of htmls) {
  const name = rel(file);
  const base = path.basename(file);
  const html = fs.readFileSync(file, 'utf8');
  const srcs = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map(m => m[1].replace(/\\/g, '/'));
  const order = isAdmin(base) ? adminScriptOrder : scriptOrder;
  let last = -1;
  for (const s of order) {
    const idx = srcs.indexOf(s);
    if (idx === -1) { errors.push(name + ': 缺少脚本 ' + s); continue; }
    if (idx < last) errors.push(name + ': 脚本顺序错误，' + s + ' 位置过早');
    last = idx;
  }
  for (const s of srcs) {
    if (!exists(path.join(root, s))) errors.push(name + ': 引用的脚本不存在 -> ' + s);
  }
}

/* ---------- 6. SVG 检查 ---------- */
for (const f of svgs) {
  const txt = fs.readFileSync(f, 'utf8');
  const n = rel(f);
  if (!/<svg[\s>]/.test(txt)) errors.push(n + ': 不是 SVG');
  if (!/xmlns="http:\/\/www\.w3\.org\/2000\/svg"/.test(txt)) errors.push(n + ': 缺少 xmlns');
  if (!/<title[\s>]/.test(txt)) warnings.push(n + ': 缺少 <title>');
  if (/<script/i.test(txt)) errors.push(n + ': 含 <script>');
  if (/\shref="(?!#)/.test(txt) || /xlink:href="(?!#)/.test(txt)) errors.push(n + ': 含外链引用');
  if (/<image[\s>]/i.test(txt)) errors.push(n + ': 含位图 <image>');
  if (/@import/.test(txt)) errors.push(n + ': 含 @import');

  // 注意：这里**不能**用 `<[A-Za-z][^>]*[^/]>`。对 `<g>` 这类单字母标签，
  // `<[A-Za-z]` 已吃掉唯一那个字符，后面的 `[^/]` 便无字符可匹配，导致 `<g>` 被漏计、
  // 而 `</g>` 被正常计入，把完全正确的文件误报为「标签可能未闭合」。
  // 改用否定后行断言来排除自闭合标签。
  const open = (txt.match(/<[A-Za-z][^>]*?(?<!\/)>/g) || []).length;
  const close = (txt.match(/<\/[A-Za-z][^>]*>/g) || []).length;
  const selfClose = (txt.match(/<[A-Za-z][^>]*?\/>/g) || []).length;
  if (open !== close) {
    errors.push(n + ': 标签可能未闭合 (开 ' + open + ' / 闭 ' + close + ' / 自闭 ' + selfClose + ')');
  }
}

/* ---------- 7. 必需的资源清单 ---------- */
const required = [
  'index.html', 'shop.html', 'product.html', 'about.html', 'cart.html', 'contact.html',
  'verify.html', 'login.html', 'register.html', 'account.html', 'preowned.html', 'admin.html',
  'css/style.css', 'js/site-config.js', 'js/cart.js', 'js/main.js', 'js/fav.js',
  'js/auth.js', 'js/wallet.js', 'js/orders.js', 'js/preowned.js',
  'js/home.js', 'js/shop.js', 'js/product.js', 'js/cart-page.js', 'js/about.js', 'js/contact.js',
  'js/verify.js', 'js/auth-page.js', 'js/account-page.js', 'js/preowned-page.js', 'js/admin.js',
  'assets/logo-mark.svg', 'assets/hero.svg', 'assets/look-01.svg', 'assets/look-02.svg',
  'assets/about-workshop.svg', 'assets/detail-01.svg', 'assets/detail-02.svg',
  'assets/col-01.svg', 'assets/col-02.svg', 'assets/col-03.svg', 'assets/col-04.svg',
  'assets/products/p01.svg', 'assets/products/p02.svg', 'assets/products/p03.svg', 'assets/products/p04.svg',
  'assets/products/p05.svg', 'assets/products/p06.svg', 'assets/products/p07.svg', 'assets/products/p08.svg'
];
for (const r of required) {
  if (!exists(path.join(root, r))) errors.push('缺少必需文件: ' + r);
}

// 每个页面引用的页面脚本是否都在
const pageScripts = {
  'index.html': 'js/home.js',
  'shop.html': 'js/shop.js',
  'product.html': 'js/product.js',
  'about.html': 'js/about.js',
  'cart.html': 'js/cart-page.js',
  'contact.html': 'js/contact.js',
  'verify.html': 'js/verify.js',
  'login.html': 'js/auth-page.js',
  'register.html': 'js/auth-page.js',
  'account.html': 'js/account-page.js',
  'preowned.html': 'js/preowned-page.js',
  'admin.html': 'js/admin.js'
};
for (const page of Object.keys(pageScripts)) {
  const p = path.join(root, page);
  if (!exists(p)) continue;
  const html = fs.readFileSync(p, 'utf8');
  if (html.indexOf(pageScripts[page]) === -1) errors.push(page + ': 未引入 ' + pageScripts[page]);
}

/* ---------- 输出 ---------- */
console.log('=== dooyoor 静态校验 ===');
console.log('根目录: ' + path.resolve(root));
for (const i of info) console.log('  · ' + i);
console.log('');
if (errors.length) {
  console.log('错误 ' + errors.length + ' 项：');
  errors.forEach((e, i) => console.log('  ' + (i + 1) + '. ' + e));
} else {
  console.log('错误 0 项 ✓');
}
if (warnings.length) {
  console.log('');
  console.log('警告 ' + warnings.length + ' 项：');
  warnings.forEach((w, i) => console.log('  ' + (i + 1) + '. ' + w));
}
const totalBytes = allFiles.reduce((s, f) => s + fs.statSync(f).size, 0);
console.log('');
console.log('总体积: ' + (totalBytes / 1024).toFixed(1) + ' KB');
process.exit(errors.length ? 1 : 0);

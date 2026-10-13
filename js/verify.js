/* ==========================================================================
   dooyoor 㛊䎟 — 溯源查询页
   依赖：js/site-config.js, js/cart.js, js/main.js
   职责：URL ?code= → 归一化匹配 products[].chain.code → 渲染成功 / 失败态
   数据全部来自本地 site-config.js，全程不发起任何网络请求（无 fetch / XHR）。
   ========================================================================== */
(function () {
  'use strict';

  var CFG = window.DY_CONFIG || {};
  var BRAND = CFG.brand || {};
  var CHAIN = BRAND.chain || {};
  var PRODUCTS = CFG.products || [];
  var STEPS = CHAIN.steps || [];
  var SAMPLES = CFG.verifySamples || [];

  /* ---------- 图标（规范 §5.6 图标集，内联 SVG，装饰性加 aria-hidden） ---------- */
  var ICON_CHECK = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7"/></svg>';
  var ICON_CLOSE = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  var ICON_STEP = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7"/></svg>';
  var ICON_SHIELD = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l7 3v6c0 5-3 8-7 9-4-1-7-4-7-9V6l7-3Z"/><path d="M9 12l2 2 4-4"/></svg>';
  var ICON_CYCLE = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12a8 8 0 0 1 13-6"/><path d="M20 12a8 8 0 0 1-13 6"/><path d="M17 3v3h-3"/><path d="M7 21v-3h3"/></svg>';

  /* ---------- 工具 ---------- */

  function $(selector) {
    return document.querySelector(selector);
  }

  function esc(value) {
    if (window.DY && typeof window.DY.escape === 'function') { return window.DY.escape(value); }
    return String(value === null || value === undefined ? '' : value);
  }

  function money(value) {
    if (window.DY && typeof window.DY.money === 'function') { return window.DY.money(value); }
    return String(value === null || value === undefined ? '' : value);
  }

  function toast(message) {
    if (window.DY && typeof window.DY.toast === 'function') { window.DY.toast(message); }
  }

  function text(value, fallback) {
    var out = value === null || value === undefined ? '' : String(value).trim();
    if (out) { return out; }
    return fallback === undefined ? '—' : fallback;
  }

  function formatInt(value) {
    var n = Number(value);
    if (!isFinite(n) || n <= 0) { return '—'; }
    return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  /* ---------- 归一化：容忍大小写、空格、全角字符与不同连字符 ---------- */

  function normalizeCode(input) {
    var raw = String(input === null || input === undefined ? '' : input);
    // 全角英数与连字符 → 半角
    raw = raw.replace(/[\uFF01-\uFF5E]/g, function (ch) {
      return String.fromCharCode(ch.charCodeAt(0) - 0xFEE0);
    });
    // 各类连字符（‐ ‑ ‒ – — ― − ﹣）统一为 -
    raw = raw.replace(/[\u2010-\u2015\u2212\uFE63]/g, '-');
    // 半角空格、全角空格、不换行空格、制表符全部忽略
    raw = raw.replace(/[\s\u3000\u00A0]+/g, '');
    return raw.toUpperCase();
  }

  function findProduct(code) {
    for (var i = 0; i < PRODUCTS.length; i++) {
      var product = PRODUCTS[i];
      if (product && product.chain && normalizeCode(product.chain.code) === code) { return product; }
    }
    return null;
  }

  /* ---------- 地址栏参数 / URL 同步 ---------- */

  function readCodeParam() {
    var raw = '';
    try {
      raw = new URLSearchParams(window.location.search).get('code') || '';
    } catch (e) {
      var matched = /[?&]code=([^&]*)/.exec(window.location.search || '');
      if (matched) {
        try { raw = decodeURIComponent(matched[1]); } catch (e2) { raw = matched[1]; }
      }
    }
    return String(raw).replace(/\s+/g, ' ').trim();
  }

  function writeCodeToUrl(code) {
    if (!code) { return; }
    try {
      var base = window.location.pathname || 'verify.html';
      window.history.replaceState(null, '', base + '?code=' + encodeURIComponent(code));
    } catch (e) {
      /* file:// 下浏览器可能拒绝 replaceState，忽略即可 */
    }
  }

  /* ---------- 滚动到结果区（尊重 prefers-reduced-motion） ---------- */

  function prefersReducedMotion() {
    try {
      return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch (e) {
      return false;
    }
  }

  function scrollToNode(node) {
    if (!node || typeof node.scrollIntoView !== 'function') { return; }
    try {
      node.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
    } catch (e) {
      node.scrollIntoView();
    }
  }

  /* ---------- 成功态：链上记录 + 流转记录 ---------- */

  function chainGridMarkup(chain) {
    var rows = [
      { label: '溯源码', value: text(chain.code) },
      { label: '交易哈希', value: text(chain.hash), hash: true },
      { label: '所在网络', value: text(chain.network) },
      { label: '区块高度', value: formatInt(chain.block) },
      { label: '上链时间', value: text(chain.mintedAt) },
      { label: '持有次数', value: chain.owners ? String(chain.owners) + ' 次' : '—' },
      { label: '织造工坊', value: text(chain.workshop) },
      { label: '丹宁批次', value: text(chain.batch) }
    ];

    var html = '';
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      var valueClass = row.hash ? 'chain-item-value chain-hash' : 'chain-item-value';
      var titleAttr = row.hash ? ' title="' + esc(text(chain.hash, '')) + '"' : '';
      html += '<div class="chain-item">'
        + '<span class="chain-item-label">' + esc(row.label) + '</span>'
        + '<span class="' + valueClass + '"' + titleAttr + '>' + esc(row.value) + '</span>'
        + '</div>';
    }
    return html;
  }

  function itemMarkup(product) {
    var chain = product.chain || {};
    var isUsed = product.condition === 'used';
    var condition = text(product.conditionName, isUsed ? '认证二手' : '全新');
    var condClass = isUsed ? 'cond-tag cond-tag--used' : 'cond-tag';
    var verifyBadge = chain.verified === false
      ? '<span class="badge badge--muted">未验真</span>'
      : '<span class="badge badge--ok">链上已验真</span>';
    var image = product.image || (product.gallery && product.gallery[0]) || '';

    // 口径（规范 §11）：compareAt 存在时现价加 .price--sale，原价用 .price--was
    var hasCompare = !!product.compareAt;
    var priceHtml = '<p class="product-price"><span class="price' + (hasCompare ? ' price--sale' : '') + '">'
      + esc(money(product.price)) + '</span>';
    if (hasCompare) {
      priceHtml += '<span class="price--was">原价 ' + esc(money(product.compareAt)) + '</span>';
    }
    priceHtml += '</p>';

    return '<div class="verify-item">'
      + '<div class="verify-item-media">'
      + (image ? '<img src="' + esc(image) + '" alt="' + esc(text(product.name, '商品')) + '" width="800" height="1000" loading="lazy" decoding="async">' : '')
      + '</div>'
      + '<div>'
      + '<h3 class="h3">' + esc(text(product.name, '未命名商品')) + '</h3>'
      + '<p class="product-en">' + esc(text(product.en)) + '</p>'
      + '<p><span class="' + condClass + '">' + esc(condition) + '</span> ' + verifyBadge + '</p>'
      + priceHtml
      + '</div>'
      + '</div>';
  }

  function lifecycleMarkup(product) {
    var items = product.lifecycle || [];
    if (!items.length) { return ''; }

    var html = '<div class="lifecycle">'
      + '<div class="chain-head">' + ICON_CYCLE
      + '<span class="chain-title">流转记录</span>'
      + '<span class="badge badge--muted">共 ' + esc(String(items.length)) + ' 条</span>'
      + '</div>'
      + '<ol class="lifecycle-list">';

    for (var i = 0; i < items.length; i++) {
      var item = items[i] || {};
      html += '<li class="lifecycle-item">'
        + '<span class="lifecycle-marker" aria-hidden="true"></span>'
        + '<p class="lifecycle-date">' + esc(text(item.date)) + '</p>'
        + '<p class="lifecycle-title">' + esc(text(item.title)) + '</p>'
        + '<p class="lifecycle-desc">' + esc(text(item.text)) + '</p>'
        + '</li>';
    }

    return html + '</ol></div>';
  }

  function successMarkup(product) {
    var chain = product.chain || {};
    var summary = '这件牛仔单品的溯源记录已写入 ' + text(CHAIN.name, 'DOOYOOR Chain')
      + (chain.network ? '（' + chain.network + '）' : '')
      + '，写入后不可修改。下面是链上记录与全部流转历史。';

    return '<div class="verify-result-head">' + ICON_CHECK + '<span>验真通过 · 记录完整</span></div>'
      + '<p class="verify-sub">' + esc(summary) + '</p>'
      + itemMarkup(product)
      + '<div class="chain-panel">'
      + '<div class="chain-head">' + ICON_SHIELD + '<span class="chain-title">链上记录</span></div>'
      + '<div class="chain-grid">' + chainGridMarkup(chain) + '</div>'
      + '</div>'
      + lifecycleMarkup(product)
      + '<div class="chain-actions">'
      + '<a class="btn btn--primary" href="product.html?id=' + encodeURIComponent(product.id) + '">查看商品详情</a>'
      + '</div>';
  }

  /* ---------- 失败态：可操作建议 ---------- */

  function failMarkup(rawInput) {
    var prefix = text(CHAIN.verifyPrefix, 'DY-');
    var email = text(BRAND.email, 'hello@dooyoor.com');
    var phone = text(BRAND.phone, '');
    var hours = text(BRAND.hours, '');

    var suggestions = '没有查到「' + esc(rawInput) + '」对应的链上记录。可以这样排查：'
      + '一、检查是否输错——字母与数字要与吊牌完全一致（大小写与空格我们会自动忽略）；'
      + '二、确认你输的是吊牌内侧的溯源码，它以 ' + esc(prefix) + ' 开头，形如 <code>DY-2025-000101</code>，'
      + '认证二手商品的新吊牌上也是同一个码；'
      + '三、吊牌已丢失的话，把下单时的订单号发给我们，可以人工核对。';

    var contact = '仍未查到请联系客服：<a class="link-btn" href="mailto:' + esc(email) + '">' + esc(email) + '</a>'
      + (phone ? ' · ' + esc(phone) : '')
      + (hours ? '（' + esc(hours) + '）' : '')
      + '。';

    return '<div class="verify-result-head">' + ICON_CLOSE + '<span>未找到该溯源码</span></div>'
      + '<p class="verify-sub">' + suggestions + '</p>'
      + '<p class="verify-sub">' + contact + '</p>';
  }

  /* ---------- 查询 ---------- */

  function hideResult(result) {
    result.className = 'verify-result';
    result.innerHTML = '';
    result.setAttribute('hidden', 'hidden');
  }

  function runQuery(rawValue, options) {
    var input = $('#verifyCode');
    var result = $('[data-verify-result]');
    if (!result) { return; }

    var raw = String(rawValue === null || rawValue === undefined ? '' : rawValue).trim();

    if (!raw) {
      toast('请输入溯源码');
      if (input) { input.focus(); }
      hideResult(result);
      return;
    }

    var product = findProduct(normalizeCode(raw));

    if (product) {
      result.className = 'verify-result verify-result--ok';
      result.innerHTML = successMarkup(product);
      result.removeAttribute('hidden');
      writeCodeToUrl(product.chain.code);
    } else {
      result.className = 'verify-result verify-result--fail';
      result.innerHTML = failMarkup(raw);
      result.removeAttribute('hidden');
    }

    if (!options || options.scroll !== false) { scrollToNode(result); }
  }

  /* ---------- 静态区块（示例码 / 上链步骤 / 说明） ---------- */

  function renderSamples() {
    var box = $('[data-verify-samples]');
    if (!box || !SAMPLES.length) { return; }
    var html = '';
    for (var i = 0; i < SAMPLES.length; i++) {
      html += (i ? '、' : '') + '<code>' + esc(SAMPLES[i]) + '</code>';
    }
    box.innerHTML = html;
  }

  function renderSteps() {
    var box = $('[data-verify-steps]');
    if (!box || !STEPS.length) { return; }
    var html = '';
    for (var i = 0; i < STEPS.length; i++) {
      var step = STEPS[i] || {};
      html += '<li class="verify-step">' + ICON_STEP
        + '<div><p><strong>' + esc(text(step.title)) + '</strong></p>'
        + '<p>' + esc(text(step.text)) + '</p></div>'
        + '</li>';
    }
    box.innerHTML = html;
  }

  function renderChainNote() {
    var node = $('[data-chain-note]');
    if (!node) { return; }
    node.textContent = text(CHAIN.note, '');
  }

  /* ---------- 启动 ---------- */

  function init() {
    var form = $('[data-verify-form]');
    var input = $('#verifyCode');
    var result = $('[data-verify-result]');
    if (!form || !input || !result) { return; }

    renderSamples();
    renderSteps();
    renderChainNote();

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      runQuery(input.value);
    });

    var fromUrl = readCodeParam();
    if (fromUrl) {
      input.value = fromUrl;
      runQuery(fromUrl);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

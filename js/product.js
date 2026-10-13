/* ==========================================================================
   dooyoor 㛊䎟 — 商品详情页
   依赖：js/site-config.js, js/cart.js, js/main.js
        （可选）js/auth.js, js/wallet.js, js/orders.js —— 缺失时优雅降级，不抛异常
   职责：读取 ?id= → 渲染商品、成色标签、溯源面板、流转记录、
        颜色/尺码/数量/图库/手风琴 → 加入购物袋 / 立即购买（交给 DY.orders.buyNow）
   金额与扣款一律由 DY.orders 负责，本页不计算、不改写、不扣款。
   ========================================================================== */
(function () {
  'use strict';

  var CART_MAX = 9;
  var QTY_MIN = 1;
  var QTY_MAX = 9;
  var FALLBACK_ID = 'p01';
  var COND_TAG = {
    'new': { className: 'cond-tag cond-tag--verified', text: '全新 · 已上链' },
    'used': { className: 'cond-tag cond-tag--used', text: '认证二手 · 官方验真' }
  };
  var SHIP_FIXED = [
    '现货在收到订单后 48 小时内从上海仓发出，江浙沪一般次日或隔日到，其他地区 2–4 天。',
    '全新商品签收后 30 天内，吊牌完整、未经洗涤和穿着，支持无理由退换；质量问题我们承担来回运费。',
    '认证二手商品支持 7 天无理由退换，需保持寄出时的成色，吊牌与溯源卡完整。'
  ];

  /* ---------- 工具 ---------- */

  function $(selector, scope) {
    return (scope || document).querySelector(selector);
  }

  function create(tagName, className, text) {
    var node = document.createElement(tagName);
    if (className) { node.className = className; }
    if (text !== undefined && text !== null) { node.textContent = String(text); }
    return node;
  }

  function clearNode(node) {
    if (!node) { return; }
    while (node.firstChild) { node.removeChild(node.firstChild); }
  }

  function starsMarkup(rating) {
    var score = Number(rating);
    if (!isFinite(score) || score < 0) { score = 0; }
    if (score > 5) { score = 5; }
    var filled = Math.round(score);
    var html = '';
    for (var i = 0; i < 5; i++) {
      html += '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" focusable="false"'
        + ' fill="' + (i < filled ? 'currentColor' : 'none') + '" stroke="currentColor"'
        + ' stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">'
        + '<path d="M12 4l2.4 5 5.6.7-4 3.9.9 5.4-4.9-2.6-4.9 2.6.9-5.4-4-3.9 5.6-.7Z"/></svg>';
    }
    return html;
  }

  /* ---------- 账户 / 钱包 / 订单层：存在性判断，任一缺失都不抛异常 ---------- */

  function authApi() {
    return (window.DY && window.DY.auth) ? window.DY.auth : null;
  }

  function walletApi() {
    return (window.DY && window.DY.wallet) ? window.DY.wallet : null;
  }

  function ordersApi() {
    return (window.DY && window.DY.orders) ? window.DY.orders : null;
  }

  function isLoggedIn() {
    var auth = authApi();
    if (!auth || typeof auth.isLoggedIn !== 'function') { return false; }
    try {
      return auth.isLoggedIn() === true;
    } catch (e) {
      return false;
    }
  }

  /* 余额 / 可用抵扣：只读钱包层的结果，本页不做任何抵扣计算 */
  function walletNumber(method) {
    var wallet = walletApi();
    if (!wallet || typeof wallet[method] !== 'function') { return 0; }
    try {
      var value = Number(wallet[method]());
      return isFinite(value) ? value : 0;
    } catch (e) {
      return 0;
    }
  }

  function demoNote() {
    var note = window.DY_CONFIG && window.DY_CONFIG.demoBalanceNote;
    return note ? String(note) : '演示余额，不涉及真实资金。';
  }

  /* 登录后跳回当前商品：next 为相对路径，必须编码 */
  function loginHref(productId) {
    return 'login.html?next=' + encodeURIComponent('product.html?id=' + String(productId));
  }

  /* ---------- 数据 ---------- */

  function readId() {
    var id = '';
    try {
      id = new URLSearchParams(window.location.search).get('id') || '';
    } catch (e) {
      id = '';
    }
    id = String(id).trim();
    if (!id) { return FALLBACK_ID; }
    return /^[A-Za-z0-9_-]{1,16}$/.test(id) ? id : FALLBACK_ID;
  }

  function productImage(product, index) {
    var gallery = product && product.gallery;
    if (gallery && gallery.length > index && gallery[index]) { return gallery[index]; }
    if (product && product.image) { return product.image; }
    return '';
  }

  function relatedFor(product, all, limit) {
    var picked = [];
    var seen = {};
    var i;

    function take(item) {
      if (!item) { return; }
      if (item.id === product.id) { return; }
      if (seen[item.id]) { return; }
      if (picked.length >= limit) { return; }
      seen[item.id] = true;
      picked.push(item);
    }

    for (i = 0; i < all.length; i++) {
      if (all[i].category === product.category) { take(all[i]); }
    }
    for (i = 0; i < all.length; i++) {
      if (picked.length >= limit) { break; }
      take(all[i]);
    }
    return picked;
  }

  /* ---------- 渲染：面包屑 / 商品信息 ---------- */

  function renderBreadcrumb(node, product) {
    if (!node) { return; }
    clearNode(node);

    var home = create('a', null, '首页');
    home.href = 'index.html';
    node.appendChild(home);

    var sep1 = create('span', null, '/');
    sep1.setAttribute('aria-hidden', 'true');
    node.appendChild(sep1);

    var shop = create('a', null, '全部商品');
    shop.href = 'shop.html';
    node.appendChild(shop);

    var sep2 = create('span', null, '/');
    sep2.setAttribute('aria-hidden', 'true');
    node.appendChild(sep2);

    var current = create('span', null, product.name);
    current.setAttribute('aria-current', 'page');
    node.appendChild(current);
  }

  function renderGallery(product) {
    var mainImg = $('[data-gallery-main]');
    var thumbsBox = $('[data-thumbs]');
    if (!thumbsBox) { return; }

    var sources = [0, 1, 2].map(function (index) {
      return {
        src: productImage(product, index),
        alt: product.name + ' 细节图 ' + String(index + 1)
      };
    });

    if (mainImg && sources[0] && sources[0].src) {
      mainImg.setAttribute('src', sources[0].src);
      mainImg.setAttribute('alt', product.name + ' 主图');
    }

    clearNode(thumbsBox);

    function activate(index) {
      var source = sources[index];
      if (!source || !source.src) { return; }
      if (mainImg) {
        mainImg.setAttribute('src', source.src);
        mainImg.setAttribute('alt', source.alt);
      }
      var buttons = thumbsBox.querySelectorAll('.thumb');
      for (var i = 0; i < buttons.length; i++) {
        if (i === index) {
          buttons[i].classList.add('is-active');
        } else {
          buttons[i].classList.remove('is-active');
        }
      }
    }

    sources.forEach(function (source, index) {
      if (!source.src) { return; }
      var thumb = create('button', 'thumb');
      thumb.type = 'button';
      thumb.setAttribute('data-index', String(index));
      thumb.setAttribute('aria-label', product.name + ' 视图 ' + String(index + 1));

      var img = create('img');
      img.setAttribute('src', source.src);
      img.setAttribute('alt', source.alt);
      img.setAttribute('loading', 'lazy');
      img.setAttribute('decoding', 'async');
      img.setAttribute('width', '800');
      img.setAttribute('height', '1000');
      thumb.appendChild(img);

      thumb.addEventListener('click', function () { activate(index); });
      thumbsBox.appendChild(thumb);
    });

    activate(0);
  }

  /* ---------- 渲染：title / meta（商品名 · 㛊䎟 dooyoor） ---------- */

  function setMetaContent(selector, value) {
    var node = document.querySelector(selector);
    if (!node) { return; }
    node.setAttribute('content', String(value));
  }

  function applyMeta(product) {
    var brand = ((window.DY_CONFIG && window.DY_CONFIG.brand) || {});
    var brandCn = brand.nameCn ? String(brand.nameCn) : '㛊䎟';
    var brandName = brand.name ? String(brand.name) : 'dooyoor';
    var title = String(product.name || '') + ' · ' + brandCn + ' ' + brandName;

    document.title = title;

    var desc = product.short ? String(product.short) + ' ' : '';
    desc += '东方古字为名、西方丹宁为体。赤耳丹宁 · 铜色压线 · 一物一码可上链查证。';

    setMetaContent('meta[name="description"]', desc);
    setMetaContent('meta[property="og:title"]', title);
    setMetaContent('meta[property="og:description"]', desc);
  }

  function renderInfo(product) {
    var title = $('[data-pdp-title]');
    var en = $('[data-pdp-en]');
    var price = $('[data-pdp-price]');
    var rating = $('[data-pdp-rating]');
    var short = $('[data-pdp-short]');

    if (title) { title.textContent = product.name; }
    if (en) { en.textContent = product.en; }
    if (short) { short.textContent = product.short; }

    if (price) {
      clearNode(price);
      var current = create('span', 'price', DY.money(product.price));
      if (product.compareAt && Number(product.compareAt) > Number(product.price)) {
        current.className = 'price price--sale';
      }
      price.appendChild(current);
      if (product.compareAt) {
        price.appendChild(create('span', 'price--was', '原价 ' + DY.money(product.compareAt)));
      }
    }

    if (rating) {
      clearNode(rating);
      var stars = create('span', 'stars');
      stars.setAttribute('aria-hidden', 'true');
      stars.innerHTML = starsMarkup(product.rating);
      rating.appendChild(stars);
      rating.appendChild(create('strong', null, String(product.rating)));
      rating.appendChild(create('span', null, '（' + String(product.reviews) + ' 条评价）'));
    }
  }

  /* ---------- 渲染：成色标签（全新 / 认证二手） ---------- */

  function renderCondition(product) {
    var tag = $('[data-pdp-cond]');
    if (!tag) { return; }
    var cond = COND_TAG[String(product.condition)] || COND_TAG['new'];
    tag.className = cond.className;
    tag.textContent = cond.text;
    tag.removeAttribute('hidden');
  }

  /* ---------- 渲染：区块链溯源面板 ---------- */

  function setText(selector, value) {
    var node = $(selector);
    if (!node) { return; }
    var text = (value === undefined || value === null || value === '') ? '—' : String(value);
    node.innerHTML = DY.escape(text);
  }

  function legacyCopy(text) {
    var field = create('textarea', 'u-sr-only');
    field.value = text;
    field.setAttribute('readonly', 'readonly');
    field.setAttribute('tabindex', '-1');
    document.body.appendChild(field);
    var ok = false;
    try {
      field.select();
      ok = document.execCommand('copy');
    } catch (e) {
      ok = false;
    }
    document.body.removeChild(field);
    return ok === true;
  }

  function copyCode(code) {
    function finish(ok) {
      if (ok) {
        DY.toast('已复制溯源码 ' + code);
      } else {
        DY.toast('当前环境不支持自动复制，请手动复制：' + code);
      }
    }

    var clipboard = null;
    try {
      clipboard = navigator.clipboard || null;
    } catch (e) {
      clipboard = null;
    }

    if (clipboard && typeof clipboard.writeText === 'function') {
      try {
        clipboard.writeText(code).then(
          function () { finish(true); },
          function () { finish(legacyCopy(code)); }
        );
        return;
      } catch (e) {
        /* 落到降级方案 */
      }
    }
    finish(legacyCopy(code));
  }

  function renderChain(product) {
    var panel = $('[data-chain-panel]');
    if (!panel) { return; }

    var chain = product.chain;
    if (!chain || !chain.code) {
      panel.setAttribute('hidden', 'hidden');
      return;
    }
    panel.removeAttribute('hidden');

    setText('[data-chain-code]', chain.code);
    setText('[data-chain-hash]', chain.hash);
    setText('[data-chain-network]', chain.network);
    setText('[data-chain-block]', chain.block);
    setText('[data-chain-minted]', chain.mintedAt);
    setText('[data-chain-owners]', (chain.owners === undefined || chain.owners === null) ? '' : chain.owners + ' 次');
    setText('[data-chain-workshop]', chain.workshop);
    setText('[data-chain-batch]', chain.batch);

    var verified = $('[data-chain-verified]');
    if (verified) {
      if (chain.verified) {
        verified.removeAttribute('hidden');
      } else {
        verified.setAttribute('hidden', 'hidden');
      }
    }

    var brandChain = ((window.DY_CONFIG.brand) || {}).chain || {};
    setText('[data-chain-note]', brandChain.note || '');

    var link = $('[data-verify-link]');
    if (link) {
      link.setAttribute('href', 'verify.html?code=' + encodeURIComponent(String(chain.code)));
    }

    var copyBtn = $('[data-copy-code]');
    if (copyBtn) {
      copyBtn.addEventListener('click', function () { copyCode(String(chain.code)); });
    }
  }

  /* ---------- 渲染：流转记录（认证二手含回收验真 → 养护 → 二次上链） ---------- */

  function renderLifecycle(product) {
    var box = $('[data-lifecycle]');
    if (!box) { return; }

    var list = $('[data-lifecycle-list]');
    var steps = product.lifecycle || [];
    if (!list || !steps.length) {
      box.setAttribute('hidden', 'hidden');
      return;
    }
    box.removeAttribute('hidden');
    clearNode(list);

    var html = '';
    steps.forEach(function (step) {
      html += '<div class="lifecycle-item">'
        + '<span class="lifecycle-marker" aria-hidden="true"></span>'
        + '<p class="lifecycle-date">' + DY.escape(step.date || '') + '</p>'
        + '<p class="lifecycle-title">' + DY.escape(step.title || '') + '</p>'
        + '<p class="lifecycle-desc">' + DY.escape(step.text || '') + '</p>'
        + '</div>';
    });
    list.innerHTML = html;

    var badge = $('[data-lifecycle-badge]');
    if (badge) {
      if (product.condition === 'used') {
        badge.innerHTML = DY.escape(String(product.conditionName || '认证二手') + ' · 已二次上链');
        badge.removeAttribute('hidden');
      } else {
        badge.setAttribute('hidden', 'hidden');
      }
    }
  }

  /* ---------- 渲染：品牌短记（优先读 DY_CONFIG.brand.shortStory） ----------
     字段存在且非空 → 用字段内容重绘 .quote；
     字段缺失（或为空）→ 保留 HTML 里写死的同一份 7 行文案，保证不空。 */

  function shortStoryLines() {
    var brand = ((window.DY_CONFIG && window.DY_CONFIG.brand) || {});
    var raw = brand.shortStory;
    var source = [];

    if (Object.prototype.toString.call(raw) === '[object Array]') {
      source = raw.slice();
    } else if (typeof raw === 'string' && raw) {
      source = raw.split(/\r?\n/);
    }

    var lines = [];
    source.forEach(function (line) {
      var text = (line === undefined || line === null) ? '' : String(line).replace(/^\s+|\s+$/g, '');
      if (text) { lines.push(text); }
    });
    return lines;
  }

  function renderShortStory() {
    var body = $('[data-short-story-body]');
    if (!body) { return; }

    var lines = shortStoryLines();
    if (!lines.length) { return; }

    var html = '';
    lines.forEach(function (line) { html += '<p>' + DY.escape(line) + '</p>'; });
    body.innerHTML = html;
  }

  /* ---------- 渲染：颜色 / 尺码 / 数量 ---------- */

  function renderColors(product, state) {
    var box = $('[data-swatches]');
    var label = $('[data-color-label]');
    if (!box) { return; }
    clearNode(box);

    var colors = product.colors || [];

    function activate(index) {
      var color = colors[index];
      if (!color) { return; }
      state.color = color.name;
      if (label) {
        clearNode(label);
        label.appendChild(document.createTextNode('颜色：'));
        label.appendChild(create('strong', null, color.name));
      }
      var buttons = box.querySelectorAll('.swatch-btn');
      for (var i = 0; i < buttons.length; i++) {
        if (i === index) {
          buttons[i].classList.add('is-active');
          buttons[i].setAttribute('aria-pressed', 'true');
        } else {
          buttons[i].classList.remove('is-active');
          buttons[i].setAttribute('aria-pressed', 'false');
        }
      }
    }

    colors.forEach(function (color, index) {
      var btn = create('button', 'swatch-btn');
      btn.type = 'button';
      btn.setAttribute('title', color.name);
      btn.setAttribute('aria-label', '颜色 ' + color.name);
      btn.setAttribute('aria-pressed', 'false');
      btn.style.setProperty('--sw', String(color.hex || ''));
      btn.addEventListener('click', function () { activate(index); });
      box.appendChild(btn);
    });

    if (colors.length) {
      state.colorIndex = 0;
      activate(0);
    } else {
      state.colorIndex = -1;
    }
  }

  function renderSizes(product, state) {
    var box = $('[data-sizes]');
    if (!box) { return; }
    clearNode(box);

    var sizes = product.sizes || [];

    function activate(index) {
      var size = sizes[index];
      if (!size) { return; }
      state.size = size;
      var buttons = box.querySelectorAll('.size-btn');
      for (var i = 0; i < buttons.length; i++) {
        if (i === index) {
          buttons[i].classList.add('is-active');
          buttons[i].setAttribute('aria-pressed', 'true');
        } else {
          buttons[i].classList.remove('is-active');
          buttons[i].setAttribute('aria-pressed', 'false');
        }
      }
    }

    sizes.forEach(function (size, index) {
      var btn = create('button', 'size-btn', size);
      btn.type = 'button';
      btn.setAttribute('aria-label', '尺码 ' + size);
      btn.setAttribute('aria-pressed', 'false');
      btn.addEventListener('click', function () { activate(index); });
      box.appendChild(btn);
    });
  }

  function bindQty(state) {
    var input = $('[data-qty-input]');
    if (!input) { return; }

    function sync() {
      input.value = String(state.qty);
    }

    function step(delta) {
      var next = state.qty + delta;
      if (next < QTY_MIN) { next = QTY_MIN; }
      if (next > QTY_MAX) { next = QTY_MAX; }
      state.qty = next;
      sync();
    }

    var dec = $('[data-qty="dec"]');
    var inc = $('[data-qty="inc"]');
    if (dec) { dec.addEventListener('click', function () { step(-1); }); }
    if (inc) { inc.addEventListener('click', function () { step(1); }); }

    sync();
  }

  /* ---------- 渲染：手风琴 ---------- */

  function bodyFor(kind) {
    return document.querySelector('[data-accordion-body][data-body="' + kind + '"]');
  }

  /* 尺码表按品类切换：上衣 / 裤子 / 裙子三套表写在 product.html 的
     <template data-size-table="tops|bottoms|skirts"> 里；包包等没有对应表的
     品类返回 null，由调用方改用商品 fit 字段作为「尺寸说明」。 */
  var SIZE_TABLE_KEYS = { tops: true, bottoms: true, skirts: true };

  function sizeTemplateFor(category) {
    var key = String(category || '');
    if (!SIZE_TABLE_KEYS[key]) { return null; }
    return document.querySelector('[data-size-table="' + key + '"]');
  }

  /* 只保留该商品在售的尺码行（例如裤子只有 XS–L 时不显示 XL 行）。
     若尺码集与模板完全对不上，则保留原始表，避免出现空表。 */
  function keepProductSizes(table, sizes) {
    if (!table || !sizes || !sizes.length) { return; }

    var wanted = {};
    sizes.forEach(function (size) { wanted[String(size)] = true; });

    var rows = table.querySelectorAll('tbody tr');
    var keep = [];
    var kept = 0;
    var i;

    for (i = 0; i < rows.length; i++) {
      var cell = rows[i].querySelector('[data-size]');
      var label = cell ? String(cell.getAttribute('data-size') || '') : '';
      var hit = wanted[label] === true;
      keep.push(hit);
      if (hit) { kept++; }
    }

    if (!kept) { return; }

    for (i = rows.length - 1; i >= 0; i--) {
      if (!keep[i]) { rows[i].parentNode.removeChild(rows[i]); }
    }
  }

  function sizeTableNode(product) {
    var tpl = sizeTemplateFor(product && product.category);
    if (!tpl || !tpl.content) { return null; }
    var table = tpl.content.cloneNode(true).querySelector('.size-table');
    if (!table) { return null; }
    keepProductSizes(table, (product && product.sizes) || []);
    return table;
  }

  function shippingLines() {
    var ship = (window.DY_CONFIG.shipping) || {};
    var free = Number(ship.freeThreshold);
    var fee = Number(ship.fee);
    if (!isFinite(free)) { free = 999; }
    if (!isFinite(fee)) { fee = 20; }
    var lines = SHIP_FIXED.slice();
    lines.splice(1, 0, '满 ' + DY.money(free) + ' 免运费，未满收 ' + DY.money(fee)
      + ' 运费。限量款如遇生产周期，预计发货时间会在商品页标注。');
    return lines;
  }

  function buildAccordionContent(product) {
    var fabricBody = bodyFor('fabric');
    if (fabricBody) {
      clearNode(fabricBody);
      fabricBody.appendChild(create('p', null, product.fabric));
      var details = product.details || [];
      if (details.length) {
        var list = create('ul');
        details.forEach(function (line) { list.appendChild(create('li', null, line)); });
        fabricBody.appendChild(list);
      }
    }

    var sizeBody = bodyFor('size');
    if (sizeBody) {
      clearNode(sizeBody);
      var sizeTable = sizeTableNode(product);
      if (sizeTable) {
        if (product.fit) { sizeBody.appendChild(create('p', null, product.fit)); }
        sizeBody.appendChild(sizeTable);
      } else if (product.fit) {
        /* 没有对应品类的尺码表（包包）：用 fit 字段作为尺寸说明，不显示空表 */
        sizeBody.appendChild(create('p', null, '尺寸说明：' + String(product.fit)));
      }
    }

    var careBody = bodyFor('care');
    if (careBody) {
      clearNode(careBody);
      var careList = create('ul');
      (product.care || []).forEach(function (line) { careList.appendChild(create('li', null, line)); });
      careBody.appendChild(careList);
    }

    var shipBody = bodyFor('ship');
    if (shipBody) {
      clearNode(shipBody);
      shippingLines().forEach(function (line) { shipBody.appendChild(create('p', null, line)); });
    }
  }

  function bindAccordion() {
    var heads = document.querySelectorAll('[data-accordion-head]');
    for (var i = 0; i < heads.length; i++) {
      (function (head) {
        head.addEventListener('click', function () {
          var id = head.getAttribute('aria-controls');
          var body = id ? document.getElementById(id) : null;
          if (!body) { return; }
          var expanded = head.getAttribute('aria-expanded') === 'true';
          head.setAttribute('aria-expanded', expanded ? 'false' : 'true');
          if (expanded) {
            body.setAttribute('hidden', 'hidden');
          } else {
            body.removeAttribute('hidden');
          }
        });
      })(heads[i]);
    }
  }

  function expandAccordion(selector) {
    var head = document.querySelector(selector);
    if (!head) { return; }
    var id = head.getAttribute('aria-controls');
    var body = id ? document.getElementById(id) : null;
    if (!body) { return; }
    head.setAttribute('aria-expanded', 'true');
    body.removeAttribute('hidden');
  }

  function bindSizeGuide() {
    var guide = $('[data-size-guide]');
    if (!guide) { return; }
    guide.addEventListener('click', function () {
      expandAccordion('[aria-controls="acc-size"][data-accordion-head]');
      var body = document.getElementById('acc-size');
      if (body) { body.scrollIntoView({ block: 'nearest' }); }
    });
  }

  /* ---------- 渲染：相关推荐 ---------- */

  function productCardMarkup(product) {
    var img = DY.escape(product.image || '');
    var name = DY.escape(product.name || '');
    var href = 'product.html?id=' + encodeURIComponent(product.id);
    var onSale = Number(product.compareAt) > Number(product.price) && Number(product.compareAt) > 0;
    var html = '<article class="product-card">'
      + '<a class="product-media" href="' + href + '">'
      + '<img src="' + img + '" alt="' + name + '" loading="lazy" decoding="async" width="800" height="1000">';

    if (product.badge) {
      var badgeClass = product.condition === 'used' ? 'product-badge product-badge--used' : 'product-badge';
      html += '<span class="' + badgeClass + '">' + DY.escape(product.badge) + '</span>';
    }

    html += '</a><div class="product-body">'
      + '<h3 class="product-name"><a href="' + href + '">' + name + '</a></h3>'
      + '<p class="product-en">' + DY.escape(product.en || '') + '</p>'
      + '<p class="product-price"><span class="price' + (onSale ? ' price--sale' : '') + '">'
      + DY.money(product.price) + '</span>';

    if (onSale) {
      html += '<span class="price--was">' + DY.money(product.compareAt) + '</span>';
    }

    html += '</p><ul class="product-swatches" aria-label="可选颜色">';
    (product.colors || []).forEach(function (color) {
      html += '<li><span class="swatch" style="--sw:' + DY.escape(color.hex) + '" title="'
        + DY.escape(color.name) + '"></span></li>';
    });
    html += '</ul></div></article>';
    return html;
  }

  function renderRelated(product, all) {
    var box = $('[data-related]');
    if (!box) { return; }

    var list = relatedFor(product, all, 4);
    clearNode(box);
    if (!list.length) { return; }

    list.forEach(function (item) {
      box.appendChild(DY.el(productCardMarkup(item)));
    });
  }

  /* ---------- 出错状态 ---------- */

  function showMissing() {
    var pdp = $('[data-pdp]');
    var empty = $('[data-pdp-empty]');
    var main = document.getElementById('main');
    if (pdp) { pdp.setAttribute('hidden', 'hidden'); }
    if (empty) { empty.removeAttribute('hidden'); }
    if (main) { main.setAttribute('data-pdp-missing', 'true'); }
    document.title = '未找到商品 · 㛊䎟 dooyoor';
  }

  /* ---------- 渲染：当前余额与可用抵扣（仅登录且大于 0 时显示） ---------- */

  function renderWalletNote() {
    var note = $('[data-pdp-wallet]');
    if (!note) { return; }

    var parts = [];
    if (isLoggedIn()) {
      var balance = walletNumber('balance');
      var credit = walletNumber('discountUnlocked');
      if (balance > 0) { parts.push('当前余额 ' + DY.money(balance)); }
      if (credit > 0) { parts.push('可用抵扣 ' + DY.money(credit) + '（下单时优先抵扣）'); }
    }

    if (!parts.length) {
      note.innerHTML = '';
      note.setAttribute('hidden', 'hidden');
      return;
    }

    note.innerHTML = '<span class="badge badge--warn">' + DY.escape(demoNote()) + '</span> '
      + DY.escape(parts.join(' · '));
    note.removeAttribute('hidden');
  }

  /* ---------- 加入购物袋 / 立即购买 ---------- */

  function bindActions(product, state) {
    var addBtn = $('[data-add-to-cart]');
    var buyBtn = $('[data-buy-now]');
    var busy = false;

    function currentQty() {
      var qty = Math.round(Number(state.qty));
      if (!isFinite(qty)) { qty = QTY_MIN; }
      return Math.min(CART_MAX, Math.max(QTY_MIN, qty));
    }

    function tryAdd() {
      if (!state.size) {
        DY.toast('请先选择尺码');
        return null;
      }
      var result = DY.cart.add(product.id, state.size, currentQty());
      DY.toast(result && result.message ? result.message : '已加入购物袋');
      return result;
    }

    if (addBtn) {
      addBtn.addEventListener('click', function () { tryAdd(); });
    }

    /* 立即购买：直接下单，不再加入购物袋。
       金额计算与扣款只发生在 DY.orders.buyNow 内部，本页只传 id/size/qty。 */
    if (buyBtn) {
      buyBtn.addEventListener('click', function () {
        if (busy) { return; }

        if (!state.size) {
          DY.toast('请先选择尺码');
          return;
        }

        if (!isLoggedIn()) {
          DY.toast('请先登录后购买');
          window.location.href = loginHref(product.id);
          return;
        }

        var orders = ordersApi();
        if (!orders || typeof orders.buyNow !== 'function') {
          DY.toast('下单服务未就绪，请稍后重试');
          return;
        }

        busy = true;
        buyBtn.disabled = true;

        var result = null;
        try {
          result = orders.buyNow(product.id, state.size, currentQty());
        } catch (e) {
          result = null;
        }

        if (result && result.ok) {
          DY.toast('下单成功');
          window.setTimeout(function () {
            window.location.href = 'account.html?view=orders';
          }, 600);
          return;
        }

        busy = false;
        buyBtn.disabled = false;
        DY.toast(result && result.message ? String(result.message) : '下单失败，请稍后重试');
        renderWalletNote();
      });
    }
  }

  /* ---------- 启动 ---------- */

  function init() {
    if (!window.DY || !window.DY_CONFIG || typeof window.DY.getProduct !== 'function') { return; }

    var id = readId();
    var product = window.DY.getProduct(id);
    if (!product) { product = window.DY.getProduct(FALLBACK_ID); }
    if (!product) { showMissing(); return; }

    var state = { color: '', colorIndex: 0, size: '', qty: 1 };

    applyMeta(product);
    renderBreadcrumb($('[data-breadcrumb]'), product);
    renderGallery(product);
    renderInfo(product);
    renderCondition(product);
    renderChain(product);
    renderLifecycle(product);
    renderColors(product, state);
    renderSizes(product, state);
    bindQty(state);
    renderShortStory();
    buildAccordionContent(product);
    bindAccordion();
    bindSizeGuide();
    renderRelated(product, window.DY_CONFIG.products || []);
    bindActions(product, state);
    renderWalletNote();
    document.addEventListener('dy:auth-change', renderWalletNote);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

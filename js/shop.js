/* ==========================================================================
   DOOYOOR 㛊䎟 — 全部商品页逻辑
   依赖：js/site-config.js, js/cart.js, js/main.js
   职责：分类筛选、成色筛选（全新 / 认证二手）、关键词筛选、排序、
        URL 同步（replaceState，不刷新页面）
   ========================================================================== */
(function () {
  'use strict';

  function onReady(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  }

  onReady(function () {
    var CFG = window.DY_CONFIG || {};
    var PRODUCTS = CFG.products || [];
    var DY = window.DY || {};

    /* ---------- 容错：工具缺失时退化为最小实现 ---------- */
    function esc(value) {
      if (typeof DY.escape === 'function') { return DY.escape(value); }
      if (value === null || value === undefined) { return ''; }
      return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    function money(value) {
      if (typeof DY.money === 'function') { return DY.money(value); }
      return '¥' + String(Math.round(Number(value) || 0));
    }

    /* ---------- 节点 ---------- */
    var grid = document.querySelector('[data-product-grid]');
    if (!grid) { return; }

    var countNode = document.querySelector('[data-result-count]');
    var emptyNode = document.querySelector('[data-empty]');
    var sortSelect = document.querySelector('[data-sort]');
    var clearBtn = document.querySelector('[data-clear-filter]');
    // 搜索建议里也有 .filter-chip，但它们是 <a>，且不在 .filter-bar 内：
    // 这里只绑 .filter-bar 里的 button[data-filter] / button[data-cond]
    var chips = document.querySelectorAll('.filter-bar button[data-filter]');
    var condChips = document.querySelectorAll('.filter-bar button[data-cond]');

    var CATEGORIES = ['all', 'tops', 'bottoms', 'skirts', 'bags'];
    var CATEGORY_NAMES = {
      all: '全部', tops: '上衣', bottoms: '裤子', skirts: '裙子', bags: '包包'
    };
    var CONDITIONS = ['all', 'new', 'used'];
    var SORTS = ['featured', 'price-asc', 'price-desc', 'new'];

    var CONDITION_OPTIONS = CFG.conditionOptions || [];
    var CONDITION_FALLBACK = { all: '全部成色', new: '全新', used: '认证二手' };

    function conditionName(id) {
      for (var i = 0; i < CONDITION_OPTIONS.length; i++) {
        if (CONDITION_OPTIONS[i] && CONDITION_OPTIONS[i].id === id) {
          return String(CONDITION_OPTIONS[i].name || '');
        }
      }
      return CONDITION_FALLBACK[id] || '';
    }

    var state = { category: 'all', condition: 'all', query: '', sort: 'featured' };

    /* ---------- URL 读取 ---------- */
    function getParam(name) {
      var search = String(window.location.search || '');
      if (search.charAt(0) === '?') { search = search.slice(1); }
      if (!search) { return ''; }
      var parts = search.split('&');
      for (var i = 0; i < parts.length; i++) {
        if (!parts[i]) { continue; }
        var eq = parts[i].indexOf('=');
        var rawKey = eq === -1 ? parts[i] : parts[i].slice(0, eq);
        var rawVal = eq === -1 ? '' : parts[i].slice(eq + 1);
        if (safeDecode(rawKey) !== name) { continue; }
        return safeDecode(rawVal);
      }
      return '';
    }

    function safeDecode(text) {
      try {
        return decodeURIComponent(String(text).replace(/\+/g, ' '));
      } catch (e) {
        return String(text);
      }
    }

    // 非法值一律回落到默认：分类 all、成色 all、排序 featured、关键词空
    function readStateFromUrl() {
      var c = String(getParam('c') || '').trim();
      if (CATEGORIES.indexOf(c) !== -1) { state.category = c; }

      var cond = String(getParam('cond') || '').trim();
      if (CONDITIONS.indexOf(cond) !== -1) { state.condition = cond; }

      state.query = String(getParam('q') || '').trim();

      var s = String(getParam('sort') || '').trim();
      if (SORTS.indexOf(s) !== -1) { state.sort = s; }
    }

    /* ---------- URL 同步（不刷新页面） ---------- */
    function syncUrl() {
      var params = [];
      if (state.category !== 'all') { params.push('c=' + encodeURIComponent(state.category)); }
      if (state.condition !== 'all') { params.push('cond=' + encodeURIComponent(state.condition)); }
      if (state.query) { params.push('q=' + encodeURIComponent(state.query)); }
      if (state.sort !== 'featured') { params.push('sort=' + encodeURIComponent(state.sort)); }

      var query = params.length ? '?' + params.join('&') : '';
      if (query === String(window.location.search || '')) { return; }

      try {
        // 只替换查询串：同源同文档，不刷新页面
        window.history.replaceState(null, '', query || window.location.pathname);
      } catch (e) {
        // file:// 或受限环境下改写 URL 可能被拒绝，忽略即可，不影响筛选
      }
    }

    /* ---------- 筛选与排序 ---------- */
    function matchQuery(product, keyword) {
      if (!keyword) { return true; }
      var q = keyword.toLowerCase();
      var fields = [product.name, product.en, product.categoryName];
      for (var i = 0; i < fields.length; i++) {
        var value = fields[i];
        if (value && String(value).toLowerCase().indexOf(q) !== -1) { return true; }
      }
      return false;
    }

    // 分类 + 成色 + 关键词 三者同时生效
    function filtered() {
      return PRODUCTS.filter(function (product) {
        if (state.category !== 'all' && product.category !== state.category) { return false; }
        if (state.condition !== 'all' && product.condition !== state.condition) { return false; }
        return matchQuery(product, state.query);
      });
    }

    function sorted(list) {
      var order = {};
      for (var i = 0; i < PRODUCTS.length; i++) { order[PRODUCTS[i].id] = i; }
      var bySourceOrder = function (a, b) { return order[a.id] - order[b.id]; };

      if (state.sort === 'price-asc') {
        list.sort(function (a, b) { return (a.price - b.price) || bySourceOrder(a, b); });
      } else if (state.sort === 'price-desc') {
        list.sort(function (a, b) { return (b.price - a.price) || bySourceOrder(a, b); });
      } else if (state.sort === 'new') {
        list.sort(function (a, b) {
          var an = a.badge === '新品' ? 0 : 1;
          var bn = b.badge === '新品' ? 0 : 1;
          return (an - bn) || bySourceOrder(a, b);
        });
      }
      // featured：保持 site-config.js 里的原数组顺序
      return list;
    }

    /* ---------- 渲染 ---------- */
    // 结构逐字对应规范 §7.7，缩进与 .product-grid 在页面中的层级一致
    function cardHtml(product) {
      var href = 'product.html?id=' + encodeURIComponent(product.id);
      var image = product.image || (product.gallery && product.gallery[0]) || '';
      var isUsed = product.condition === 'used';
      var usedName = product.conditionName || conditionName('used') || '认证二手';
      // 认证二手即使数据里 badge 为 null，也必须有角标
      var badgeText = product.badge || (isUsed ? usedName : '');
      var lines = [];

      lines.push('        <article class="product-card">');
      lines.push('          <a class="product-media" href="' + esc(href) + '">');
      lines.push('            <img src="' + esc(image) + '" alt="' + esc(product.name) + '" loading="lazy" decoding="async" width="800" height="1000">');
      if (badgeText) {
        lines.push('            <span class="product-badge' + (isUsed ? ' product-badge--used' : '') + '">' + esc(badgeText) + '</span>');
      }
      lines.push('          </a>');
      lines.push('          <div class="product-body">');
      lines.push('            <h3 class="product-name"><a href="' + esc(href) + '">' + esc(product.name) + '</a></h3>');
      lines.push('            <p class="product-en">' + esc(product.en) + '</p>');

      // 成色标签：认证二手 / 全新 · 已上链，让成色在列表页一眼可辨
      if (isUsed) {
        lines.push('            <p class="cond-tag cond-tag--used">' + esc(usedName) + '</p>');
      } else {
        lines.push('            <p class="cond-tag cond-tag--verified">全新 · 已上链</p>');
      }

      // 全站统一价格口径：有 compareAt 时现价带 .price--sale，原价用 .price--was
      var priceLine = '            <p class="product-price"><span class="price'
        + (product.compareAt ? ' price--sale' : '') + '">' + esc(money(product.price)) + '</span>';
      if (product.compareAt) {
        priceLine += '<span class="price--was">' + esc(money(product.compareAt)) + '</span>';
      }
      priceLine += '</p>';
      lines.push(priceLine);

      lines.push('            <ul class="product-swatches" aria-label="可选颜色">');

      var colors = product.colors || [];
      for (var i = 0; i < colors.length; i++) {
        lines.push('              <li><span class="swatch" style="--sw:' + esc(colors[i].hex) + '" title="' + esc(colors[i].name) + '"></span></li>');
      }

      lines.push('            </ul>');
      lines.push('          </div>');
      lines.push('        </article>');
      return lines.join('\n');
    }

    function syncChipGroup(nodes, attr, activeValue) {
      for (var i = 0; i < nodes.length; i++) {
        var isActive = nodes[i].getAttribute(attr) === activeValue;
        if (isActive) {
          nodes[i].classList.add('is-active');
        } else {
          nodes[i].classList.remove('is-active');
        }
        nodes[i].setAttribute('aria-pressed', isActive ? 'true' : 'false');
      }
    }

    function syncSort() {
      if (sortSelect) { sortSelect.value = state.sort; }
    }

    // 「共 N 件」，有筛选生效时追加说明，如「共 2 件 · 认证二手」
    function countText(total) {
      var text = '共 ' + total + ' 件';
      var parts = [];
      if (state.condition !== 'all') { parts.push(conditionName(state.condition)); }
      if (state.category !== 'all') { parts.push(CATEGORY_NAMES[state.category] || state.category); }
      if (state.query) { parts.push('关键词「' + state.query + '」'); }
      if (parts.length) { text += ' · ' + parts.join(' · '); }
      return text;
    }

    function render() {
      var list = sorted(filtered());
      var html = [];
      for (var i = 0; i < list.length; i++) { html.push(cardHtml(list[i])); }
      grid.innerHTML = html.length ? html.join('\n') + '\n' : '';

      if (countNode) { countNode.textContent = countText(list.length); }

      if (emptyNode) {
        if (list.length === 0) {
          emptyNode.removeAttribute('hidden');
        } else {
          emptyNode.setAttribute('hidden', 'hidden');
        }
      }

      syncChipGroup(chips, 'data-filter', state.category);
      syncChipGroup(condChips, 'data-cond', state.condition);
      syncSort();
      syncUrl();
    }

    /* ---------- 事件 ---------- */
    for (var i = 0; i < chips.length; i++) {
      (function (chip) {
        chip.addEventListener('click', function (e) {
          e.preventDefault();
          var value = chip.getAttribute('data-filter');
          if (CATEGORIES.indexOf(value) === -1) { return; }
          state.category = value;
          render();
        });
      })(chips[i]);
    }

    for (var j = 0; j < condChips.length; j++) {
      (function (chip) {
        chip.addEventListener('click', function (e) {
          e.preventDefault();
          var value = chip.getAttribute('data-cond');
          if (CONDITIONS.indexOf(value) === -1) { return; }
          state.condition = value;
          render();
        });
      })(condChips[j]);
    }

    if (sortSelect) {
      sortSelect.addEventListener('change', function () {
        var value = sortSelect.value;
        state.sort = SORTS.indexOf(value) === -1 ? 'featured' : value;
        render();
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener('click', function (e) {
        e.preventDefault();
        // 一次性重置四者：分类 + 成色 + 关键词 + 排序
        state.category = 'all';
        state.condition = 'all';
        state.query = '';
        state.sort = 'featured';
        render();
      });
    }

    /* ---------- 初始化 ---------- */
    readStateFromUrl();
    render();
  });
})();

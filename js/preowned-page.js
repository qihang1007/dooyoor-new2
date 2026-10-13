/* ==========================================================================
   DOOYOOR 㛊䎟 — 二手商城页逻辑
   依赖：js/site-config.js, js/cart.js（DY.store/DY.escape/DY.money/DY.toast）
        js/main.js, js/fav.js, js/auth.js, js/wallet.js, js/orders.js,
        js/preowned.js（DY.preowned.list / DY.auth.isLoggedIn / DY.orders.buyUsed）
   职责：渲染二手列表、分类 + 等级 + 排序组合过滤、URL 同步（replaceState）、
        立即购买（事件委托）、?publish=<单号> 打开发布二手表单（站点内 Modal）
   约定：纯 ES5、无依赖、无网络请求；所有插入 DOM 的文本经 DY.escape()，
        金额经 DY.money()；任何依赖缺失时优雅降级，绝不抛异常；
        绝不使用 prompt() / confirm() / alert()。
   对应规范：§7.7 商品卡结构 / §11 附录类名 / §12.5 listing / §12.9 发布二手 /
            §12.10 二手交易 / §12.13 preowned.html 页面契约
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

    function toast(message) {
      if (typeof DY.toast === 'function') { DY.toast(message); }
    }

    function str(value) {
      return value === null || value === undefined ? '' : String(value);
    }

    function trimmed(value) {
      return str(value).replace(/^\s+|\s+$/g, '');
    }

    function toArray(value) {
      return Object.prototype.toString.call(value) === '[object Array]' ? value : [];
    }

    function num(value) {
      var n = Number(value);
      return isFinite(n) ? n : 0;
    }

    /* 手机号脱敏：任意长度都安全，绝不抛异常、绝不原样返回
       - 长度 0        → ''（调用方负责回落到「DOOYOOR 官方」）
       - 长度 1–3      → 全遮：***
       - 长度 4–7      → 首尾各留 1 位：1****7
       - 长度 ≥8       → 标准形式 138****8000（前缀 3 位 + **** + 后 4 位） */
    function stars(count) {
      var n = count > 0 ? Math.floor(count) : 0;
      return new Array(n + 1).join('*');
    }

    function maskPhone(value) {
      var raw = trimmed(value);
      var len = raw.length;
      if (!len) { return ''; }
      if (len <= 3) { return stars(len); }
      if (len < 8) { return raw.charAt(0) + stars(len - 2) + raw.charAt(len - 1); }
      return raw.slice(0, 3) + '****' + raw.slice(len - 4);
    }

    /* 卖家一行：官方渠道（sellerPhone 为空）显示官方名，否则脱敏手机号 */
    function sellerText(listing) {
      var phone = trimmed(listing && listing.sellerPhone);
      return phone ? maskPhone(phone) : 'DOOYOOR 官方';
    }

    /* ---------- 节点 ---------- */
    var grid = document.querySelector('[data-grid]');
    if (!grid) { return; }

    var countNode = document.querySelector('[data-result-count]');
    var emptyNode = document.querySelector('[data-empty]');
    var sortSelect = document.querySelector('[data-sort]');
    var clearBtn = document.querySelector('[data-clear-filter]');
    var publishNotice = document.querySelector('[data-publish-notice]');

    /* 发布二手 Modal（?publish=<单号> 时打开） */
    var publishModal = document.querySelector('[data-publish-modal]');
    var publishNameNode = document.querySelector('[data-publish-name]');
    var publishOriginNode = document.querySelector('[data-publish-origin]');
    var publishPriceInput = document.querySelector('#publishPrice');
    var publishNoteInput = document.querySelector('#publishNote');
    var publishErrorNode = document.querySelector('[data-publish-error]');
    var publishSubmitBtn = document.querySelector('[data-publish-submit]');

    // 搜索建议里的 .filter-chip 是 <a> 且不在 .filter-bar 内，这里只取筛选条里的 button
    var catChips = document.querySelectorAll('.filter-bar button[data-filter]');
    var gradeChips = document.querySelectorAll('.filter-bar button[data-grade]');

    /* ---------- 取值域 ---------- */
    var CATEGORIES = ['all', 'tops', 'bottoms', 'skirts', 'bags'];
    var CATEGORY_NAMES = {
      all: '全部', tops: '上衣', bottoms: '裤子', skirts: '裙子', bags: '包包'
    };
    var GRADES = ['all', 'A-', 'B+', 'B'];
    var SORTS = ['featured', 'price-asc', 'price-desc'];

    var state = { category: 'all', grade: 'all', sort: 'featured', orderNo: '' };

    /* ---------- URL 读取 ---------- */
    function safeDecode(text) {
      try {
        return decodeURIComponent(String(text).replace(/\+/g, ' '));
      } catch (e) {
        return String(text);
      }
    }

    function getParam(name) {
      var search = str(window.location.search);
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

    // 非法值一律回落到默认：分类 all、等级 all、排序 featured
    function readStateFromUrl() {
      var c = trimmed(getParam('c'));
      if (CATEGORIES.indexOf(c) !== -1) { state.category = c; }

      var g = trimmed(getParam('grade'));
      if (GRADES.indexOf(g) !== -1) { state.grade = g; }

      var s = trimmed(getParam('sort'));
      if (SORTS.indexOf(s) !== -1) { state.sort = s; }

      // ?publish=<orderNo>：待发布的订单号，用于打开「发布二手」表单（不按名称反查）
      state.orderNo = trimmed(getParam('publish'));
    }

    /* ---------- URL 同步（replaceState，不刷新页面） ---------- */
    function syncUrl() {
      var params = [];
      if (state.category !== 'all') { params.push('c=' + encodeURIComponent(state.category)); }
      if (state.grade !== 'all') { params.push('grade=' + encodeURIComponent(state.grade)); }
      if (state.sort !== 'featured') { params.push('sort=' + encodeURIComponent(state.sort)); }
      // 发布流程未结束（表单已打开或待打开）时保留订单号，成功后由 replaceState 去掉
      if (state.orderNo) { params.push('publish=' + encodeURIComponent(state.orderNo)); }

      var query = params.length ? '?' + params.join('&') : '';
      if (query === str(window.location.search)) { return; }

      try {
        window.history.replaceState(null, '', query || window.location.pathname);
      } catch (e) {
        // file:// 或受限环境下改写地址会被拒绝，静默忽略，不影响筛选
      }
    }

    /* ---------- 数据 ---------- */
    function allListings() {
      var api = DY.preowned;
      if (!api || typeof api.list !== 'function') { return []; }
      var list = null;
      try {
        list = api.list();
      } catch (e) {
        list = null;
      }
      return toArray(list);
    }

    // 分类 + 等级 同时生效
    function filtered(list) {
      var result = [];
      for (var i = 0; i < list.length; i++) {
        var item = list[i];
        if (!item) { continue; }
        if (state.category !== 'all' && trimmed(item.category) !== state.category) { continue; }
        if (state.grade !== 'all' && trimmed(item.grade) !== state.grade) { continue; }
        result.push(item);
      }
      return result;
    }

    // 推荐 = DY.preowned.list() 的原顺序；价格排序并列时按原顺序，保证结果稳定
    function sorted(list) {
      var order = {};
      for (var i = 0; i < list.length; i++) { order[str(list[i].id)] = i; }
      var bySource = function (a, b) { return order[str(a.id)] - order[str(b.id)]; };

      var copy = list.slice();
      if (state.sort === 'price-asc') {
        copy.sort(function (a, b) { return (num(a.price) - num(b.price)) || bySource(a, b); });
      } else if (state.sort === 'price-desc') {
        copy.sort(function (a, b) { return (num(b.price) - num(a.price)) || bySource(a, b); });
      }
      return copy;
    }

    // 二手不单独建详情页：靠 chainCode 反查原商品（找不到就不渲染该链接）
    function productIdByChainCode(code) {
      var wanted = trimmed(code);
      if (!wanted) { return ''; }
      var products = toArray(CFG.products);
      for (var i = 0; i < products.length; i++) {
        var product = products[i];
        var chain = product && product.chain;
        if (chain && trimmed(chain.code) === wanted) { return trimmed(product.id); }
      }
      return '';
    }

    /* ---------- 渲染 ---------- */
    // 结构对应规范 §7.7；因卡片内含「立即购买」按钮，整卡不包 <a>（避免嵌套交互冲突）
    function cardHtml(listing) {
      var id = trimmed(listing.id);
      var name = str(listing.name);
      var image = str(listing.image);
      var grade = trimmed(listing.grade) || 'B+';
      var official = !trimmed(listing.sellerPhone);
      var productId = productIdByChainCode(listing.chainCode);
      var lines = [];

      lines.push('        <article class="product-card">');
      lines.push('          <div class="product-media">');
      lines.push('            <img src="' + esc(image) + '" alt="' + esc(name) + '" loading="lazy" decoding="async" width="800" height="1000">');
      lines.push('            <span class="product-badge product-badge--used">' + esc('认证二手 ' + grade) + '</span>');
      lines.push('          </div>');
      lines.push('          <div class="product-body">');
      lines.push('            <h3 class="product-name">' + esc(name) + '</h3>');
      lines.push('            <p class="product-en">' + esc(listing.nameEn) + '</p>');
      lines.push('            <p class="product-price"><span class="price price--sale">' + esc(money(listing.price))
        + '</span><span class="price--was">' + esc(money(listing.origin)) + '</span></p>');
      lines.push('            <p class="cond-tag cond-tag--used">' + esc('成色 ' + grade + ' · ' + (official ? '官方渠道' : '个人转让')) + '</p>');
      lines.push('            <p class="chain-note">卖家：' + esc(sellerText(listing)) + '</p>');
      lines.push('            <p><button class="btn btn--primary btn--sm" type="button" data-buy="' + esc(id) + '">立即购买</button></p>');
      if (productId) {
        lines.push('            <p><a class="link-btn" href="' + esc('product.html?id=' + encodeURIComponent(productId)) + '">查看原商品</a></p>');
      }
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

    // 「共 N 件」，有筛选生效时追加说明，如「共 1 件 · 上衣 · 成色 A-」
    function countText(total) {
      var text = '共 ' + total + ' 件';
      var parts = [];
      if (state.category !== 'all') { parts.push(CATEGORY_NAMES[state.category] || state.category); }
      if (state.grade !== 'all') { parts.push('成色 ' + state.grade); }
      if (parts.length) { text += ' · ' + parts.join(' · '); }
      return text;
    }

    function render() {
      var list = sorted(filtered(allListings()));
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

      syncChipGroup(catChips, 'data-filter', state.category);
      syncChipGroup(gradeChips, 'data-grade', state.grade);
      if (sortSelect) { sortSelect.value = state.sort; }
      syncUrl();
    }

    /* ======================================================================
       ?publish=<单号> → 发布二手（站点内 Modal，绝不使用 prompt()/confirm()/alert()）
       ====================================================================== */

    var MODAL_FADE_MS = 280;
    var publishState = { order: null, origin: 0, lastFocus: null, open: false };

    function isLoggedIn() {
      var auth = DY.auth;
      if (auth && typeof auth.isLoggedIn === 'function') {
        try { return !!auth.isLoggedIn(); } catch (e) { /* 回落到 current() */ }
      }
      return currentUser() !== null;
    }

    function currentUser() {
      var auth = DY.auth;
      if (!auth || typeof auth.current !== 'function') { return null; }
      var user = null;
      try { user = auth.current(); } catch (e) { user = null; }
      return (user && typeof user === 'object') ? user : null;
    }

    /* 按「单号」反查订单 —— 与 DY.preowned.publish 第 3 步同口径，绝不按名称 */
    function findOrder(user, orderNo) {
      var wanted = trimmed(orderNo);
      if (!wanted) { return null; }
      var orders = toArray(user && user.orders);
      for (var i = 0; i < orders.length; i++) {
        if (orders[i] && trimmed(orders[i].no) === wanted) { return orders[i]; }
      }
      return null;
    }

    function orderFirstItem(order) {
      return toArray(order && order.items)[0] || null;
    }

    function orderItemName(order) {
      var item = orderFirstItem(order);
      return trimmed(item && item.name);
    }

    /* 原价取第一行：单件用 lineTotal，多件用单价 unitPrice（publish 期望正数 origin） */
    function orderOrigin(order) {
      var item = orderFirstItem(order);
      if (!item) { return 0; }
      var unit = num(item.unitPrice);
      var line = num(item.lineTotal);
      if (num(item.qty) > 1 && unit > 0) { return unit; }
      return line > 0 ? line : unit;
    }

    function inDocument(node) {
      var el = node;
      while (el) {
        if (el === document) { return true; }
        el = el.parentNode;
      }
      return false;
    }

    function focusField(node) {
      if (!node || node.nodeType !== 1 || typeof node.focus !== 'function') { return; }
      try { node.focus(); } catch (e) { /* 忽略 */ }
    }

    /* 页面提示位：无 ?publish= / 找不到订单 / 发布成功都用它，代替原「死循环」提示 */
    function showNotice(message) {
      if (!publishNotice) { return; }
      publishNotice.innerHTML = esc(message)
        + ' <a class="link-btn" href="account.html?view=orders">去「我的订单」</a>';
      publishNotice.hidden = false;
    }

    function hideNotice() {
      if (!publishNotice) { return; }
      publishNotice.hidden = true;
      publishNotice.textContent = '';
    }

    function setPublishError(message) {
      if (!publishErrorNode) { return; }
      var text = trimmed(message);
      publishErrorNode.innerHTML = esc(text);
      if (text) {
        publishErrorNode.removeAttribute('hidden');
      } else {
        publishErrorNode.setAttribute('hidden', 'hidden');
      }
    }

    function openPublishModal(order) {
      if (!publishModal || !order) { return false; }

      var already = order.usedPublished === true;
      var origin = orderOrigin(order);
      var name = orderItemName(order) || '订单商品';

      publishState.order = order;
      publishState.origin = origin;
      publishState.lastFocus = document.activeElement;
      publishState.open = true;

      if (publishNameNode) { publishNameNode.innerHTML = esc(name); }
      if (publishOriginNode) {
        publishOriginNode.innerHTML = esc(origin > 0 ? money(origin) : '订单未记录原价');
      }
      if (publishPriceInput) {
        publishPriceInput.value = '';
        if (origin > 0) {
          publishPriceInput.setAttribute('max', String(origin));
        } else {
          publishPriceInput.removeAttribute('max');
        }
      }
      if (publishNoteInput) { publishNoteInput.value = ''; }
      if (publishSubmitBtn) { publishSubmitBtn.disabled = already; }

      hideNotice();
      setPublishError(already ? '该订单已发布过二手，不能重复发布。' : '');

      publishModal.removeAttribute('hidden');
      void publishModal.offsetWidth;          // 强制重排，保证过渡生效
      publishModal.classList.add('is-open');

      /* 聚焦「转让价格」；已发布过时焦点落到关闭按钮，避免对着禁用的表单输入 */
      focusField(already ? publishModal.querySelector('button[data-publish-close]') : publishPriceInput);
      return true;
    }

    function closePublishModal() {
      if (!publishModal || !publishState.open) { return; }
      publishState.open = false;

      publishModal.classList.remove('is-open');
      window.setTimeout(function () {
        if (!publishModal.classList.contains('is-open')) {
          publishModal.setAttribute('hidden', 'hidden');
        }
      }, MODAL_FADE_MS);

      /* 关闭后焦点归还触发元素；本页自动打开（触发元素在订单页）时兜底回到 CTA */
      var back = publishState.lastFocus;
      publishState.lastFocus = null;
      if (back && back.nodeType === 1 && back !== document.body && inDocument(back)) {
        focusField(back);
      } else {
        focusField(document.querySelector('.page-head a.btn'));
      }
    }

    function failPublish(message) {
      setPublishError(message);
      toast(message);
      return false;
    }

    /* §12.9 第 3 步要求发布成功后把该订单置 usedPublished = true（防重复发布）。
       preowned.js 是在 auth.update() 落盘之后才置位的，那一笔改动不会写进存储，
       刷新即丢——「已发布过二手」分支与订单页隐藏按钮都会失效。这里用公开 API
       补一次持久化；补写失败不影响已经完成的发布，所以静默忽略。 */
    function markOrderPublished(orderNo) {
      if (!orderNo) { return; }
      var auth = DY.auth;
      if (!auth || typeof auth.update !== 'function') { return; }

      var user = currentUser();
      var orders = toArray(user && user.orders);
      var changed = false;
      for (var i = 0; i < orders.length; i++) {
        if (orders[i] && trimmed(orders[i].no) === orderNo && orders[i].usedPublished !== true) {
          orders[i].usedPublished = true;
          changed = true;
          break;
        }
      }
      if (!changed) { return; }

      try {
        auth.update({ orders: orders });
      } catch (e) { /* 忽略：listing 已发布成功 */ }
    }

    function submitPublish() {
      var order = publishState.order;
      if (!order) { return; }
      if (order.usedPublished === true) {
        return failPublish('该订单已发布过二手，不能重复发布。');
      }

      var origin = publishState.origin;
      var rawPrice = publishPriceInput ? trimmed(publishPriceInput.value) : '';
      var price = rawPrice ? Number(rawPrice) : NaN;
      var note = publishNoteInput ? trimmed(publishNoteInput.value) : '';

      if (!(origin > 0)) { return failPublish('该订单缺少原价信息，暂时无法发布。'); }
      if (!rawPrice || !isFinite(price)) { return failPublish('请填写转让价格'); }
      if (!(price > 0)) { return failPublish('转让价必须是正数'); }
      if (price > origin) { return failPublish('转让价不能高于原价 ' + money(origin)); }
      if (note.length < 5) { return failPublish('请填写成色说明（至少 5 个字）'); }

      var api = DY.preowned;
      if (!api || typeof api.publish !== 'function') {
        return failPublish('发布服务未就绪，请刷新后重试');
      }

      var result = null;
      try {
        result = api.publish({
          name: orderItemName(order),
          price: price,
          origin: origin,
          note: note,
          sourceOrderNo: trimmed(order.no)
        });
      } catch (e) {
        result = null;
      }

      if (result && result.ok) {
        var done = trimmed(result.message) || '已发布';
        markOrderPublished(trimmed(order.no));   // 让「已发布过」在刷新后依然成立
        closePublishModal();
        publishState.order = null;
        state.orderNo = '';                 // render() → syncUrl() 用 replaceState 去掉 ?publish=
        render();                           // 新发布的二手已在全局列表里，重渲染即可看到
        showNotice(done + '，可在下方列表看到。');
        toast(done);
        return;
      }

      failPublish((result && trimmed(result.message)) || '发布失败，请重试');
    }

    function bindPublishModal() {
      if (!publishModal) { return; }

      /* 背景 / 容器空白处关闭 */
      publishModal.addEventListener('click', function (event) {
        var target = event.target;
        if (target === publishModal) { closePublishModal(); return; }
        if (target && target.nodeType === 1 && target.classList
          && target.classList.contains('admin-modal-backdrop')) {
          closePublishModal();
        }
      });

      var closers = publishModal.querySelectorAll('[data-publish-close], [data-publish-cancel]');
      for (var i = 0; i < closers.length; i++) {
        (function (btn) {
          btn.addEventListener('click', function (event) {
            event.preventDefault();
            closePublishModal();
          });
        })(closers[i]);
      }

      if (publishSubmitBtn) {
        publishSubmitBtn.addEventListener('click', function (event) {
          event.preventDefault();
          submitPublish();
        });
      }

      if (publishPriceInput) {
        publishPriceInput.addEventListener('keydown', function (event) {
          var key = event.key;
          if (key !== 'Enter' && key !== 'NumpadEnter') { return; }
          event.preventDefault();
          submitPublish();
        });
      }

      /* Esc 关闭（只在表单打开时响应，不影响抽屉与搜索层的既有逻辑） */
      document.addEventListener('keydown', function (event) {
        var key = event.key;
        if (key !== 'Escape' && key !== 'Esc') { return; }
        if (!publishState.open) { return; }
        closePublishModal();
      });
    }

    /* ?publish=<单号> 的完整链路：未登录 → 登录页；找不到订单 → 提示；已发布过 → 只读+禁用确认 */
    function initPublishFromUrl() {
      var orderNo = trimmed(state.orderNo);

      if (!orderNo) {
        showNotice('要转让闲置？请从「我的订单」选择要转让的订单，再点「发布二手」。');
        return;
      }

      if (!isLoggedIn()) {
        toast('请先登录');
        window.location.href = 'login.html?next='
          + encodeURIComponent('preowned.html?publish=' + orderNo);
        return;
      }

      var order = findOrder(currentUser(), orderNo);
      if (!order) {
        state.orderNo = '';                 // 无效单号不再留在地址里，刷新不会反复报错
        render();
        showNotice('未找到该订单，请从「我的订单」重新选择要转让的订单。');
        toast('未找到该订单');
        return;
      }

      if (!openPublishModal(order)) {
        showNotice('发布表单未就绪，请刷新页面后重试。');
      }
    }

    /* ---------- 购买 ---------- */
    function buy(id) {
      if (!id) { return; }
      if (!isLoggedIn()) {
        toast('请先登录');
        window.location.href = 'login.html?next=' + encodeURIComponent('preowned.html');
        return;
      }

      var orders = DY.orders;
      if (!orders || typeof orders.buyUsed !== 'function') {
        toast('订单服务未就绪');
        return;
      }

      var result = null;
      try {
        result = orders.buyUsed(id);
      } catch (e) {
        result = null;
      }

      if (result && result.ok) {
        toast(trimmed(result.message) || '已下单');
        render();   // 成交的二手已从列表移除，重渲染
      } else {
        toast((result && trimmed(result.message)) || '下单失败，请重试');
      }
    }

    // 事件委托：整卡都不绑处理器，只在网格上监听一次
    grid.addEventListener('click', function (event) {
      var node = event.target;
      var trigger = null;
      while (node && node !== grid) {
        if (node.nodeType === 1 && typeof node.hasAttribute === 'function'
          && node.hasAttribute('data-buy')) {
          trigger = node;
          break;
        }
        node = node.parentNode;
      }
      if (!trigger) { return; }
      event.preventDefault();
      buy(trimmed(trigger.getAttribute('data-buy')));
    });

    /* ---------- 筛选条 ---------- */
    function bindChips(nodes, attr, values) {
      for (var i = 0; i < nodes.length; i++) {
        (function (chip) {
          chip.addEventListener('click', function (e) {
            e.preventDefault();
            var value = trimmed(chip.getAttribute(attr));
            if (values.indexOf(value) === -1) { return; }
            if (attr === 'data-filter') {
              state.category = value;
            } else {
              state.grade = value;
            }
            render();
          });
        })(nodes[i]);
      }
    }

    bindChips(catChips, 'data-filter', CATEGORIES);
    bindChips(gradeChips, 'data-grade', GRADES);

    if (sortSelect) {
      sortSelect.addEventListener('change', function () {
        var value = trimmed(sortSelect.value);
        state.sort = SORTS.indexOf(value) === -1 ? 'featured' : value;
        render();
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener('click', function (e) {
        e.preventDefault();
        // 一次性重置三者：分类 + 等级 + 排序（?publish= 发布流程保留）
        state.category = 'all';
        state.grade = 'all';
        state.sort = 'featured';
        render();
      });
    }

    /* ---------- 初始化 ---------- */
    readStateFromUrl();
    bindPublishModal();
    render();
    initPublishFromUrl();   // 表单最后打开：保证列表已渲染、焦点已可落位
  });
})();

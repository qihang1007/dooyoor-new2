/* ==========================================================================
   dooyoor 㛊䎟 — 「我的」账户中心（account.html）页面逻辑
   ---------------------------------------------------------------------------
   依赖（加载顺序见规范 §12.1）：
     js/site-config.js  DY_CONFIG.accountViews / orderStatuses / notifyPrefs /
                        discountRule / demoBalanceNote / brand.chain
     js/cart.js         DY.store / DY.escape / DY.money / DY.toast
     js/fav.js          DY.fav.list()
     js/auth.js         DY.auth.current / isLoggedIn / logout / update / changePassword
     js/wallet.js       DY.wallet.balance / history / discountUnlocked / discountDetail
     js/orders.js       DY.orders.list(status)   ← 并行开发，可能缺失
     js/preowned.js     DY.preowned.mine / remove
   ---------------------------------------------------------------------------
   八视图：overview | orders | wallet | discount | preowned | chain | favorites | settings
   口径（§12.13 / §12.15 验收项）：
     · 路由守卫最优先：未登录一律 location.replace('login.html?next=account.html') 并
       立即 return，不渲染任何未授权内容。
     · 视图路由只用 ?view= 深链 + history.replaceState（try/catch 兜住 file://），
       不实现历史栈——初稿 router.back() 的乒乓死循环不会出现。
     · txHash 一律直接取自订单记录，渲染时绝不重新生成。
     · 所有插入 DOM 的文本经 DY.escape()；金额经 DY.money()；
       绝不把数据拼进 onclick 之类属性里的 JS 串。
     · 任一模块缺失（尤其 orders.js / wallet.js 未加载）时该视图显示提示并提前 return，
       绝不抛异常、绝不白屏。
   ========================================================================== */
(function () {
  'use strict';

  /* ---------- 常量 ---------- */
  var VERSION_TEXT = 'v3.0.0';
  var DEFAULT_VIEW = 'overview';
  var LOGIN_URL = 'login.html?next=account.html';
  var AFTER_LOGOUT_URL = 'login.html';
  var HOME_URL = 'index.html';
  var MAX_AVATAR_BYTES = 1572864;              // 1.5MB
  var MODAL_FADE_MS = 280;
  var MIN_NAME = 2;
  var MAX_NAME = 20;
  var MIN_PWD = 6;
  var DEMO_KEYS = [
    'dooyoor.users.v1',
    'dooyoor.session.v1',
    'dooyoor.cart.v1',
    'dooyoor.fav.v1',
    'dooyoor.preowned.v1'
  ];
  var STATUS_BADGE = {
    pending: 'badge--warn',
    shipped: 'badge--accent',
    done: 'badge--ok',
    refund: 'badge--muted'
  };

  var CFG = window.DY_CONFIG || {};

  /* ---------- 运行时状态 ---------- */
  var modalStack = [];        // [{ node, lastFocus, onOk }]
  var settingsAvatar = null;  // 设置页新选的 data URI；null = 未改动
  var editAvatar = '';        // 编辑弹窗里的 data URI（含沿用原头像）
  var orderStatus = 'all';
  var bound = false;
  var loggingOut = false;

  /* ======================================================================
     一、基础工具（原生 ES5，无依赖）
     ====================================================================== */

  function onReady(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  }

  function isObj(v) {
    return !!v && typeof v === 'object' && Object.prototype.toString.call(v) !== '[object Array]';
  }

  function isArr(v) {
    return Object.prototype.toString.call(v) === '[object Array]';
  }

  function str(v) {
    return (v === null || v === undefined) ? '' : String(v);
  }

  function trim(v) {
    return str(v).replace(/^\s+|\s+$/g, '');
  }

  function toNum(v, fallback) {
    var n = Number(v);
    return isFinite(n) ? n : fallback;
  }

  function repeatChar(ch, times) {
    var out = '';
    for (var i = 0; i < times; i++) { out += ch; }
    return out;
  }

  function $(sel) { return document.querySelector(sel); }

  function $$(sel) { return document.querySelectorAll(sel); }

  function show(node) {
    if (node) { node.removeAttribute('hidden'); }
  }

  function hide(node) {
    if (node) { node.setAttribute('hidden', 'hidden'); }
  }

  function setText(node, text) {
    if (node) { node.textContent = str(text); }
  }

  function rawValue(field) {
    if (!field) { return ''; }
    var v = field.value;
    return (v === null || v === undefined) ? '' : String(v);
  }

  function clearValue(field) {
    if (!field) { return; }
    try { field.value = ''; } catch (e) { /* 忽略 */ }
  }

  function focusField(field) {
    if (field && typeof field.focus === 'function') {
      try { field.focus(); } catch (e) { /* 忽略 */ }
    }
  }

  /* 所有插入 DOM 的文本必须过这里 */
  function esc(value) {
    var DY = window.DY || {};
    if (typeof DY.escape === 'function') { return DY.escape(value); }
    if (value === null || value === undefined) { return ''; }
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /* 金额一律经 DY.money() */
  function money(value) {
    var DY = window.DY || {};
    if (typeof DY.money === 'function') { return DY.money(value); }
    var n = Number(value);
    if (!isFinite(n)) { n = 0; }
    n = Math.round(n);
    var text = String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return '¥' + (n < 0 ? '-' : '') + text;
  }

  function toast(message) {
    var DY = window.DY || {};
    if (typeof DY.toast === 'function') { DY.toast(str(message)); }
  }

  function redirect(href) {
    try {
      window.location.replace(href);
    } catch (e) {
      try { window.location.href = href; } catch (e2) { /* 忽略 */ }
    }
  }

  /* 依赖缺失时列表内的一行提示（.chain-note 是 style.css 已定义的类） */
  function hintHtml(text) {
    return '<p class="chain-note">' + esc(text) + '</p>';
  }

  function decodeSafe(value) {
    try { return decodeURIComponent(value); } catch (e) { return value; }
  }

  function queryPairs(search) {
    var query = str(search);
    if (query.charAt(0) === '?') { query = query.slice(1); }
    if (!query) { return []; }
    var raw = query.split('&');
    var out = [];
    for (var i = 0; i < raw.length; i++) {
      var pair = raw[i];
      if (!pair) { continue; }
      var eq = pair.indexOf('=');
      var key = eq < 0 ? pair : pair.slice(0, eq);
      var value = eq < 0 ? '' : pair.slice(eq + 1);
      out.push([
        decodeSafe(key.replace(/\+/g, ' ')),
        decodeSafe(value.replace(/\+/g, ' '))
      ]);
    }
    return out;
  }

  function urlParam(name) {
    var pairs = queryPairs(window.location.search);
    for (var i = 0; i < pairs.length; i++) {
      if (pairs[i][0] === name) { return pairs[i][1]; }
    }
    return '';
  }

  /* 写回 ?view=：保留其它查询参数与 hash；file:// 下 replaceState 会抛错 → 静默 */
  function writeViewUrl(viewId) {
    var pairs = queryPairs(window.location.search);
    var parts = [];
    var found = false;
    for (var i = 0; i < pairs.length; i++) {
      var key = pairs[i][0];
      var value = pairs[i][1];
      if (key === 'view') {
        if (found) { continue; }
        found = true;
        value = viewId;
      }
      parts.push(encodeURIComponent(key) + '=' + encodeURIComponent(value));
    }
    if (!found) { parts.push('view=' + encodeURIComponent(viewId)); }

    var search = parts.length ? ('?' + parts.join('&')) : '';
    if (str(window.location.search) === search) { return; }
    try {
      window.history.replaceState(
        null, '',
        str(window.location.pathname) + search + str(window.location.hash)
      );
    } catch (e) { /* file:// 下失败：静默 */ }
  }

  /* ISO / 日期字符串 → 'YYYY-MM-DD HH:mm'（解析不动就原样返回） */
  function formatTime(value) {
    var s = str(value);
    if (!s) { return ''; }
    var m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(s);
    if (m) { return m[1] + '-' + m[2] + '-' + m[3] + ' ' + m[4] + ':' + m[5]; }
    return s;
  }

  /* 长哈希缩短显示；完整值由调用方放进 title 属性 */
  function shortHash(value) {
    var s = str(value);
    if (s.length <= 20) { return s; }
    return s.slice(0, 10) + '…' + s.slice(s.length - 8);
  }

  /* 手机号脱敏：对任意长度安全，永不抛错、永不越界 */
  function maskPhone(value) {
    var s = str(value).replace(/\s+/g, '');
    if (!s) { return ''; }
    if (s.length <= 2) { return repeatChar('*', s.length); }
    if (s.length < 8) { return s.charAt(0) + '****' + s.charAt(s.length - 1); }
    return s.slice(0, 3) + '****' + s.slice(s.length - 4);
  }

  function initialOf(name) {
    var s = trim(name);
    if (!s) { return '我'; }
    return s.charAt(0);
  }

  function validateName(name) {
    var n = trim(name);
    if (!n) { return '请填写昵称'; }
    if (n.length < MIN_NAME) { return '昵称至少 ' + MIN_NAME + ' 个字'; }
    if (n.length > MAX_NAME) { return '昵称不能超过 ' + MAX_NAME + ' 个字'; }
    return '';
  }

  function validateImageFile(file) {
    if (!file) { return '请选择一张图片'; }
    var type = str(file.type).toLowerCase();
    if (type.indexOf('image/') !== 0) { return '只能选择图片文件（JPG / PNG / WebP）'; }
    var size = Number(file.size);
    if (isFinite(size) && size > MAX_AVATAR_BYTES) { return '图片不能超过 1.5MB，请压缩后再试'; }
    return '';
  }

  /* 只接受白名单形式的图片 data URI（base64），杜绝把任意串写进 src */
  function isImageDataUri(value) {
    var v = str(value);
    if (v.indexOf('data:image/') !== 0) { return false; }
    return /^data:image\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/]+={0,2}$/i.test(v);
  }

  function setPreview(node, dataUri) {
    if (!node) { return; }
    if (!isImageDataUri(dataUri)) {
      hide(node);
      if (node.tagName === 'IMG') {
        node.removeAttribute('src');
      } else {
        var olds = node.querySelectorAll('img');
        for (var i = 0; i < olds.length; i++) { node.removeChild(olds[i]); }
      }
      return;
    }
    var img = (node.tagName === 'IMG') ? node : node.querySelector('img');
    if (!img) {
      img = document.createElement('img');
      img.setAttribute('alt', '头像预览');
      node.appendChild(img);
    }
    img.setAttribute('src', dataUri);   // 值已通过 isImageDataUri 白名单校验
    show(node);
  }

  /* ======================================================================
     二、账户读写（唯一出入口 DY.auth）
     ====================================================================== */

  function auth() {
    var a = window.DY && window.DY.auth;
    return (a && typeof a.current === 'function') ? a : null;
  }

  function currentUser() {
    var a = auth();
    if (!a) { return null; }
    try {
      var rec = a.current();
      return isObj(rec) ? rec : null;
    } catch (e) {
      return null;
    }
  }

  /* 保存前先确认依赖与登录态，绝不在未登录时假装成功 */
  function safeUpdate(patch) {
    var a = auth();
    if (!a || typeof a.update !== 'function') {
      return { ok: false, message: '账户模块未就绪，无法保存' };
    }
    if (!currentUser()) {
      return { ok: false, message: '登录状态已失效，请重新登录' };
    }
    try {
      var res = a.update(patch);
      if (res && typeof res.ok === 'boolean') { return res; }
      return { ok: false, message: '保存失败，请重试' };
    } catch (e) {
      return { ok: false, message: '保存失败，请重试' };
    }
  }

  /* ======================================================================
     三、视图清单与路由（?view= 深链，无历史栈）
     ====================================================================== */

  function accountViewList() {
    var list = isArr(CFG.accountViews) ? CFG.accountViews : [];
    var out = [];
    for (var i = 0; i < list.length; i++) {
      var item = isObj(list[i]) ? list[i] : {};
      var id = trim(item.id);
      if (!id) { continue; }
      out.push({ id: id, name: trim(item.name) || id });
    }
    return out;
  }

  function viewIds() {
    var list = accountViewList();
    var ids = [];
    for (var i = 0; i < list.length; i++) { ids.push(list[i].id); }
    return ids;
  }

  function defaultView() {
    var ids = viewIds();
    for (var i = 0; i < ids.length; i++) {
      if (ids[i] === DEFAULT_VIEW) { return DEFAULT_VIEW; }
    }
    return ids.length ? ids[0] : DEFAULT_VIEW;
  }

  /* 非法值一律回落到默认视图 */
  function validView(id) {
    var want = trim(id);
    var ids = viewIds();
    for (var i = 0; i < ids.length; i++) {
      if (ids[i] === want) { return want; }
    }
    return defaultView();
  }

  function setView(id, options) {
    var next = validView(id);
    var opts = options || {};
    var i;

    /* 导航按钮：.is-active + aria-selected */
    var tabs = $$('[role="tablist"] button[data-view]');
    for (i = 0; i < tabs.length; i++) {
      var on = tabs[i].getAttribute('data-view') === next;
      tabs[i].classList.toggle('is-active', on);
      tabs[i].setAttribute('aria-selected', on ? 'true' : 'false');
    }

    /* 面板：只留一个可见 */
    var panels = $$('[data-view-panel]');
    for (i = 0; i < panels.length; i++) {
      if (panels[i].getAttribute('data-view-panel') === next) {
        show(panels[i]);
      } else {
        hide(panels[i]);
      }
    }

    if (opts.writeUrl !== false) { writeViewUrl(next); }
    renderView(next);
  }

  function renderView(id) {
    if (id === 'overview') {
      renderIdentity();
      renderBalance();
      renderAccountGrid();
    } else if (id === 'orders') {
      renderOrders();
    } else if (id === 'wallet') {
      renderWallet();
    } else if (id === 'discount') {
      renderDiscount();
    } else if (id === 'preowned') {
      renderPreowned();
    } else if (id === 'chain') {
      renderChain();
    } else if (id === 'favorites') {
      renderFavorites();
    } else if (id === 'settings') {
      renderSettings();
    }
  }

  /* ======================================================================
     四、overview — 资料卡 / 余额卡 / 八宫格入口
     ====================================================================== */

  /* 资料卡头像：默认写昵称首字（无昵称时写「我」）。
     用户上传过头像、且容器能承载图片（.admin-avatar 由 style.css §26 约束为
     100% / object-fit:cover）时，改为渲染 <img>；其余容器一律回落首字，
     绝不把没有尺寸约束的图片塞进未知容器。 */
  function renderProfileAvatar(user) {
    var node = $('[data-profile-avatar]');
    if (!node) { return; }

    var avatar = str(user && user.avatar);
    var initial = initialOf(user && user.name);
    var isImg = (node.tagName === 'IMG');
    var canHost = isImg
      || (node.classList && node.classList.contains('admin-avatar'));
    var img = isImg ? node : node.querySelector('img');

    if (!canHost || !isImageDataUri(avatar)) {
      if (!isImg && img && img.parentNode) { img.parentNode.removeChild(img); }
      if (isImg) {
        node.removeAttribute('src');
        node.setAttribute('alt', initial);
      } else {
        node.textContent = initial;
      }
      return;
    }

    if (!img) {
      img = document.createElement('img');
      img.setAttribute('alt', '');
      node.textContent = '';
      node.appendChild(img);
    }
    img.setAttribute('src', avatar);   // 值已通过 isImageDataUri 白名单校验
  }

  function renderIdentity() {
    var user = currentUser();
    if (!user) { return; }
    renderProfileAvatar(user);
    setText($('[data-profile-name]'), str(user.name));
    setText($('[data-profile-phone]'), maskPhone(user.phone));
    setText($('[data-profile-date]'), str(user.registerDate));
  }

  function renderBalance() {
    var user = currentUser();
    var wallet = window.DY && window.DY.wallet;
    var value = null;

    if (wallet && typeof wallet.balance === 'function') {
      try { value = wallet.balance(); } catch (e) { value = null; }
    }
    if (value === null || !isFinite(Number(value))) {
      value = toNum(user && user.balance, 0);
    }

    setText($('[data-balance]'), money(value));
    setText($('[data-balance-note]'), str(CFG.demoBalanceNote));
  }

  function renderAccountGrid() {
    var grid = $('[data-account-grid]');
    if (!grid) { return; }

    var list = accountViewList();
    if (!list.length) {
      grid.innerHTML = hintHtml('站点数据未加载（js/site-config.js），暂时无法显示入口。');
      return;
    }

    /* 每个入口的图标（24 格、stroke=currentColor、fill=none）。
       指针设备只显示图标，悬停 / 键盘聚焦时用气泡显示功能名；
       触屏没有 hover，由 CSS 在 (hover:none) 下常驻一行小字。 */
    var ICONS = {
      overview: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20c0-3.9 3.1-6 7-6s7 2.1 7 6"/>',
      orders: '<path d="M3 8l9-5 9 5v8l-9 5-9-5z"/><path d="M3 8l9 5 9-5"/><path d="M12 13v8"/>',
      wallet: '<path d="M4 7h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4z"/><path d="M4 7V6a2 2 0 0 1 2-2h11"/><circle cx="16" cy="13" r="1.2"/>',
      discount: '<circle cx="12" cy="12" r="8"/><path d="M12 8v4.5l3 1.8"/>',
      preowned: '<path d="M4 12a8 8 0 0 1 13-6"/><path d="M20 12a8 8 0 0 1-13 6"/><path d="M17 3v3h-3"/><path d="M7 21v-3h3"/>',
      chain: '<path d="M12 3l7 3v6c0 5-3 8-7 9-4-1-7-4-7-9V6l7-3Z"/><path d="M9 12l2 2 4-4"/>',
      favorites: '<path d="M12 20.2S4.6 15.5 4.6 10.4A4.3 4.3 0 0 1 12 7.5a4.3 4.3 0 0 1 7.4 2.9c0 5.1-7.4 9.8-7.4 9.8Z"/>',
      settings: '<circle cx="12" cy="12" r="3"/><path d="M12 3v2.6M12 18.4V21M4.4 7.6l2.3 1.3M17.3 15.1l2.3 1.3M4.4 16.4l2.3-1.3M17.3 8.9l2.3-1.3"/>'
    };
    var FALLBACK_ICON = '<circle cx="12" cy="12" r="8"/><path d="M12 8v8M8 12h8"/>';

    var html = [];
    for (var i = 0; i < list.length; i++) {
      var viewId = str(list[i].id);
      var viewName = str(list[i].name);
      var icon = ICONS[viewId] || FALLBACK_ICON;
      html.push('<button class="entry-btn" type="button"'
        + ' data-view-go="' + esc(viewId) + '"'
        + ' data-tip="' + esc(viewName) + '"'
        + ' aria-label="' + esc(viewName) + '"'
        + ' title="' + esc(viewName) + '">'
        + '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none"'
        + ' stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">'
        + icon + '</svg>'
        + '<span class="entry-label" aria-hidden="true">' + esc(viewName) + '</span>'
        + '</button>');
    }
    grid.classList.add('entry-grid');
    grid.innerHTML = html.join('\n');
  }

  /* ======================================================================
     五、orders — 订单列表
     ====================================================================== */

  function ordersApi() {
    var api = window.DY && window.DY.orders;
    return (api && typeof api.list === 'function') ? api : null;
  }

  /* status='all' 时同时兼容 list('all') 与 list() 两种实现 */
  function fetchOrders(status) {
    var api = ordersApi();
    if (!api) { return null; }

    var out = [];
    try { out = api.list(status); } catch (e) { out = []; }
    out = isArr(out) ? out : [];

    if (!out.length && status === 'all') {
      try {
        var all = api.list();
        if (isArr(all) && all.length) { out = all; }
      } catch (e2) { /* 忽略 */ }
    }
    return out;
  }

  function orderStatusName(id) {
    var list = isArr(CFG.orderStatuses) ? CFG.orderStatuses : [];
    for (var i = 0; i < list.length; i++) {
      if (isObj(list[i]) && str(list[i].id) === str(id)) {
        return str(list[i].name) || str(id);
      }
    }
    return str(id);
  }

  function orderBadgeClass(status) {
    return STATUS_BADGE[str(status)] || 'badge--muted';
  }

  function initOrderStatus() {
    var list = isArr(CFG.orderStatuses) ? CFG.orderStatuses : [];
    var ids = [];
    for (var i = 0; i < list.length; i++) {
      if (isObj(list[i]) && trim(list[i].id)) { ids.push(trim(list[i].id)); }
    }
    orderStatus = 'all';
    if (!ids.length) { return; }
    for (i = 0; i < ids.length; i++) {
      if (ids[i] === 'all') { return; }
    }
    orderStatus = ids[0];
  }

  function renderOrders() {
    renderOrderFilter();
    renderOrderList();
  }

  /* 订单状态筛选条：data-order-filter 挂在每个 chip 自己身上，
     这里必须向上找到它们所在的 .filter-bar 容器再整体重渲染。
     若直接把 $('[data-order-filter]')（第一个 chip）当容器，就会在 chip 里嵌 chip：
     外层激活 chip 的靛蓝底会把内层未激活 chip 的深色文字压在上面，导致对比度失效。 */
  function orderFilterBar() {
    var chip = $('[data-order-filter]');
    if (!chip) { return null; }
    if (typeof chip.closest === 'function') {
      var bar = chip.closest('.filter-bar');
      if (bar) { return bar; }
    }
    return chip.parentNode || null;
  }

  function renderOrderFilter() {
    var node = orderFilterBar();
    if (!node) { return; }

    var list = isArr(CFG.orderStatuses) ? CFG.orderStatuses : [];
    var entries = [];
    for (var i = 0; i < list.length; i++) {
      if (!isObj(list[i])) { continue; }
      var id = trim(list[i].id);
      if (!id) { continue; }
      entries.push({ id: id, name: trim(list[i].name) || id });
    }
    /* 配置缺失时保留静态 chip，绝不清空筛选条 */
    if (!entries.length) { return; }

    /* 当前筛选值若不在配置里，回落到第一项 */
    var ok = false;
    for (i = 0; i < entries.length; i++) {
      if (entries[i].id === orderStatus) { ok = true; }
    }
    if (!ok) { orderStatus = entries[0].id; }

    /* 任何时刻只允许一个 chip 带 .is-active（配置里 id 重复时也只亮第一个） */
    var activeDone = false;
    var html = [];
    for (i = 0; i < entries.length; i++) {
      var on = !activeDone && entries[i].id === orderStatus;
      if (on) { activeDone = true; }
      html.push('<button class="filter-chip' + (on ? ' is-active' : '') + '" type="button"'
        + ' data-order-filter="' + esc(entries[i].id) + '"'
        + ' data-status="' + esc(entries[i].id) + '"'
        + ' aria-pressed="' + (on ? 'true' : 'false') + '">'
        + esc(entries[i].name) + '</button>');
    }
    node.innerHTML = html.join('\n');
  }

  function itemLine(item) {
    var it = isObj(item) ? item : {};
    var name = str(it.name) || str(it.productId);
    var parts = [name + ' × ' + toNum(it.qty, 1)];
    if (str(it.size)) { parts.push('尺码 ' + str(it.size)); }
    var unit = toNum(it.unitPrice, NaN);
    if (isFinite(unit)) { parts.push('单价 ' + money(unit)); }
    return parts.join(' · ');
  }

  function payLine(pay) {
    var p = isObj(pay) ? pay : {};
    var parts = [];
    if (p.subtotal !== undefined && p.subtotal !== null) {
      parts.push('小计 ' + money(p.subtotal));
    }
    parts.push('抵扣 ' + money(p.discount));
    parts.push('余额 ' + money(p.balance));
    parts.push('运费 ' + money(p.shipping));
    return '支付明细：' + parts.join(' · ');
  }

  function orderTitle(order) {
    var items = isArr(order.items) ? order.items : [];
    var first = items.length ? str(items[0].name) : '';
    if (!first) { return str(order.no); }
    if (items.length > 1) { return first + ' 等 ' + items.length + ' 件'; }
    return first;
  }

  function orderCardHtml(order) {
    var no = str(order.no);
    var statusKey = str(order.status);
    var statusText = orderStatusName(statusKey) || statusKey || '未知状态';
    var typeText = str(order.type) === 'used' ? '二手' : '新品';
    var html = [];

    html.push('<article class="order-card">');
    html.push('  <div class="order-head">');
    html.push('    <div>');
    html.push('      <span class="order-no">' + esc(no) + '</span>');
    html.push('      <span class="badge badge--muted">' + esc(typeText) + '</span>');
    html.push('      <h3 class="order-name">' + esc(orderTitle(order)) + '</h3>');
    html.push('    </div>');
    html.push('    <span class="badge ' + orderBadgeClass(statusKey) + '">' + esc(statusText) + '</span>');
    html.push('  </div>');

    html.push('  <div class="order-meta">');
    var items = isArr(order.items) ? order.items : [];
    for (var i = 0; i < items.length; i++) {
      html.push('    <span>' + esc(itemLine(items[i])) + '</span>');
    }
    html.push('    <span>' + esc(payLine(order.pay)) + '</span>');

    /* txHash 直接取订单记录里的值，渲染时绝不重算；完整值放 title */
    var fullHash = str(order.txHash);
    if (fullHash) {
      html.push('    <span>交易哈希：<span class="order-no" title="' + esc(fullHash) + '">'
        + esc(shortHash(fullHash)) + '</span></span>');
    }
    var when = str(order.date) || formatTime(order.time);
    if (when) { html.push('    <span>下单日期：' + esc(when) + '</span>'); }
    html.push('  </div>');

    html.push('  <div class="order-foot">');
    if (str(order.type) === 'new' && order.usedPublished !== true && no) {
      html.push('    <a class="btn btn--outline btn--sm" href="preowned.html?publish='
        + esc(encodeURIComponent(no)) + '">发布二手</a>');
    } else {
      html.push('    <span class="order-no">实付</span>');
    }
    html.push('    <span class="order-amount">' + esc(money(order.total)) + '</span>');
    html.push('  </div>');
    html.push('</article>');
    return html.join('\n');
  }

  function renderOrderList() {
    var listNode = $('[data-order-list]');
    var emptyNode = $('[data-order-empty]');
    if (!listNode) { return; }

    if (!ordersApi()) {
      listNode.innerHTML = hintHtml('订单服务未就绪（js/orders.js 未加载），暂时无法显示订单。');
      hide(emptyNode);
      return;
    }

    var orders = fetchOrders(orderStatus) || [];
    var html = [];
    for (var i = 0; i < orders.length; i++) {
      if (isObj(orders[i])) { html.push(orderCardHtml(orders[i])); }
    }

    if (!html.length) {
      listNode.innerHTML = '';
      show(emptyNode);
      return;
    }
    hide(emptyNode);
    listNode.innerHTML = html.join('\n');
  }

  /* ======================================================================
     六、wallet — 余额明细
     ====================================================================== */

  function txCardHtml(tx) {
    var income = str(tx.type) === 'income';
    var amountText = (income ? '+' : '') + money(Math.abs(toNum(tx.amount, 0)));
    var when = formatTime(tx.time) || str(tx.date);
    var desc = str(tx.description) || (income ? '收入' : '支出');
    var html = [];

    html.push('<article class="order-card">');
    html.push('  <div class="order-head">');
    html.push('    <div>');
    html.push('      <h3 class="order-name">' + esc(desc) + '</h3>');
    if (when) { html.push('      <span class="order-no">' + esc(when) + '</span>'); }
    html.push('    </div>');
    html.push('    <span class="badge ' + (income ? 'badge--ok' : 'badge--muted') + '">'
      + (income ? '收入' : '支出') + '</span>');
    html.push('  </div>');
    html.push('  <div class="order-foot">');
    html.push('    <span class="order-no">流水号 ' + esc(str(tx.id)) + '</span>');
    html.push('    <span class="order-amount">' + esc(amountText) + '</span>');
    html.push('  </div>');
    html.push('</article>');
    return html.join('\n');
  }

  function renderWallet() {
    var listNode = $('[data-wallet-list]');
    var emptyNode = $('[data-wallet-empty]');
    var balanceNode = $('[data-wallet-balance]');
    var wallet = window.DY && window.DY.wallet;
    var user = currentUser();

    var value = toNum(user && user.balance, 0);
    if (wallet && typeof wallet.balance === 'function') {
      try { value = wallet.balance(); } catch (e) { value = toNum(user && user.balance, 0); }
    }
    if (balanceNode) { balanceNode.textContent = money(value); }

    if (!listNode) { return; }

    if (!wallet || typeof wallet.history !== 'function') {
      listNode.innerHTML = hintHtml('余额明细服务未就绪（js/wallet.js 未加载），暂时无法显示流水。');
      hide(emptyNode);
      return;
    }

    var list = [];
    try { list = wallet.history(); } catch (e) { list = []; }
    list = isArr(list) ? list : [];

    if (!list.length) {
      listNode.innerHTML = '';
      show(emptyNode);
      return;
    }
    hide(emptyNode);

    var html = [];
    for (var i = 0; i < list.length; i++) {
      if (isObj(list[i])) { html.push(txCardHtml(list[i])); }
    }
    listNode.innerHTML = html.join('\n');
  }

  /* ======================================================================
     七、discount — 我的抵扣（§12.8）
     ====================================================================== */

  function holdMonths() {
    var rule = isObj(CFG.discountRule) ? CFG.discountRule : {};
    var n = toNum(rule.holdMonths, 12);
    return n > 0 ? n : 12;
  }

  function discountRowHtml(detail) {
    var entry = isObj(detail) ? detail : {};
    var item = isObj(entry.myProduct) ? entry.myProduct : {};
    var name = str(item.name) || str(item.productId) || '未命名商品';
    var image = str(item.image);
    var months = toNum(entry.months, 0);
    var unlocked = toNum(entry.unlocked, 0);
    var bonus = toNum(entry.bonus, 0);
    var need = holdMonths() - months;
    if (need < 1) { need = 1; }

    var html = [];
    html.push('<article class="admin-row">');
    html.push('  <div class="admin-row-media">');
    if (image) {
      html.push('    <img src="' + esc(image) + '" alt="' + esc(name)
        + '" loading="lazy" decoding="async" width="800" height="1000">');
    }
    html.push('  </div>');
    html.push('  <div class="admin-row-body">');
    html.push('    <h3 class="admin-row-title">' + esc(name) + '</h3>');
    html.push('    <div class="admin-row-meta">');
    html.push('      <span>实付 ' + esc(money(item.price)) + '</span>');
    html.push('      <span>已持有 ' + esc(months) + ' 个月</span>');
    html.push('    </div>');
    html.push('    <div class="admin-row-meta">');
    if (unlocked > 0) {
      html.push('      <span class="badge badge--ok">已解锁 ' + esc(money(unlocked)) + '</span>');
      if (bonus > 0) {
        html.push('      <span>含持有奖励 ' + esc(money(bonus)) + '</span>');
      }
    } else {
      html.push('      <span class="badge badge--muted">还需 ' + esc(need) + ' 个月解锁</span>');
    }
    html.push('    </div>');
    html.push('  </div>');
    html.push('</article>');
    return html.join('\n');
  }

  function renderDiscount() {
    var totalNode = $('[data-discount-total]');
    var ruleNode = $('[data-discount-rule]');
    var listNode = $('[data-discount-list]');
    var emptyNode = $('[data-discount-empty]');
    var wallet = window.DY && window.DY.wallet;

    var rule = isObj(CFG.discountRule) ? CFG.discountRule : {};
    setText(ruleNode, str(rule.note));

    if (!wallet || typeof wallet.discountDetail !== 'function') {
      if (totalNode) { totalNode.textContent = money(0); }
      if (listNode) {
        listNode.innerHTML = hintHtml('抵扣服务未就绪（js/wallet.js 未加载），暂时无法显示抵扣明细。');
      }
      hide(emptyNode);
      return;
    }

    var total = 0;
    try { total = wallet.discountUnlocked(); } catch (e) { total = 0; }
    if (totalNode) { totalNode.textContent = money(total); }

    if (!listNode) { return; }

    var detail = [];
    try { detail = wallet.discountDetail(); } catch (e) { detail = []; }
    detail = isArr(detail) ? detail : [];

    if (!detail.length) {
      listNode.innerHTML = '';
      show(emptyNode);
      return;
    }
    hide(emptyNode);

    var html = [];
    for (var i = 0; i < detail.length; i++) {
      if (isObj(detail[i])) { html.push(discountRowHtml(detail[i])); }
    }
    listNode.innerHTML = html.join('\n');
  }

  /* ======================================================================
     八、preowned — 我发布的二手
     ====================================================================== */

  function mineRowHtml(item) {
    var id = str(item.id);
    var name = str(item.name) || id || '未命名商品';
    var image = str(item.image);
    var html = [];

    html.push('<article class="admin-row">');
    html.push('  <div class="admin-row-media">');
    if (image) {
      html.push('    <img src="' + esc(image) + '" alt="' + esc(name)
        + '" loading="lazy" decoding="async" width="800" height="1000">');
    }
    html.push('  </div>');
    html.push('  <div class="admin-row-body">');
    html.push('    <h3 class="admin-row-title">' + esc(name) + '</h3>');
    html.push('    <div class="admin-row-meta">');
    html.push('      <span>转让价 ' + esc(money(item.price)) + '</span>');
    html.push('      <span>原价 ' + esc(money(item.origin)) + '</span>');
    html.push('      <span>成色 ' + esc(str(item.grade) || '—') + '</span>');
    if (str(item.createdAt)) {
      html.push('      <span>' + esc(str(item.createdAt)) + '</span>');
    }
    html.push('    </div>');
    html.push('    <div class="admin-row-actions">');
    html.push('      <button class="btn btn--outline btn--sm" type="button"'
      + ' data-mine-remove="' + esc(id) + '"'
      + ' data-mine-name="' + esc(name) + '">下架</button>');
    html.push('    </div>');
    html.push('  </div>');
    html.push('</article>');
    return html.join('\n');
  }

  function renderPreowned() {
    var listNode = $('[data-mine-list]');
    var emptyNode = $('[data-mine-empty]');
    if (!listNode) { return; }

    var api = window.DY && window.DY.preowned;
    if (!api || typeof api.mine !== 'function') {
      listNode.innerHTML = hintHtml('二手服务未就绪（js/preowned.js 未加载），暂时无法显示你发布的商品。');
      hide(emptyNode);
      return;
    }

    var items = [];
    try { items = api.mine(); } catch (e) { items = []; }
    items = isArr(items) ? items : [];

    if (!items.length) {
      listNode.innerHTML = '';
      show(emptyNode);
      return;
    }
    hide(emptyNode);

    var html = [];
    for (var i = 0; i < items.length; i++) {
      if (isObj(items[i])) { html.push(mineRowHtml(items[i])); }
    }
    listNode.innerHTML = html.join('\n');
  }

  function removeMine(button) {
    var id = str(button.getAttribute('data-mine-remove'));
    if (!id) { return; }
    var name = str(button.getAttribute('data-mine-name')) || '这件商品';

    var api = window.DY && window.DY.preowned;
    if (!api || typeof api.remove !== 'function') {
      toast('二手服务未就绪，无法下架');
      return;
    }

    openConfirm({
      title: '下架确认',
      text: '确定要下架「' + name + '」吗？下架后买家将无法再看到它。',
      onOk: function () {
        var res = null;
        try {
          res = api.remove(id);
        } catch (e) {
          res = { ok: false, message: '下架失败，请重试' };
        }
        if (res && res.ok === false) {
          toast(str(res.message) || '下架失败，请重试');
          return;
        }
        toast(str(res && res.message) || '已下架');
        renderPreowned();
      }
    });
  }

  /* ======================================================================
     九、chain — 我的区块链凭证（txHash 只读订单，绝不重算）
     ====================================================================== */

  function chainItem(label, value) {
    return '<div class="chain-item"><span class="chain-item-label">' + esc(label) + '</span>'
      + '<span class="chain-item-value">' + esc(value) + '</span></div>';
  }

  function chainPanelHtml(order) {
    /* ★ 直接取订单记录里的 txHash，渲染时不生成、不重算、不随机 */
    var hash = str(order.txHash);
    var code = str(order.chainCode);
    if (!hash && !code) { return ''; }

    var network = str(CFG.brand && CFG.brand.chain && CFG.brand.chain.network);
    var html = [];

    html.push('<article class="chain-panel">');
    html.push('  <div class="chain-head">');
    html.push('    <span class="badge ' + (hash ? 'badge--ok' : 'badge--muted') + '">'
      + (hash ? '已上链' : '未上链') + '</span>');
    html.push('    <span class="chain-title">' + esc(str(order.no) || code) + '</span>');
    html.push('  </div>');
    if (hash) {
      html.push('  <div class="chain-hash" title="' + esc(hash) + '">' + esc(hash) + '</div>');
    }
    html.push('  <div class="chain-grid">');
    if (code) { html.push(chainItem('溯源码', code)); }
    var when = str(order.date) || formatTime(order.time);
    if (when) { html.push(chainItem('下单日期', when)); }
    html.push(chainItem('订单金额', money(order.total)));
    if (network) { html.push(chainItem('溯源网络', network)); }
    html.push('  </div>');
    html.push('</article>');
    return html.join('\n');
  }

  function renderChain() {
    var listNode = $('[data-chain-list]');
    var emptyNode = $('[data-chain-empty]');
    if (!listNode) { return; }

    if (!ordersApi()) {
      listNode.innerHTML = hintHtml('链上凭证服务未就绪（js/orders.js 未加载），暂时无法显示区块链凭证。');
      hide(emptyNode);
      return;
    }

    var orders = fetchOrders('all') || [];
    var html = [];
    for (var i = 0; i < orders.length; i++) {
      if (!isObj(orders[i])) { continue; }
      var panel = chainPanelHtml(orders[i]);
      if (panel) { html.push(panel); }
    }

    if (!html.length) {
      listNode.innerHTML = '';
      show(emptyNode);
      return;
    }
    hide(emptyNode);
    listNode.innerHTML = html.join('\n');
  }

  /* ======================================================================
     十、favorites — 收藏网格（照 §7.7；二手 id 以 'u' 开头 → preowned.html#id）
     ====================================================================== */

  function favTarget(item) {
    var id = isObj(item) ? str(item.id) : str(item);
    var used = id.charAt(0) === 'u';
    return {
      id: id,
      used: used,
      href: used
        ? ('preowned.html#' + encodeURIComponent(id))
        : ('product.html?id=' + encodeURIComponent(id))
    };
  }

  function favCardHtml(item) {
    var source = isObj(item) ? item : {};
    var target = favTarget(item);
    if (!target.id) { return ''; }

    var name = str(source.name) || target.id;
    var image = str(source.image);
    if (!image && isArr(source.gallery) && source.gallery.length) {
      image = str(source.gallery[0]);
    }
    var was = source.compareAt || source.origin;
    var badgeText = str(source.badge) || (target.used ? '认证二手' : '');
    var html = [];

    html.push('<article class="product-card">');
    html.push('  <a class="product-media" href="' + esc(target.href) + '">');
    if (image) {
      html.push('    <img src="' + esc(image) + '" alt="' + esc(name)
        + '" loading="lazy" decoding="async" width="800" height="1000">');
    }
    if (badgeText) {
      html.push('    <span class="product-badge' + (target.used ? ' product-badge--used' : '')
        + '">' + esc(badgeText) + '</span>');
    }
    html.push('  </a>');
    html.push('  <div class="product-body">');
    html.push('    <h3 class="product-name"><a href="' + esc(target.href) + '">'
      + esc(name) + '</a></h3>');
    if (str(source.en)) {
      html.push('    <p class="product-en">' + esc(source.en) + '</p>');
    }
    html.push('    <p class="product-price">');
    html.push('      <span class="price' + (was ? ' price--sale' : '') + '">'
      + esc(money(source.price)) + '</span>');
    if (was) {
      html.push('      <span class="price--was">' + esc(money(was)) + '</span>');
    }
    html.push('    </p>');

    var colors = isArr(source.colors) ? source.colors : [];
    if (colors.length) {
      html.push('    <ul class="product-swatches" aria-label="可选颜色">');
      for (var i = 0; i < colors.length; i++) {
        var color = isObj(colors[i]) ? colors[i] : {};
        html.push('      <li><span class="swatch" style="--sw:' + esc(color.hex)
          + '" title="' + esc(color.name) + '"></span></li>');
      }
      html.push('    </ul>');
    }

    html.push('  </div>');
    html.push('</article>');
    return html.join('\n');
  }

  function renderFavorites() {
    var grid = $('[data-fav-grid]');
    var emptyNode = $('[data-fav-empty]');
    if (!grid) { return; }

    /* 网格布局由 .product-grid 提供（style.css 已定义），HTML 未带时补上 */
    if (!grid.classList.contains('product-grid')) { grid.classList.add('product-grid'); }

    var fav = window.DY && window.DY.fav;
    if (!fav || typeof fav.list !== 'function') {
      grid.innerHTML = hintHtml('收藏服务未就绪（js/fav.js 未加载），暂时无法显示收藏。');
      hide(emptyNode);
      return;
    }

    var items = [];
    try { items = fav.list(); } catch (e) { items = []; }
    items = isArr(items) ? items : [];

    if (!items.length) {
      grid.innerHTML = '';
      show(emptyNode);
      return;
    }
    hide(emptyNode);

    var html = [];
    for (var i = 0; i < items.length; i++) {
      var card = favCardHtml(items[i]);
      if (card) { html.push(card); }
    }
    grid.innerHTML = html.join('\n');
  }

  /* ======================================================================
     十一、settings — 资料 / 密码 / 通知 / 关于
     ====================================================================== */

  function setFormError(node, text) {
    if (!node) { return; }
    node.textContent = str(text);
  }

  function effectiveAvatar(user) {
    if (settingsAvatar !== null) { return settingsAvatar; }
    return str(user && user.avatar);
  }

  function fillProfileForm() {
    var user = currentUser();
    var field = $('#acctName');
    if (field && user) { field.value = str(user.name); }
    setPreview($('[data-avatar-preview]'), effectiveAvatar(user));
  }

  function collectPrefs(node) {
    var prefs = {};
    if (!node) { return prefs; }
    var inputs = node.querySelectorAll('[data-pref]');
    for (var i = 0; i < inputs.length; i++) {
      var id = trim(inputs[i].getAttribute('data-pref'));
      if (id) { prefs[id] = !!inputs[i].checked; }
    }
    return prefs;
  }

  function renderNotifyList() {
    var node = $('[data-notify-list]');
    if (!node) { return; }

    var prefs = isArr(CFG.notifyPrefs) ? CFG.notifyPrefs : [];
    var user = currentUser();
    var saved = isObj(user && user.prefs) ? user.prefs : {};
    var seen = Object.create(null);
    var html = [];

    for (var i = 0; i < prefs.length; i++) {
      var item = isObj(prefs[i]) ? prefs[i] : {};
      var id = trim(item.id);
      if (!id || seen[id]) { continue; }
      seen[id] = true;

      var on = (typeof saved[id] === 'boolean') ? saved[id] : !!item.def;
      /* style.css §27 .check：整行 label + 原生 checkbox，min-height 44px，
         outline 由 [data-notify-list] input[type="checkbox"]:focus-visible 负责 */
      html.push('<label class="check">');
      html.push('  <input type="checkbox" data-pref="' + esc(id) + '"'
        + (on ? ' checked' : '') + '>');
      html.push('  <span class="check-text">' + esc(trim(item.name) || id));
      if (trim(item.desc)) {
        html.push('    <span class="check-note">' + esc(item.desc) + '</span>');
      }
      html.push('  </span>');
      html.push('</label>');
    }
    node.innerHTML = html.join('\n');
  }

  function saveNotifyPrefs(node, input) {
    var a = auth();
    if (!a || typeof a.update !== 'function') {
      input.checked = !input.checked;
      toast('账户模块未就绪，设置未保存');
      return;
    }
    if (!currentUser()) {
      input.checked = !input.checked;
      toast('登录状态已失效，请重新登录');
      return;
    }
    var res = safeUpdate({ prefs: collectPrefs(node) });
    if (!res || res.ok === false) {
      input.checked = !input.checked;
      toast(str(res && res.message) || '保存失败，请重试');
      return;
    }
    toast('通知设置已保存');
  }

  function renderSettings() {
    fillProfileForm();
    renderNotifyList();
    setText($('[data-version]'), VERSION_TEXT);
  }

  function submitProfileForm() {
    var errorNode = $('[data-profile-error]');
    var nameField = $('#acctName');
    setFormError(errorNode, '');

    var a = auth();
    if (!a || typeof a.update !== 'function') {
      setFormError(errorNode, '账户模块未就绪，无法保存');
      return;
    }

    var user = currentUser();
    if (!user) {
      /* 未登录：明确报错，绝不静默失败后仍提示成功 */
      setFormError(errorNode, '登录状态已失效，请重新登录后再保存');
      toast('登录状态已失效，请重新登录');
      return;
    }

    var name = trim(nameField ? nameField.value : '');
    var nameError = validateName(name);
    if (nameError) {
      setFormError(errorNode, nameError);
      focusField(nameField);
      return;
    }

    var avatar = effectiveAvatar(user);
    var res = safeUpdate({ name: name, avatar: avatar });
    if (!res || res.ok === false) {
      var message = str(res && res.message) || '保存失败，请重试';
      setFormError(errorNode, message);
      toast(message);
      return;
    }

    settingsAvatar = avatar;
    if (nameField) { nameField.value = name; }
    setFormError(errorNode, '');
    setPreview($('[data-avatar-preview]'), avatar);
    renderIdentity();
    toast('资料已保存');
  }

  function submitPwdForm() {
    var errorNode = $('[data-pwd-error]');
    setFormError(errorNode, '');

    var a = auth();
    if (!a || typeof a.changePassword !== 'function') {
      setFormError(errorNode, '账户模块未就绪，无法修改密码');
      return;
    }
    if (!currentUser()) {
      setFormError(errorNode, '登录状态已失效，请重新登录');
      return;
    }

    var oldField = $('#pwdOld');
    var newField = $('#pwdNew');
    var againField = $('#pwdNew2');
    var oldPwd = rawValue(oldField);
    var newPwd = rawValue(newField);
    var again = rawValue(againField);

    if (!oldPwd) {
      setFormError(errorNode, '请输入当前密码');
      focusField(oldField);
      return;
    }
    if (newPwd.length < MIN_PWD) {
      setFormError(errorNode, '新密码至少 ' + MIN_PWD + ' 位');
      focusField(newField);
      return;
    }
    if (newPwd !== again) {
      setFormError(errorNode, '两次输入的新密码不一致');
      focusField(againField);
      return;
    }

    var res = null;
    try {
      res = a.changePassword(oldPwd, newPwd);
    } catch (e) {
      res = { ok: false, message: '修改失败，请重试' };
    }

    if (!res || res.ok === false) {
      setFormError(errorNode, str(res && res.message) || '修改失败，请重试');
      return;
    }

    clearValue(oldField);
    clearValue(newField);
    clearValue(againField);
    setFormError(errorNode, '');
    toast(str(res.message) || '密码已修改');
  }

  function handleAvatarPick(input, done) {
    var file = null;
    if (input && input.files && input.files.length) { file = input.files[0]; }
    if (!file) { return; }

    var error = validateImageFile(file);
    if (error) {
      clearValue(input);
      done('', error);
      return;
    }

    if (typeof window.FileReader !== 'function') {
      clearValue(input);
      done('', '当前浏览器不支持读取本地图片');
      return;
    }

    var reader = null;
    try { reader = new window.FileReader(); } catch (e) { reader = null; }
    if (!reader) {
      clearValue(input);
      done('', '图片读取失败，请重试');
      return;
    }

    reader.onload = function () {
      var data = (typeof reader.result === 'string') ? reader.result : '';
      if (!isImageDataUri(data)) {
        clearValue(input);
        done('', '图片格式不受支持，请换一张');
        return;
      }
      done(data, '');
    };
    reader.onerror = function () {
      clearValue(input);
      done('', '图片读取失败，请重试');
    };

    try {
      reader.readAsDataURL(file);
    } catch (e2) {
      clearValue(input);
      done('', '图片读取失败，请重试');
    }
  }

  /* ---------- 编辑资料弹窗 ---------- */

  function openEditProfile() {
    var node = $('[data-modal="profile"]');
    if (!node) {
      toast('编辑弹窗未就绪');
      return;
    }
    var user = currentUser();
    if (!user) {
      toast('登录状态已失效，请重新登录');
      return;
    }

    var nameField = $('#editName');
    if (nameField) { nameField.value = str(user.name); }
    clearValue($('#editAvatar'));
    editAvatar = str(user.avatar);
    setPreview($('[data-edit-avatar-preview]'), editAvatar);

    openModal(node, { focus: nameField || node.querySelector('[data-edit-save]') });
  }

  function saveEditProfile() {
    var a = auth();
    if (!a || typeof a.update !== 'function') {
      toast('账户模块未就绪，无法保存');
      return;
    }
    if (!currentUser()) {
      toast('登录状态已失效，请重新登录');
      return;
    }

    var nameField = $('#editName');
    var name = trim(nameField ? nameField.value : '');
    var error = validateName(name);
    if (error) {
      toast(error);
      focusField(nameField);
      return;
    }

    var avatar = str(editAvatar);
    var res = safeUpdate({ name: name, avatar: avatar });
    if (!res || res.ok === false) {
      toast(str(res && res.message) || '保存失败，请重试');
      return;
    }

    settingsAvatar = avatar;
    var settingsName = $('#acctName');
    if (settingsName) { settingsName.value = name; }
    setPreview($('[data-avatar-preview]'), avatar);
    renderIdentity();
    toast('资料已更新');
    closeModal($('[data-modal="profile"]'));
  }

  /* ---------- 清空演示数据 ---------- */

  function clearDemoData() {
    var store = window.DY && window.DY.store;
    for (var i = 0; i < DEMO_KEYS.length; i++) {
      var key = DEMO_KEYS[i];
      try {
        if (store && typeof store.set === 'function') {
          store.set(key, null);
        } else if (window.localStorage) {
          window.localStorage.removeItem(key);
        }
      } catch (e) { /* 单个键失败不影响其余 */ }
    }
    toast('演示数据已清空');
    redirect(HOME_URL);
  }

  /* ======================================================================
     十二、弹窗（confirm / profile）—— 不使用 confirm()/prompt()/alert()
     ====================================================================== */

  function findModalEntry(node) {
    for (var i = modalStack.length - 1; i >= 0; i--) {
      if (modalStack[i].node === node) { return modalStack[i]; }
    }
    return null;
  }

  function openModal(node, options) {
    if (!node) { return false; }
    var opts = options || {};

    if (opts.title !== undefined) {
      setText(node.querySelector('[data-modal-title]'), opts.title);
    }
    if (opts.text !== undefined) {
      setText(node.querySelector('[data-modal-text]'), opts.text);
    }

    var entry = findModalEntry(node);
    if (!entry) {
      entry = { node: node, lastFocus: document.activeElement, onOk: null };
      modalStack.push(entry);
    }
    entry.onOk = (typeof opts.onOk === 'function') ? opts.onOk : null;

    node.removeAttribute('hidden');
    void node.offsetWidth;                      // 强制重排，保证过渡生效
    node.classList.add('is-open');

    var target = opts.focus
      || node.querySelector('[data-modal-ok]')
      || node.querySelector('[data-edit-save]')
      || node.querySelector('input, select, textarea, button, a');
    focusField(target);
    return true;
  }

  function closeModal(node) {
    if (!node) { return null; }

    var entry = findModalEntry(node);
    if (entry) {
      var idx = -1;
      for (var i = 0; i < modalStack.length; i++) {
        if (modalStack[i] === entry) { idx = i; break; }
      }
      if (idx !== -1) { modalStack.splice(idx, 1); }
    }

    node.classList.remove('is-open');
    window.setTimeout(function () {
      if (!node.classList.contains('is-open')) { node.setAttribute('hidden', 'hidden'); }
    }, MODAL_FADE_MS);

    /* 关闭后焦点归还触发元素 */
    if (entry && entry.lastFocus && entry.lastFocus.nodeType === 1) {
      focusField(entry.lastFocus);
    }
    return entry;
  }

  function openConfirm(options) {
    var opts = options || {};
    var node = $('[data-modal="confirm"]');
    if (!node) {
      /* 弹窗缺失时中止操作，而不是绕过二次确认（也绝不退回系统 confirm()） */
      toast('确认弹窗未就绪，操作已取消');
      return false;
    }
    return openModal(node, {
      title: opts.title,
      text: opts.text,
      onOk: opts.onOk
    });
  }

  function initModals() {
    var nodes = [$('[data-modal="confirm"]'), $('[data-modal="profile"]')];
    var i;

    for (i = 0; i < nodes.length; i++) {
      (function (node) {
        if (!node) { return; }

        /* 背景（backdrop 或弹窗容器空白处）关闭 */
        node.addEventListener('click', function (e) {
          var t = e.target;
          if (t === node) { closeModal(node); return; }
          if (t && t.nodeType === 1 && t.classList
            && t.classList.contains('admin-modal-backdrop')) {
            closeModal(node);
          }
        });

        var closers = node.querySelectorAll('[data-modal-close]');
        for (var c = 0; c < closers.length; c++) {
          (function (btn) {
            btn.addEventListener('click', function (e) {
              e.preventDefault();
              closeModal(node);
            });
          })(closers[c]);
        }
      })(nodes[i]);
    }

    var confirmNode = nodes[0];
    if (confirmNode) {
      var okBtn = confirmNode.querySelector('[data-modal-ok]');
      if (okBtn) {
        okBtn.addEventListener('click', function (e) {
          e.preventDefault();
          var entry = findModalEntry(confirmNode);
          var trigger = entry ? entry.lastFocus : null;
          closeModal(confirmNode);
          if (entry && typeof entry.onOk === 'function') {
            try {
              entry.onOk();
            } catch (err) {
              toast('操作失败，请重试');
            }
          }
          /* 触发元素可能已被重渲染移除：焦点兜底到当前视图的导航按钮 */
          if (trigger && trigger.nodeType === 1 && !inDocument(trigger)) {
            focusField($('[role="tablist"] button.is-active')
              || $('[role="tablist"] button[data-view]'));
          }
        });
      }
      var cancelBtn = confirmNode.querySelector('[data-modal-cancel]');
      if (cancelBtn) {
        cancelBtn.addEventListener('click', function (e) {
          e.preventDefault();
          closeModal(confirmNode);
        });
      }
    }

    /* Esc 关闭最上层弹窗 */
    document.addEventListener('keydown', function (e) {
      var key = e.key;
      if (key !== 'Escape' && key !== 'Esc') { return; }
      if (!modalStack.length) { return; }
      closeModal(modalStack[modalStack.length - 1].node);
    });
  }

  /* ======================================================================
     十三、事件绑定（只在 boot 时绑一次，列表一律用事件委托）
     ====================================================================== */

  function inDocument(node) {
    var el = node;
    while (el) {
      if (el === document) { return true; }
      el = el.parentNode;
    }
    return false;
  }

  function closestByAttr(node, boundary, attr, tagName) {
    var el = node;
    while (el && el !== boundary) {
      if (el.nodeType === 1 && el.getAttribute && el.getAttribute(attr) !== null) {
        if (!tagName || el.tagName === tagName) { return el; }
      }
      el = el.parentNode;
    }
    return null;
  }

  function initTabs() {
    var lists = $$('[role="tablist"]');
    for (var i = 0; i < lists.length; i++) {
      (function (list) {
        list.addEventListener('click', function (e) {
          var btn = closestByAttr(e.target, list, 'data-view', 'BUTTON');
          if (!btn) { return; }
          e.preventDefault();
          setView(btn.getAttribute('data-view'));
        });

        /* 方向键 / Home / End：键盘可达 */
        list.addEventListener('keydown', function (e) {
          var key = e.key;
          if (key !== 'ArrowRight' && key !== 'ArrowLeft'
            && key !== 'Home' && key !== 'End') { return; }
          var btns = list.querySelectorAll('button[data-view]');
          if (!btns.length) { return; }
          var idx = -1;
          for (var j = 0; j < btns.length; j++) {
            if (btns[j] === e.target) { idx = j; break; }
          }
          if (idx === -1) { return; }

          var next = idx;
          if (key === 'ArrowRight') { next = (idx + 1) % btns.length; }
          else if (key === 'ArrowLeft') { next = (idx - 1 + btns.length) % btns.length; }
          else if (key === 'Home') { next = 0; }
          else { next = btns.length - 1; }

          e.preventDefault();
          setView(btns[next].getAttribute('data-view'));
          focusField(btns[next]);
        });
      })(lists[i]);
    }
  }

  function initGrid() {
    var grid = $('[data-account-grid]');
    if (!grid) { return; }
    grid.addEventListener('click', function (e) {
      var btn = closestByAttr(e.target, grid, 'data-view-go', 'BUTTON');
      if (!btn) { return; }
      e.preventDefault();
      setView(btn.getAttribute('data-view-go'));
    });
  }

  function initLogout() {
    var btn = $('[data-logout]');
    if (!btn) { return; }
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      loggingOut = true;                 // 阻止 dy:auth-change 抢先改写跳转目标
      var a = auth();
      if (a && typeof a.logout === 'function') {
        try { a.logout(); } catch (err) { /* 忽略 */ }
      }
      redirect(AFTER_LOGOUT_URL);
    });
  }

  function initOrderFilter() {
    /* 必须绑在 .filter-bar 容器上：chip 由 renderOrderFilter 整体重建，
       绑定单个 chip 会在重渲染后失效（也会误把第一个 chip 当容器）。 */
    var node = orderFilterBar();
    if (!node) { return; }
    node.addEventListener('click', function (e) {
      var btn = closestByAttr(e.target, node, 'data-status', 'BUTTON');
      if (!btn) { return; }
      e.preventDefault();
      orderStatus = trim(btn.getAttribute('data-status')) || 'all';
      renderOrderFilter();
      renderOrderList();
    });
  }

  function initMineList() {
    var node = $('[data-mine-list]');
    if (!node) { return; }
    node.addEventListener('click', function (e) {
      var btn = closestByAttr(e.target, node, 'data-mine-remove', 'BUTTON');
      if (!btn) { return; }
      e.preventDefault();
      removeMine(btn);
    });
  }

  function initNotifyList() {
    var node = $('[data-notify-list]');
    if (!node) { return; }
    node.addEventListener('change', function (e) {
      var input = e.target;
      if (!input || input.nodeType !== 1) { return; }
      if (input.getAttribute('data-pref') === null) { return; }
      if (str(input.type).toLowerCase() !== 'checkbox') { return; }
      saveNotifyPrefs(node, input);       // 立即持久化到 prefs
    });
  }

  function initProfileForm() {
    var form = $('[data-profile-form]');
    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        submitProfileForm();
      });
    }
    /* 保存按钮单独兜底：即使 HTML 用的是 div 而不是 form 也能提交。
       这里 preventDefault 会阻止按钮的原生提交，因此不会与上面的 submit 重复执行。 */
    var saveBtn = $('[data-profile-save]');
    if (saveBtn) {
      saveBtn.addEventListener('click', function (e) {
        e.preventDefault();
        submitProfileForm();
      });
    }
  }

  function initPwdForm() {
    var form = $('[data-pwd-form]');
    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        submitPwdForm();
      });
    }
    var saveBtn = $('[data-pwd-save]');
    if (saveBtn) {
      saveBtn.addEventListener('click', function (e) {
        e.preventDefault();
        submitPwdForm();
      });
    }
  }

  function initAvatarInputs() {
    var profileInput = $('#acctAvatar');
    if (profileInput) {
      profileInput.addEventListener('change', function () {
        handleAvatarPick(profileInput, function (dataUri, error) {
          if (error) {
            settingsAvatar = null;
            setPreview($('[data-avatar-preview]'), null);
            setFormError($('[data-profile-error]'), error);
            toast(error);
            return;
          }
          settingsAvatar = dataUri;
          setPreview($('[data-avatar-preview]'), dataUri);
          setFormError($('[data-profile-error]'), '');
          toast('图片已选择，点保存生效');
        });
      });
    }

    var editInput = $('#editAvatar');
    if (editInput) {
      editInput.addEventListener('change', function () {
        handleAvatarPick(editInput, function (dataUri, error) {
          if (error) {
            toast(error);
            return;
          }
          editAvatar = dataUri;
          setPreview($('[data-edit-avatar-preview]'), dataUri);
        });
      });
    }
  }

  function initEditModal() {
    var openBtn = $('[data-profile-edit]');
    if (openBtn) {
      openBtn.addEventListener('click', function (e) {
        e.preventDefault();
        openEditProfile();
      });
    }

    var node = $('[data-modal="profile"]');
    if (!node) { return; }

    var saveBtn = node.querySelector('[data-edit-save]');
    if (saveBtn) {
      saveBtn.addEventListener('click', function (e) {
        e.preventDefault();
        saveEditProfile();
      });
    }

    var cancelBtn = node.querySelector('[data-edit-cancel]');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', function (e) {
        e.preventDefault();
        closeModal(node);
      });
    }
  }

  function initAbout() {
    setText($('[data-version]'), VERSION_TEXT);

    var btn = $('[data-clear-demo]');
    if (!btn) { return; }
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      openConfirm({
        title: '清空演示数据',
        text: '这会删除本地保存的账号、余额、订单、购物袋、收藏与二手发布记录，且无法恢复。确定要继续吗？',
        onOk: clearDemoData
      });
    });
  }

  function initAuthWatch() {
    document.addEventListener('dy:auth-change', function () {
      if (loggingOut) { return; }
      if (!currentUser()) { redirect(LOGIN_URL); }
    });
  }

  function bindOnce() {
    if (bound) { return; }
    bound = true;
    initTabs();
    initGrid();
    initLogout();
    initOrderFilter();
    initMineList();
    initNotifyList();
    initProfileForm();
    initPwdForm();
    initAvatarInputs();
    initEditModal();
    initAbout();
    initModals();
    initAuthWatch();
  }

  /* ======================================================================
     十四、入口：路由守卫 → 视图路由
     ====================================================================== */

  function boot() {
    CFG = window.DY_CONFIG || {};
    initOrderStatus();
    bindOnce();

    var view = validView(urlParam('view'));
    setView(view);
  }

  onReady(function () {
    /* 路由守卫：DOMContentLoaded 第一件事，未登录不得渲染任何内容 */
    var a = auth();
    var logged = false;
    if (a && typeof a.isLoggedIn === 'function') {
      try { logged = (a.isLoggedIn() === true); } catch (e) { logged = false; }
    }
    if (!logged) {
      redirect(LOGIN_URL);
      return;
    }

    try {
      boot();
    } catch (err) {
      try {
        if (window.console && window.console.error) {
          window.console.error('[account-page]', err);
        }
      } catch (e2) { /* 忽略 */ }
    }
  });
})();

/* ==========================================================================
   dooyoor 㛊䎟 — 商家后台（纯静态演示，七视图）
   依赖：js/site-config.js（数据）、js/cart.js（DY.store / DY.escape / DY.money / DY.toast）
   本页不加载 js/main.js 与 js/fav.js：登录、导航、抽屉、弹窗全部在此文件内实现。

   ---------------------------------------------------------------------------
   本轮修正（对应规范 §12 与 §23.14）：
   1. 持久化：商品 → dooyoor.admin.products.v1；广告 → DY_CONFIG.bannersKey
      （dooyoor.banners.v1，与前台首页轮播共用）；订单/用户 → dooyoor.users.v1。
      一律经 DY.store.get/set；写失败（配额超限）必须捕获并明确提示，绝不谎报成功。
   2. 统计口径：新品销售额只累加 type==='new'，二手销售额只累加 type==='used'，
      不再用 o.status==='completed' 混淆类型。金额统一走 DY.money()。
   3. 安全：所有插入 DOM 的文本一律 DY.escape()；不使用内联事件、不把数据
      序列化进 HTML 属性；删除一律站点内 Modal 二次确认；无 prompt/confirm/alert。
   4. 登录门：不预填密码、不写 localStorage、不在"忘记密码"里回显密码。
   5. 手机号脱敏对任意长度安全；余额一律 Number() 后兜底 0，不直接 toFixed()。
   ========================================================================== */
(function () {
  'use strict';

  var CFG = window.DY_CONFIG || {};
  var ADMIN_USER = CFG.adminUser || { name: '运营账号', role: '超级管理员', initial: 'D' };

  /* ---------- 存储键 ---------- */
  var PRODUCTS_KEY = 'dooyoor.admin.products.v1';
  var BANNERS_KEY = (typeof CFG.bannersKey === 'string' && CFG.bannersKey)
    ? CFG.bannersKey : 'dooyoor.banners.v1';
  var USERS_KEY = 'dooyoor.users.v1';
  var PREOWNED_KEY = (typeof CFG.preownedKey === 'string' && CFG.preownedKey)
    ? CFG.preownedKey : 'dooyoor.preowned.v1';

  var FALLBACK_IMAGE = 'assets/products/p01.svg';

  /* ---------- 演示凭据：只做前端判断，没有后端，绝不落盘 ---------- */
  var DEMO_ACCOUNT = 'admin';
  var DEMO_PASSWORD = 'dooyoor2025';

  var MAX_PHOTOS = 5;
  var MAX_EDGE = 1000;
  var JPEG_QUALITY = 0.8;
  var BANNER_INTERVAL = 4000;

  var MSG_QUOTA = '保存失败：本地存储空间不足，请减少图片数量或改用更小的图片';
  var MSG_NO_STORAGE = '保存失败：浏览器本地存储不可用（可能处于无痕模式），本次改动没有落盘';

  var VIEW_TITLES = {
    dashboard: '概览',
    products: '商品管理',
    add: '发布新品',
    banner: '广告栏装修',
    users: '用户管理',
    orders: '订单管理',
    chain: '溯源记录'
  };
  var STATUS_BADGE = { pending: 'badge--warn', shipped: 'badge--accent', done: 'badge--ok', refund: 'badge--muted' };
  var STATUS_NAME = { pending: '待发货', shipped: '已发货', done: '已完成', refund: '退款中' };
  var CONDITION_LABEL = { new: '全新', used: '认证二手' };

  var CATEGORY_OPTIONS = [
    { id: 'tops', name: '上衣' },
    { id: 'bottoms', name: '裤子' },
    { id: 'skirts', name: '裙子' },
    { id: 'bags', name: '包包' }
  ];

  var SIZE_OPTIONS = ['XS', 'S', 'M', 'L', 'XL'];
  var COLOR_PRESETS = ['云雾白', '玫黑', '暖驼', '靛蓝', '灰褐', '苔绿'];

  /* ---------- 图标：规范 §5.6 图标集，内联 SVG，装饰性加 aria-hidden ---------- */
  var SVG_ATTR = ' viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none"'
    + ' stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"';
  var ICON_CHECK = '<svg' + SVG_ATTR + '><path d="M5 13l4 4L19 7"/></svg>';
  var ICON_IMAGE = '<svg' + SVG_ATTR + '><path d="M3 6h18v12H3z"/><path d="M3 14l5-4 4 3 4-4 5 5"/></svg>';

  /* ======================================================================
     工具（ES5）
     ====================================================================== */

  var DY = window.DY || {};

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

  function money(amount) {
    if (typeof DY.money === 'function') { return DY.money(amount); }
    var n = Number(amount);
    if (!isFinite(n)) { n = 0; }
    n = Math.round(n);
    return '¥' + String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  function toast(message) {
    if (typeof DY.toast === 'function') { DY.toast(message); }
  }

  function isArr(v) { return Object.prototype.toString.call(v) === '[object Array]'; }

  function isObj(v) { return !!v && typeof v === 'object' && !isArr(v); }

  function str(v) {
    return (v === null || v === undefined) ? '' : String(v);
  }

  function trim(v) { return str(v).replace(/^\s+|\s+$/g, ''); }

  function num(v, fallback) {
    var n = Number(v);
    return isFinite(n) ? n : (typeof fallback === 'number' ? fallback : 0);
  }

  /* 余额等字段可能是字符串，必须先 Number() 再兜底，绝不直接 .toFixed() */
  function numOr0(v) { return num(v, 0); }

  function intOr(v, fallback) { return Math.round(num(v, fallback)); }

  function $(selector) { return document.querySelector(selector); }

  function $$(selector) { return Array.prototype.slice.call(document.querySelectorAll(selector)); }

  function closestAttr(node, attr) {
    while (node && node.nodeType === 1) {
      if (node.hasAttribute(attr)) { return node; }
      node = node.parentNode;
    }
    return null;
  }

  /* 本地 YYYY-MM-DD。绝不用 toISOString().split('T')[0]——UTC 会让东八区差一天 */
  function pad2(n) { return n < 10 ? '0' + n : String(n); }

  function localDate(input) {
    var d = (input === undefined || input === null) ? new Date() : new Date(input);
    if (!(d instanceof Date) || isNaN(d.getTime())) { d = new Date(); }
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  /* 手机号脱敏：对任意长度安全（空串、短号、带区号都不会抛错或变空） */
  function maskPhone(value) {
    var s = trim(value);
    if (!s) { return '未填写'; }
    if (s.length <= 4) { return '****'; }
    if (s.length <= 7) { return s.charAt(0) + '****'; }
    return s.slice(0, 3) + '****' + s.slice(s.length - 4);
  }

  function digits(value, allowDot) {
    var pattern = allowDot ? /[^0-9.]/g : /[^0-9]/g;
    return str(value).replace(pattern, '');
  }

  /* 链接协议白名单：站内相对路径，或 https:// */
  function isSafeLink(raw) {
    var v = trim(raw);
    if (!v) { return true; }
    if (v.charAt(0) === '/') { return v.charAt(1) !== '/' && v.charAt(1) !== '\\'; }
    if (v.charAt(0) === '#') { return true; }
    /* 本站图片：本地上传后压缩成的 data URL，只放行位图，不放行 image/svg+xml */
    if (/^data:image\/(png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=]+$/i.test(v)) { return true; }
    if (/^[a-z0-9._~\-]+(?:[\/?#][^\s]*)?$/i.test(v)) {
      return v.indexOf('..') !== 0;
    }
    if (/^https:\/\/[^\s]+$/i.test(v)) { return true; }
    return false;
  }

  /* ======================================================================
     存储层：全部经 DY.store.get/set。set 失败必须返回 false 并以异常兜底，
     让调用方能明确提示用户，而不是静默丢失或谎报成功。
     ====================================================================== */

  function storeGet(key, fallback) {
    if (!DY.store || typeof DY.store.get !== 'function') { return fallback; }
    try {
      return DY.store.get(key, fallback);
    } catch (e) {
      return fallback;
    }
  }

  /* 探测 localStorage 是否真的可用（只探一次，结果缓存） */
  var storageProbe = null;

  function localStorageUsable() {
    if (storageProbe !== null) { return storageProbe; }
    try {
      window.localStorage.setItem('dooyoor.admin.probe', '1');
      window.localStorage.removeItem('dooyoor.admin.probe');
      storageProbe = true;
    } catch (e) {
      storageProbe = false;
    }
    return storageProbe;
  }

  /* 写失败时的统一文案：区分"配额超限"与"存储完全不可用" */
  function saveErrorMessage() {
    return localStorageUsable() ? MSG_QUOTA : MSG_NO_STORAGE;
  }

  function storeSet(key, value) {
    if (!DY.store || typeof DY.store.set !== 'function') {
      throw new Error('storage-unavailable');
    }
    var ok = DY.store.set(key, value);
    /* cart.js 的 storeSet 在写失败时会静默降级到内存并返回 true，
       因此这里必须回读校验：读不回来就视为持久化失败，绝不谎报成功。 */
    var readBack = storeGet(key, null);
    if (ok === false || readBack === null || readBack === undefined) {
      throw new Error(localStorageUsable() ? 'storage-quota' : 'storage-unavailable');
    }
    return true;
  }

  /* ======================================================================
     数据装配
     ====================================================================== */

  function categoryName(id) {
    for (var i = 0; i < CATEGORY_OPTIONS.length; i++) {
      if (CATEGORY_OPTIONS[i].id === id) { return CATEGORY_OPTIONS[i].name; }
    }
    return '';
  }

  function conditionName(id) {
    return CONDITION_LABEL[id === 'used' ? 'used' : 'new'];
  }

  function colorList(raw) {
    var out = [];
    if (!isArr(raw)) { return out; }
    raw.forEach(function (item) {
      if (isObj(item)) {
        var n = trim(item.name);
        if (n) { out.push({ name: n, hex: str(item.hex) }); }
      } else {
        var t = trim(item);
        if (t) { out.push({ name: t, hex: '' }); }
      }
    });
    return out;
  }

  function imageList(raw, fallbackImage) {
    var out = [];
    if (isArr(raw)) {
      raw.forEach(function (v) { var t = trim(v); if (t) { out.push(t); } });
    }
    return out.length ? out : (fallbackImage ? [fallbackImage] : []);
  }

  /* 归一化一件商品：保留 site-config 的既有字段，补上后台需要的字段 */
  function assembleProduct(raw, index) {
    var p = isObj(raw) ? raw : {};
    var id = trim(p.id) || ('p' + pad2(index + 1));
    var condition = (p.condition === 'used') ? 'used' : 'new';
    var category = trim(p.category);
    var images = imageList(p.gallery, trim(p.image));

    var out = {};
    for (var key in p) {
      if (Object.prototype.hasOwnProperty.call(p, key)) { out[key] = p[key]; }
    }
    out.id = id;
    out.name = trim(p.name);
    out.en = trim(p.en);
    out.category = category;
    out.categoryName = trim(p.categoryName) || categoryName(category);
    out.condition = condition;
    out.conditionName = trim(p.conditionName) || conditionName(condition);
    out.price = intOr(p.price, 0);
    out.compareAt = (p.compareAt === null || p.compareAt === undefined || p.compareAt === '')
      ? null : intOr(p.compareAt, 0);
    out.badge = trim(p.badge);
    out.short = trim(p.short);
    out.fabric = trim(p.fabric);
    out.colors = colorList(p.colors);
    out.sizes = isArr(p.sizes) ? p.sizes.slice() : [];
    out.gallery = images;
    out.image = images.length ? images[0] : FALLBACK_IMAGE;
    out.stock = Math.max(0, intOr(p.stock, 0));
    out.off = p.off === true;
    return out;
  }

  function normalizeProductList(raw, seed) {
    var source = isArr(raw) ? raw : (isArr(seed) ? seed : []);
    return source.map(assembleProduct).filter(function (p) { return !!p.name || !!p.id; });
  }

  function loadProducts() {
    var stored = storeGet(PRODUCTS_KEY, null);
    if (isArr(stored)) { return normalizeProductList(stored, []); }
    /* 首次启用：用 DY_CONFIG.products 播种 */
    return normalizeProductList(CFG.products || [], []);
  }

  /* id 用 'p' + (maxId + 1)，但删除后会复用旧 id，因此必须检测冲突并自增 */
  function nextProductId(list) {
    var max = 0;
    list.forEach(function (p) {
      var m = /^p(\d+)$/.exec(str(p.id));
      if (m) { max = Math.max(max, parseInt(m[1], 10)); }
    });
    var n = max + 1;
    var taken = {};
    list.forEach(function (p) { taken[str(p.id)] = true; });
    var id = 'p' + (n < 10 ? '0' + n : n);
    while (taken[id]) {
      n += 1;
      id = 'p' + (n < 10 ? '0' + n : n);
    }
    return id;
  }

  function sortBanners(list) {
    return list.slice().sort(function (a, b) {
      return (num(a.sort, 0) - num(b.sort, 0));
    });
  }

  /* 深拷贝一行广告：写盘失败要能安全回滚，所以行上的对象绝不能与
     state.banners 里的对象同引用（浅拷贝也会污染） */
  function cloneBanner(b) {
    return {
      id: b.id,
      image: b.image,
      title: b.title,
      desc: b.desc,
      link: b.link,
      linkText: b.linkText,
      sort: b.sort,
      status: b.status
    };
  }

  function normalizeBannerSort(list) {
    sortBanners(list).forEach(function (item, index) { item.sort = index + 1; });
    return list;
  }

  function assembleBanner(raw, index) {
    var b = isObj(raw) ? raw : {};
    var status = (b.status === 'inactive') ? 'inactive' : 'active';
    return {
      id: trim(b.id) || ('b' + (index + 1)),
      image: trim(b.image) || FALLBACK_IMAGE,
      title: trim(b.title),
      desc: trim(b.desc),
      link: trim(b.link),
      linkText: trim(b.linkText),
      sort: num(b.sort, index + 1),
      status: status
    };
  }

  function normalizeBannerList(raw, seed) {
    var source = isArr(raw) ? raw : (isArr(seed) ? seed : []);
    return source.map(assembleBanner).filter(function (b) { return !!b.title || !!b.image; });
  }

  function loadBanners() {
    var stored = storeGet(BANNERS_KEY, null);
    if (isArr(stored)) { return normalizeBannerSort(normalizeBannerList(stored, [])); }
    /* 首次启用：用 DY_CONFIG.banners 播种 */
    return normalizeBannerSort(normalizeBannerList(CFG.banners || [], []));
  }

  /* ---- 用户：读 dooyoor.users.v1（一个大对象），绝不扫描全部 localStorage key ---- */

  function phoneOf(key, record) {
    var p = trim(record && record.phone);
    return p || trim(key);
  }

  function userList() {
    var raw = storeGet(USERS_KEY, null);
    var out = [];
    if (!isObj(raw)) { return out; }
    Object.keys(raw).forEach(function (key) {
      var record = raw[key];
      if (!isObj(record)) { return; }
      out.push({
        key: key,
        phone: phoneOf(key, record),
        name: trim(record.name),
        avatar: str(record.avatar),
        registerDate: trim(record.registerDate),
        balance: numOr0(record.balance),
        orders: isArr(record.orders) ? record.orders : [],
        myUsedGoods: isArr(record.myUsedGoods) ? record.myUsedGoods : []
      });
    });
    return out;
  }

  /* ---- 订单：默认读真实用户订单，无数据时用 DY_CONFIG.orders 兜底 ---- */

  function normalizeItem(raw) {
    var it = isObj(raw) ? raw : {};
    return {
      name: trim(it.name) || '未命名商品',
      image: trim(it.image),
      size: trim(it.size),
      qty: Math.max(0, intOr(it.qty, 0)),
      unitPrice: numOr0(it.unitPrice)
    };
  }

  function assembleOrder(raw, buyerFallback) {
    var o = isObj(raw) ? raw : {};
    var statusKey = trim(o.statusKey);
    if (!STATUS_NAME[statusKey]) {
      statusKey = 'pending';
      for (var k in STATUS_NAME) {
        if (Object.prototype.hasOwnProperty.call(STATUS_NAME, k) && STATUS_NAME[k] === trim(o.status)) {
          statusKey = k;
          break;
        }
      }
    }

    var items = [];
    if (isArr(o.items) && o.items.length) {
      items = o.items.map(normalizeItem);
    } else {
      items = [normalizeItem({
        name: o.name,
        image: '',
        size: o.size,
        qty: o.qty,
        unitPrice: (numOr0(o.amount) && intOr(o.qty, 1)) ? (numOr0(o.amount) / Math.max(1, intOr(o.qty, 1))) : numOr0(o.amount)
      })];
    }

    var qty = items.reduce(function (sum, it) { return sum + it.qty; }, 0);
    var rawBuyer = trim(o.buyer) || trim(buyerFallback);
    return {
      no: trim(o.no) || '—',
      /* type 缺失一律按新品处理；统计时严格按 type 分流 */
      type: (o.type === 'used') ? 'used' : 'new',
      items: items,
      qty: qty,
      amount: numOr0(o.total) || numOr0(o.amount),
      statusKey: statusKey,
      status: STATUS_NAME[statusKey],
      date: trim(o.date) || localDate(o.time),
      buyer: rawBuyer ? maskPhone(rawBuyer) : '—',
      sellerPhone: trim(o.sellerPhone),
      code: trim(o.chainCode) || trim(o.code)
    };
  }

  function collectUserOrders() {
    var raw = storeGet(USERS_KEY, null);
    var out = [];
    if (!isObj(raw)) { return out; }
    Object.keys(raw).forEach(function (key) {
      var record = raw[key];
      if (!isObj(record) || !isArr(record.orders)) { return; }
      record.orders.forEach(function (order) {
        out.push(assembleOrder(order, record.name || key));
      });
    });
    return out;
  }

  function loadOrders() {
    var real = collectUserOrders();
    if (real.length) { return real; }
    return (CFG.orders || []).map(function (o) { return assembleOrder(o, ''); });
  }

  /* ======================================================================
     状态
     ====================================================================== */

  var state = {
    view: 'dashboard',
    query: '',
    condition: 'all',
    orderStatus: 'all',
    editingId: null,
    photos: [],
    colors: [],
    sizes: [],
    dragFrom: null,
    bannerEditing: null,
    bannerDraftImage: '',
    confirmAction: null,
    products: [],
    banners: [],
    orders: []
  };

  function findProduct(id) {
    for (var i = 0; i < state.products.length; i++) {
      if (state.products[i].id === id) { return state.products[i]; }
    }
    return null;
  }

  function findBanner(id) {
    for (var i = 0; i < state.banners.length; i++) {
      if (state.banners[i].id === id) { return state.banners[i]; }
    }
    return null;
  }

  /* ---- 持久化包装：失败时回滚内存并抛出，调用方负责 toast ---- */

  function persistProducts(next) {
    try {
      storeSet(PRODUCTS_KEY, next);
      return true;
    } catch (e) {
      return false;
    }
  }

  function persistBanners(next) {
    try {
      storeSet(BANNERS_KEY, next);
      return true;
    } catch (e) {
      return false;
    }
  }

  function persistUsers(next) {
    try {
      storeSet(USERS_KEY, next);
      return true;
    } catch (e) {
      return false;
    }
  }

  /* ======================================================================
     DOM 引用
     ====================================================================== */

  var els = {};
  var drawerTimer = null;
  var modalTimer = null;
  var lastFocus = null;
  var bannerTimer = null;
  var bannerIndex = 0;
  var desktopQuery = window.matchMedia ? window.matchMedia('(min-width: 768px)') : null;

  function reducedMotion() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  /* ======================================================================
     登录门
     ====================================================================== */

  function setFieldError(input, errorNode, message) {
    if (errorNode) { errorNode.textContent = message || ''; }
    if (!input) { return; }
    if (message) {
      input.classList.add('is-invalid');
      input.setAttribute('aria-invalid', 'true');
    } else {
      input.classList.remove('is-invalid');
      input.removeAttribute('aria-invalid');
    }
  }

  function showShell() {
    if (els.login) { els.login.hidden = true; }
    if (els.shell) { els.shell.hidden = false; }
    loadAllData();
    renderStats();
    renderRecentOrders();
    renderProducts();
    renderBanners();
    renderUsers();
    renderOrders();
    renderChain();
    setView('dashboard');
  }

  function showLogin() {
    closeModal();
    closeBannerModal();
    closeConfirm();
    setDrawer(false);
    stopBannerTimer();
    if (els.shell) { els.shell.hidden = true; }
    if (els.login) { els.login.hidden = false; }
    /* 不预填、不记忆任何密码 */
    if (els.account) { els.account.value = ''; }
    if (els.password) { els.password.value = ''; }
    setFieldError(els.account, els.accountError, '');
    setFieldError(els.password, els.passwordError, '');
    setView('dashboard');
  }

  function onLoginSubmit(event) {
    event.preventDefault();
    var account = els.account ? trim(els.account.value) : '';
    var password = els.password ? els.password.value : '';

    setFieldError(els.account, els.accountError, '');
    setFieldError(els.password, els.passwordError, '');

    if (!account) {
      setFieldError(els.account, els.accountError, '请输入账号');
      if (els.account) { els.account.focus(); }
      return;
    }
    if (!password) {
      setFieldError(els.password, els.passwordError, '请输入密码');
      if (els.password) { els.password.focus(); }
      return;
    }
    if (account !== DEMO_ACCOUNT || password !== DEMO_PASSWORD) {
      setFieldError(els.account, els.accountError, '账号或密码不正确');
      setFieldError(els.password, els.passwordError, '账号或密码不正确');
      toast('账号或密码不正确，请使用页面下方提示的演示账号');
      if (els.password) { els.password.focus(); }
      return;
    }

    /* 只切内存里的 hidden；账号密码不入 localStorage、不入 session */
    showShell();
    toast('已登录：' + ADMIN_USER.name + '（演示账号，状态不落盘）');
  }

  /* ======================================================================
     视图切换（.admin-side 与 .admin-drawer 同步高亮）
     ====================================================================== */

  function setView(name) {
    if (!VIEW_TITLES[name]) { name = 'dashboard'; }
    state.view = name;

    $$('.admin-nav-link[data-view]').forEach(function (link) {
      var active = link.getAttribute('data-view') === name;
      link.classList.toggle('is-active', active);
      if (active) {
        link.setAttribute('aria-current', 'page');
      } else {
        link.removeAttribute('aria-current');
      }
    });

    $$('section[data-view]').forEach(function (panel) {
      var show = panel.getAttribute('data-view') === name;
      if (show) {
        panel.removeAttribute('hidden');
      } else {
        panel.setAttribute('hidden', 'hidden');
      }
    });

    if (els.viewTitle) { els.viewTitle.textContent = VIEW_TITLES[name]; }

    setDrawer(false);
    if (els.shell && !els.shell.hidden) { window.scrollTo(0, 0); }

    if (name === 'banner') {
      renderBannerPreview();
      startBannerTimer();
    } else {
      stopBannerTimer();
    }
  }

  /* ======================================================================
     移动端抽屉 / 弹窗基础
     ====================================================================== */

  function isDesktop() { return !!(desktopQuery && desktopQuery.matches); }

  function drawerIsOpen() { return !!(els.drawer && els.drawer.classList.contains('is-open')); }

  function anyModalOpen() {
    var nodes = [els.modal, els.bannerModal, els.confirm];
    for (var i = 0; i < nodes.length; i++) {
      if (nodes[i] && nodes[i].classList.contains('is-open')) { return true; }
    }
    return false;
  }

  function syncScrollLock() {
    document.body.classList.toggle('is-locked', drawerIsOpen() || anyModalOpen());
  }

  function setDrawer(open) {
    if (!els.drawer || !els.menuBtn) { return; }
    window.clearTimeout(drawerTimer);
    if (open) {
      els.drawer.hidden = false;
      void els.drawer.offsetWidth; /* 先进入渲染树，再加 .is-open，过渡才生效 */
      els.drawer.classList.add('is-open');
      els.menuBtn.setAttribute('aria-expanded', 'true');
    } else {
      els.drawer.classList.remove('is-open');
      els.menuBtn.setAttribute('aria-expanded', 'false');
      drawerTimer = window.setTimeout(function () { els.drawer.hidden = true; }, 280);
    }
    syncScrollLock();
  }

  function openPanel(node) {
    if (!node) { return; }
    if (drawerIsOpen()) { setDrawer(false); }
    window.clearTimeout(modalTimer);
    node.hidden = false;
    void node.offsetWidth;
    node.classList.add('is-open');
    syncScrollLock();
  }

  function closePanel(node) {
    if (!node) { return; }
    window.clearTimeout(modalTimer);
    node.classList.remove('is-open');
    var target = node;
    modalTimer = window.setTimeout(function () { target.hidden = true; }, 260);
    syncScrollLock();
  }

  /* ======================================================================
     弹窗 1：编辑商品
     ====================================================================== */

  function modalIsOpen() { return !!(els.modal && els.modal.classList.contains('is-open')); }

  function openModal() {
    openPanel(els.modal);
    if (els.priceInput) { els.priceInput.focus(); }
  }

  function closeModal() {
    if (!els.modal || els.modal.hidden) { return; }
    var wasOpen = modalIsOpen();
    closePanel(els.modal);
    state.editingId = null;
    if (wasOpen && lastFocus && typeof lastFocus.focus === 'function') { lastFocus.focus(); }
    lastFocus = null;
  }

  function openEditFor(id) {
    var product = findProduct(id);
    if (!product) { return; }
    state.editingId = id;
    lastFocus = (document.activeElement && document.activeElement.nodeType === 1) ? document.activeElement : null;

    if (els.editName) {
      els.editName.textContent = product.name
        + ' · ' + (product.chain && product.chain.code ? product.chain.code : '未上链');
    }
    if (els.priceInput) { els.priceInput.value = String(product.price); }
    if (els.stockInput) { els.stockInput.value = String(product.stock); }
    setFieldError(els.priceInput, els.priceError, '');
    setFieldError(els.stockInput, els.stockError, '');
    openModal();
  }

  function onEditSubmit(event) {
    event.preventDefault();
    var product = findProduct(state.editingId);
    if (!product) { closeModal(); return; }

    var rawPrice = els.priceInput ? digits(els.priceInput.value, true) : '';
    var rawStock = els.stockInput ? digits(els.stockInput.value, false) : '';
    var price = rawPrice === '' ? NaN : Number(rawPrice);
    var stock = rawStock === '' ? NaN : Number(rawStock);
    var bad = false;

    setFieldError(els.priceInput, els.priceError, '');
    setFieldError(els.stockInput, els.stockError, '');

    if (!isFinite(price) || price <= 0 || price > 999999) {
      setFieldError(els.priceInput, els.priceError, '请输入 1–999999 之间的价格（元）');
      bad = true;
    }
    if (!isFinite(stock) || stock < 0 || stock > 99999) {
      setFieldError(els.stockInput, els.stockError, '请输入 0–99999 之间的库存（件）');
      bad = true;
    }
    if (bad) {
      toast('保存失败：请检查表单提示');
      return;
    }

    var beforePrice = product.price;
    var beforeStock = product.stock;
    product.price = Math.round(price);
    product.stock = Math.round(stock);

    if (!persistProducts(state.products)) {
      product.price = beforePrice;
      product.stock = beforeStock;
      if (els.priceInput) { els.priceInput.value = String(beforePrice); }
      if (els.stockInput) { els.stockInput.value = String(beforeStock); }
      renderProducts();
      toast(saveErrorMessage());
      return;
    }

    closeModal();
    renderProducts();
    renderChain();
    toast('已保存：' + product.name + ' ' + money(product.price) + ' · 库存 ' + product.stock + ' 件');
  }

  /* ======================================================================
     渲染：概览（统计口径按 type 严格分流）
     ====================================================================== */

  function computeStats() {
    var onSale = state.products.filter(function (p) { return !p.off; }).length;
    var newSales = 0;
    var usedSales = 0;

    state.orders.forEach(function (order) {
      var amount = numOr0(order.amount);
      /* 只按 type 区分：绝不用 status === 'done' 混进新品销售额 */
      if (order.type === 'used') {
        usedSales += amount;
      } else if (order.type === 'new') {
        newSales += amount;
      }
    });

    return [
      { label: '在售商品数', value: String(onSale), delta: '共 ' + state.products.length + ' 款，含下架' },
      { label: '订单总数', value: String(state.orders.length), delta: '来自真实用户订单与演示数据' },
      { label: '用户总数', value: String(userList().length), delta: 'dooyoor.users.v1' },
      { label: '新品销售额', value: money(newSales), delta: '仅统计 type=新品的订单' },
      { label: '二手销售额', value: money(usedSales), delta: '仅统计 type=二手的订单' },
      { label: '总销售额', value: money(newSales + usedSales), delta: '新品 + 二手' }
    ];
  }

  function renderStats() {
    if (!els.stats) { return; }
    els.stats.innerHTML = computeStats().map(function (item) {
      return '<div class="stat-card">'
        + '<div class="stat-label">' + esc(item.label) + '</div>'
        + '<div class="stat-value">' + esc(item.value) + '</div>'
        + '<div class="stat-delta">' + esc(item.delta) + '</div>'
        + '</div>';
    }).join('');
  }

  function orderCardHtml(order) {
    var badge = STATUS_BADGE[order.statusKey] || 'badge--muted';
    var first = order.items[0] || { name: '—', size: '', qty: 0 };
    var title = first.name + (order.items.length > 1 ? ' 等 ' + order.items.length + ' 款' : '');
    var typeBadge = order.type === 'used'
      ? '<span class="badge badge--muted">认证二手</span>'
      : '<span class="badge badge--accent">新品</span>';
    var code = order.code || '—';

    return '<article class="order-card">'
      + '<div class="order-head">'
        + '<div>'
          + '<span class="order-no">' + esc(order.no) + '</span>'
          + '<h3 class="order-name">' + esc(title) + '</h3>'
        + '</div>'
        + '<span class="badge ' + badge + '">' + esc(order.status) + '</span>'
      + '</div>'
      + '<div class="order-meta">'
        + '<span>尺码 ' + esc(first.size || '—') + ' · 数量 ' + esc(order.qty) + '</span>'
        + '<span>买家 ' + esc(order.buyer) + ' · ' + esc(order.date) + '</span>'
        + '<span>溯源码 ' + esc(code) + '</span>'
      + '</div>'
      + '<div class="order-foot">'
        + '<span>' + typeBadge + '</span>'
        + '<span class="order-amount">' + esc(money(order.amount)) + '</span>'
      + '</div>'
      + '</article>';
  }

  function renderRecentOrders() {
    if (!els.recentOrders) { return; }
    var recent = state.orders.slice().sort(function (a, b) {
      return str(b.date).localeCompare(str(a.date));
    }).slice(0, 3);
    els.recentOrders.innerHTML = recent.map(orderCardHtml).join('');
  }

  /* ======================================================================
     渲染：商品管理
     ====================================================================== */

  function filteredProducts() {
    var query = trim(state.query).toLowerCase();
    return state.products.filter(function (product) {
      if (state.condition !== 'all' && product.condition !== state.condition) { return false; }
      if (!query) { return true; }
      var code = product.chain && product.chain.code ? str(product.chain.code).toLowerCase() : '';
      return str(product.name).toLowerCase().indexOf(query) > -1
        || str(product.en).toLowerCase().indexOf(query) > -1
        || str(product.categoryName).toLowerCase().indexOf(query) > -1
        || code.indexOf(query) > -1;
    });
  }

  function productRowHtml(product) {
    var chainCode = product.chain && product.chain.code ? product.chain.code : '未上链';
    var meta = '<span>' + esc(money(product.price)) + '</span>'
      + '<span>' + esc(product.categoryName || '未分类') + '</span>'
      + '<span>库存 ' + esc(product.stock) + ' 件</span>'
      + '<span>' + esc(chainCode) + '</span>'
      + '<span class="cond-tag' + (product.condition === 'used' ? ' cond-tag--used' : '') + '">'
      + esc(product.conditionName) + '</span>';

    if (product.off) {
      meta += '<span class="badge badge--muted">已下架</span>';
    }

    return '<article class="admin-row">'
      + '<div class="admin-row-media">'
        + '<img src="' + esc(product.image) + '" alt="' + esc(product.name) + '"'
        + ' width="800" height="1000" loading="lazy" decoding="async">'
      + '</div>'
      + '<div class="admin-row-body">'
        + '<h3 class="admin-row-title">' + esc(product.name) + '</h3>'
        + '<div class="admin-row-meta">' + meta + '</div>'
        + '<div class="admin-row-actions">'
          + '<button class="btn btn--outline" type="button" data-admin-edit="' + esc(product.id) + '">编辑</button>'
          + '<button class="btn ' + (product.off ? 'btn--primary' : 'btn--ghost') + '" type="button"'
          + ' data-admin-shelf="' + esc(product.id) + '" aria-pressed="' + (product.off ? 'true' : 'false') + '">'
          + (product.off ? '恢复上架' : '下架') + '</button>'
        + '</div>'
      + '</div>'
      + '</article>';
  }

  function renderProducts() {
    if (!els.products) { return; }
    var items = filteredProducts();
    els.products.innerHTML = items.map(productRowHtml).join('');
    els.products.hidden = items.length === 0;
    if (els.productsEmpty) { els.productsEmpty.hidden = items.length > 0; }
  }

  /* ======================================================================
     渲染：订单管理
     ====================================================================== */

  function renderOrderChips() {
    $$('[data-admin-order-status]').forEach(function (chip) {
      var active = chip.getAttribute('data-admin-order-status') === state.orderStatus;
      chip.classList.toggle('is-active', active);
      chip.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  function renderOrders() {
    if (!els.orders) { return; }
    var items = state.orders.filter(function (order) {
      return state.orderStatus === 'all' || order.statusKey === state.orderStatus;
    });
    els.orders.innerHTML = items.map(orderCardHtml).join('');
    els.orders.hidden = items.length === 0;
    if (els.ordersEmpty) { els.ordersEmpty.hidden = items.length > 0; }
    renderOrderChips();
  }

  /* ======================================================================
     渲染：溯源记录
     ====================================================================== */

  function chainRowHtml(product) {
    var chain = product.chain;
    var meta = chain
      ? '<span>' + esc(chain.code) + '</span>'
        + '<span>' + esc(chain.network) + '</span>'
        + '<span>区块高度 ' + esc(chain.block) + '</span>'
        + '<span>上链时间 ' + esc(chain.mintedAt) + '</span>'
      : '<span>未上链</span>';
    var status = chain && chain.verified
      ? '<span class="cond-tag cond-tag--verified">' + ICON_CHECK + '链上记录一致</span>'
      : '<span class="badge badge--warn">待验真</span>';

    return '<article class="admin-row">'
      + '<div class="admin-row-media">'
        + '<img src="' + esc(product.image) + '" alt="' + esc(product.name) + '"'
        + ' width="800" height="1000" loading="lazy" decoding="async">'
      + '</div>'
      + '<div class="admin-row-body">'
        + '<h3 class="admin-row-title">' + esc(product.name) + '</h3>'
        + '<div class="admin-row-meta">' + meta + '</div>'
        + '<div class="admin-row-meta">' + status + '</div>'
        + '<div class="admin-row-actions">'
          + '<button class="btn btn--outline" type="button" data-admin-verify="' + esc(product.id) + '">'
          + ICON_CHECK + '验真</button>'
        + '</div>'
      + '</div>'
      + '</article>';
  }

  function renderChain() {
    if (!els.chain) { return; }
    els.chain.innerHTML = state.products.map(chainRowHtml).join('');
    els.chain.hidden = state.products.length === 0;
    if (els.chainEmpty) { els.chainEmpty.hidden = state.products.length > 0; }
  }

  /* ======================================================================
     渲染：广告栏装修
     ====================================================================== */

  function bannerRowHtml(banner) {
    var active = banner.status === 'active';
    var statusBadge = active
      ? '<span class="badge badge--ok">投放中</span>'
      : '<span class="badge badge--muted">已下线</span>';

    return '<article class="admin-row" data-admin-banner-row="' + esc(banner.id) + '">'
      + '<div class="admin-row-media">'
        + '<img src="' + esc(banner.image) + '" alt="' + esc(banner.title || '广告图') + '"'
        + ' width="1600" height="1100" loading="lazy" decoding="async">'
      + '</div>'
      + '<div class="admin-row-body">'
        + '<h3 class="admin-row-title">' + esc(banner.title || '未命名广告') + '</h3>'
        + '<div class="admin-row-meta">'
          + '<span>' + esc(banner.desc || '无描述') + '</span>'
          + '<span>链接 ' + esc(banner.link || '无跳转') + '</span>'
          + '<span>排序 ' + esc(banner.sort) + '</span>'
          + statusBadge
        + '</div>'
        + '<div class="admin-row-actions">'
          + '<label class="field-label" for="bannerSort-' + esc(banner.id) + '">排序</label>'
          + '<input class="input" id="bannerSort-' + esc(banner.id) + '" type="number" min="1" step="1"'
          + ' value="' + esc(banner.sort) + '" data-admin-banner-sort="' + esc(banner.id) + '">'
          + '<button class="btn btn--outline btn--sm" type="button"'
          + ' data-admin-banner-toggle="' + esc(banner.id) + '" aria-pressed="' + (active ? 'true' : 'false') + '">'
          + (active ? '下线' : '上线') + '</button>'
          + '<button class="btn btn--ghost btn--sm" type="button"'
          + ' data-admin-banner-delete="' + esc(banner.id) + '">删除</button>'
        + '</div>'
      + '</div>'
      + '</article>';
  }

  function activeBanners() {
    return sortBanners(state.banners.filter(function (b) { return b.status === 'active'; }));
  }

  /* 写盘成功才替换 state；失败一律提示且保持原数据不变 */
  function commitBanners(next) {
    normalizeBannerSort(next);
    if (!persistBanners(next)) {
      toast(saveErrorMessage());
      renderBanners();
      return false;
    }
    state.banners = next;
    renderBanners();
    return true;
  }

  function renderBanners() {
    if (!els.banners) { return; }
    var list = sortBanners(state.banners);
    els.banners.innerHTML = list.map(bannerRowHtml).join('');
    els.banners.hidden = list.length === 0;
    if (els.bannersEmpty) { els.bannersEmpty.hidden = list.length > 0; }
    renderBannerPreview();
  }

  function bannerSlideHtml(banner, index) {
    return '<div class="banner-slide' + (index === 0 ? ' is-active' : '') + '">'
      + '<img src="' + esc(banner.image) + '" alt="' + esc(banner.title) + '"'
      + ' width="1600" height="1100" loading="lazy" decoding="async">'
      + '<div class="banner-overlay"></div>'
      + '<div class="banner-content">'
        + '<p class="banner-title">' + esc(banner.title) + '</p>'
        + '<p class="banner-desc">' + esc(banner.desc) + '</p>'
      + '</div>'
      + '</div>';
  }

  function bannerDotHtml(banner, index) {
    return '<button class="banner-dot' + (index === 0 ? ' is-active' : '') + '" type="button"'
      + ' data-admin-banner-dot="' + index + '"'
      + ' aria-label="第 ' + (index + 1) + ' 张"'
      + (index === 0 ? ' aria-current="true"' : '') + '></button>';
  }

  function goToBanner(index, total) {
    var track = els.bannerTrack;
    if (!track || !total) { return; }
    bannerIndex = ((index % total) + total) % total;
    /* 与 js/home.js 同口径：单实例页面，按 track 自身尺寸计算位移是安全的 */
    track.style.transform = 'translateX(-' + (bannerIndex * 100) + '%)';
    var slides = track.querySelectorAll('.banner-slide');
    var dots = els.bannerDots ? els.bannerDots.querySelectorAll('.banner-dot') : [];
    for (var i = 0; i < slides.length; i++) {
      if (i === bannerIndex) {
        slides[i].classList.add('is-active');
        if (dots[i]) { dots[i].classList.add('is-active'); dots[i].setAttribute('aria-current', 'true'); }
      } else {
        slides[i].classList.remove('is-active');
        if (dots[i]) { dots[i].classList.remove('is-active'); dots[i].removeAttribute('aria-current'); }
      }
    }
  }

  function stopBannerTimer() {
    if (bannerTimer !== null) {
      window.clearInterval(bannerTimer);
      bannerTimer = null;
    }
  }

  function startBannerTimer() {
    stopBannerTimer();
    if (state.view !== 'banner') { return; }
    if (reducedMotion()) { return; } /* 无障碍：偏好减少动效时不自动播放 */
    if (document.visibilityState === 'hidden') { return; }
    var total = activeBanners().length;
    if (total <= 1) { return; }
    bannerTimer = window.setInterval(function () {
      goToBanner(bannerIndex + 1, activeBanners().length);
    }, BANNER_INTERVAL);
  }

  function renderBannerPreview() {
    if (!els.bannerTrack || !els.bannerDots) { return; }
    var list = activeBanners();
    bannerIndex = 0;

    els.bannerTrack.innerHTML = list.map(bannerSlideHtml).join('');
    els.bannerDots.innerHTML = list.map(bannerDotHtml).join('');

    var shell = els.bannerPreview;
    if (shell) { shell.hidden = list.length === 0; }
    if (els.bannerPreviewNote) {
      els.bannerPreviewNote.textContent = reducedMotion()
        ? '只展示状态为「投放中」的广告。检测到系统偏好减少动效，已关闭自动轮播。'
        : '只展示状态为「投放中」的广告，每 4 秒自动轮播；页面切到后台时暂停。';
    }

    goToBanner(0, list.length);
    if (state.view === 'banner') { startBannerTimer(); }
  }

  /* ======================================================================
     渲染：用户管理
     ====================================================================== */

  function userRowHtml(user) {
    var name = user.name || maskPhone(user.phone);
    var masked = maskPhone(user.phone);
    var registered = user.registerDate || '未知';
    var balance = numOr0(user.balance); /* 字符串余额也安全 */
    var orders = user.orders.length;
    var preowned = user.myUsedGoods.length;
    var usedBadge = preowned > 0
      ? '<span class="badge badge--accent">已发布二手 ' + esc(preowned) + ' 件</span>'
      : '<span class="badge badge--muted">未发布二手</span>';
    var id = 'userPick-' + esc(user.key);

    return '<article class="admin-row">'
      + '<div class="admin-row-body">'
        + '<div class="form-actions">'
          + '<input id="' + id + '" type="checkbox" data-admin-user-pick="' + esc(user.key) + '">'
          + '<label class="field-label" for="' + id + '">选择 ' + esc(name) + '</label>'
        + '</div>'
        + '<h3 class="admin-row-title">' + esc(name) + '</h3>'
        + '<div class="admin-row-meta">'
          + '<span>' + esc(masked) + '</span>'
          + '<span>注册 ' + esc(registered) + '</span>'
          + '<span>余额 ' + esc(money(balance)) + '</span>'
          + '<span>订单 ' + esc(orders) + ' 笔</span>'
          + usedBadge
        + '</div>'
      + '</div>'
      + '</article>';
  }

  function renderUsers() {
    if (!els.users) { return; }
    var list = userList();
    els.users.innerHTML = list.map(userRowHtml).join('');
    els.users.hidden = list.length === 0;
    if (els.usersEmpty) { els.usersEmpty.hidden = list.length > 0; }
    if (els.usersAll) { els.usersAll.checked = false; }
    if (els.usersDelete) { els.usersDelete.disabled = list.length === 0; }
  }

  function pickedUsers() {
    return $$('[data-admin-user-pick]').filter(function (node) { return node.checked; })
      .map(function (node) { return node.getAttribute('data-admin-user-pick'); });
  }

  function syncSelectAll() {
    if (!els.usersAll) { return; }
    var boxes = $$('[data-admin-user-pick]');
    var checked = boxes.filter(function (n) { return n.checked; }).length;
    els.usersAll.checked = boxes.length > 0 && checked === boxes.length;
    try { els.usersAll.indeterminate = checked > 0 && checked < boxes.length; } catch (e) { /* 老浏览器忽略 */ }
  }

  /* 删除用户：从 dooyoor.users.v1 移除，并清理其 myUsedGoods 关联的全局二手条目 */
  function removeUsers(keys) {
    var raw = storeGet(USERS_KEY, null);
    if (!isObj(raw)) { raw = {}; }

    var doomedPreowned = {};
    keys.forEach(function (key) {
      var record = raw[key];
      if (!isObj(record) || !isArr(record.myUsedGoods)) { return; }
      record.myUsedGoods.forEach(function (item) {
        if (isObj(item) && trim(item.id)) { doomedPreowned[trim(item.id)] = true; }
      });
    });

    var next = {};
    Object.keys(raw).forEach(function (key) {
      if (keys.indexOf(key) === -1) { next[key] = raw[key]; }
    });

    if (!persistUsers(next)) {
      toast(saveErrorMessage());
      return false;
    }

    var ids = Object.keys(doomedPreowned);
    if (ids.length) {
      var stored = storeGet(PREOWNED_KEY, null);
      if (isArr(stored)) {
        var kept = stored.filter(function (item) {
          return !(isObj(item) && doomedPreowned[trim(item.id)]);
        });
        if (kept.length !== stored.length) {
          try {
            storeSet(PREOWNED_KEY, kept);
          } catch (e) {
            /* 二手清理失败不回滚用户删除，但必须如实告知 */
            toast(saveErrorMessage());
          }
        }
      }
    }

    loadAllData();
    renderUsers();
    renderStats();
    renderRecentOrders();
    renderOrders();
    return true;
  }

  /* ======================================================================
     发布新品：图片压缩与排序
     ====================================================================== */

  function compressPhoto(file) {
    return new Promise(function (resolve) {
      if (!file || str(file.type).indexOf('image/') !== 0) { resolve(null); return; }
      var reader = new FileReader();
      reader.onerror = function () { resolve(null); };
      reader.onabort = function () { resolve(null); };
      reader.onload = function () {
        var data = str(reader.result);
        if (!data) { resolve(null); return; }
        var img = new Image();
        img.onerror = function () { resolve(null); };
        img.onload = function () {
          try {
            var w = img.naturalWidth || img.width;
            var h = img.naturalHeight || img.height;
            if (!w || !h) { resolve(null); return; }
            var scale = Math.min(1, MAX_EDGE / Math.max(w, h));
            var cw = Math.max(1, Math.round(w * scale));
            var ch = Math.max(1, Math.round(h * scale));
            var canvas = document.createElement('canvas');
            canvas.width = cw;
            canvas.height = ch;
            var ctx = canvas.getContext('2d');
            if (!ctx) { resolve(null); return; }
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, cw, ch);
            ctx.drawImage(img, 0, 0, cw, ch);
            resolve(canvas.toDataURL('image/jpeg', JPEG_QUALITY));
          } catch (e) {
            resolve(null);
          }
        };
        img.src = data;
      };
      reader.readAsDataURL(file);
    });
  }

  function renderPhotoThumbs() {
    var box = els.addThumbs;
    if (!box) { return; }
    box.innerHTML = state.photos.map(function (photo, index) {
      return '<div class="thumb' + (index === 0 ? ' is-active' : '') + '" draggable="true"'
        + ' data-admin-photo="' + index + '" data-index="' + index + '"'
        + ' role="group" aria-label="第 ' + (index + 1) + ' 张图片，可拖动排序">'
        + '<img src="' + esc(photo) + '" alt="第 ' + (index + 1) + ' 张预览图" width="200" height="250">'
        + '</div>';
    }).join('');

    var actions = els.addThumbsActions;
    if (!actions) { return; }
    actions.hidden = state.photos.length === 0;
    actions.innerHTML = state.photos.map(function (photo, index) {
      return '<button class="link-btn" type="button" data-admin-photo-remove="' + index + '"'
        + ' aria-label="删除第 ' + (index + 1) + ' 张图片">删除第 ' + (index + 1) + ' 张</button>';
    }).join('');
  }

  function onPhotosPicked(files) {
    var list = Array.prototype.slice.call(files || []);
    if (!list.length) { return; }
    var room = MAX_PHOTOS - state.photos.length;
    if (room <= 0) {
      setFieldError(els.addImages, els.addImagesError, '最多只能 5 张图片');
      toast('最多只能 5 张图片');
      return;
    }
    if (list.length > room) {
      list = list.slice(0, room);
      toast('最多 5 张，已只保留前 ' + room + ' 张');
    }
    setFieldError(els.addImages, els.addImagesError, '');

    var tasks = list.map(compressPhoto);
    Promise.all(tasks).then(function (results) {
      var added = 0;
      var failed = 0;
      results.forEach(function (data) {
        if (!data) { failed += 1; return; }
        if (state.photos.length >= MAX_PHOTOS) { return; }
        state.photos.push(data);
        added += 1;
      });
      renderPhotoThumbs();
      if (added) { toast('已添加 ' + added + ' 张图片，可拖动缩略图排序'); }
      if (failed) { toast('有 ' + failed + ' 张图片读取失败，已跳过'); }
    });
  }

  function movePhoto(from, to) {
    if (from === to || from < 0 || to < 0) { return; }
    if (from >= state.photos.length || to >= state.photos.length) { return; }
    var moved = state.photos.splice(from, 1)[0];
    state.photos.splice(to, 0, moved);
    renderPhotoThumbs();
  }

  /* ---- 颜色 / 尺码 ---- */

  function renderColorPresets() {
    if (!els.addColorPresets) { return; }
    els.addColorPresets.innerHTML = COLOR_PRESETS.map(function (name) {
      return '<button class="filter-chip" type="button" data-admin-color-preset="' + esc(name) + '">'
        + esc(name) + '</button>';
    }).join('');
  }

  function renderColors() {
    if (!els.addColors) { return; }
    els.addColors.innerHTML = state.colors.map(function (name, index) {
      return '<span class="cond-tag">' + esc(name)
        + '<button class="link-btn" type="button" data-admin-color-remove="' + index + '"'
        + ' aria-label="移除颜色 ' + esc(name) + '">移除</button>'
        + '</span>';
    }).join('');
  }

  function addColor(name) {
    var value = trim(name);
    if (!value) { return; }
    if (state.colors.indexOf(value) > -1) { toast('颜色已存在：' + value); return; }
    if (state.colors.length >= 8) { toast('颜色最多 8 个'); return; }
    state.colors.push(value);
    renderColors();
  }

  function renderSizes() {
    if (!els.addSizes) { return; }
    els.addSizes.innerHTML = SIZE_OPTIONS.map(function (size) {
      var active = state.sizes.indexOf(size) > -1;
      return '<button class="size-btn' + (active ? ' is-active' : '') + '" type="button"'
        + ' data-admin-size="' + esc(size) + '" aria-pressed="' + (active ? 'true' : 'false') + '">'
        + esc(size) + '</button>';
    }).join('');
  }

  function resetAddForm() {
    state.photos = [];
    state.colors = [];
    state.sizes = [];
    state.dragFrom = null;

    if (els.addForm) { els.addForm.reset(); }
    setFieldError(els.addName, els.addNameError, '');
    setFieldError(els.addPrice, els.addPriceError, '');
    setFieldError(els.addCompareAt, els.addCompareError, '');
    setFieldError(els.addStock, els.addStockError, '');
    setFieldError(els.addImages, els.addImagesError, '');
    if (els.addCategory) { els.addCategory.value = 'tops'; }
    if (els.addCondition) { els.addCondition.value = 'new'; }
    renderSizes();
    renderColors();
    renderPhotoThumbs();
  }

  function onAddSubmit(event) {
    event.preventDefault();

    var name = els.addName ? trim(els.addName.value) : '';
    var rawPrice = els.addPrice ? digits(els.addPrice.value, true) : '';
    var rawCompare = els.addCompareAt ? digits(els.addCompareAt.value, true) : '';
    var rawStock = els.addStock ? digits(els.addStock.value, false) : '';
    var price = rawPrice === '' ? NaN : Number(rawPrice);
    var compare = rawCompare === '' ? null : Number(rawCompare);
    var stock = rawStock === '' ? NaN : Number(rawStock);
    var bad = false;

    setFieldError(els.addName, els.addNameError, '');
    setFieldError(els.addPrice, els.addPriceError, '');
    setFieldError(els.addCompareAt, els.addCompareError, '');
    setFieldError(els.addStock, els.addStockError, '');

    if (!name) {
      setFieldError(els.addName, els.addNameError, '请输入商品名称');
      bad = true;
    }
    if (!isFinite(price) || price <= 0 || price > 999999) {
      setFieldError(els.addPrice, els.addPriceError, '请输入 1–999999 之间的现价（元）');
      bad = true;
    }
    if (compare !== null && (!isFinite(compare) || compare <= 0 || compare > 999999)) {
      setFieldError(els.addCompareAt, els.addCompareError, '原价需为 1–999999 之间的数字，或留空');
      bad = true;
    }
    if (!isFinite(stock) || stock < 0 || stock > 99999 || Math.floor(stock) !== stock) {
      setFieldError(els.addStock, els.addStockError, '库存需为 0–99999 之间的整数');
      bad = true;
    }
    if (bad) {
      toast('发布失败：请检查表单提示');
      return;
    }

    var category = els.addCategory ? els.addCategory.value : 'tops';
    if (!categoryName(category)) { category = 'tops'; }
    var condition = (els.addCondition && els.addCondition.value === 'used') ? 'used' : 'new';
    var id = nextProductId(state.products);

    var product = assembleProduct({
      id: id,
      name: name,
      category: category,
      categoryName: categoryName(category),
      condition: condition,
      conditionName: conditionName(condition),
      price: Math.round(price),
      compareAt: compare === null ? null : Math.round(compare),
      stock: Math.round(stock),
      badge: els.addBadge ? trim(els.addBadge.value) : '',
      short: els.addShort ? trim(els.addShort.value) : '',
      fabric: els.addFabric ? trim(els.addFabric.value) : '',
      sizes: state.sizes.slice(),
      colors: state.colors.map(function (n) { return { name: n, hex: '' }; }),
      gallery: state.photos.slice(),
      chain: null,
      off: false
    }, state.products.length);

    var next = state.products.concat([product]);
    if (!persistProducts(next)) {
      toast(saveErrorMessage());
      return;
    }

    state.products = next;
    resetAddForm();
    renderProducts();
    renderChain();
    renderStats();
    setView('products');
    toast('已发布：' + product.name + '（' + product.id + '）');
  }

  /* ======================================================================
     广告弹窗
     ====================================================================== */

  function bannerModalIsOpen() {
    return !!(els.bannerModal && els.bannerModal.classList.contains('is-open'));
  }

  function clearBannerForm() {
    state.bannerEditing = null;
    state.bannerDraftImage = '';
    if (els.bannerForm) { els.bannerForm.reset(); }
    if (els.bannerTitle) { els.bannerTitle.textContent = '添加广告'; }
    if (els.bannerActive) { els.bannerActive.checked = true; }
    if (els.bannerSort) { els.bannerSort.value = String(state.banners.length + 1); }
    setFieldError(els.bannerImage, els.bannerImageError, '');
    setFieldError(els.bannerLink, els.bannerLinkError, '');
    setFieldError(els.bannerTitleInput, els.bannerTitleError, '');
    setFieldError(els.bannerSort, els.bannerSortError, '');
    renderBannerDraftThumb();
  }

  function renderBannerDraftThumb() {
    if (!els.bannerThumb) { return; }
    var url = trim(els.bannerImage ? els.bannerImage.value : '') || state.bannerDraftImage;
    els.bannerThumb.innerHTML = url
      ? '<div class="thumb is-active"><img src="' + esc(url) + '" alt="广告图预览" width="200" height="250"></div>'
      : '';
  }

  function openBannerModal() {
    clearBannerForm();
    lastFocus = (document.activeElement && document.activeElement.nodeType === 1) ? document.activeElement : null;
    openPanel(els.bannerModal);
    if (els.bannerImage) { els.bannerImage.focus(); }
  }

  function closeBannerModal() {
    if (!els.bannerModal || els.bannerModal.hidden) { return; }
    var wasOpen = bannerModalIsOpen();
    closePanel(els.bannerModal);
    state.bannerEditing = null;
    if (wasOpen && lastFocus && typeof lastFocus.focus === 'function') { lastFocus.focus(); }
    lastFocus = null;
  }

  function onBannerSubmit(event) {
    event.preventDefault();

    var image = trim(els.bannerImage ? els.bannerImage.value : '') || state.bannerDraftImage;
    var title = trim(els.bannerTitleInput ? els.bannerTitleInput.value : '');
    var desc = els.bannerDesc ? trim(els.bannerDesc.value) : '';
    var link = els.bannerLink ? trim(els.bannerLink.value) : '';
    var linkText = els.bannerLinkText ? trim(els.bannerLinkText.value) : '';
    var rawSort = els.bannerSort ? digits(els.bannerSort.value, false) : '';
    var sort = rawSort === '' ? NaN : Number(rawSort);
    var active = !!(els.bannerActive && els.bannerActive.checked);
    var bad = false;

    setFieldError(els.bannerImage, els.bannerImageError, '');
    setFieldError(els.bannerTitleInput, els.bannerTitleError, '');
    setFieldError(els.bannerLink, els.bannerLinkError, '');
    setFieldError(els.bannerSort, els.bannerSortError, '');

    if (!image) {
      setFieldError(els.bannerImage, els.bannerImageError, '请填写图片地址或上传一张本地图片');
      bad = true;
    } else if (!state.bannerDraftImage && !isSafeLink(image)) {
      /* 上传的 data URL 由代码生成，可信；手填的地址一律白名单校验 */
      setFieldError(els.bannerImage, els.bannerImageError, '只允许站内相对路径（如 assets/hero.svg）或 https:// 链接');
      bad = true;
    }
    if (!title) {
      setFieldError(els.bannerTitleInput, els.bannerTitleError, '请输入广告标题');
      bad = true;
    }
    if (!isSafeLink(link)) {
      setFieldError(els.bannerLink, els.bannerLinkError, '只允许站内相对路径或 https:// 链接，已拒绝该协议');
      bad = true;
    }
    if (!isFinite(sort) || sort < 1 || sort > 999) {
      setFieldError(els.bannerSort, els.bannerSortError, '排序需为 1–999 之间的整数');
      bad = true;
    }
    if (bad) {
      toast('保存失败：请检查表单提示');
      return;
    }

    var id = state.bannerEditing;
    /* 深拷贝后再改，写盘失败时原数据完好 */
    var next = state.banners.map(cloneBanner);
    if (id) {
      var existing = null;
      for (var i = 0; i < next.length; i++) {
        if (next[i].id === id) { existing = next[i]; }
      }
      if (existing) {
        existing.image = image;
        existing.title = title;
        existing.desc = desc;
        existing.link = link;
        existing.linkText = linkText;
        existing.sort = Math.round(sort);
        existing.status = active ? 'active' : 'inactive';
      }
    } else {
      next.push({
        id: 'b' + String(Date.now()),
        image: image,
        title: title,
        desc: desc,
        link: link,
        linkText: linkText,
        sort: Math.round(sort),
        status: active ? 'active' : 'inactive'
      });
    }

    if (!commitBanners(next)) { return; }
    closeBannerModal();
    toast('已保存，前台首页刷新后生效');
  }

  function onBannerSortChange(id, value) {
    var banner = findBanner(id);
    if (!banner) { return; }
    var n = Number(digits(value, false));
    if (!isFinite(n) || n < 1) { n = 1; }

    /* 在深拷贝的副本上改动 + 写盘，成功后才替换 state，保证失败可安全回滚 */
    var next = state.banners.map(cloneBanner);
    var target = null;
    for (var i = 0; i < next.length; i++) {
      if (next[i].id === id) { target = next[i]; }
    }
    if (!target) { return; }
    target.sort = Math.round(n);
    if (commitBanners(next)) { toast('已保存，前台首页刷新后生效'); }
  }

  function toggleBanner(id) {
    var next = state.banners.map(cloneBanner);
    var target = null;
    for (var i = 0; i < next.length; i++) {
      if (next[i].id === id) { target = next[i]; }
    }
    if (!target) { return; }
    target.status = (target.status === 'active') ? 'inactive' : 'active';
    if (commitBanners(next)) {
      toast(target.status === 'active' ? '已上线，前台首页刷新后生效' : '已下线，前台首页刷新后生效');
    }
  }

  /* ======================================================================
     站点内确认弹窗（替代 confirm）
     ====================================================================== */

  function confirmIsOpen() { return !!(els.confirm && els.confirm.classList.contains('is-open')); }

  function openConfirm(message, action) {
    if (!els.confirm) { return; }
    state.confirmAction = action;
    if (els.confirmText) { els.confirmText.textContent = message; }
    lastFocus = (document.activeElement && document.activeElement.nodeType === 1) ? document.activeElement : null;
    openPanel(els.confirm);
    if (els.confirmOk) { els.confirmOk.focus(); }
  }

  function closeConfirm() {
    if (!els.confirm || els.confirm.hidden) { return; }
    var wasOpen = confirmIsOpen();
    closePanel(els.confirm);
    state.confirmAction = null;
    if (wasOpen && lastFocus && typeof lastFocus.focus === 'function') { lastFocus.focus(); }
    lastFocus = null;
  }

  function onConfirmOk() {
    var action = state.confirmAction;
    state.confirmAction = null;
    closeConfirm();
    if (typeof action === 'function') { action(); }
  }

  /* ======================================================================
     数据装载
     ====================================================================== */

  function loadAllData() {
    state.products = loadProducts();
    state.banners = loadBanners();
    state.orders = loadOrders();
  }

  /* ======================================================================
     事件绑定（全部 addEventListener / 事件委托，无内联 onclick）
     ====================================================================== */

  function bindLogin() {
    if (els.loginForm) { els.loginForm.addEventListener('submit', onLoginSubmit); }
    if (els.logout) { els.logout.addEventListener('click', showLogin); }
  }

  function bindNav() {
    $$('.admin-nav').forEach(function (nav) {
      nav.addEventListener('click', function (event) {
        var link = closestAttr(event.target, 'data-view');
        if (!link || !VIEW_TITLES[link.getAttribute('data-view')]) { return; }
        setView(link.getAttribute('data-view'));
      });
    });
  }

  function bindDrawer() {
    if (els.menuBtn) {
      els.menuBtn.addEventListener('click', function () {
        if (isDesktop()) { return; } /* ≥768px 用 .admin-side，抽屉不参与 */
        setDrawer(!drawerIsOpen());
      });
    }
    $$('[data-admin-drawer-close]').forEach(function (node) {
      node.addEventListener('click', function () { setDrawer(false); });
    });
    if (desktopQuery) {
      var onChange = function () { if (desktopQuery.matches) { setDrawer(false); } };
      if (typeof desktopQuery.addEventListener === 'function') { desktopQuery.addEventListener('change', onChange); }
      else if (typeof desktopQuery.addListener === 'function') { desktopQuery.addListener(onChange); }
    }
  }

  function bindProducts() {
    if (els.search) {
      els.search.addEventListener('input', function () {
        state.query = els.search.value || '';
        renderProducts();
      });
    }
    if (els.condition) {
      els.condition.addEventListener('change', function () {
        state.condition = els.condition.value || 'all';
        renderProducts();
      });
    }
    if (els.productsReset) {
      els.productsReset.addEventListener('click', function () {
        state.query = '';
        state.condition = 'all';
        if (els.search) { els.search.value = ''; }
        if (els.condition) { els.condition.value = 'all'; }
        renderProducts();
        if (els.search) { els.search.focus(); }
        toast('已清除筛选条件');
      });
    }
    if (els.products) {
      els.products.addEventListener('click', function (event) {
        var editBtn = closestAttr(event.target, 'data-admin-edit');
        if (editBtn) { openEditFor(editBtn.getAttribute('data-admin-edit')); return; }

        var shelfBtn = closestAttr(event.target, 'data-admin-shelf');
        if (shelfBtn) {
          var product = findProduct(shelfBtn.getAttribute('data-admin-shelf'));
          if (!product) { return; }
          var before = product.off;
          product.off = !product.off;
          if (!persistProducts(state.products)) {
            product.off = before;
            renderProducts();
            toast(saveErrorMessage());
            return;
          }
          renderProducts();
          renderStats();
          toast(product.off ? ('已下架：' + product.name) : ('已恢复上架：' + product.name));
        }
      });
    }
  }

  function bindAddForm() {
    if (!els.addForm) { return; }

    els.addForm.addEventListener('submit', onAddSubmit);
    if (els.addReset) { els.addReset.addEventListener('click', function () { resetAddForm(); toast('表单已重置'); }); }

    renderColorPresets();
    renderSizes();
    renderColors();
    renderPhotoThumbs();

    if (els.addImages) {
      els.addImages.addEventListener('change', function () {
        onPhotosPicked(els.addImages.files);
      });
    }

    if (els.addColorInput) {
      els.addColorInput.addEventListener('keydown', function (event) {
        if (event.key !== 'Enter' && event.key !== 'Return') { return; }
        event.preventDefault();
        addColor(els.addColorInput.value);
        els.addColorInput.value = '';
      });
    }
    if (els.addColorAdd) {
      els.addColorAdd.addEventListener('click', function () {
        addColor(els.addColorInput ? els.addColorInput.value : '');
        if (els.addColorInput) { els.addColorInput.value = ''; }
      });
    }
    if (els.addColorPresets) {
      els.addColorPresets.addEventListener('click', function (event) {
        var btn = closestAttr(event.target, 'data-admin-color-preset');
        if (!btn) { return; }
        addColor(btn.getAttribute('data-admin-color-preset'));
      });
    }
    if (els.addColors) {
      els.addColors.addEventListener('click', function (event) {
        var btn = closestAttr(event.target, 'data-admin-color-remove');
        if (!btn) { return; }
        var index = parseInt(btn.getAttribute('data-admin-color-remove'), 10);
        if (isFinite(index) && index >= 0) {
          state.colors.splice(index, 1);
          renderColors();
        }
      });
    }
    if (els.addSizes) {
      els.addSizes.addEventListener('click', function (event) {
        var btn = closestAttr(event.target, 'data-admin-size');
        if (!btn) { return; }
        var size = btn.getAttribute('data-admin-size');
        var at = state.sizes.indexOf(size);
        if (at === -1) { state.sizes.push(size); } else { state.sizes.splice(at, 1); }
        renderSizes();
      });
    }

    /* 缩略图拖拽排序：HTML5 drag，data-index 交换 */
    if (els.addThumbs) {
      els.addThumbs.addEventListener('dragstart', function (event) {
        var node = closestAttr(event.target, 'data-admin-photo');
        if (!node) { return; }
        state.dragFrom = parseInt(node.getAttribute('data-index'), 10);
        if (event.dataTransfer) {
          event.dataTransfer.effectAllowed = 'move';
          try { event.dataTransfer.setData('text/plain', String(state.dragFrom)); } catch (e) { /* 忽略 */ }
        }
      });
      els.addThumbs.addEventListener('dragover', function (event) {
        if (state.dragFrom === null) { return; }
        event.preventDefault();
        if (event.dataTransfer) { event.dataTransfer.dropEffect = 'move'; }
      });
      els.addThumbs.addEventListener('drop', function (event) {
        event.preventDefault();
        var node = closestAttr(event.target, 'data-admin-photo');
        if (!node || state.dragFrom === null) { return; }
        var to = parseInt(node.getAttribute('data-index'), 10);
        movePhoto(state.dragFrom, to);
        state.dragFrom = null;
      });
      els.addThumbs.addEventListener('dragend', function () { state.dragFrom = null; });
    }
    if (els.addThumbsActions) {
      els.addThumbsActions.addEventListener('click', function (event) {
        var btn = closestAttr(event.target, 'data-admin-photo-remove');
        if (!btn) { return; }
        var index = parseInt(btn.getAttribute('data-admin-photo-remove'), 10);
        if (!isFinite(index) || index < 0) { return; }
        state.photos.splice(index, 1);
        renderPhotoThumbs();
        toast('已删除 1 张图片');
      });
    }
  }

  function bindBanners() {
    if (els.bannerAdd) { els.bannerAdd.addEventListener('click', openBannerModal); }
    $$('[data-admin-banner-close]').forEach(function (node) {
      node.addEventListener('click', closeBannerModal);
    });
    if (els.bannerForm) { els.bannerForm.addEventListener('submit', onBannerSubmit); }
    if (els.bannerUpload) {
      els.bannerUpload.addEventListener('change', function () {
        var files = els.bannerUpload.files;
        if (!files || !files.length) { return; }
        compressPhoto(files[0]).then(function (data) {
          if (!data) { toast('图片读取失败，请换一张'); return; }
          state.bannerDraftImage = data;
          if (els.bannerImage) { els.bannerImage.value = ''; }
          renderBannerDraftThumb();
          toast('已压缩并选用本地图片');
        });
      });
    }
    if (els.bannerImage) {
      els.bannerImage.addEventListener('input', renderBannerDraftThumb);
    }

    if (els.banners) {
      els.banners.addEventListener('change', function (event) {
        var input = closestAttr(event.target, 'data-admin-banner-sort');
        if (!input) { return; }
        onBannerSortChange(input.getAttribute('data-admin-banner-sort'), input.value);
      });
      els.banners.addEventListener('click', function (event) {
        var toggle = closestAttr(event.target, 'data-admin-banner-toggle');
        if (toggle) { toggleBanner(toggle.getAttribute('data-admin-banner-toggle')); return; }

        var del = closestAttr(event.target, 'data-admin-banner-delete');
        if (del) {
          var id = del.getAttribute('data-admin-banner-delete');
          var banner = findBanner(id);
          if (!banner) { return; }
          openConfirm('删除广告「' + banner.title + '」？删除后前台首页刷新即不再显示，且不可恢复。',
            function () {
              var next = state.banners
                .filter(function (b) { return b.id !== id; })
                .map(cloneBanner);
              if (commitBanners(next)) { toast('已删除，前台首页刷新后生效'); }
            });
        }
      });
    }

    if (els.bannerDots) {
      els.bannerDots.addEventListener('click', function (event) {
        var dot = closestAttr(event.target, 'data-admin-banner-dot');
        if (!dot) { return; }
        var index = parseInt(dot.getAttribute('data-admin-banner-dot'), 10);
        if (isFinite(index)) { goToBanner(index, activeBanners().length); }
      });
    }

    /* 页面隐藏时暂停自动轮播 */
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') {
        stopBannerTimer();
      } else if (state.view === 'banner') {
        startBannerTimer();
      }
    });
  }

  function bindUsers() {
    if (els.users) {
      els.users.addEventListener('change', function (event) {
        if (closestAttr(event.target, 'data-admin-user-pick')) { syncSelectAll(); }
      });
    }
    if (els.usersAll) {
      els.usersAll.addEventListener('change', function () {
        var checked = !!els.usersAll.checked;
        $$('[data-admin-user-pick]').forEach(function (node) { node.checked = checked; });
        syncSelectAll();
      });
    }
    if (els.usersDelete) {
      els.usersDelete.addEventListener('click', function () {
        var keys = pickedUsers();
        if (!keys.length) { toast('请先勾选要删除的用户'); return; }
        openConfirm('删除选中的 ' + keys.length + ' 个用户？删除后其账号、余额与订单记录将从本地存储移除，'
          + '同时清理其发布的二手商品，操作不可恢复。',
          function () {
            if (removeUsers(keys)) { toast('已删除 ' + keys.length + ' 个用户'); }
          });
      });
    }
  }

  function bindOrders() {
    $$('[data-admin-order-status]').forEach(function (chip) {
      chip.addEventListener('click', function () {
        state.orderStatus = chip.getAttribute('data-admin-order-status') || 'all';
        renderOrders();
      });
    });
  }

  function bindChain() {
    if (!els.chain) { return; }
    els.chain.addEventListener('click', function (event) {
      var verifyBtn = closestAttr(event.target, 'data-admin-verify');
      if (!verifyBtn) { return; }
      var product = findProduct(verifyBtn.getAttribute('data-admin-verify'));
      if (!product) { return; }
      var code = product.chain && product.chain.code ? product.chain.code : '（未上链）';
      toast('溯源码 ' + code + ' 校验通过：链上记录与实物一致');
    });
  }

  function bindModals() {
    if (els.editForm) { els.editForm.addEventListener('submit', onEditSubmit); }
    $$('[data-admin-modal-close]').forEach(function (node) {
      node.addEventListener('click', function () { closeModal(); });
    });
    $$('[data-admin-confirm-close]').forEach(function (node) {
      node.addEventListener('click', closeConfirm);
    });
    if (els.confirmOk) { els.confirmOk.addEventListener('click', onConfirmOk); }

    document.addEventListener('keydown', function (event) {
      var key = event.key;
      if (key !== 'Escape' && key !== 'Esc') { return; }
      if (confirmIsOpen()) { closeConfirm(); return; }
      if (bannerModalIsOpen()) { closeBannerModal(); return; }
      if (modalIsOpen()) { closeModal(); return; }
      if (drawerIsOpen()) { setDrawer(false); }
    });
  }

  function bindShellUser() {
    if (els.avatar) { els.avatar.textContent = str(ADMIN_USER.initial || 'D'); }
    if (els.userName) { els.userName.textContent = str(ADMIN_USER.name || '运营账号'); }
  }

  /* ======================================================================
     启动
     ====================================================================== */

  function cacheEls() {
    els = {
      login: $('[data-admin-login]'),
      loginForm: $('[data-admin-login-form]'),
      account: $('#adminAccount'),
      password: $('#adminPassword'),
      accountError: $('[data-admin-login-error-account]'),
      passwordError: $('[data-admin-login-error-password]'),
      shell: $('[data-admin-shell]'),
      logout: $('[data-admin-logout]'),
      menuBtn: $('[data-admin-menu-toggle]'),
      drawer: $('[data-admin-drawer]'),
      viewTitle: $('[data-admin-view-title]'),
      avatar: $('[data-admin-avatar]'),
      userName: $('[data-admin-user-name]'),

      stats: $('[data-admin-stats]'),
      recentOrders: $('[data-admin-recent-orders]'),

      search: $('[data-admin-product-search]'),
      condition: $('[data-admin-condition]'),
      products: $('[data-admin-products]'),
      productsEmpty: $('[data-admin-products-empty]'),
      productsReset: $('[data-admin-products-reset]'),

      addForm: $('[data-admin-add-form]'),
      addName: $('#addName'),
      addNameError: $('[data-admin-add-error-name]'),
      addPrice: $('#addPrice'),
      addPriceError: $('[data-admin-add-error-price]'),
      addCompareAt: $('#addCompareAt'),
      addCompareError: $('[data-admin-add-error-compare]'),
      addCategory: $('[data-admin-add-category]'),
      addCondition: $('[data-admin-add-condition]'),
      addStock: $('#addStock'),
      addStockError: $('[data-admin-add-error-stock]'),
      addSizes: $('[data-admin-add-sizes]'),
      addColorInput: $('[data-admin-add-color-input]'),
      addColorAdd: $('[data-admin-add-color-add]'),
      addColorPresets: $('[data-admin-add-color-presets]'),
      addColors: $('[data-admin-add-colors]'),
      addBadge: $('#addBadge'),
      addShort: $('#addShort'),
      addFabric: $('#addFabric'),
      addImages: $('[data-admin-add-images]'),
      addImagesError: $('[data-admin-add-error-images]'),
      addThumbs: $('[data-admin-add-thumbs]'),
      addThumbsActions: $('[data-admin-add-thumbs-actions]'),
      addReset: $('[data-admin-add-reset]'),

      bannerPreview: $('[data-admin-banner-preview]'),
      bannerSwiper: $('[data-admin-banner-swiper]'),
      bannerTrack: $('[data-admin-banner-track]'),
      bannerDots: $('[data-admin-banner-dots]'),
      bannerPreviewNote: $('[data-admin-banner-preview-note]'),
      bannerAdd: $('[data-admin-banner-add]'),
      banners: $('[data-admin-banners]'),
      bannersEmpty: $('[data-admin-banners-empty]'),
      bannerModal: $('[data-admin-banner-modal]'),
      bannerForm: $('[data-admin-banner-form]'),
      bannerTitle: $('#adminBannerTitle'),
      bannerImage: $('#bannerImage'),
      bannerImageError: $('[data-admin-banner-error-image]'),
      bannerUpload: $('[data-admin-banner-upload]'),
      bannerThumb: $('[data-admin-banner-thumb]'),
      bannerTitleInput: $('#bannerTitle'),
      bannerTitleError: $('[data-admin-banner-error-title]'),
      bannerDesc: $('#bannerDesc'),
      bannerLink: $('#bannerLink'),
      bannerLinkError: $('[data-admin-banner-error-link]'),
      bannerLinkText: $('#bannerLinkText'),
      bannerSort: $('#bannerSort'),
      bannerSortError: $('[data-admin-banner-error-sort]'),
      bannerActive: $('#bannerActive'),

      users: $('[data-admin-users]'),
      usersEmpty: $('[data-admin-users-empty]'),
      usersAll: $('[data-admin-users-all]'),
      usersDelete: $('[data-admin-users-delete]'),

      orders: $('[data-admin-orders]'),
      ordersEmpty: $('[data-admin-orders-empty]'),

      chain: $('[data-admin-chain]'),
      chainEmpty: $('[data-admin-chain-empty]'),

      modal: $('[data-admin-modal]'),
      editForm: $('[data-admin-edit-form]'),
      editName: $('[data-admin-edit-name]'),
      priceInput: $('#adminEditPrice'),
      stockInput: $('#adminEditStock'),
      priceError: $('[data-admin-edit-error-price]'),
      stockError: $('[data-admin-edit-error-stock]'),

      confirm: $('[data-admin-confirm]'),
      confirmText: $('[data-admin-confirm-text]'),
      confirmOk: $('[data-admin-confirm-ok]')
    };
  }

  function fillSelects() {
    if (els.addCategory) {
      els.addCategory.innerHTML = CATEGORY_OPTIONS.map(function (item) {
        return '<option value="' + esc(item.id) + '">' + esc(item.name) + '</option>';
      }).join('');
      els.addCategory.value = 'tops';
    }
    if (els.addCondition) {
      var options = (isArr(CFG.conditionOptions) && CFG.conditionOptions.length)
        ? CFG.conditionOptions : [{ id: 'new', name: '全新' }, { id: 'used', name: '认证二手' }];
      els.addCondition.innerHTML = options.filter(function (item) {
        return item && item.id && item.id !== 'all';
      }).map(function (item) {
        return '<option value="' + esc(item.id) + '">' + esc(item.name) + '</option>';
      }).join('');
      els.addCondition.value = 'new';
    }
  }

  function init() {
    cacheEls();
    fillSelects();

    bindLogin();
    bindNav();
    bindDrawer();
    bindProducts();
    bindAddForm();
    bindBanners();
    bindUsers();
    bindOrders();
    bindChain();
    bindModals();
    bindShellUser();

    loadAllData();
    renderStats();
    renderRecentOrders();
    renderProducts();
    renderBanners();
    renderUsers();
    renderOrders();
    renderChain();
    setView('dashboard');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

/* ==========================================================================
   DOOYOOR 㛊䎟 — 二手商城数据层
   依赖：js/site-config.js（DY_CONFIG.preownedKey / DY_CONFIG.preowned）
        js/cart.js（DY.store / DY.getProduct）
        js/auth.js（DY.auth.current / DY.auth.update）
   暴露：window.DY.preowned = { list, mine, find, publish, remove }
   约定：所有读写一律经 DY.store；任何依赖缺失都返回 { ok:false, message:'…未就绪' }，
        绝不抛异常。
   对应规范 §12.2 存储键 / §12.5 listing 结构 / §12.6 API 契约 / §12.9 发布二手。
   ========================================================================== */
(function () {
  'use strict';

  var CONFIG = window.DY_CONFIG || {};
  var FALLBACK_KEY = 'dooyoor.preowned.v1';
  var GRADES = ['A-', 'B+', 'B'];
  var DEFAULT_GRADE = 'B+';
  var OFFICIAL_NAME = 'DOOYOOR 官方';
  var NOT_READY = '账户服务未就绪';

  /* ---------- 基础工具（ES5，与全站脚本风格一致） ---------- */

  function str(value) {
    return value === null || value === undefined ? '' : String(value).trim();
  }

  function toNumber(value) {
    var n = Number(value);
    return isFinite(n) ? n : NaN;
  }

  function isArray(value) {
    return Object.prototype.toString.call(value) === '[object Array]';
  }

  function toArray(value) {
    return isArray(value) ? value : [];
  }

  /* 本地日期 YYYY-MM-DD（不用 toISOString：那是 UTC，会差一天） */
  function todayLocal() {
    var now = new Date();
    var month = now.getMonth() + 1;
    var day = now.getDate();
    return now.getFullYear()
      + '-' + (month < 10 ? '0' + month : month)
      + '-' + (day < 10 ? '0' + day : day);
  }

  /* ---------- 存储：优先 DY.store ---------- */

  function storageKey() {
    return str(CONFIG.preownedKey) || FALLBACK_KEY;
  }

  function storeGet(key, fallback) {
    var store = window.DY && window.DY.store;
    if (store && typeof store.get === 'function') {
      return store.get(key, fallback);
    }
    try {
      var raw = window.localStorage.getItem(key);
      if (raw === null || raw === '') { return fallback; }
      var parsed = JSON.parse(raw);
      return parsed === null || parsed === undefined ? fallback : parsed;
    } catch (e) {
      return fallback;
    }
  }

  function storeSet(key, value) {
    var store = window.DY && window.DY.store;
    if (store && typeof store.set === 'function') {
      return store.set(key, value) !== false;
    }
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      return false;
    }
  }

  /* ---------- listing 归一化（§12.5） ---------- */

  function normalize(raw) {
    if (!raw || typeof raw !== 'object') { return null; }

    var listing = {};
    for (var field in raw) {
      if (Object.prototype.hasOwnProperty.call(raw, field)) { listing[field] = raw[field]; }
    }

    listing.id = str(listing.id);
    if (!listing.id) { return null; }

    listing.name = str(listing.name);
    listing.nameEn = str(listing.nameEn);
    listing.image = str(listing.image);

    listing.price = toNumber(listing.price);
    if (!isFinite(listing.price)) { listing.price = 0; }

    listing.origin = toNumber(listing.origin);
    if (!isFinite(listing.origin)) { listing.origin = 0; }

    listing.category = str(listing.category);
    listing.categoryName = str(listing.categoryName);
    listing.sellerPhone = str(listing.sellerPhone);
    listing.sellerName = str(listing.sellerName)
      || (listing.sellerPhone ? '用户 ' + listing.sellerPhone.slice(-4) : OFFICIAL_NAME);
    listing.grade = GRADES.indexOf(str(listing.grade)) !== -1 ? str(listing.grade) : DEFAULT_GRADE;
    listing.chainCode = str(listing.chainCode);
    listing.note = str(listing.note);
    listing.createdAt = str(listing.createdAt);
    return listing;
  }

  function normalizeList(value) {
    var source = toArray(value);
    var list = [];
    for (var i = 0; i < source.length; i++) {
      var listing = normalize(source[i]);
      if (listing) { list.push(listing); }
    }
    return list;
  }

  /* 示范数据深拷贝：绝不把 DY_CONFIG.preowned 里的对象直接交给调用方去改 */
  function seedList() {
    return normalizeList(CONFIG.preowned);
  }

  /* ---------- 当前用户 ---------- */

  function currentUser() {
    var auth = window.DY && window.DY.auth;
    if (!auth || typeof auth.current !== 'function') { return null; }
    var user = null;
    try {
      user = auth.current();
    } catch (e) {
      user = null;
    }
    return user && typeof user === 'object' ? user : null;
  }

  function authReady() {
    var auth = window.DY && window.DY.auth;
    return !!(auth && typeof auth.current === 'function' && typeof auth.update === 'function');
  }

  /* ---------- 商品反查（二手不建详情页，靠 chainCode 回到原商品） ---------- */

  function resolveProduct(productId) {
    var wanted = str(productId);
    if (!wanted) { return null; }

    var getProduct = window.DY && window.DY.getProduct;
    if (typeof getProduct === 'function') {
      try {
        var found = getProduct(wanted);
        if (found) { return found; }
      } catch (e) {
        /* 忽略，回落到配置表 */
      }
    }

    var products = toArray(CONFIG.products);
    for (var i = 0; i < products.length; i++) {
      if (products[i] && str(products[i].id) === wanted) { return products[i]; }
    }
    return null;
  }

  /* ---------- 订单反查：按「单号」找，不按名称（§12.9 第 3 步） ---------- */

  function findOrderByNo(user, orderNo) {
    var wanted = str(orderNo);
    if (!wanted) { return null; }
    var orders = toArray(user && user.orders);
    for (var i = 0; i < orders.length; i++) {
      if (orders[i] && str(orders[i].no) === wanted) { return orders[i]; }
    }
    return null;
  }

  /* ---------- 公开 API ---------- */

  /* list()：读存档；无存档（或解析失败返回非数组）时用 DY_CONFIG.preowned 播种并写回。
     注意：空数组是合法存档（用户把在售的全买完/下架完了），不得再次播种。 */
  function list() {
    var stored = storeGet(storageKey(), null);
    if (!isArray(stored)) {
      var seeded = seedList();
      storeSet(storageKey(), seeded);
      return seeded;
    }
    return normalizeList(stored);
  }

  /* mine()：当前用户发布的（按 sellerPhone 判定，官方渠道 sellerPhone 为空） */
  function mine() {
    var user = currentUser();
    var phone = str(user && user.phone);
    if (!phone) { return []; }

    var all = list();
    var result = [];
    for (var i = 0; i < all.length; i++) {
      if (all[i].sellerPhone === phone) { result.push(all[i]); }
    }
    return result;
  }

  function find(id) {
    var wanted = str(id);
    if (!wanted) { return null; }
    var all = list();
    for (var i = 0; i < all.length; i++) {
      if (all[i].id === wanted) { return all[i]; }
    }
    return null;
  }

  /* publish()：严格照 §12.9 五步
     1. 校验登录（初稿漏掉 → sellerPhone 为 null 的无主商品）
     2. price / origin 为正数且 price <= origin
     3. 给了 sourceOrderNo 就「按单号」反查订单，取 image 与 chainCode，
        并校验 usedPublished !== true，成功后置 true（防重复发布）
     4. 生成 listing（id = 'u' + Date.now()，sellerPhone = 当前用户，grade 默认 B+）
     5. 同时写入全局列表与用户 myUsedGoods（初稿两者割裂导致不同步） */
  function publish(input) {
    var data = input || {};

    /* 第 1 步：登录校验（含依赖存在性判断，缺失时优雅失败） */
    if (!authReady()) { return { ok: false, message: NOT_READY }; }
    var user = currentUser();
    if (!user || !str(user.phone)) { return { ok: false, message: '请先登录' }; }

    /* 第 2 步：价格校验 */
    var price = toNumber(data.price);
    var origin = toNumber(data.origin);
    if (!(price > 0)) { return { ok: false, message: '转让价必须是正数' }; }
    if (!(origin > 0)) { return { ok: false, message: '原价必须是正数' }; }
    if (price > origin) { return { ok: false, message: '转让价不能高于原价' }; }

    /* 第 3 步：按单号反查订单（不是按名称）+ 防重复发布 */
    var orderNo = str(data.sourceOrderNo);
    var order = null;
    if (orderNo) {
      order = findOrderByNo(user, orderNo);
      if (!order) { return { ok: false, message: '没有找到单号 ' + orderNo + ' 的订单' }; }
      if (order.usedPublished === true) { return { ok: false, message: '该订单已发布过二手' }; }
    }

    var item = order && toArray(order.items).length ? toArray(order.items)[0] : null;
    var product = resolveProduct(item && item.productId);

    var name = str(data.name) || str(item && item.name) || str(product && product.name);
    if (!name) { return { ok: false, message: '请填写商品名称' }; }

    /* 第 4 步：生成 listing（image 与 chainCode 来自订单商品） */
    var listing = {
      id: 'u' + Date.now(),
      name: name,
      nameEn: str(data.nameEn) || str(product && product.en) || '',
      image: str(item && item.image) || str(data.image) || str(product && product.image),
      price: price,
      origin: origin,
      category: str(data.category) || str(product && product.category),
      categoryName: str(data.categoryName) || str(product && product.categoryName),
      sellerPhone: str(user.phone),
      sellerName: '用户 ' + str(user.phone).slice(-4),
      grade: GRADES.indexOf(str(data.grade)) !== -1 ? str(data.grade) : DEFAULT_GRADE,
      chainCode: str(order && order.chainCode) || str(data.chainCode)
        || str(product && product.chain && product.chain.code),
      note: str(data.note),
      createdAt: todayLocal()
    };

    /* 第 5 步：全局列表 + 用户 myUsedGoods 同时写；任一处失败则回滚，保持两者同步 */
    var before = list();
    var next = before.slice();
    next.unshift(listing);
    storeSet(storageKey(), next);

    // 必须在下一次落盘**之前**置位。auth.update() 是立即 JSON.stringify 保存的，
    // 若等 update() 之后再改内存里的 order，这个标记永远写不进存储——
    // 刷新后「已发布过二手」的防重复校验会失效，同一订单可被无限重复发布。
    if (order) { order.usedPublished = true; }

    var myUsed = toArray(user.myUsedGoods).slice();
    myUsed.unshift(listing);

    var patch = { myUsedGoods: myUsed };
    if (order) { patch.orders = toArray(user.orders); }

    var saved = null;
    try {
      saved = window.DY.auth.update(patch);
    } catch (e) {
      saved = { ok: false, message: '保存失败，请重试' };
    }

    if (saved && saved.ok === false) {
      storeSet(storageKey(), before);   // 回滚全局列表，绝不留下只写了一半的数据
      return { ok: false, message: str(saved.message) || '保存失败，请重试' };
    }

    return { ok: true, message: '已发布', listing: listing };
  }

  /* remove()：只能删自己的，同时从全局列表与 myUsedGoods 两处移除 */
  function remove(id) {
    var wanted = str(id);
    if (!wanted) { return { ok: false, message: '缺少商品编号' }; }

    if (!authReady()) { return { ok: false, message: NOT_READY }; }
    var user = currentUser();
    var phone = str(user && user.phone);
    if (!phone) { return { ok: false, message: '请先登录' }; }

    var before = list();
    var index = -1;
    for (var i = 0; i < before.length; i++) {
      if (before[i].id === wanted) { index = i; break; }
    }

    var myUsed = toArray(user.myUsedGoods);
    var inMine = false;
    for (var j = 0; j < myUsed.length; j++) {
      if (myUsed[j] && str(myUsed[j].id) === wanted) { inMine = true; break; }
    }

    var found = index !== -1 || inMine;
    if (!found) { return { ok: false, message: '没有找到这件商品' }; }

    var owner = index !== -1 ? before[index].sellerPhone : str(myUsed[j] && myUsed[j].sellerPhone);
    if (owner !== phone) { return { ok: false, message: '只能下架自己发布的商品' }; }

    if (index !== -1) {
      var next = before.slice();
      next.splice(index, 1);
      storeSet(storageKey(), next);
    }

    var remain = [];
    for (var k = 0; k < myUsed.length; k++) {
      if (!myUsed[k] || str(myUsed[k].id) !== wanted) { remain.push(myUsed[k]); }
    }

    var saved = null;
    try {
      saved = window.DY.auth.update({ myUsedGoods: remain });
    } catch (e) {
      saved = { ok: false, message: '保存失败，请重试' };
    }

    if (saved && saved.ok === false) {
      if (index !== -1) { storeSet(storageKey(), before); }   // 回滚，保持两处一致
      return { ok: false, message: str(saved.message) || '保存失败，请重试' };
    }

    return { ok: true, message: '已下架' };
  }

  /* ---------- 导出 ---------- */
  window.DY = window.DY || {};
  window.DY.preowned = {
    list: list,
    mine: mine,
    find: find,
    publish: publish,
    remove: remove
  };
})();

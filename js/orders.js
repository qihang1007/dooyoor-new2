/* ==========================================================================
   DOOYOOR 㛊䎟 — 交易层：订单 · 结算 · 二手成交 · 确定性哈希
   依赖：js/site-config.js（DY_CONFIG.shipping / orderStatuses / preownedKey / preowned）
        js/cart.js（DY.store / DY.cart / DY.getProduct）
        js/auth.js（DY.auth.current / DY.auth.update）
        js/wallet.js（DY.wallet.spend / earn / discountUnlocked / discountDetail / balance）
        js/preowned.js（DY.preowned.find / list）——缺失时自行回落读存储键
   暴露：window.DY.orders = { list, find, checkout, buyNow, buyUsed, setStatus, nextNo }
        window.DY.chain  = { hash }
   ---------------------------------------------------------------------------
   三条不可退让的口径（§12.7 / §12.8 / §12.10）：
    1. 结算只扣一次钱，金额 = subtotal - discount + shipping（**含数量**）。
       严禁逐项扣款；本文件里唯一的扣款出口是 pay() → DY.wallet.spend(amt, …)。
    2. 抵扣先用、余额补差：「抵扣不被重复消费」靠两道锁：
       · 一次下单只调用一次 spend，金额是 rest = 总额 - 抵扣（绝不既 spend(总额) 又 spend(rest)）；
       · 用掉的 myProducts 条目回写 usedInOrder = 订单号（wallet.js 的约定），
         该条目此后永久退出 discountUnlocked()，不会在下一单里被二次抵扣。
       抵扣覆盖全价（rest === 0）时仍写一条 amount 为 0 的流水，保证明细与订单对得上。
    3. 二手成交绝不静默丢钱：卖家是官方（sellerPhone 为空）或该用户不存在时，
       订单显式记 settled:false + settleTo，页面据此显示「待结算」；卖家存在才真正入账。
   其它：txHash 下单时算一次写死（绝不渲染时重算）、严禁 Math.random()、
        原生 ES5、无依赖、无网络请求、无 prompt/confirm/alert、任何情况下不抛异常。
   ========================================================================== */
(function () {
  'use strict';

  /* ---------- 配置 / 常量 ---------- */
  var CFG = window.DY_CONFIG || {};
  var USERS_KEY = 'dooyoor.users.v1';
  var PREOWNED_KEY = (typeof CFG.preownedKey === 'string' && CFG.preownedKey)
    ? CFG.preownedKey : 'dooyoor.preowned.v1';
  var SHIPPING = CFG.shipping || { freeThreshold: 999, fee: 20 };
  var STATUS_FALLBACK = ['pending', 'shipped', 'done', 'refund'];

  var MSG_WALLET = '钱包模块未就绪';
  var MSG_CART = '购物袋模块未就绪';
  var MSG_AUTH = '账户模块未就绪';
  var MSG_LOGIN = '请先登录';
  var MSG_EMPTY_BAG = '购物袋是空的';
  var MSG_NO_BALANCE = '余额不足';
  var MSG_SHIP = '请填写收货信息';

  /* ---------- 基础工具（ES5） ---------- */
  function isArr(v) {
    return Object.prototype.toString.call(v) === '[object Array]';
  }

  function isObj(v) {
    return !!v && typeof v === 'object' && !isArr(v);
  }

  function toArray(v) {
    return isArr(v) ? v : [];
  }

  function str(v) {
    return (v === null || v === undefined) ? '' : String(v).trim();
  }

  function num(v, fallback) {
    var n = Number(v);
    return isFinite(n) ? n : fallback;
  }

  function round2(n) {
    var x = Number(n);
    if (!isFinite(x)) { return 0; }
    return Math.round(x * 100) / 100;
  }

  function pad2(n) {
    return (n < 10 ? '0' : '') + n;
  }

  function pad4(n) {
    var s = String(n);
    while (s.length < 4) { s = '0' + s; }
    return s;
  }

  /* 本地日期 / 时间。
     注意：new Date().toISOString() 是 UTC，东八区凌晨会差一天，
     所以订单的 date / time 一律用本地字段显式拼接；
     只有 myProducts.buyTime 按 §12.8 要求存 ISO 字符串（wallet 按月算，时区无影响）。 */
  function nowParts() {
    var d = new Date();
    var date = d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
    return {
      date: date,
      time: date + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes())
    };
  }

  function isoNow() {
    try {
      return new Date().toISOString();
    } catch (e) {
      return nowParts().time;
    }
  }

  /* ---------- 存储：一律经 DY.store（内部已 try/catch 降级） ---------- */
  function storeApi() {
    return (window.DY && window.DY.store) ? window.DY.store : null;
  }

  function storeGet(key, fallback) {
    var s = storeApi();
    if (s && typeof s.get === 'function') {
      try {
        var got = s.get(key, fallback);
        return (got === undefined) ? fallback : got;
      } catch (e) {
        /* 忽略，回落到 localStorage */
      }
    }
    try {
      var raw = window.localStorage.getItem(key);
      if (raw === null || raw === '') { return fallback; }
      var parsed = JSON.parse(raw);            /* 必须 try/catch：存档可能被改坏 */
      return (parsed === null || parsed === undefined) ? fallback : parsed;
    } catch (e2) {
      return fallback;
    }
  }

  function storeSet(key, value) {
    var s = storeApi();
    if (s && typeof s.set === 'function') {
      try {
        return s.set(key, value) !== false;
      } catch (e) {
        return false;
      }
    }
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e2) {
      return false;
    }
  }

  /* ---------- §12.12 确定性哈希（FNV-1a，严禁 Math.random） ---------- */
  /* 逐字符吃两个字节（低 8 位 + 高 8 位），避免只取 & 0xff 丢掉中文信息。
     乘以 16777619 拆成移位加法，全程 32 位无符号，ES5 下不丢精度。 */
  function fnv1a32(text) {
    var s = String(text === null || text === undefined ? '' : text);
    var h = 0x811c9dc5;
    for (var i = 0; i < s.length; i++) {
      var code = s.charCodeAt(i);
      h ^= code & 0xff;
      h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
      h ^= (code >>> 8) & 0xff;
      h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
    }
    return h >>> 0;
  }

  /* 8 段 32 位散列拼成 64 位十六进制（'0x' + 64 个字符）。
     同一 seed 永远同一结果——不含任何随机或时间成分。 */
  function hash64(seed) {
    var base = String(seed === null || seed === undefined ? '' : seed);
    var out = '';
    for (var i = 0; i < 8; i++) {
      out += ('0000000' + fnv1a32(base + '#' + i).toString(16)).slice(-8);
    }
    return '0x' + out;
  }

  /* 下单用哈希：优先用已挂载的 DY.chain.hash（本文件自己导出）；
     若它被替换且返回值合法就沿用它，否则回落到本地实现 —— 两条路都确定。 */
  function chainHash(seed) {
    var chain = window.DY && window.DY.chain;
    if (chain && typeof chain.hash === 'function') {
      try {
        var v = String(chain.hash(seed));
        if (/^0x[0-9a-fA-F]{64}$/.test(v)) { return v.toLowerCase(); }
      } catch (e) {
        /* 回落到本地实现 */
      }
    }
    return hash64(seed);
  }

  /* ---------- 依赖模块（缺一个就优雅失败，绝不抛异常） ---------- */
  function authApi() {
    var a = window.DY && window.DY.auth;
    return (a && typeof a.current === 'function' && typeof a.update === 'function') ? a : null;
  }

  function cartApi() {
    var c = window.DY && window.DY.cart;
    return (c && typeof c.items === 'function') ? c : null;
  }

  function walletApi() {
    var w = window.DY && window.DY.wallet;
    return (w && typeof w.spend === 'function') ? w : null;
  }

  function currentUser() {
    var a = authApi();
    if (!a) { return null; }
    try {
      var rec = a.current();
      return isObj(rec) ? rec : null;
    } catch (e) {
      return null;
    }
  }

  function saveUser(patch) {
    var a = authApi();
    if (!a) { return { ok: false, message: MSG_AUTH }; }
    try {
      var res = a.update(patch);
      if (isObj(res) && res.ok === false) {
        return { ok: false, message: str(res.message) || '保存失败' };
      }
      if (isObj(res) && res.ok === true) { return { ok: true, message: '' }; }
      return { ok: false, message: '保存失败' };
    } catch (e) {
      return { ok: false, message: '保存失败' };
    }
  }

  /* 余额：优先问 wallet（唯一权威），未就绪时读用户记录 */
  function balanceOf() {
    var w = window.DY && window.DY.wallet;
    if (w && typeof w.balance === 'function') {
      try {
        var b = Number(w.balance());
        if (isFinite(b)) { return b; }
      } catch (e) {
        /* 回落到用户记录 */
      }
    }
    var u = currentUser();
    return u ? num(u.balance, 0) : 0;
  }

  /* 唯一的扣款出口：金额一律由调用方按「含数量的总额 - 抵扣 + 运费」算好。
     amount 为 0 时也要留一条流水（§12.7：抵扣覆盖全价时明细必须对得上）。 */
  function pay(amount, description) {
    var w = walletApi();
    if (!w) { return { ok: false, message: MSG_WALLET }; }
    var amt = round2(num(amount, 0));
    if (amt < 0) { amt = 0; }

    try {
      var res = w.spend(amt, description);
      if (res && res.ok === false) {
        if (amt === 0) {
          /* wallet 拒绝 0 元支出时的兜底：仍然写一条 0 元流水（不动余额） */
          if (writeZeroTx(description)) { return { ok: true, message: '' }; }
        }
        return { ok: false, message: str(res.message) || '支付失败' };
      }
      return { ok: true, message: '' };
    } catch (e) {
      if (amt === 0 && writeZeroTx(description)) { return { ok: true, message: '' }; }
      return { ok: false, message: '支付失败' };
    }
  }

  /* 兜底：直接往 balanceHistory 追加一条 amount 为 0 的流水（余额不变，绝不重复扣钱） */
  function writeZeroTx(description) {
    var u = currentUser();
    if (!u) { return false; }
    var list = toArray(u.balanceHistory).slice();
    var p = nowParts();
    list.push({
      id: 'tx' + Date.now() + '-' + list.length,
      amount: 0,
      type: 'expense',
      description: str(description) || '抵扣支付',
      time: isoNow(),
      date: p.date
    });
    var res = saveUser({ balanceHistory: list });
    return res.ok === true;
  }

  /* 下单失败时把钱退回（只在「已扣款但订单没能落盘」的极端情况下调用） */
  function refund(amount, no) {
    var amt = round2(num(amount, 0));
    var w = window.DY && window.DY.wallet;
    if (amt <= 0 || !w || typeof w.earn !== 'function') { return false; }
    try {
      var res = w.earn(amt, '下单失败退回 ' + no);
      return !(res && res.ok === false);
    } catch (e) {
      return false;
    }
  }

  function emit(name, detail) {
    try {
      document.dispatchEvent(new CustomEvent(name, { detail: detail }));
    } catch (e) {
      try {
        var evt = document.createEvent('CustomEvent');
        evt.initCustomEvent(name, false, false, detail);
        document.dispatchEvent(evt);
      } catch (e2) {
        /* 极旧环境忽略 */
      }
    }
  }

  /* ---------- 单号生成（'DY' + YYYYMMDD + 4 位序号） ---------- */
  function readUsers() {
    var v = storeGet(USERS_KEY, null);
    if (!isObj(v)) { return {}; }
    return v;
  }

  /* 已有单号集合：扫全部用户的 orders，跨用户也不重号 */
  function existingNos() {
    var set = {};
    var users = readUsers();
    for (var phone in users) {
      if (!Object.prototype.hasOwnProperty.call(users, phone)) { continue; }
      var rec = users[phone];
      var orders = toArray(rec && rec.orders);
      for (var i = 0; i < orders.length; i++) {
        var no = str(orders[i] && orders[i].no);
        if (no) { set[no] = true; }
      }
    }
    var me = currentUser();
    var mine = toArray(me && me.orders);
    for (var j = 0; j < mine.length; j++) {
      var mineNo = str(mine[j] && mine[j].no);
      if (mineNo) { set[mineNo] = true; }
    }
    return set;
  }

  function nextNo() {
    var stamp = nowParts().date.replace(/-/g, '');
    var prefix = 'DY' + stamp;
    var set = existingNos();

    /* 先取当天已用掉的最大序号，再自增；随后逐个比对冲突（同一天内绝不重号） */
    var max = 0;
    for (var no in set) {
      if (!Object.prototype.hasOwnProperty.call(set, no)) { continue; }
      if (no.indexOf(prefix) !== 0) { continue; }
      var seq = parseInt(no.slice(prefix.length), 10);
      if (isFinite(seq) && seq > max) { max = seq; }
    }

    var n = max + 1;
    if (!(n >= 1) || n > 999999) { n = 1; }
    var candidate = prefix + pad4(n);
    var guard = 0;
    while (set[candidate] && guard < 100000) {
      n += 1;
      candidate = prefix + pad4(n);
      guard += 1;
    }
    return candidate;
  }

  /* ---------- §12.4 订单组装 ----------
     所有字段在这里一次写全：[no, type, items, total, pay, status, date, time,
     chainCode, txHash, ship, sellerPhone, settled, settleTo, usedPublished]
     txHash 由调用方用「单号 + 商品 id」现算一次传进来，写死，渲染端不得重算。 */
  function makeOrder(input) {
    var p = nowParts();
    return {
      no: input.no,
      type: input.type,
      items: input.items,
      total: round2(input.total),
      pay: {
        subtotal: round2(input.pay.subtotal),
        discount: round2(input.pay.discount),
        shipping: round2(input.pay.shipping),
        balance: round2(input.pay.balance)
      },
      status: 'pending',
      date: p.date,
      time: p.time,
      chainCode: input.chainCode || '',
      txHash: input.txHash,
      ship: input.ship,
      sellerPhone: input.sellerPhone || '',
      settled: input.settled === true,
      settleTo: input.settleTo || '',
      usedPublished: false
    };
  }

  function emptyShip() {
    return { receiver: '', phone: '', address: '' };
  }

  /* 每行写一条 myProducts（price = 该行实付小计 lineTotal，供 §12.8 抵扣） */
  function pushMyProduct(list, item, orderNo, buyTime) {
    list.push({
      id: item.productId,
      name: item.name,
      price: round2(item.lineTotal),
      image: item.image,
      buyTime: buyTime,
      orderNo: orderNo
    });
  }

  /* ---------- 商品反查 ---------- */
  function findProduct(productId) {
    var wanted = str(productId);
    if (!wanted) { return null; }
    var getProduct = window.DY && window.DY.getProduct;
    if (typeof getProduct === 'function') {
      try {
        var found = getProduct(wanted);
        if (found) { return found; }
      } catch (e) {
        /* 回落到配置表 */
      }
    }
    var products = toArray(CFG.products);
    for (var i = 0; i < products.length; i++) {
      if (products[i] && str(products[i].id) === wanted) { return products[i]; }
    }
    return null;
  }

  function productChainCode(product) {
    return str(product && product.chain && product.chain.code);
  }

  /* ---------- §12.6 list / find ---------- */
  function list(status) {
    var u = currentUser();
    if (!u) { return []; }
    var orders = toArray(u.orders);
    var want = str(status);
    if (!want || want === 'all') { return orders.slice(); }

    var out = [];
    for (var i = 0; i < orders.length; i++) {
      if (str(orders[i] && orders[i].status) === want) { out.push(orders[i]); }
    }
    return out;
  }

  function find(no) {
    var u = currentUser();
    if (!u) { return null; }
    var wanted = str(no);
    if (!wanted) { return null; }
    var orders = toArray(u.orders);
    for (var i = 0; i < orders.length; i++) {
      if (str(orders[i] && orders[i].no) === wanted) { return orders[i]; }
    }
    return null;
  }

  /* ---------- §12.7 步骤 1–10：购物袋结算 ----------
     金额口径（唯一一次扣款）：
       lineTotal = unitPrice * qty；subtotal = Σ lineTotal          ← 含数量
       discount  = 购物袋优惠（增值抵扣在 buyNow 中优先使用，此处不用；没有则 0）
       shipping  = subtotal - discount >= freeThreshold ? 0 : fee
       payable   = subtotal - discount + shipping                  ← 只扣这一次
     未登录 / 空袋 / 余额不足 → 失败且数据不变；收货信息给了就必须给全。 */
  function checkout(opts) {
    /* 步骤 1：未登录先挡住——依赖缺失的判断一律排在其后，
       保证「请先登录」永远是第一口径（即便 wallet.js 还没加载）。 */
    var u = currentUser();
    if (!u) { return { ok: false, message: MSG_LOGIN }; }

    var cart = cartApi();
    if (!cart) { return { ok: false, message: MSG_CART }; }
    if (!walletApi()) { return { ok: false, message: MSG_WALLET }; }

    var raw = [];
    try {
      raw = toArray(cart.items());
    } catch (e) {
      raw = [];
    }
    if (!raw.length) { return { ok: false, message: MSG_EMPTY_BAG }; }

    /* 收货信息：opts 里一个字段都没给就跳过校验（便于复用/演示），
       只要给了就三项必须齐全，否则不生成订单。 */
    var o = isObj(opts) ? opts : {};
    var receiver = str(o.receiver);
    var phone = str(o.phone);
    var address = str(o.address);
    if (receiver || phone || address) {
      if (!receiver || !phone || !address) { return { ok: false, message: MSG_SHIP }; }
    }
    var ship = { receiver: receiver, phone: phone, address: address };

    /* 步骤 3：逐行 lineTotal = unitPrice * qty（含数量，绝不漏乘） */
    var lines = [];
    var subtotal = 0;
    for (var i = 0; i < raw.length; i++) {
      var it = isObj(raw[i]) ? raw[i] : {};
      var product = isObj(it.product) ? it.product : findProduct(it.id);
      var unit = round2(num(it.unitPrice, product ? num(product.price, 0) : 0));
      var qty = Math.round(num(it.qty, 1));
      if (!(qty >= 1)) { qty = 1; }
      if (qty > 99) { qty = 99; }
      var lineTotal = round2(unit * qty);
      subtotal = round2(subtotal + lineTotal);
      lines.push({
        productId: str(it.id),
        name: str(product && product.name),
        image: str(product && product.image),
        size: str(it.size),
        qty: qty,
        unitPrice: unit,
        lineTotal: lineTotal
      });
    }
    if (!lines.length || subtotal <= 0) { return { ok: false, message: MSG_EMPTY_BAG }; }

    /* 步骤 4：discount = 本次使用的抵扣额。增值抵扣按 §12.7 在 buyNow 中优先使用，
       结算这里的 discount 取购物袋优惠（没使用时记 0）——与 cart.discount() 同口径。 */
    var discount = 0;
    if (typeof cart.discount === 'function') {
      try {
        discount = round2(num(cart.discount(), 0));
      } catch (e) {
        discount = 0;
      }
    }
    if (!(discount > 0)) { discount = 0; }
    if (discount > subtotal) { discount = subtotal; }

    /* 步骤 5：运费按「减完优惠的金额」判断免运费门槛 */
    var freeThreshold = num(SHIPPING.freeThreshold, 999);
    var fee = num(SHIPPING.fee, 0);
    var shipping = 0;
    if (typeof cart.shipping === 'function') {
      try {
        shipping = round2(num(cart.shipping(), 0));
      } catch (e) {
        shipping = 0;
      }
    } else {
      shipping = (subtotal - discount >= freeThreshold) ? 0 : fee;
    }
    if (!(shipping >= 0)) { shipping = 0; }

    /* 步骤 6：比较对象必须是乘以数量后的总额 */
    var payable = round2(subtotal - discount + shipping);
    if (payable < 0) { payable = 0; }
    var balance = balanceOf();
    if (payable > balance) { return { ok: false, message: MSG_NO_BALANCE }; }

    /* 步骤 7：单号与哈希先定下来（流水描述要用单号；txHash 写死不再重算） */
    var no = nextNo();
    var primaryId = lines[0].productId;
    var txHash = chainHash(no + primaryId);

    /* 只扣一次：金额 = subtotal - discount + shipping（含数量） */
    var paid = pay(payable, '订单支付 ' + no);
    if (!paid.ok) { return { ok: false, message: paid.message }; }

    /* 步骤 8：生成 1 个订单，items 含全部行（不按行拆单） */
    var order = makeOrder({
      no: no,
      type: 'new',
      items: lines,
      total: payable,
      pay: { subtotal: subtotal, discount: discount, shipping: shipping, balance: payable },
      chainCode: productChainCode(findProduct(primaryId)),
      txHash: txHash,
      ship: ship,
      sellerPhone: '',
      settled: true,
      settleTo: ''
    });

    /* 步骤 9：每行追加 1 条 myProducts，price = lineTotal */
    var buyTime = isoNow();
    var myProducts = toArray(u.myProducts).slice();
    for (var k = 0; k < lines.length; k++) {
      pushMyProduct(myProducts, lines[k], no, buyTime);
    }

    var orders = toArray(u.orders).slice();
    orders.push(order);

    var saved = saveUser({ orders: orders, myProducts: myProducts });
    if (!saved.ok) {
      refund(payable, no);                    /* 已扣款但没落盘 → 退回，保持数据不变 */
      return { ok: false, message: saved.message || '订单保存失败' };
    }

    /* 步骤 10：清空购物袋（cart.clear() 自己会派发 dy:cart-change） */
    if (typeof cart.clear === 'function') {
      try {
        cart.clear();
      } catch (e) {
        emit('dy:cart-change', { count: 0, subtotal: 0 });
      }
    } else {
      emit('dy:cart-change', { count: 0, subtotal: 0 });
    }

    emit('dy:orders-change', { order: order });
    return { ok: true, message: '下单成功', order: order };
  }

  /* ---------- §12.7 buyNow：先用抵扣再用余额 ----------
     amount       = product.price * qty
     discountUsed = min(amount, wallet.discountUnlocked())
     rest         = amount - discountUsed   ← 唯一一次扣款金额
     抵扣覆盖全价（rest === 0）时仍写一条 amount 为 0 的流水。
     用掉的抵扣条目回写 usedInOrder = 单号，永久退出后续抵扣（不重复消费）。 */
  function buyNow(productId, size, qty) {
    var u = currentUser();
    if (!u) { return { ok: false, message: MSG_LOGIN }; }
    if (!walletApi()) { return { ok: false, message: MSG_WALLET }; }

    var product = findProduct(productId);
    if (!product) { return { ok: false, message: '商品不存在' }; }

    var sizeText = str(size);
    if (!sizeText) { return { ok: false, message: '请先选择尺码' }; }
    if (toArray(product.sizes).indexOf(sizeText) === -1) {
      return { ok: false, message: '该尺码不可选' };
    }

    var n = Math.round(num(qty, 1));
    if (!(n >= 1)) { n = 1; }
    if (n > 99) { n = 99; }

    var unit = round2(num(product.price, 0));
    var amount = round2(unit * n);                       /* 含数量 */
    if (!(amount > 0)) { return { ok: false, message: '商品价格无效' }; }

    /* 抵扣：整单只读一次、只用一次 */
    var w = window.DY && window.DY.wallet;
    var unlocked = 0;
    if (w && typeof w.discountUnlocked === 'function') {
      try {
        unlocked = round2(num(w.discountUnlocked(), 0));
      } catch (e) {
        unlocked = 0;
      }
    }
    if (!(unlocked > 0)) { unlocked = 0; }

    var discountUsed = round2(Math.min(amount, unlocked));
    var rest = round2(amount - discountUsed);
    if (rest < 0) { rest = 0; }

    /* 先按「总额 - 抵扣」预检余额，避免无谓地消耗单号 */
    var balance = balanceOf();
    if (rest > balance) { return { ok: false, message: MSG_NO_BALANCE }; }

    var no = nextNo();
    var txHash = chainHash(no + str(product.id));

    /* 抵扣一次性消费：被用掉的条目回写 usedInOrder = 单号（wallet.js 约定），
       此后永久退出 discountUnlocked()，同一笔抵扣绝不进第二张订单。 */
    var marked = markConsumed(u, discountUsed, no);
    if (discountUsed > 0 && marked.total <= 0) {
      /* 明细缺失/异常时宁可不抵扣，也绝不留下「用了却没标记」的漏洞 */
      discountUsed = 0;
      marked = { list: toArray(u.myProducts).slice(), total: 0, changed: false };
    }
    discountUsed = round2(discountUsed);
    rest = round2(amount - discountUsed);
    if (rest < 0) { rest = 0; }
    if (rest > balance) { return { ok: false, message: MSG_NO_BALANCE }; }

    var detailText = '订单支付 ' + no
      + (discountUsed > 0 ? '（已用抵扣 ¥' + discountUsed + '，余额支付 ¥' + rest + '）' : '');
    var paid = pay(rest, detailText);                    /* 只扣 rest，一次；rest=0 时也留 0 元流水 */
    if (!paid.ok) { return { ok: false, message: paid.message }; }

    var line = {
      productId: str(product.id),
      name: str(product.name),
      image: str(product.image),
      size: sizeText,
      qty: n,
      unitPrice: unit,
      lineTotal: amount
    };

    var order = makeOrder({
      no: no,
      type: 'new',
      items: [line],
      total: rest,
      pay: { subtotal: amount, discount: discountUsed, shipping: 0, balance: rest },
      chainCode: productChainCode(product),
      txHash: txHash,
      ship: emptyShip(),
      sellerPhone: '',
      settled: true,
      settleTo: ''
    });

    var myProducts = marked.list;
    pushMyProduct(myProducts, line, no, isoNow());

    var orders = toArray(u.orders).slice();
    orders.push(order);

    var saved = saveUser({ orders: orders, myProducts: myProducts });
    if (!saved.ok) {
      refund(rest, no);
      return { ok: false, message: saved.message || '订单保存失败' };
    }

    emit('dy:orders-change', { order: order });
    return { ok: true, message: '下单成功', order: order };
  }

  /* ---------- 抵扣消费标记（wallet.js 的文件头约定） ----------
     贪心地把 unlocked > 0 的条目依次标记 usedInOrder = 订单号，
     直到累计覆盖 discountUsed。被标记的条目此后被 wallet.discountUnlocked()
     永久排除 —— 这是「抵扣不被重复消费」的第二道锁。
     返回新的 myProducts 数组（不改动入参对象）。 */
  function markConsumed(user, discountUsed, orderNo) {
    var raw = toArray(user && user.myProducts);
    var next = [];
    var i;
    for (i = 0; i < raw.length; i++) {
      next.push(raw[i]);
    }

    var result = { list: next, total: 0, changed: false };
    if (!(discountUsed > 0)) { return result; }
    var mark = str(orderNo);

    var w = window.DY && window.DY.wallet;
    var detail = [];
    if (w && typeof w.discountDetail === 'function') {
      try {
        detail = toArray(w.discountDetail());
      } catch (e) {
        detail = [];
      }
    }
    if (!detail.length) { return result; }

    var remaining = discountUsed;
    for (var d = 0; d < detail.length && remaining > 0; d++) {
      var row = isObj(detail[d]) ? detail[d] : {};
      var unlocked = round2(num(row.unlocked, 0));
      if (!(unlocked > 0)) { continue; }

      var idx = indexOfMyProduct(raw, row.myProduct);
      if (idx === -1) { continue; }

      var entry = isObj(raw[idx]) ? raw[idx] : {};
      var clone = {};
      var field;
      for (field in entry) {
        if (Object.prototype.hasOwnProperty.call(entry, field)) { clone[field] = entry[field]; }
      }
      clone.usedInOrder = mark || clone.usedInOrder || '';
      clone.discountUsed = true;
      clone.usedTime = isoNow();
      next[idx] = clone;

      result.total = round2(result.total + unlocked);
      result.changed = true;
      remaining = round2(remaining - unlocked);
    }
    return result;
  }

  /* 在 myProducts 里定位一条（先按对象身份，再按内容特征兜底） */
  function indexOfMyProduct(raw, item) {
    if (!isObj(item)) { return -1; }
    var i;
    for (i = 0; i < raw.length; i++) {
      if (raw[i] === item) { return i; }
    }
    var key = myProductKey(item);
    if (!key) { return -1; }
    for (i = 0; i < raw.length; i++) {
      if (myProductKey(raw[i]) === key) { return i; }
    }
    return -1;
  }

  function myProductKey(item) {
    if (!isObj(item)) { return ''; }
    return str(item.id) + '|' + str(item.buyTime) + '|' + str(item.orderNo) + '|' + str(item.price);
  }

  /* ---------- §12.10 二手成交（六步，绝不静默丢钱） ---------- */
  function listingFromStore(listingId) {
    var key = PREOWNED_KEY;
    var list = storeGet(key, null);
    if (!isArr(list)) {
      var pre = window.DY && window.DY.preowned;
      if (pre && typeof pre.list === 'function') {
        try {
          list = toArray(pre.list());
        } catch (e) {
          list = toArray(CFG.preowned);
        }
      } else {
        list = toArray(CFG.preowned);
      }
    }
    for (var i = 0; i < list.length; i++) {
      if (str(list[i] && list[i].id) === str(listingId)) { return list[i]; }
    }
    return null;
  }

  function findListing(listingId) {
    var pre = window.DY && window.DY.preowned;
    if (pre && typeof pre.find === 'function') {
      try {
        var found = pre.find(listingId);
        if (found) { return found; }
      } catch (e) {
        /* 回落到直接读存储 */
      }
    }
    return listingFromStore(listingId);
  }

  /* 从全局二手列表移除（买单人不是卖家，DY.preowned.remove 只允许删自己的，故直接改存储键）。
     返回 { ok, before }：before 用于失败回滚。 */
  function removeListingFromStore(listingId) {
    var key = PREOWNED_KEY;
    var list = storeGet(key, null);
    if (!isArr(list)) {
      var pre = window.DY && window.DY.preowned;
      if (pre && typeof pre.list === 'function') {
        try {
          list = toArray(pre.list());
        } catch (e) {
          list = toArray(CFG.preowned);
        }
      } else {
        list = toArray(CFG.preowned);
      }
    }

    var before = list.slice();
    var next = [];
    var found = false;
    for (var i = 0; i < list.length; i++) {
      if (str(list[i] && list[i].id) === str(listingId)) {
        found = true;
      } else {
        next.push(list[i]);
      }
    }
    if (!found) { return { ok: false, before: before }; }
    return { ok: storeSet(key, next), before: before };
  }

  /* 给卖家入账（卖家不是当前会话用户，DY.auth.update 只能写自己，故直接写用户表）。
     写失败 / 用户不存在 → ok:false，由调用方记 settleTo，绝不静默吞掉这笔钱。 */
  function creditSeller(sellerPhone, amount, orderNo) {
    var phone = str(sellerPhone);
    if (!phone) { return { ok: false, message: '官方渠道' }; }

    var users = readUsers();
    var rec = users[phone];
    if (!isObj(rec)) { return { ok: false, message: '卖家账户不存在' }; }

    var history = toArray(rec.balanceHistory).slice();
    var p = nowParts();
    history.push({
      id: 'tx' + Date.now() + '-' + history.length,
      amount: round2(amount),
      type: 'income',
      description: '二手售出 ' + orderNo,
      time: isoNow(),
      date: p.date
    });

    rec.balance = round2(num(rec.balance, 0) + num(amount, 0));
    rec.balanceHistory = history;
    users[phone] = rec;

    if (!storeSet(USERS_KEY, users)) { return { ok: false, message: '卖家入账失败' }; }
    return { ok: true, message: '' };
  }

  /* 回滚：把已入账的卖家金额扣回（只在订单落盘失败的极端情况下用） */
  function debitSeller(sellerPhone, amount, orderNo) {
    var phone = str(sellerPhone);
    if (!phone) { return; }
    var users = readUsers();
    var rec = users[phone];
    if (!isObj(rec)) { return; }

    var history = toArray(rec.balanceHistory).slice();
    var p = nowParts();
    history.push({
      id: 'tx' + Date.now() + '-' + history.length,
      amount: round2(amount),
      type: 'expense',
      description: '下单失败冲回 ' + orderNo,
      time: isoNow(),
      date: p.date
    });
    rec.balance = round2(num(rec.balance, 0) - num(amount, 0));
    rec.balanceHistory = history;
    users[phone] = rec;
    storeSet(USERS_KEY, users);
  }

  function buyUsed(listingId) {
    var u = currentUser();
    if (!u) { return { ok: false, message: MSG_LOGIN }; }
    if (!walletApi()) { return { ok: false, message: MSG_WALLET }; }

    /* 1. 找件 */
    var listing = findListing(listingId);
    if (!listing) { return { ok: false, message: '商品不存在或已下架' }; }

    /* 2. 不能买自己的 */
    var sellerPhone = str(listing.sellerPhone);
    var buyerPhone = str(u.phone);
    if (sellerPhone && sellerPhone === buyerPhone) {
      return { ok: false, message: '不能购买自己发布的商品' };
    }

    var price = round2(num(listing.price, 0));
    if (!(price > 0)) { return { ok: false, message: '商品价格无效' }; }

    /* 3. 余额校验（比较对象是转让价本身） */
    var balance = balanceOf();
    if (price > balance) { return { ok: false, message: MSG_NO_BALANCE }; }

    var no = nextNo();
    var txHash = chainHash(no + str(listing.id));

    /* 4. 扣买家余额：一次，金额为转让价 */
    var paid = pay(price, '二手订单支付 ' + no + '：' + str(listing.name));
    if (!paid.ok) { return { ok: false, message: paid.message }; }

    /* 5. 给卖家入账；官方（sellerPhone 为空）或卖家不存在 → 显式记待结算，绝不静默丢钱 */
    var settled = false;
    var settleTo = '';
    if (!sellerPhone) {
      settleTo = '官方待结算';
    } else {
      var credit = creditSeller(sellerPhone, price, no);
      if (credit.ok) {
        settled = true;
      } else {
        settleTo = '待结算给卖家 ' + sellerPhone;
      }
    }

    /* 6. 从全局二手列表移除 → 写订单 → 加入买家 myProducts */
    var removed = removeListingFromStore(listing.id);
    if (!removed.ok) {
      /* 商品已被并发下架：退回款项并冲回卖家，保持数据不变 */
      if (settled) { debitSeller(sellerPhone, price, no); }
      refund(price, no);
      return { ok: false, message: '商品不存在或已下架' };
    }

    var order = makeOrder({
      no: no,
      type: 'used',
      items: [{
        productId: str(listing.id),
        name: str(listing.name),
        image: str(listing.image),
        size: '',
        qty: 1,
        unitPrice: price,
        lineTotal: price
      }],
      total: price,
      pay: { subtotal: price, discount: 0, shipping: 0, balance: price },
      chainCode: str(listing.chainCode),
      txHash: txHash,
      ship: emptyShip(),
      sellerPhone: sellerPhone,
      settled: settled,
      settleTo: settleTo
    });

    var orders = toArray(u.orders).slice();
    orders.push(order);

    var myProducts = toArray(u.myProducts).slice();
    pushMyProduct(myProducts, order.items[0], no, isoNow());

    var saved = saveUser({ orders: orders, myProducts: myProducts });
    if (!saved.ok) {
      /* 订单没落盘 → 上架恢复 + 卖家冲回 + 买家退回 */
      storeSet(PREOWNED_KEY, removed.before);
      if (settled) { debitSeller(sellerPhone, price, no); }
      refund(price, no);
      return { ok: false, message: saved.message || '订单保存失败' };
    }

    emit('dy:orders-change', { order: order });

    var message = '下单成功';
    if (!settled) { message = '下单成功，货款已记入' + settleTo; }
    return { ok: true, message: message, order: order };
  }

  /* ---------- §12.6 setStatus（仅供后台演示） ---------- */
  function validStatuses() {
    var out = [];
    var configured = toArray(CFG.orderStatuses);
    for (var i = 0; i < configured.length; i++) {
      var id = str(configured[i] && configured[i].id);
      if (id && id !== 'all') { out.push(id); }
    }
    return out.length ? out : STATUS_FALLBACK.slice();
  }

  function setStatus(no, status) {
    var u = currentUser();
    if (!u) { return { ok: false, message: MSG_LOGIN }; }

    var wantedNo = str(no);
    var wantedStatus = str(status);
    if (!wantedNo) { return { ok: false, message: '缺少单号' }; }
    if (validStatuses().indexOf(wantedStatus) === -1) {
      return { ok: false, message: '订单状态不合法' };
    }

    var orders = toArray(u.orders);
    var index = -1;
    for (var i = 0; i < orders.length; i++) {
      if (str(orders[i] && orders[i].no) === wantedNo) { index = i; break; }
    }
    if (index === -1) { return { ok: false, message: '订单不存在' }; }

    var next = orders.slice();
    var clone = {};
    var field;
    for (field in next[index]) {
      if (Object.prototype.hasOwnProperty.call(next[index], field)) {
        clone[field] = next[index][field];
      }
    }
    clone.status = wantedStatus;
    next[index] = clone;

    var saved = saveUser({ orders: next });
    if (!saved.ok) { return { ok: false, message: saved.message || '保存失败' }; }

    emit('dy:orders-change', { order: clone });
    return { ok: true, message: '订单状态已更新' };
  }

  /* ---------- 导出 ---------- */
  window.DY = window.DY || {};

  window.DY.orders = {
    list: list,
    find: find,
    checkout: checkout,
    buyNow: buyNow,
    buyUsed: buyUsed,
    setStatus: setStatus,
    nextNo: nextNo
  };

  window.DY.chain = window.DY.chain || {};
  if (typeof window.DY.chain.hash !== 'function') {
    window.DY.chain.hash = hash64;
  }
})();

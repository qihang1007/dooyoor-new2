/* ==========================================================================
   dooyoor 㛊䎟 — 账户认证内核（§12.2 / §12.3 / §12.6 / §12.11 / §12.14）
   依赖：js/site-config.js（DY_CONFIG）、js/cart.js（DY.store）
   暴露：window.DY.auth（签名冻结）
   口径：
     · 绝不存储明文密码——只存 pwdHash = DY.auth.hash(password)
     · dooyoor.session.v1 只存 { phone, at }，绝不存密码
     · 用户表是一个大对象 dooyoor.users.v1 = { '<手机号>': userRecord }
     · 全部读写经 DY.store.get / DY.store.set（内部已 try/catch 降级）
   ========================================================================== */
(function () {
  'use strict';

  var CFG = window.DY_CONFIG || {};
  var USERS_KEY = 'dooyoor.users.v1';
  var SESSION_KEY = 'dooyoor.session.v1';
  var REMEMBER_KEY = 'dooyoor.remember.v1';
  var DEMO_CODE = '888888';                 // 演示验证码，固定值，必须标注为演示
  var PHONE_RE = /^1\d{10}$/;
  var MIN_PWD = 6;
  var DEMO_PHONE = '13800138000';
  var DEMO_PASSWORD = 'dooyoor';

  /* ---------- 存储 ---------- */
  function store() {
    return (window.DY && window.DY.store) ? window.DY.store : null;
  }

  function readUsers() {
    var s = store();
    var data = s ? s.get(USERS_KEY, null) : null;
    if (!data || typeof data !== 'object' || Object.prototype.toString.call(data) === '[object Array]') {
      return {};
    }
    return data;
  }

  function saveUsers(users) {
    var s = store();
    if (!s) { return false; }
    return !!s.set(USERS_KEY, users);
  }

  function readSession() {
    var s = store();
    var sess = s ? s.get(SESSION_KEY, null) : null;
    if (!sess || typeof sess !== 'object') { return null; }
    if (typeof sess.phone !== 'string' || !sess.phone) { return null; }
    return { phone: sess.phone, at: sess.at || '' };
  }

  function saveSession(phone) {
    var s = store();
    if (!s) { return; }
    s.set(SESSION_KEY, { phone: String(phone), at: new Date().toISOString() });
  }

  function clearSession() {
    var s = store();
    if (s) { s.set(SESSION_KEY, null); }
  }

  /* ---------- 工具 ---------- */
  function pad2(n) {
    return (n < 10 ? '0' : '') + n;
  }

  function today() {
    var d = new Date();
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  function defaultName(phone) {
    return '用户 ' + String(phone).slice(-4);
  }

  /* 确定性散列：FNV-1a，输出 8 位十六进制（32 位）。
     同一输入永远同一输出——不允许任何随机成分。 */
  function hash(text) {
    var str = String(text === null || text === undefined ? '' : text);
    var h = 0x811c9dc5;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i) & 0xff;
      /* 乘以 16777619，拆成移位加法，避免 32 位溢出丢精度 */
      h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
    }
    return ('0000000' + h.toString(16)).slice(-8);
  }

  function prefDefaults() {
    var list = CFG.notifyPrefs || [];
    var prefs = {};
    for (var i = 0; i < list.length; i++) {
      var p = list[i] || {};
      if (p.id) { prefs[p.id] = !!p.def; }
    }
    return prefs;
  }

  function arr(value) {
    return Object.prototype.toString.call(value) === '[object Array]' ? value : [];
  }

  function obj(value) {
    return (value && typeof value === 'object' && Object.prototype.toString.call(value) !== '[object Array]') ? value : {};
  }

  /* 把可能残缺的历史记录补齐成完整 userRecord（不覆盖已有值） */
  function normalize(rec, phone) {
    var r = obj(rec);
    var prefs = obj(r.prefs);
    var defaults = prefDefaults();

    var key;
    for (key in defaults) {
      if (Object.prototype.hasOwnProperty.call(defaults, key) && typeof prefs[key] !== 'boolean') {
        prefs[key] = defaults[key];
      }
    }

    r.phone = typeof r.phone === 'string' && r.phone ? r.phone : String(phone || '');
    r.name = typeof r.name === 'string' && r.name ? r.name : defaultName(r.phone);
    r.avatar = typeof r.avatar === 'string' ? r.avatar : '';
    r.registerDate = typeof r.registerDate === 'string' && r.registerDate ? r.registerDate : today();
    r.balance = isFinite(Number(r.balance)) ? Number(r.balance) : 0;
    r.pwdHash = typeof r.pwdHash === 'string' ? r.pwdHash : '';
    r.prefs = prefs;
    r.orders = arr(r.orders);
    r.balanceHistory = arr(r.balanceHistory);
    r.myProducts = arr(r.myProducts);
    r.myUsedGoods = arr(r.myUsedGoods);
    return r;
  }

  /* 写一条演示初始余额流水。
     注意：这里**不能**调用 DY.wallet.earn()。seed() 与 register() 两个调用点都在
     persist() 之前，此刻 rec 尚未写入 users、session 也未建立，auth.current() 仍是
     null，earn 会按契约返回 {ok:false} 并静默丢掉这条流水，导致 §12.14 要求的
     「演示初始余额」记录永远不存在。因此这里直接写入 rec.balanceHistory。
     余额本身已经写在 rec.balance 上，这里只是补一条流水，不重复加钱。 */
  function seedTx(rec) {
    var amount = Number(rec.balance);
    if (!isFinite(amount) || amount <= 0) { return; }
    var d = new Date();
    var pad = function (n) { return n < 10 ? '0' + n : String(n); };
    rec.balanceHistory = arr(rec.balanceHistory);
    rec.balanceHistory.push({
      id: 'tx' + d.getTime() + '-' + rec.balanceHistory.length,
      amount: amount,
      type: 'income',
      description: '演示初始余额',
      time: d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
        + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()),
      date: today()
    });
  }

  function persist(users, rec) {
    users[rec.phone] = rec;
    saveUsers(users);
  }

  /* ---------- §12.14 演示数据播种 ----------
     users 为空时创建演示账号 13800138000 / dooyoor，让访客立刻能体验完整闭环。 */
  function seed() {
    var users = readUsers();
    var rec = users[DEMO_PHONE];
    if (rec && typeof rec === 'object' && rec.pwdHash) { return false; }

    var fresh = normalize({}, DEMO_PHONE);
    fresh.name = '演示用户';
    fresh.registerDate = today();
    fresh.balance = isFinite(Number(CFG.demoBalance)) ? Number(CFG.demoBalance) : 10000;
    fresh.pwdHash = hash(DEMO_PASSWORD);
    fresh.orders = [];
    fresh.balanceHistory = [];
    fresh.myProducts = [];
    fresh.myUsedGoods = [];
    seedTx(fresh);
    persist(users, fresh);
    return true;
  }

  /* ---------- 事件 ---------- */
  var subscribers = [];

  function emit() {
    var user = current();
    for (var i = 0; i < subscribers.length; i++) {
      try { subscribers[i](user); } catch (e) { /* 单个订阅者出错不影响其它 */ }
    }
    var detail = { phone: user ? user.phone : '', user: user };
    try {
      document.dispatchEvent(new CustomEvent('dy:auth-change', { detail: detail }));
    } catch (e2) {
      try {
        var evt = document.createEvent('CustomEvent');
        evt.initCustomEvent('dy:auth-change', false, false, detail);
        document.dispatchEvent(evt);
      } catch (e3) { /* 极旧浏览器忽略 */ }
    }
  }

  function onChange(fn) {
    if (typeof fn !== 'function') { return function () {}; }
    subscribers.push(fn);
    return function () {
      for (var i = 0; i < subscribers.length; i++) {
        if (subscribers[i] === fn) { subscribers.splice(i, 1); return; }
      }
    };
  }

  /* ---------- §12.6 API ---------- */
  function userByPhone(phone) {
    if (!phone) { return null; }
    var users = readUsers();
    var rec = users[phone];
    return (rec && typeof rec === 'object') ? normalize(rec, phone) : null;
  }

  /* session → users 查表；session 无效时清掉它 */
  function current() {
    var sess = readSession();
    if (!sess) { return null; }
    var rec = userByPhone(sess.phone);
    if (!rec) { clearSession(); return null; }
    return rec;
  }

  function isLoggedIn() {
    return current() !== null;
  }

  function register(phone, code, password) {
    var p = String(phone === null || phone === undefined ? '' : phone).replace(/\s+/g, '');
    var c = String(code === null || code === undefined ? '' : code).replace(/\s+/g, '');
    var pwd = String(password === null || password === undefined ? '' : password);

    if (!PHONE_RE.test(p)) { return { ok: false, message: '请输入 11 位手机号（以 1 开头）' }; }
    if (c !== DEMO_CODE) { return { ok: false, message: '验证码不正确，演示环境固定为 ' + DEMO_CODE }; }
    if (pwd.length < MIN_PWD) { return { ok: false, message: '密码至少 ' + MIN_PWD + ' 位' }; }

    var users = readUsers();
    if (users[p] && typeof users[p] === 'object') { return { ok: false, message: '该手机号已注册，可直接登录' }; }

    var rec = normalize({}, p);
    rec.registerDate = today();
    rec.balance = isFinite(Number(CFG.demoBalance)) ? Number(CFG.demoBalance) : 10000;
    rec.pwdHash = hash(pwd);
    seedTx(rec);
    persist(users, rec);
    saveSession(rec.phone);
    emit();
    return { ok: true, message: '注册成功，已为你登录', user: rec };
  }

  function login(phone, password) {
    var p = String(phone === null || phone === undefined ? '' : phone).replace(/\s+/g, '');
    var pwd = String(password === null || password === undefined ? '' : password);

    if (!PHONE_RE.test(p)) { return { ok: false, message: '请输入 11 位手机号（以 1 开头）' }; }
    if (!pwd) { return { ok: false, message: '请输入密码' }; }

    var users = readUsers();
    var raw = users[p];
    if (!raw || typeof raw !== 'object') { return { ok: false, message: '该手机号尚未注册，请先注册' }; }

    var rec = normalize(raw, p);
    if (!rec.pwdHash || rec.pwdHash !== hash(pwd)) { return { ok: false, message: '手机号或密码不正确' }; }

    persist(users, rec);
    saveSession(rec.phone);
    emit();
    return { ok: true, message: '登录成功', user: rec };
  }

  /* 清除 session；不动购物袋与收藏 */
  function logout() {
    clearSession();
    emit();
  }

  function update(patch) {
    var rec = current();
    if (!rec) { return { ok: false, message: '请先登录' }; }
    if (!patch || typeof patch !== 'object') { return { ok: false, message: '没有需要保存的改动' }; }

    var merged = obj(rec);
    for (var key in patch) {
      if (Object.prototype.hasOwnProperty.call(patch, key)) { merged[key] = patch[key]; }
    }
    /* 主键与凭据不允许被 patch 覆盖 */
    merged.phone = rec.phone;
    merged.pwdHash = rec.pwdHash;
    merged = normalize(merged, rec.phone);

    var users = readUsers();
    persist(users, merged);
    emit();
    return { ok: true, message: '已保存', user: merged };
  }

  function changePassword(oldPwd, newPwd) {
    var rec = current();
    if (!rec) { return { ok: false, message: '请先登录' }; }

    var oldText = String(oldPwd === null || oldPwd === undefined ? '' : oldPwd);
    var newText = String(newPwd === null || newPwd === undefined ? '' : newPwd);

    if (!oldText) { return { ok: false, message: '请输入当前密码' }; }
    if (rec.pwdHash !== hash(oldText)) { return { ok: false, message: '当前密码不正确' }; }
    if (newText.length < MIN_PWD) { return { ok: false, message: '新密码至少 ' + MIN_PWD + ' 位' }; }
    if (newText === oldText) { return { ok: false, message: '新密码不能与当前密码相同' }; }

    rec.pwdHash = hash(newText);
    var users = readUsers();
    persist(users, rec);
    return { ok: true, message: '密码已修改' };
  }

  /* ---------- 「记住我」只记手机号 ---------- */
  function remembered() {
    var s = store();
    var v = s ? s.get(REMEMBER_KEY, null) : null;
    if (!v) { return ''; }
    if (typeof v === 'string') { return v; }
    if (typeof v === 'object' && typeof v.phone === 'string') { return v.phone; }
    return '';
  }

  function remember(phone) {
    var s = store();
    if (!s) { return; }
    var p = String(phone === null || phone === undefined ? '' : phone).replace(/\s+/g, '');
    s.set(REMEMBER_KEY, p ? { phone: p } : null);
  }

  function forget() {
    remember('');
  }

  /* ---------- 导出 ---------- */
  window.DY = window.DY || {};
  window.DY.auth = {
    current: current,
    isLoggedIn: isLoggedIn,
    register: register,
    login: login,
    logout: logout,
    update: update,
    changePassword: changePassword,
    hash: hash,
    onChange: onChange,
    remembered: remembered,
    remember: remember,
    forget: forget
  };

  /* 初始化即播种演示账号（users 为空时） */
  seed();
})();

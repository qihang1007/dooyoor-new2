/* ==========================================================================
   dooyoor 㛊䎟 — 钱包 / 增值抵扣内核（§12.2 / §12.3 / §12.6 / §12.8 / §12.13）
   依赖：js/site-config.js（DY_CONFIG.discountRule）、js/auth.js（DY.auth；落盘由 auth 内部经
         js/cart.js 的 DY.store 完成）。本文件不直接使用 DY.store。
   暴露：window.DY.wallet（签名冻结，仅以下 7 个方法）
     balance() / history() / spend(amount, description) / earn(amount, description)
     / discountUnlocked() / discountDetail() / monthsHeld(buyTime)
   ---------------------------------------------------------------------------
   口径：
     · 余额与流水**只经 DY.auth.current() 读、只经 DY.auth.update(patch) 写**；
       本文件不直接碰 localStorage、不自建存储键（存储键见 §12.2）。
     · 未登录时：balance() → 0，history() → []，discountUnlocked() → 0，
       discountDetail() → []，spend/earn → {ok:false, message:'请先登录'}。
       （§12.6 把 balance/history/discountUnlocked/discountDetail 的返回类型
        冻结为 number / tx[] / number / array，因此这四者不返回 {ok:false} 对象，
        否则 orders.js 与 account-page.js 的 sum/遍历会直接坏掉。）
     · 所有公开方法都不抛异常；解析失败一律退化为安全默认值。
   ---------------------------------------------------------------------------
   ★ myProducts「抵扣不可重复计入」的约定（orders.js 必须照此遵守）：
     一条 myProduct 只允许被抵扣一次。结算时若用掉某条的抵扣额，必须把该条
     回写为 usedInOrder: '<订单号>'（推荐；同时可写 discountUsed: true、
     usedTime: ISO 字符串）。wallet 对带 usedInOrder / discountUsed / used
     任一真值的条目不进入 discountUnlocked() / discountDetail()，即永久排除，
     不会在后续订单里被二次抵扣。未被标记的条目始终视为「未使用」。
   ========================================================================== */
(function () {
  'use strict';

  /* ---------- 常量 ---------- */
  var TX_INCOME = 'income';
  var TX_EXPENSE = 'expense';
  var MSG_NOT_LOGIN = '请先登录';
  var MSG_BAD_AMOUNT = '金额不合法';
  var MSG_NEGATIVE = '金额不能为负数';
  var MSG_OVERDRAW = '余额不足';

  /* 抵扣「已用掉」的标记字段：任一为真值即永久排除 */
  var USED_FLAGS = ['usedInOrder', 'discountUsed', 'used'];

  /* 仅当 site-config.js 未加载、或 discountRule 字段缺失时的兜底。
     正常运行一律以 DY_CONFIG.discountRule 为准——算法内部绝不写死阈值。 */
  var RULE_FALLBACK = { holdMonths: 12, bonusStartMonths: 36, bonusPerYear: 100 };

  /* ---------- 基础工具（ES5） ---------- */
  function isArr(v) {
    return Object.prototype.toString.call(v) === '[object Array]';
  }

  function isObj(v) {
    return !!v && typeof v === 'object' && Object.prototype.toString.call(v) !== '[object Array]';
  }

  function toNum(v, fallback) {
    var n = Number(v);
    return isFinite(n) ? n : fallback;
  }

  /* 金额保留 2 位小数，避免浮点误差累积 */
  function round2(n) {
    var x = Number(n);
    if (!isFinite(x)) { return 0; }
    return Math.round(x * 100) / 100;
  }

  function pad2(n) {
    return (n < 10 ? '0' : '') + n;
  }

  function dateOnly(d) {
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  function today() {
    try { return dateOnly(new Date()); } catch (e) { return ''; }
  }

  function nowIso() {
    try { return new Date().toISOString(); } catch (e) { return today(); }
  }

  /* ---------- 配置（§12.8：阈值一律取自 DY_CONFIG.discountRule） ---------- */
  function rule() {
    var cfg = window.DY_CONFIG || {};
    var r = isObj(cfg.discountRule) ? cfg.discountRule : {};
    return {
      holdMonths: toNum(r.holdMonths, RULE_FALLBACK.holdMonths),
      bonusStartMonths: toNum(r.bonusStartMonths, RULE_FALLBACK.bonusStartMonths),
      bonusPerYear: toNum(r.bonusPerYear, RULE_FALLBACK.bonusPerYear)
    };
  }

  /* ---------- 账户读写（唯一出入口：DY.auth） ---------- */
  function auth() {
    var a = window.DY && window.DY.auth;
    return (a && typeof a.current === 'function' && typeof a.update === 'function') ? a : null;
  }

  function current() {
    var a = auth();
    if (!a) { return null; }
    try {
      var rec = a.current();
      return isObj(rec) ? rec : null;
    } catch (e) {
      return null;
    }
  }

  function save(patch) {
    var a = auth();
    if (!a) { return { ok: false, message: '账户模块未加载' }; }
    try {
      var res = a.update(patch);
      if (isObj(res) && typeof res.ok === 'boolean') { return res; }
      return { ok: false, message: '保存失败' };
    } catch (e) {
      return { ok: false, message: '保存失败' };
    }
  }

  function historyList(rec) {
    return isArr(rec && rec.balanceHistory) ? rec.balanceHistory.slice() : [];
  }

  function productList(rec) {
    return isArr(rec && rec.myProducts) ? rec.myProducts : [];
  }

  /* ---------- §12.8 月份对齐 ----------
     monthsHeld(buyTime) → 整月数（整数，永不为 NaN、永不为负）
     输入按 §12.8 必须是 ISO 字符串（new Date().toISOString()）。
     对齐规则：**按「日」对齐的日历整月，不足一月不计**。
       months = (y2-y1)*12 + (m2-m1)；若 now 的日 < 购买的日，则 months -= 1。
     两个时间点都按「本地日历字段」（年/月/日）比较，与显示口径一致。
     示例：2025-01-15 → 2026-01-15 记 12 个月；
           2025-01-31 → 2025-02-28 记 0 个月（28 < 31，不足一月）；
           2025-01-31 → 2025-03-01 记 1 个月（跨月后日已满足）；
           未来时间 / 无法解析 / 空值 → 0。 */
  function monthsHeld(buyTime) {
    try {
      var d;
      if (typeof buyTime === 'string') {
        if (!buyTime) { return 0; }
        d = new Date(buyTime);
      } else if (typeof buyTime === 'number' && isFinite(buyTime)) {
        d = new Date(buyTime);
      } else {
        return 0;
      }
      if (!d || isNaN(d.getTime())) { return 0; }

      var now = new Date();
      var months = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
      if (now.getDate() < d.getDate()) { months -= 1; }
      return months > 0 ? months : 0;
    } catch (e) {
      return 0;
    }
  }

  /* 取购买时间：orders.js 正常写 buyTime（ISO），其余字段仅作兼容兜底 */
  function buyTimeOf(item) {
    if (!isObj(item)) { return ''; }
    if (item.buyTime) { return item.buyTime; }
    if (item.buyDate) { return item.buyDate; }
    if (item.time) { return item.time; }
    if (item.createdAt) { return item.createdAt; }
    return '';
  }

  /* 是否已被抵扣使用过（见文件头约定） */
  function isConsumed(item) {
    if (!isObj(item)) { return true; }
    for (var i = 0; i < USED_FLAGS.length; i++) {
      if (item[USED_FLAGS[i]]) { return true; }
    }
    return false;
  }

  /* 单件抵扣计算（§12.8 严格实现）
       months = monthsHeld(buyTime)
       months < holdMonths                       → unlocked = 0
       否则 base = price；months >= bonusStartMonths 时
         bonus = (floor(months/12) - floor(bonusStartMonths/12) + 1) * bonusPerYear
         unlocked = base + bonus
     默认配置（holdMonths=12 / bonusStartMonths=36 / bonusPerYear=100）下，
     bonus 等价于规范里写的 (floor(months/12) - 2) * 100；
     这里用 bonusStartMonths 推导年份基数，保证阈值改配置即生效、不写死。 */
  function evaluate(item) {
    var r = rule();
    var months = monthsHeld(buyTimeOf(item));
    var base = 0;
    var bonus = 0;

    if (months >= r.holdMonths) {
      base = toNum(isObj(item) ? item.price : 0, 0);
      if (base < 0) { base = 0; }
      if (months >= r.bonusStartMonths) {
        var years = Math.floor(months / 12) - Math.floor(r.bonusStartMonths / 12) + 1;
        if (years > 0) { bonus = years * r.bonusPerYear; }
      }
    }

    return {
      months: months,
      bonus: round2(bonus),
      unlocked: round2(base + bonus)
    };
  }

  /* ---------- §12.6 API ---------- */

  /* 余额（元）。未登录 / 模块未加载 → 0 */
  function balance() {
    try {
      var rec = current();
      if (!rec) { return 0; }
      return round2(toNum(rec.balance, 0));
    } catch (e) {
      return 0;
    }
  }

  /* 流水，按时间**倒序**（最新在前）。未登录 → [] */
  function history() {
    try {
      var rec = current();
      if (!rec) { return []; }

      var raw = historyList(rec);
      var list = [];
      for (var i = 0; i < raw.length; i++) {
        var tx = raw[i];
        if (!isObj(tx)) { continue; }
        list.push({
          id: typeof tx.id === 'string' && tx.id ? tx.id : 'tx-' + i,
          amount: round2(toNum(tx.amount, 0)),
          type: tx.type === TX_INCOME ? TX_INCOME : TX_EXPENSE,
          description: (tx.description === null || tx.description === undefined) ? '' : String(tx.description),
          time: typeof tx.time === 'string' ? tx.time : '',
          date: typeof tx.date === 'string' ? tx.date : '',
          index: i
        });
      }

      /* 时间倒序；无法解析的时间记 0 排到最后，同一时间保持原有先后（稳定） */
      list.sort(function (a, b) {
        var ta = Date.parse(a.time) || Date.parse(a.date) || 0;
        var tb = Date.parse(b.time) || Date.parse(b.date) || 0;
        if (ta !== tb) { return tb - ta; }
        return a.index - b.index;
      });

      var out = [];
      for (var k = 0; k < list.length; k++) {
        out.push({
          id: list[k].id,
          amount: list[k].amount,
          type: list[k].type,
          description: list[k].description,
          time: list[k].time,
          date: list[k].date
        });
      }
      return out;
    } catch (e) {
      return [];
    }
  }

  /* 交易核心：收入 / 支出共用，amount 为绝对值，方向由 type 决定 */
  function move(type, amount, description) {
    var rec = current();
    if (!rec) { return { ok: false, message: MSG_NOT_LOGIN }; }

    if (amount === null || amount === undefined || typeof amount === 'boolean') {
      return { ok: false, message: MSG_BAD_AMOUNT };
    }
    if (typeof amount === 'string' && !amount.replace(/\s+/g, '')) {
      return { ok: false, message: MSG_BAD_AMOUNT };
    }
    var n = Number(amount);
    if (!isFinite(n)) { return { ok: false, message: MSG_BAD_AMOUNT }; }
    if (n < 0) { return { ok: false, message: MSG_NEGATIVE }; }
    n = round2(n);

    var cur = round2(toNum(rec.balance, 0));
    var next;
    if (type === TX_EXPENSE) {
      if (n > cur) { return { ok: false, message: MSG_OVERDRAW }; }
      next = round2(cur - n);
    } else {
      next = round2(cur + n);
    }

    var list = historyList(rec);
    var text = (description === null || description === undefined) ? '' : String(description);
    var tx = {
      id: 'tx' + Date.now() + '-' + list.length,
      amount: n,
      type: type,
      description: text || (type === TX_INCOME ? '收入' : '支出'),
      time: nowIso(),
      date: today()
    };
    list.push(tx);

    var res = save({ balance: next, balanceHistory: list });
    if (!res.ok) {
      return { ok: false, message: res.message || '保存失败' };
    }
    /* amount 允许为 0：抵扣已覆盖全部时仍要留一条 amount 为 0 的流水（§12.7） */
    return { ok: true, message: type === TX_INCOME ? '已入账' : '已扣款', balance: next };
  }

  function spend(amount, description) {
    try {
      return move(TX_EXPENSE, amount, description);
    } catch (e) {
      return { ok: false, message: MSG_BAD_AMOUNT };
    }
  }

  function earn(amount, description) {
    try {
      return move(TX_INCOME, amount, description);
    } catch (e) {
      return { ok: false, message: MSG_BAD_AMOUNT };
    }
  }

  /* 当前可抵扣总额（12.8）。未登录 → 0；已用于抵扣的条目不计入 */
  function discountUnlocked() {
    try {
      var rec = current();
      if (!rec) { return 0; }

      var items = productList(rec);
      var total = 0;
      for (var i = 0; i < items.length; i++) {
        if (isConsumed(items[i])) { continue; }
        total += evaluate(items[i]).unlocked;
      }
      return round2(total);
    } catch (e) {
      return 0;
    }
  }

  /* 逐件明细 [{myProduct, unlocked, months, bonus}]，供「我的抵扣」页。
     未解锁的条目也返回（unlocked=0），页面据此显示剩余月数；
     已用于抵扣的条目与 discountUnlocked() 一样被排除。 */
  function discountDetail() {
    try {
      var rec = current();
      if (!rec) { return []; }

      var items = productList(rec);
      var out = [];
      for (var i = 0; i < items.length; i++) {
        var item = items[i];
        if (isConsumed(item)) { continue; }
        var info = evaluate(item);
        out.push({
          myProduct: item,
          unlocked: info.unlocked,
          months: info.months,
          bonus: info.bonus
        });
      }
      return out;
    } catch (e) {
      return [];
    }
  }

  /* ---------- 导出 ---------- */
  window.DY = window.DY || {};
  window.DY.wallet = {
    balance: balance,
    history: history,
    spend: spend,
    earn: earn,
    discountUnlocked: discountUnlocked,
    discountDetail: discountDetail,
    monthsHeld: monthsHeld
  };
})();

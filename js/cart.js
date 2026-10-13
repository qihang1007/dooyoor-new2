/* ==========================================================================
   dooyoor 㛊䎟 — 购物袋内核 + 全局工具
   依赖：js/site-config.js
   暴露：window.DY.{ escape, money, el, getProduct, toast, cart }
   ========================================================================== */
(function () {
  'use strict';

  var CFG = window.DY_CONFIG || {};
  var PRODUCTS = CFG.products || [];
  var SHIPPING = CFG.shipping || { freeThreshold: 999, fee: 20 };
  var CURRENCY = CFG.currency || { symbol: '¥', decimals: 0 };

  var CART_KEY = 'dooyoor.cart.v1';
  var PROMO_KEY = 'dooyoor.promo.v1';
  var PROMOS = { WELCOME10: { rate: 0.1, label: '9 折' } };

  /* ---------- 存储：localStorage 不可用时退化为内存 ---------- */
  var memory = {};

  function readRaw(key) {
    try {
      var v = window.localStorage.getItem(key);
      return v === null ? null : v;
    } catch (e) {
      return Object.prototype.hasOwnProperty.call(memory, key) ? memory[key] : null;
    }
  }

  function writeRaw(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch (e) {
      memory[key] = value;
    }
  }

  /* ---------- 工具 ---------- */
  function escapeHtml(input) {
    if (input === null || input === undefined) { return ''; }
    return String(input)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function money(amount) {
    var n = Number(amount);
    if (!isFinite(n)) { n = 0; }
    var rounded = Math.round(n);
    var text = String(Math.abs(rounded));
    // 千分位
    text = text.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return CURRENCY.symbol + (rounded < 0 ? '-' : '') + text;
  }

  function el(html) {
    var tpl = document.createElement('template');
    tpl.innerHTML = String(html).trim();
    return tpl.content.firstElementChild;
  }

  function getProduct(id) {
    for (var i = 0; i < PRODUCTS.length; i++) {
      if (PRODUCTS[i].id === id) { return PRODUCTS[i]; }
    }
    return null;
  }

  function toast(message) {
    var node = document.querySelector('[data-toast]');
    if (!node) { return; }
    node.textContent = message;
    node.classList.add('is-show');
    if (toast._timer) { window.clearTimeout(toast._timer); }
    toast._timer = window.setTimeout(function () {
      node.classList.remove('is-show');
    }, 2400);
  }

  /* ---------- 购物袋状态 ---------- */
  function loadState() {
    var raw = readRaw(CART_KEY);
    var state = { items: [], promo: null };
    if (raw) {
      try {
        var parsed = JSON.parse(raw);
        if (parsed && Object.prototype.toString.call(parsed.items) === '[object Array]') {
          state.items = parsed.items.filter(function (it) {
            return it && typeof it.id === 'string' && typeof it.size === 'string'
              && isFinite(Number(it.qty)) && Number(it.qty) > 0 && getProduct(it.id);
          }).map(function (it) {
            return { id: it.id, size: it.size, qty: Math.min(9, Math.max(1, Math.round(Number(it.qty)))) };
          });
        }
      } catch (e) {
        state.items = [];
      }
    }
    var promo = readRaw(PROMO_KEY);
    if (promo && PROMOS[promo]) { state.promo = promo; }
    return state;
  }

  var state = loadState();

  function persist() {
    writeRaw(CART_KEY, JSON.stringify({ items: state.items }));
    writeRaw(PROMO_KEY, state.promo || '');
  }

  function keyOf(id, size) { return id + '__' + size; }

  function findIndex(id, size) {
    var k = keyOf(id, size);
    for (var i = 0; i < state.items.length; i++) {
      if (keyOf(state.items[i].id, state.items[i].size) === k) { return i; }
    }
    return -1;
  }

  function items() {
    return state.items.map(function (it) {
      var product = getProduct(it.id);
      var unit = product ? product.price : 0;
      return {
        key: keyOf(it.id, it.size),
        id: it.id,
        size: it.size,
        qty: it.qty,
        product: product,
        unitPrice: unit,
        lineTotal: unit * it.qty
      };
    });
  }

  function count() {
    return state.items.reduce(function (sum, it) { return sum + it.qty; }, 0);
  }

  function subtotal() {
    return state.items.reduce(function (sum, it) {
      var product = getProduct(it.id);
      return sum + (product ? product.price * it.qty : 0);
    }, 0);
  }

  function discount() {
    if (!state.promo || !PROMOS[state.promo]) { return 0; }
    return Math.round(subtotal() * PROMOS[state.promo].rate);
  }

  function shipping() {
    if (count() === 0) { return 0; }
    return subtotal() - discount() >= SHIPPING.freeThreshold ? 0 : SHIPPING.fee;
  }

  function total() {
    return Math.max(0, subtotal() - discount() + shipping());
  }

  function syncBadges() {
    var n = count();
    var nodes = document.querySelectorAll('[data-cart-count]');
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].textContent = String(n);
      if (n > 0) {
        nodes[i].removeAttribute('hidden');
      } else {
        nodes[i].setAttribute('hidden', 'hidden');
      }
    }
  }

  function announce() {
    syncBadges();
    document.dispatchEvent(new CustomEvent('dy:cart-change', {
      detail: { count: count(), subtotal: subtotal() }
    }));
  }

  function add(id, size, qty) {
    var product = getProduct(id);
    if (!product) { return { ok: false, message: '商品不存在' }; }
    if (!size) { return { ok: false, message: '请先选择尺码' }; }
    if (product.sizes.indexOf(size) === -1) { return { ok: false, message: '该尺码不可选' }; }

    var n = Math.max(1, Math.min(9, Math.round(Number(qty) || 1)));
    var idx = findIndex(id, size);
    if (idx === -1) {
      state.items.push({ id: id, size: size, qty: n });
    } else {
      state.items[idx].qty = Math.min(9, state.items[idx].qty + n);
    }
    persist();
    announce();
    return { ok: true, message: '已加入购物袋' };
  }

  function setQty(key, qty) {
    var n = Math.round(Number(qty));
    for (var i = 0; i < state.items.length; i++) {
      if (keyOf(state.items[i].id, state.items[i].size) === key) {
        if (!isFinite(n) || n <= 0) {
          state.items.splice(i, 1);
        } else {
          state.items[i].qty = Math.min(9, n);
        }
        persist();
        announce();
        return true;
      }
    }
    return false;
  }

  function remove(key) {
    for (var i = 0; i < state.items.length; i++) {
      if (keyOf(state.items[i].id, state.items[i].size) === key) {
        state.items.splice(i, 1);
        persist();
        announce();
        return true;
      }
    }
    return false;
  }

  function clear() {
    state.items = [];
    state.promo = null;
    persist();
    announce();
  }

  function applyPromo(code) {
    var normalized = String(code || '').trim().toUpperCase();
    if (!normalized) { return { ok: false, message: '请输入优惠码' }; }
    if (!PROMOS[normalized]) { return { ok: false, message: '优惠码无效或已过期' }; }
    state.promo = normalized;
    persist();
    announce();
    return { ok: true, message: '已应用：' + PROMOS[normalized].label };
  }

  function currentPromo() {
    return state.promo ? { code: state.promo, label: PROMOS[state.promo].label } : null;
  }

  /* ---------- 通用本地存储（供收藏、广告栏等模块复用） ---------- */
  function storeGet(key, fallback) {
    var raw = readRaw(key);
    if (raw === null || raw === '') { return fallback; }
    try {
      var parsed = JSON.parse(raw);
      return (parsed === null || parsed === undefined) ? fallback : parsed;
    } catch (e) {
      return fallback;
    }
  }

  function storeSet(key, value) {
    try {
      writeRaw(key, JSON.stringify(value));
      return true;
    } catch (e) {
      return false;
    }
  }

  /* 探测 localStorage 是否真的可用。
     注意：storeSet 在不可用时会降级到内存并**仍然返回 true**——此时值在本会话内
     有效，但不会落盘（刷新即丢）。调用方若需要区分「已落盘」与「仅本会话」，
     应读 store.available，或在写入后回读校验。 */
  var storageAvailable = (function () {
    try {
      var probe = '__dy_probe__';
      window.localStorage.setItem(probe, '1');
      window.localStorage.removeItem(probe);
      return true;
    } catch (e) {
      return false;
    }
  })();

  var store = { get: storeGet, set: storeSet, available: storageAvailable };

  /* ---------- 导出 ---------- */
  window.DY = window.DY || {};
  window.DY.store = store;
  window.DY.escape = escapeHtml;
  window.DY.money = money;
  window.DY.el = el;
  window.DY.getProduct = getProduct;
  window.DY.toast = toast;
  window.DY.cart = {
    items: items,
    count: count,
    subtotal: subtotal,
    shipping: shipping,
    discount: discount,
    total: total,
    add: add,
    setQty: setQty,
    remove: remove,
    clear: clear,
    applyPromo: applyPromo,
    currentPromo: currentPromo
  };

  document.addEventListener('DOMContentLoaded', syncBadges);
  if (document.readyState !== 'loading') { syncBadges(); }
})();

/* ==========================================================================
   dooyoor 㛊䎟 — 商品收藏
   依赖：js/site-config.js, js/cart.js（提供 DY.escape / DY.toast / DY.store）
   暴露：window.DY.fav.{ has, toggle, remove, ids, list, count, clear, buttonHtml }

   设计：卡片渲染方只需插入 DY.fav.buttonHtml(id, name) 返回的 HTML，
   点击事件由本文件在 document 上委托处理，渲染方无需绑定事件。
   ========================================================================== */
(function () {
  'use strict';

  var KEY = 'dooyoor.fav.v1';
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

  function productExists(id) {
    return !!(window.DY && typeof window.DY.getProduct === 'function' && window.DY.getProduct(id));
  }

  function load() {
    var raw = readRaw(KEY);
    var ids = [];
    if (raw) {
      try {
        var parsed = JSON.parse(raw);
        if (Object.prototype.toString.call(parsed) === '[object Array]') {
          ids = parsed.filter(function (x) {
            return typeof x === 'string' && x && productExists(x);
          });
          // 去重
          ids = ids.filter(function (x, i) { return ids.indexOf(x) === i; });
        }
      } catch (e) {
        ids = [];
      }
    }
    return ids;
  }

  var state = load();

  function persist() {
    writeRaw(KEY, JSON.stringify(state));
  }

  function esc(text) {
    if (window.DY && typeof window.DY.escape === 'function') { return window.DY.escape(text); }
    return String(text === null || text === undefined ? '' : text);
  }

  function has(id) { return state.indexOf(id) !== -1; }

  function count() { return state.length; }

  function ids() { return state.slice(); }

  function list() {
    var out = [];
    for (var i = 0; i < state.length; i++) {
      var p = window.DY.getProduct(state[i]);
      if (p) { out.push(p); }
    }
    return out;
  }

  function syncBadges() {
    var n = count();
    var nodes = document.querySelectorAll('[data-fav-count]');
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
    document.dispatchEvent(new CustomEvent('dy:fav-change', { detail: { count: count() } }));
  }

  function toggle(id) {
    if (!id || !productExists(id)) { return { ok: false, active: false }; }
    var i = state.indexOf(id);
    var nowActive;
    if (i === -1) {
      state.push(id);
      nowActive = true;
    } else {
      state.splice(i, 1);
      nowActive = false;
    }
    persist();
    announce();
    return { ok: true, active: nowActive };
  }

  function remove(id) {
    var i = state.indexOf(id);
    if (i === -1) { return false; }
    state.splice(i, 1);
    persist();
    announce();
    return true;
  }

  function clear() {
    state = [];
    persist();
    announce();
  }

  /* 供卡片渲染方使用的按钮 HTML。aria-label 会带上商品名以便读屏。 */
  function buttonHtml(id, name) {
    var active = has(id);
    var label = esc(name || '');
    var text = (active ? '取消收藏' : '收藏') + (label ? '：' + label : '');
    return '<button class="product-fav-btn' + (active ? ' is-active' : '') + '" type="button"'
      + ' data-fav-id="' + esc(id) + '"'
      + ' aria-pressed="' + (active ? 'true' : 'false') + '"'
      + ' aria-label="' + text + '">'
      + '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">'
      + '<path d="M12 20.2S4.6 15.5 4.6 10.4A4.3 4.3 0 0 1 12 7.5a4.3 4.3 0 0 1 7.4 2.9c0 5.1-7.4 9.8-7.4 9.8Z"/>'
      + '</svg></button>';
  }

  /* 事件委托：渲染方无需绑定 */
  document.addEventListener('click', function (e) {
    var target = e.target;
    if (!target || typeof target.closest !== 'function') { return; }
    var btn = target.closest('[data-fav-id]');
    if (!btn) { return; }
    e.preventDefault();
    var id = btn.getAttribute('data-fav-id');
    var result = toggle(id);
    if (!result.ok) { return; }

    btn.classList.toggle('is-active', result.active);
    btn.setAttribute('aria-pressed', result.active ? 'true' : 'false');
    var name = '';
    if (window.DY && typeof window.DY.getProduct === 'function') {
      var p = window.DY.getProduct(id);
      if (p) { name = p.name; }
    }
    btn.setAttribute('aria-label', (result.active ? '取消收藏' : '收藏') + (name ? '：' + name : ''));

    if (window.DY && typeof window.DY.toast === 'function') {
      window.DY.toast(result.active ? '已加入收藏' : '已取消收藏');
    }
  });

  /* 其它页面（如列表页按收藏筛选后）收藏变化时，同步按钮状态 */
  document.addEventListener('dy:fav-change', function () {
    var buttons = document.querySelectorAll('[data-fav-id]');
    for (var i = 0; i < buttons.length; i++) {
      var id = buttons[i].getAttribute('data-fav-id');
      buttons[i].classList.toggle('is-active', has(id));
      buttons[i].setAttribute('aria-pressed', has(id) ? 'true' : 'false');
    }
  });

  window.DY = window.DY || {};
  window.DY.fav = {
    has: has,
    toggle: toggle,
    remove: remove,
    ids: ids,
    list: list,
    count: count,
    clear: clear,
    buttonHtml: buttonHtml
  };

  document.addEventListener('DOMContentLoaded', syncBadges);
  if (document.readyState !== 'loading') { syncBadges(); }
})();

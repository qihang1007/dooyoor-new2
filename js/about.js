/* ==========================================================================
   dooyoor 㛊䎟 — 品牌故事页
   依赖：js/site-config.js, js/cart.js, js/main.js
   职责：渲染品牌故事正文、溯源机制四步、时间线、工艺三原则
   （本页数据渲染由 about.js 承担，属已批准的规范偏离）
   ========================================================================== */
(function () {
  'use strict';

  var CFG = window.DY_CONFIG || {};

  /* §5.6 图标集：本页需要「叶子 / 线轴 / 盾牌 / 对勾」四个。
     icon 名称只用于查这张表，不插入 DOM。 */
  var ICONS = {
    leaf: '<path d="M5 19c0-8 5-13 14-13 0 9-5 14-14 13Z"/><path d="M5 19c3-4 6-6 10-8"/>',
    spool: '<circle cx="12" cy="12" r="7"/><path d="M12 5v14M5 12h14"/>',
    shield: '<path d="M12 3l7 3v6c0 5-3 8-7 9-4-1-7-4-7-9V6l7-3Z"/><path d="M9 12l2 2 4-4"/>',
    check: '<path d="M5 13l4 4L19 7"/>'
  };

  /* 所有进入 DOM 的文本一律走 DY.escape()；
     DY 缺失时用同一套替换规则兜底，避免页面留白。 */
  function escapeText(value) {
    if (window.DY && typeof window.DY.escape === 'function') {
      return window.DY.escape(value);
    }
    if (value === null || value === undefined) { return ''; }
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function iconSvg(name, size) {
    var paths = Object.prototype.hasOwnProperty.call(ICONS, name) ? ICONS[name] : ICONS.leaf;
    var px = size || 22;
    return '<svg viewBox="0 0 24 24" width="' + px + '" height="' + px + '" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' + paths + '</svg>';
  }

  /* ---------- 1. 品牌故事正文（DY_CONFIG.brand.story） ---------- */
  function renderStory() {
    var node = document.querySelector('[data-about-story]');
    var story = (CFG.brand && CFG.brand.story) || [];
    if (!node || !story.length) { return; }

    var html = '';
    for (var i = 0; i < story.length; i++) {
      html += '<p>' + escapeText(story[i]) + '</p>';
    }
    node.innerHTML = html;
  }

  /* ---------- 2. 溯源机制四步（DY_CONFIG.brand.chain.steps） ----------
     对勾图标 + 标题 + 说明；条数完全由数据决定，不写死 4 条。 */
  function renderChainSteps() {
    var node = document.querySelector('[data-about-chain-steps]');
    var chain = (CFG.brand && CFG.brand.chain) || {};
    var steps = chain.steps || [];
    if (!node || !steps.length) { return; }

    var html = '';
    for (var i = 0; i < steps.length; i++) {
      var step = steps[i] || {};
      html += '<div class="verify-step">'
        + iconSvg('check', 18)
        + '<span><strong>' + escapeText(step.title) + '</strong>'
        + ' ' + escapeText(step.text) + '</span>'
        + '</div>';
    }
    node.innerHTML = html;
  }

  /* ---------- 3. 时间线（DY_CONFIG.timeline） ---------- */
  function renderTimeline() {
    var node = document.querySelector('[data-about-timeline]');
    var list = CFG.timeline || [];
    if (!node || !list.length) { return; }

    var html = '';
    for (var i = 0; i < list.length; i++) {
      var item = list[i] || {};
      html += '<li class="timeline-item">'
        + '<span class="timeline-year">' + escapeText(item.year) + '</span>'
        + '<div class="timeline-body">'
        + '<h3 class="h3">' + escapeText(item.title) + '</h3>'
        + '<p>' + escapeText(item.text) + '</p>'
        + '</div>'
        + '</li>';
    }
    node.innerHTML = html;
  }

  /* ---------- 4. 工艺三原则（DY_CONFIG.pillars） ---------- */
  function renderPillars() {
    var node = document.querySelector('[data-about-pillars]');
    var list = CFG.pillars || [];
    if (!node || !list.length) { return; }

    var html = '';
    for (var i = 0; i < list.length; i++) {
      var item = list[i] || {};
      html += '<li class="pillar">'
        + iconSvg(item.icon)
        + '<h3 class="h3">' + escapeText(item.title) + '</h3>'
        + '<p>' + escapeText(item.text) + '</p>'
        + '</li>';
    }
    node.innerHTML = html;
  }

  function init() {
    renderStory();
    renderChainSteps();
    renderTimeline();
    renderPillars();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

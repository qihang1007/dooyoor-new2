/* ==========================================================================
   dooyoor 㛊䎟 — 全局交互
   依赖：js/site-config.js, js/cart.js
   职责：抽屉、搜索层、导航高亮、页脚年份、订阅表单、滚动淡入、页头状态
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
    var body = document.body;
    var pageId = body.getAttribute('data-page') || '';

    /* ---------- 导航高亮 ---------- */
    // 商品详情页归属「全部商品」
    var activeId = pageId === 'product' ? 'shop' : pageId;
    if (activeId) {
      var navNodes = document.querySelectorAll('[data-nav]');
      for (var i = 0; i < navNodes.length; i++) {
        if (navNodes[i].getAttribute('data-nav') === activeId) {
          navNodes[i].setAttribute('aria-current', 'page');
        }
      }
    }

    /* ---------- 遮罩层管理 ---------- */
    function lockScroll(locked) {
      if (locked) {
        body.classList.add('is-locked');
      } else {
        body.classList.remove('is-locked');
      }
    }

    var overlayRegistry = [];

    function createOverlay(node, toggleAttr, closeAttr, overlayId) {
      var isOpen = false;
      var lastFocus = null;

      function open() {
        if (isOpen) { return; }
        // 同一时刻只允许一个遮罩层：关掉别的，不关自己
        for (var oi = 0; oi < overlayRegistry.length; oi++) {
          if (overlayRegistry[oi].id !== overlayId && overlayRegistry[oi].api.isOpen()) {
            overlayRegistry[oi].api.close();
          }
        }
        isOpen = true;
        lastFocus = document.activeElement;
        node.removeAttribute('hidden');
        // 下一帧加类，保证过渡生效
        window.requestAnimationFrame(function () {
          node.classList.add('is-open');
        });
        lockScroll(true);
      }

      function close() {
        if (!isOpen) { return; }
        isOpen = false;
        node.classList.remove('is-open');
        lockScroll(false);
        var finish = function () {
          if (!isOpen) { node.setAttribute('hidden', 'hidden'); }
        };
        window.setTimeout(finish, 320);
        if (lastFocus && typeof lastFocus.focus === 'function') { lastFocus.focus(); }
      }

      function toggle() { if (isOpen) { close(); } else { open(); } }

      // 触发按钮
      var toggles = document.querySelectorAll('[' + toggleAttr + ']');
      for (var t = 0; t < toggles.length; t++) {
        (function (btn) {
          btn.addEventListener('click', function (e) {
            e.preventDefault();
            toggle();
            btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
          });
        })(toggles[t]);
      }

      // 关闭按钮
      var closers = node.querySelectorAll('[' + closeAttr + ']');
      for (var c = 0; c < closers.length; c++) {
        closers[c].addEventListener('click', function (e) {
          e.preventDefault();
          close();
          var tr = document.querySelectorAll('[' + toggleAttr + ']');
          for (var k = 0; k < tr.length; k++) { tr[k].setAttribute('aria-expanded', 'false'); }
        });
      }

      var api = { open: open, close: close, toggle: toggle, isOpen: function () { return isOpen; } };
      overlayRegistry.push({ id: overlayId, api: api });
      return api;
    }

    var drawerNode = document.querySelector('[data-drawer]');
    var searchNode = document.querySelector('[data-search]');
    var drawer = null;
    var search = null;

    if (drawerNode) {
      drawer = createOverlay(drawerNode, 'data-menu-toggle', 'data-drawer-close', 'drawer');
      // 抽屉内点链接后关闭
      var links = drawerNode.querySelectorAll('a');
      for (var l = 0; l < links.length; l++) {
        links[l].addEventListener('click', function () { drawer.close(); });
      }
    }

    if (searchNode) {
      search = createOverlay(searchNode, 'data-search-toggle', 'data-search-close', 'search');
      var input = searchNode.querySelector('input[type="search"]');
      if (input) {
        // 打开后自动聚焦
        document.addEventListener('click', function (e) {
          var trigger = e.target.closest ? e.target.closest('[data-search-toggle]') : null;
          if (trigger) {
            window.setTimeout(function () { input.focus(); }, 220);
          }
        });

        // 清除按钮：有内容才出现
        var clearBtn = searchNode.querySelector('[data-search-clear]');
        if (clearBtn) {
          var syncClear = function () {
            if (input.value.length > 0) {
              clearBtn.removeAttribute('hidden');
              window.requestAnimationFrame(function () { clearBtn.classList.add('is-visible'); });
            } else {
              clearBtn.classList.remove('is-visible');
              clearBtn.setAttribute('hidden', 'hidden');
            }
          };
          input.addEventListener('input', syncClear);
          clearBtn.addEventListener('click', function (e) {
            e.preventDefault();
            input.value = '';
            syncClear();
            input.focus();
          });
          syncClear();
        }
      }
    }

    /* ---------- Esc 关闭 ---------- */
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape' && e.key !== 'Esc') { return; }
      if (search && search.isOpen()) { search.close(); return; }
      if (drawer && drawer.isOpen()) { drawer.close(); }
    });

    /* ---------- 页脚年份 ---------- */
    var years = document.querySelectorAll('[data-year]');
    var thisYear = String(new Date().getFullYear());
    for (var y = 0; y < years.length; y++) { years[y].textContent = thisYear; }

    /* ---------- 订阅表单 ---------- */
    var newsForms = document.querySelectorAll('[data-news-form]');
    for (var n = 0; n < newsForms.length; n++) {
      (function (form) {
        form.addEventListener('submit', function (e) {
          e.preventDefault();
          var note = form.parentNode.querySelector('[data-news-note]');
          var field = form.querySelector('input[type="email"]');
          var value = field ? String(field.value || '').trim() : '';
          var valid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);

          if (!note) { return; }
          note.classList.remove('is-error');

          if (!valid) {
            note.textContent = '请填写有效的邮箱地址';
            note.classList.add('is-error');
            if (field) { field.focus(); }
            return;
          }
          note.textContent = '订阅成功，下一封新品通知会发到 ' + value;
          form.reset();
        });
      })(newsForms[n]);
    }

    /* ---------- 页头滚动状态 ---------- */
    var header = document.querySelector('[data-header]');
    if (header) {
      var onScroll = function () {
        if (window.pageYOffset > 4) {
          header.classList.add('is-stuck');
        } else {
          header.classList.remove('is-stuck');
        }
      };
      window.addEventListener('scroll', onScroll, { passive: true });
      onScroll();
    }

    /* ---------- 滚动淡入 ---------- */
    var revealNodes = document.querySelectorAll('[data-reveal]');
    if (revealNodes.length) {
      if ('IntersectionObserver' in window) {
        var io = new IntersectionObserver(function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              entry.target.classList.add('is-visible');
              io.unobserve(entry.target);
            }
          });
        }, { rootMargin: '0px 0px -8% 0px', threshold: 0.06 });

        for (var r = 0; r < revealNodes.length; r++) { io.observe(revealNodes[r]); }
      } else {
        for (var r2 = 0; r2 < revealNodes.length; r2++) {
          revealNodes[r2].classList.add('is-visible');
        }
      }
    }
  });
})();

/* ==========================================================================
   dooyoor 㛊䎟 — 首页渲染
   依赖：js/site-config.js, js/cart.js, js/main.js
   职责：系列入口、精选商品、工艺三原则、区块链溯源、服务承诺
        （文案与商品数据全部取自 DY_CONFIG，不硬编码在 HTML 里）
   ========================================================================== */
(function () {
  'use strict';

  /* ---------- §5.6 图标集（内联 SVG，24 格） ---------- */
  var ICONS = {
    leaf: '<path d="M5 19c0-8 5-13 14-13 0 9-5 14-14 13Z"/><path d="M5 19c3-4 6-6 10-8"/>',
    spool: '<circle cx="12" cy="12" r="7"/><path d="M12 5v14M5 12h14"/>',
    shield: '<path d="M12 3l7 3v6c0 5-3 8-7 9-4-1-7-4-7-9V6l7-3Z"/><path d="M9 12l2 2 4-4"/>',
    truck: '<path d="M3 7h11v10H3z"/><path d="M14 10h4l3 3v4h-7z"/><circle cx="7" cy="18" r="1.6"/><circle cx="17" cy="18" r="1.6"/>',
    renew: '<path d="M4 12a8 8 0 0 1 13-6"/><path d="M20 12a8 8 0 0 1-13 6"/><path d="M17 3v3h-3"/><path d="M7 21v-3h3"/>',
    check: '<path d="M5 13l4 4L19 7"/>'
  };

  function icon(name, size) {
    var body = ICONS[name] || ICONS.leaf;
    var px = size || 22;
    return '<svg viewBox="0 0 24 24" width="' + px + '" height="' + px + '" aria-hidden="true" fill="none" '
      + 'stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">'
      + body + '</svg>';
  }

  function onReady(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  }

  /* ---------- 系列入口 ---------- */
  function collectionCard(item) {
    var esc = window.DY.escape;
    var lines = [];
    lines.push('      <a class="collection-card" href="' + esc(item.href) + '">');
    lines.push('        <div class="collection-media">');
    lines.push('          <img src="' + esc(item.image) + '" alt="' + esc(item.name) + '" loading="lazy" decoding="async" width="800" height="1000">');
    lines.push('        </div>');
    lines.push('        <div class="collection-label">');
    lines.push('          <span>' + esc(item.name) + '</span>');
    lines.push('          <em>' + esc(item.en) + '</em>');
    lines.push('        </div>');
    lines.push('      </a>');
    return lines.join('\n');
  }

  /* ---------- 商品卡（结构逐字照抄规范 §7.7） ---------- */
  function productCard(product) {
    var esc = window.DY.escape;
    var href = 'product.html?id=' + encodeURIComponent(product.id);
    var isUsed = product.condition === 'used';
    var badgeClass = 'product-badge' + (isUsed ? ' product-badge--used' : '');
    var lines = [];

    lines.push('      <article class="product-card">');
    lines.push('        <a class="product-media" href="' + esc(href) + '">');
    lines.push('          <img src="' + esc(product.image) + '" alt="' + esc(product.name) + '" loading="lazy" decoding="async" width="800" height="1000">');
    if (product.badge) {
      lines.push('          <span class="' + badgeClass + '">' + esc(product.badge) + '</span>');
    } else if (isUsed) {
      /* 认证二手即使没有 badge，也必须给出成色角标 */
      lines.push('          <span class="' + badgeClass + '">' + esc(product.conditionName || '认证二手') + '</span>');
    }
    lines.push('        </a>');
    lines.push('        <div class="product-body">');
    lines.push('          <h3 class="product-name"><a href="' + esc(href) + '">' + esc(product.name) + '</a></h3>');
    lines.push('          <p class="product-en">' + esc(product.en) + '</p>');

    /* compareAt 存在：现价 .price--sale，原价 .price--was */
    var price = '          <p class="product-price"><span class="'
      + (product.compareAt ? 'price price--sale' : 'price') + '">'
      + esc(window.DY.money(product.price)) + '</span>';
    if (product.compareAt) {
      price += '<span class="price--was">原价 ' + esc(window.DY.money(product.compareAt)) + '</span>';
    }
    lines.push(price + '</p>');

    lines.push('          <ul class="product-swatches" aria-label="可选颜色">');
    (product.colors || []).forEach(function (color) {
      lines.push('            <li><span class="swatch" style="--sw:' + esc(color.hex) + '" title="' + esc(color.name) + '"></span></li>');
    });
    lines.push('          </ul>');
    lines.push('        </div>');
    lines.push('      </article>');
    return lines.join('\n');
  }

  /* ---------- 原则 / 承诺 ---------- */
  function pillar(item) {
    var esc = window.DY.escape;
    return '      <article class="pillar">\n'
      + '        ' + icon(item.icon) + '\n'
      + '        <h3 class="h3">' + esc(item.title) + '</h3>\n'
      + '        <p>' + esc(item.text) + '</p>\n'
      + '      </article>';
  }

  /* ---------- 区块链溯源：4 条机制说明 ---------- */
  function verifyStep(step) {
    var esc = window.DY.escape;
    return '            <div class="verify-step">\n'
      + '              ' + icon('check', 18) + '\n'
      + '              <div><strong>' + esc(step.title) + '</strong><br>' + esc(step.text) + '</div>\n'
      + '            </div>';
  }

  var PROMISES = [
    {
      icon: 'renew',
      title: '版型比对数百位真实身形',
      text: '每一条腰线的弧度都反复比对过数百位普通女性的日常身形。不追求极端的“纸片人效果”，只让丹宁妥帖地承托你最舒服的状态。'
    },
    {
      icon: 'truck',
      title: '全国包邮（西藏、新疆、港澳台除外）',
      text: '全国包邮（西藏、新疆、港澳台除外）。现货在收到订单后 48 小时内从上海仓发出。'
    },
    {
      icon: 'shield',
      title: '全新 30 天、认证二手 7 天无理由',
      text: '全新品签收后 30 天内，吊牌完整、未经洗涤与穿着可退换；认证二手支持 7 天无理由，需保持成色与寄出时一致。'
    }
  ];

  /* ---------- 首页轮播（css/style.css §25.1） ---------- */
  var BANNER_INTERVAL = 4000;
  var SWIPE_THRESHOLD = 40;

  /* 后台「广告栏装修」写入的本地存档优先，损坏或为空时回落 site-config 默认值 */
  function bannerData(config) {
    var stored = window.DY.store.get(config.bannersKey, null);
    var list = (Object.prototype.toString.call(stored) === '[object Array]' && stored.length > 0)
      ? stored
      : (config.banners || []);

    return list.filter(function (item) {
      return item && item.status === 'active';
    }).sort(function (a, b) {
      return (Number(a.sort) || 0) - (Number(b.sort) || 0);
    });
  }

  function bannerSlide(item, index) {
    var esc = window.DY.escape;
    var lines = [];
    lines.push('        <div class="banner-slide' + (index === 0 ? ' is-active' : '') + '">');
    lines.push('          <img src="' + esc(item.image) + '" alt="' + esc(item.title) + '" loading="lazy" decoding="async" width="1600" height="1100">');
    lines.push('          <div class="banner-overlay"></div>');
    lines.push('          <div class="banner-content">');
    lines.push('            <p class="banner-title">' + esc(item.title) + '</p>');
    lines.push('            <p class="banner-desc">' + esc(item.desc) + '</p>');
    if (item.link) {
      lines.push('            <div class="banner-cta"><a class="btn btn--primary" href="' + esc(item.link) + '">' + esc(item.linkText || '了解详情') + '</a></div>');
    }
    lines.push('          </div>');
    lines.push('        </div>');
    return lines.join('\n');
  }

  function bannerDot(item, index) {
    return '        <button class="banner-dot' + (index === 0 ? ' is-active' : '') + '" type="button"'
      + ' data-banner-dot="' + index + '"'
      + ' aria-label="第 ' + (index + 1) + ' 张"' + (index === 0 ? ' aria-current="true"' : '') + '></button>';
  }

  function renderBanner() {
    if (!window.DY || !window.DY.store || !window.DY.escape || !window.DY_CONFIG) { return; }

    var banner = document.querySelector('[data-banner]');
    if (!banner) { return; }

    var list = bannerData(window.DY_CONFIG);
    if (!list.length) {
      /* 无可用数据时不留空壳 */
      banner.hidden = true;
      return;
    }

    var swiper = banner.querySelector('[data-banner-swiper]');
    var track = banner.querySelector('[data-banner-track]');
    var dotsBox = banner.querySelector('[data-banner-dots]');
    var prevBtn = banner.querySelector('[data-banner-prev]');
    var nextBtn = banner.querySelector('[data-banner-next]');
    if (!swiper || !track || !dotsBox) {
      banner.hidden = true;
      return;
    }

    track.innerHTML = list.map(bannerSlide).join('\n');
    dotsBox.innerHTML = list.map(bannerDot).join('\n');

    var slides = track.querySelectorAll('.banner-slide');
    var dots = dotsBox.querySelectorAll('.banner-dot');
    var total = list.length;
    var single = total <= 1;
    var current = 0;
    var timer = null;
    var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

    function goTo(index) {
      current = ((index % total) + total) % total;
      track.style.transform = 'translateX(-' + (current * 100) + '%)';
      for (var i = 0; i < slides.length; i++) {
        if (i === current) {
          slides[i].classList.add('is-active');
          dots[i].classList.add('is-active');
          dots[i].setAttribute('aria-current', 'true');
        } else {
          slides[i].classList.remove('is-active');
          dots[i].classList.remove('is-active');
          dots[i].removeAttribute('aria-current');
        }
      }
    }

    function stopTimer() {
      if (timer !== null) {
        window.clearInterval(timer);
        timer = null;
      }
    }

    function startTimer() {
      stopTimer();
      /* 无障碍：偏好减少动效时不自动播放；单张与页面隐藏时也停 */
      if (reduce || single) { return; }
      if (document.visibilityState === 'hidden') { return; }
      timer = window.setInterval(function () { goTo(current + 1); }, BANNER_INTERVAL);
    }

    /* 手动切换后重置计时器 */
    function manualGoTo(index) {
      goTo(index);
      startTimer();
    }

    function dotIndexFrom(node) {
      var el = node;
      while (el && el !== dotsBox) {
        if (el.getAttribute && el.getAttribute('data-banner-dot') !== null) {
          return parseInt(el.getAttribute('data-banner-dot'), 10) || 0;
        }
        el = el.parentNode;
      }
      return -1;
    }

    if (single) {
      if (prevBtn) { prevBtn.hidden = true; }
      if (nextBtn) { nextBtn.hidden = true; }
      dotsBox.hidden = true;
    }

    if (prevBtn) {
      prevBtn.addEventListener('click', function () { manualGoTo(current - 1); });
    }
    if (nextBtn) {
      nextBtn.addEventListener('click', function () { manualGoTo(current + 1); });
    }

    dotsBox.addEventListener('click', function (event) {
      var index = dotIndexFrom(event.target);
      if (index >= 0) { manualGoTo(index); }
    });

    /* 键盘：左右方向键切换 */
    swiper.setAttribute('tabindex', '0');
    swiper.addEventListener('keydown', function (event) {
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        manualGoTo(current - 1);
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        manualGoTo(current + 1);
      }
    });

    /* 手势：左右滑动，阈值约 40px（原生事件，无任何库） */
    var touchStartX = null;

    swiper.addEventListener('touchstart', function (event) {
      if (event.touches.length !== 1) { return; }
      touchStartX = event.touches[0].clientX;
    }, { passive: true });

    swiper.addEventListener('touchend', function (event) {
      if (touchStartX === null) { return; }
      var endX = (event.changedTouches && event.changedTouches[0])
        ? event.changedTouches[0].clientX
        : touchStartX;
      var dx = endX - touchStartX;
      touchStartX = null;
      if (Math.abs(dx) < SWIPE_THRESHOLD) { return; }
      manualGoTo(dx < 0 ? current + 1 : current - 1);
    });

    swiper.addEventListener('touchcancel', function () { touchStartX = null; });

    /* 页面隐藏时暂停自动播放，可见时恢复 */
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') {
        stopTimer();
      } else {
        startTimer();
      }
    });

    startTimer();
  }

  /* ---------- 渲染 ---------- */
  function render() {
    if (!window.DY_CONFIG || !window.DY || !window.DY.cart) { return; }

    var config = window.DY_CONFIG;
    var brand = config.brand || {};
    var chain = brand.chain || {};
    var collections = config.collections || [];
    var products = config.products || [];
    var pillars = config.pillars || [];
    var steps = chain.steps || [];

    var collectionGrid = document.querySelector('[data-collection-grid]');
    if (collectionGrid) {
      collectionGrid.innerHTML = collections.map(collectionCard).join('\n');
    }

    var productGrid = document.querySelector('[data-product-grid]');
    if (productGrid) {
      productGrid.innerHTML = products.slice(0, 4).map(productCard).join('\n');
    }

    var pillarList = document.querySelector('[data-pillars]');
    if (pillarList) {
      pillarList.innerHTML = pillars.map(pillar).join('\n');
    }

    var promiseList = document.querySelector('[data-promise-pillars]');
    if (promiseList) {
      promiseList.innerHTML = PROMISES.map(pillar).join('\n');
    }

    var chainNote = document.querySelector('[data-chain-note]');
    if (chainNote) {
      chainNote.textContent = chain.note || '';
    }

    var verifySteps = document.querySelector('[data-verify-steps]');
    if (verifySteps) {
      verifySteps.innerHTML = steps.map(verifyStep).join('\n');
    }
  }

  onReady(function () {
    render();
    renderBanner();
  });
})();

/* ==========================================================================
   dooyoor 㛊䎟 — 购物袋页
   依赖：js/site-config.js, js/cart.js, js/main.js
        （可选）js/auth.js, js/wallet.js, js/orders.js —— 缺失时优雅降级，不抛异常
   职责：渲染购物袋列表与金额、数量增减、移除、优惠码、免运费进度、
        收货信息表单校验、把结算整单交给 DY.orders.checkout
   只使用 DY 公开 API：DY.escape / DY.money / DY.toast / DY.cart.*
        及 DY.auth.isLoggedIn / DY.wallet.balance / DY.wallet.discountUnlocked / DY.orders.checkout
   金额与扣款一律由 DY.orders 负责，本页不计算、不改写、不扣款。
   ========================================================================== */
(function () {
  'use strict';

  var CFG = window.DY_CONFIG || {};
  var SHIPPING = CFG.shipping || { freeThreshold: 999, fee: 20 };

  var ICON_DEC = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M5 12h14"/></svg>';
  var ICON_INC = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>';

  function onReady(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  }

  function $(selector, root) {
    return (root || document).querySelector(selector);
  }

  /* 文本一律经 DY.escape 后再插入 DOM */
  function esc(value) {
    if (window.DY && typeof window.DY.escape === 'function') { return window.DY.escape(value); }
    return String(value === null || value === undefined ? '' : value);
  }

  function money(amount) {
    if (window.DY && typeof window.DY.money === 'function') { return window.DY.money(amount); }
    return '¥' + amount;
  }

  /* ---------- 账户 / 钱包 / 订单层：存在性判断，任一缺失都不抛异常 ---------- */

  function authApi() {
    return (window.DY && window.DY.auth) ? window.DY.auth : null;
  }

  function walletApi() {
    return (window.DY && window.DY.wallet) ? window.DY.wallet : null;
  }

  function ordersApi() {
    return (window.DY && window.DY.orders) ? window.DY.orders : null;
  }

  function isLoggedIn() {
    var auth = authApi();
    if (!auth || typeof auth.isLoggedIn !== 'function') { return false; }
    try {
      return auth.isLoggedIn() === true;
    } catch (e) {
      return false;
    }
  }

  /* 余额 / 可用抵扣：只读钱包层的结果，本页不做任何抵扣计算 */
  function walletNumber(method) {
    var wallet = walletApi();
    if (!wallet || typeof wallet[method] !== 'function') { return 0; }
    try {
      var value = Number(wallet[method]());
      return isFinite(value) ? value : 0;
    } catch (e) {
      return 0;
    }
  }

  function walletBalance() { return walletNumber('balance'); }
  function walletCredit() { return walletNumber('discountUnlocked'); }

  function demoNote() {
    var note = window.DY_CONFIG && window.DY_CONFIG.demoBalanceNote;
    return note ? String(note) : '演示余额，不涉及真实资金。';
  }

  onReady(function () {
    var DY = window.DY;
    if (!DY || !DY.cart) { return; }

    var layoutNode = $('[data-cart-layout]');
    var listNode = $('[data-cart-list]');
    var emptyNode = $('[data-cart-empty]');
    var shipBar = $('[data-ship-bar]');
    var shipFill = $('[data-ship-fill]');
    var shipText = $('[data-ship-text]');
    var shipRow = $('[data-row-ship]');
    var discountRow = $('[data-row-discount]');
    var promoForm = $('[data-promo-form]');
    var promoInput = promoForm ? promoForm.querySelector('input') : null;
    var promoNote = $('[data-promo-note]');
    var checkoutBtn = $('[data-checkout]');
    var checkoutForm = $('[data-checkout-form]');
    var checkoutError = $('[data-checkout-error]');
    var creditRow = $('[data-row-credit]');
    var balanceRow = $('[data-row-balance]');
    var walletNote = $('[data-wallet-note]');
    var loginNote = $('[data-login-note]');
    var busy = false;

    function setText(selector, value, root) {
      var node = $(selector, root);
      if (node) { node.innerHTML = esc(value); }
    }

    /* 显示/隐藏：属性 + .u-hide 一起用，保证 display 一定生效 */
    function setShown(node, shown) {
      if (!node) { return; }
      if (shown) {
        node.removeAttribute('hidden');
        node.classList.remove('u-hide');
      } else {
        node.setAttribute('hidden', 'hidden');
        node.classList.add('u-hide');
      }
    }

    /* ---------- 单条购物袋项 ---------- */
    function itemHtml(item) {
      var product = item.product;
      if (!product) { return ''; }

      var href = 'product.html?id=' + encodeURIComponent(item.id);
      var name = esc(product.name);
      var qty = Number(item.qty) || 1;

      return '<article class="cart-item" data-key="' + esc(item.key) + '" data-id="' + esc(item.id) + '">'
        + '<a class="cart-item-media" href="' + esc(href) + '">'
        + '<img src="' + esc(product.image) + '" alt="' + name + '" loading="lazy" decoding="async" width="84" height="105">'
        + '</a>'
        + '<div class="cart-item-info">'
        + '<h3 class="cart-item-name"><a href="' + esc(href) + '">' + name + '</a></h3>'
        + '<p class="cart-item-meta">' + esc(product.en) + '</p>'
        + '<p class="cart-item-meta">尺码 ' + esc(item.size) + ' · ' + esc(product.categoryName) + '</p>'
        + '<p class="cart-item-price">' + esc(money(item.unitPrice)) + '</p>'
        + '<div class="cart-item-actions">'
        + '<div class="qty">'
        + '<button class="qty-btn" type="button" data-qty="dec" aria-label="减少数量">' + ICON_DEC + '</button>'
        + '<input class="qty-input" type="text" inputmode="numeric" readonly value="' + esc(qty) + '" aria-label="' + name + '的数量">'
        + '<button class="qty-btn" type="button" data-qty="inc" aria-label="增加数量">' + ICON_INC + '</button>'
        + '</div>'
        + '<button class="link-btn" type="button" data-remove>移除</button>'
        + '</div>'
        + '</div>'
        + '</article>';
    }

    /* ---------- 免运费进度 ---------- */
    function renderShipBar(subtotal, discount) {
      var threshold = Number(SHIPPING.freeThreshold) || 0;
      var base = Math.max(0, subtotal - discount);
      var progress = 1;
      var text = '已免运费';

      if (threshold > 0 && base < threshold) {
        progress = base / threshold;
        text = '再买 ' + money(threshold - base) + ' 即免运费';
      }

      progress = Math.min(1, Math.max(0, progress));
      var value = progress.toFixed(3);

      if (shipBar) { shipBar.style.setProperty('--p', value); }
      if (shipFill) { shipFill.style.setProperty('--p', value); }
      if (shipText) { shipText.innerHTML = esc(text); }
    }

    /* ---------- 支付明细：可用抵扣 / 当前余额（数值全部来自 wallet 层） ---------- */
    function renderWallet() {
      var logged = isLoggedIn();
      var credit = walletCredit();

      /* 可用抵扣：登录且大于 0 才显示 */
      setShown(creditRow, logged && credit > 0);
      setText('[data-sum-credit]', money(credit), creditRow);

      setShown(balanceRow, true);
      setText('[data-sum-balance]', money(walletBalance()), balanceRow);

      if (walletNote) {
        walletNote.innerHTML = '<span class="badge badge--warn">' + esc(demoNote()) + '</span><br>'
          + esc('可用抵扣与余额由订单模块按下单规则计算，最终以订单金额为准。');
      }

      setShown(loginNote, !logged);
      if (checkoutBtn && !busy) {
        checkoutBtn.innerHTML = esc(logged ? '去结算' : '请先登录后结算');
      }
    }

    /* ---------- 收货信息校验 ---------- */
    var PHONE_RE = /^1\d{10}$/;

    function formField(name) {
      return checkoutForm ? checkoutForm.querySelector('[name="' + name + '"]') : null;
    }

    function fieldErrorNode(name) {
      return $('[data-field-error="' + name + '"]');
    }

    function fieldValue(name) {
      var input = formField(name);
      return input ? String(input.value || '').trim() : '';
    }

    function setFieldError(name, message) {
      var errorNode = fieldErrorNode(name);
      var input = formField(name);
      if (errorNode) { errorNode.innerHTML = message ? esc(message) : ''; }
      if (input) {
        if (message) {
          input.classList.add('is-invalid');
          input.setAttribute('aria-invalid', 'true');
        } else {
          input.classList.remove('is-invalid');
          input.removeAttribute('aria-invalid');
        }
      }
    }

    function checkReceiver() {
      var value = fieldValue('receiver');
      if (!value) { setFieldError('receiver', '请填写收件人姓名'); return false; }
      if (value.length < 2) { setFieldError('receiver', '收件人姓名至少 2 个字'); return false; }
      setFieldError('receiver', '');
      return true;
    }

    function checkPhone() {
      var value = fieldValue('phone').replace(/[\s-]/g, '');
      if (!value) { setFieldError('phone', '请填写手机号'); return false; }
      if (!PHONE_RE.test(value)) { setFieldError('phone', '手机号应为 11 位数字且以 1 开头'); return false; }
      setFieldError('phone', '');
      return true;
    }

    function checkAddress() {
      var value = fieldValue('address');
      if (!value) { setFieldError('address', '请填写详细地址'); return false; }
      if (value.length < 5) { setFieldError('address', '详细地址至少 5 个字，含省市区与门牌号'); return false; }
      setFieldError('address', '');
      return true;
    }

    function validateForm() {
      var okReceiver = checkReceiver();
      var okPhone = checkPhone();
      var okAddress = checkAddress();
      return okReceiver && okPhone && okAddress;
    }

    function focusFirstInvalid() {
      if (!checkoutForm) { return; }
      var invalid = checkoutForm.querySelector('.is-invalid');
      if (invalid && typeof invalid.focus === 'function') { invalid.focus(); }
    }

    function setCheckoutError(message) {
      if (!checkoutError) { return; }
      checkoutError.innerHTML = message ? esc(message) : '';
    }

    function setBusy(value) {
      busy = value;
      if (!checkoutBtn) { return; }
      checkoutBtn.disabled = value;
      checkoutBtn.innerHTML = esc(value ? '提交中…' : (isLoggedIn() ? '去结算' : '请先登录后结算'));
    }

    if (checkoutForm) {
      var watched = ['receiver', 'phone', 'address'];
      var checkers = { receiver: checkReceiver, phone: checkPhone, address: checkAddress };
      for (var w = 0; w < watched.length; w++) {
        (function (name) {
          var input = formField(name);
          if (!input) { return; }
          input.addEventListener('blur', function () { checkers[name](); });
          input.addEventListener('input', function () {
            if (input.classList.contains('is-invalid')) { checkers[name](); }
            setCheckoutError('');
          });
        })(watched[w]);
      }
    }

    /* ---------- 渲染（首次 DOMContentLoaded 与 dy:cart-change 共用） ---------- */
    function render() {
      var items = DY.cart.items();
      var isEmpty = items.length === 0;

      setShown(layoutNode, !isEmpty);
      setShown(emptyNode, isEmpty);

      if (listNode) {
        var html = '';
        for (var i = 0; i < items.length; i++) { html += itemHtml(items[i]); }
        listNode.innerHTML = html;
      }

      var count = DY.cart.count();
      var subtotal = DY.cart.subtotal();
      var shipping = DY.cart.shipping();
      var discount = DY.cart.discount();
      var total = DY.cart.total();
      var promo = typeof DY.cart.currentPromo === 'function' ? DY.cart.currentPromo() : null;

      setText('[data-sum-subtotal]', money(subtotal));
      setText('[data-sum-total]', money(total));

      /* 运费：满额免运费时显示「免运费」并加 .summary-row--free */
      if (shipRow) {
        var free = count > 0 && shipping === 0;
        if (free) {
          shipRow.classList.add('summary-row--free');
        } else {
          shipRow.classList.remove('summary-row--free');
        }
        setText('[data-sum-ship]', free ? '免运费' : money(shipping), shipRow);
      }

      /* 优惠：有优惠时显示负值并加 .summary-row--discount */
      if (discountRow) {
        if (discount > 0) {
          setShown(discountRow, true);
          setText('[data-discount-label]', promo ? '优惠 ' + promo.code + '（' + promo.label + '）' : '优惠', discountRow);
          setText('[data-sum-discount]', '-' + money(discount), discountRow);
        } else {
          setShown(discountRow, false);
        }
      }

      /* 优惠码回填与当前优惠说明 */
      if (promoInput && promo && promoInput.value !== promo.code) {
        promoInput.value = promo.code;
      }
      if (promoNote) {
        promoNote.innerHTML = esc(promo
          ? '已应用优惠码 ' + promo.code + '（' + promo.label + '）'
          : '输入优惠码，如 WELCOME10 享 9 折');
      }

      renderShipBar(subtotal, discount);
      renderWallet();
    }

    /* ---------- 数量增减 / 移除（事件委托，重渲染后依然有效） ---------- */
    if (listNode) {
      listNode.addEventListener('click', function (e) {
        var target = e.target;
        if (!target || typeof target.closest !== 'function') { return; }

        var itemNode = target.closest('.cart-item');
        if (!itemNode) { return; }
        var key = itemNode.getAttribute('data-key');
        if (!key) { return; }

        if (target.closest('[data-remove]')) {
          DY.cart.remove(key);
          DY.toast('已从购物袋移除');
          return;
        }

        var qtyBtn = target.closest('[data-qty]');
        if (!qtyBtn) { return; }

        var current = 1;
        var items = DY.cart.items();
        for (var i = 0; i < items.length; i++) {
          if (items[i].key === key) { current = items[i].qty; }
        }

        var next = qtyBtn.getAttribute('data-qty') === 'inc' ? current + 1 : current - 1;
        if (next > 9) {
          DY.toast('单款单尺码最多 9 件');
          return;
        }
        DY.cart.setQty(key, next);
      });
    }

    /* ---------- 优惠码 ---------- */
    if (promoForm) {
      promoForm.addEventListener('submit', function (e) {
        e.preventDefault();
        var result = DY.cart.applyPromo(promoInput ? promoInput.value : '');
        DY.toast(result && result.message ? result.message : '优惠码无效或已过期');
        render();
      });
    }

    /* ---------- 结算 ----------
       金额计算与扣款只发生在 DY.orders.checkout 内部（它负责只扣一次含数量的总额），
       本页只负责：校验收货信息 → 传参 → 按 {ok, message, order} 反馈。 */
    function doCheckout() {
      if (busy) { return; }
      setCheckoutError('');

      if (!isLoggedIn()) {
        DY.toast('请先登录后结算');
        window.location.href = 'login.html?next=cart.html';
        return;
      }

      if (!DY.cart.count()) {
        DY.toast('购物袋是空的');
        return;
      }

      if (!validateForm()) {
        DY.toast('请检查收货信息');
        focusFirstInvalid();
        return;
      }

      var orders = ordersApi();
      if (!orders || typeof orders.checkout !== 'function') {
        DY.toast('下单服务未就绪，请稍后重试');
        return;
      }

      var payload = {
        receiver: fieldValue('receiver'),
        phone: fieldValue('phone').replace(/[\s-]/g, ''),
        address: fieldValue('address')
      };

      setBusy(true);
      var result = null;
      try {
        result = orders.checkout(payload);
      } catch (e) {
        result = null;
      }

      if (!result || typeof result !== 'object') {
        setBusy(false);
        setCheckoutError('下单失败，请稍后重试');
        DY.toast('下单失败，请稍后重试');
        return;
      }

      if (!result.ok) {
        setBusy(false);
        var message = result.message ? String(result.message) : '下单失败，请稍后重试';
        setCheckoutError(message);
        DY.toast(message);
        render();
        return;
      }

      DY.toast('下单成功');
      window.setTimeout(function () {
        window.location.href = 'account.html?view=orders';
      }, 600);
    }

    if (checkoutForm) {
      checkoutForm.addEventListener('submit', function (e) {
        e.preventDefault();
        doCheckout();
      });
    } else if (checkoutBtn) {
      checkoutBtn.addEventListener('click', doCheckout);
    }

    document.addEventListener('dy:cart-change', render);
    document.addEventListener('dy:auth-change', function () { renderWallet(); });
    render();
  });
})();

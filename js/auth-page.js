/* ==========================================================================
   dooyoor 㛊䎟 — 登录页 / 注册页共用逻辑（§12.13）
   依赖：js/site-config.js、js/cart.js（DY.toast / DY.escape）、js/auth.js（DY.auth）
   职责：
     · login.html  —— 失焦校验、错误写入 .field-error、记住我只记手机号、
                      ?next= 站内相对路径校验后跳转、已登录自动跳转
     · register.html —— 演示验证码 + 60 秒倒计时（结束必须恢复可点）、
                      注册成功后自动登录并跳 account.html
   口径：纯前端演示；密码只在内存里传给 DY.auth，绝不写入 DOM 属性或存储。
   ========================================================================== */
(function () {
  'use strict';

  var COUNTDOWN_SECONDS = 60;

  function onReady(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  }

  /* 所有插入 DOM 的文本先转义 */
  function esc(value) {
    var DY = window.DY || {};
    if (typeof DY.escape === 'function') { return DY.escape(value); }
    if (value === null || value === undefined) { return ''; }
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function toast(message) {
    var DY = window.DY || {};
    if (typeof DY.toast === 'function') { DY.toast(message); }
  }

  function rawValue(field) {
    if (!field) { return ''; }
    return String(field.value === undefined || field.value === null ? '' : field.value);
  }

  function trimmed(field) {
    return rawValue(field).replace(/^\s+|\s+$/g, '');
  }

  function digitsOnly(field) {
    return rawValue(field).replace(/[^0-9]/g, '');
  }

  /* ---------- 开放重定向防护 ----------
     只接受站内相对路径：拒绝绝对 URL、协议相对（//）、javascript:、data: 等。
     通过给 <a> 设 href 后回读，借用浏览器自身的解析结果做最终判断。 */
  function safeNext(href, fallback) {
    var fallbackHref = fallback || 'account.html';
    var value = String(href === null || href === undefined ? '' : href);
    if (!value) { return fallbackHref; }
    if (value.length > 512) { return fallbackHref; }
    if (/[\u0000-\u001F\u007F]/.test(value)) { return fallbackHref; }
    if (/^\s*[a-zA-Z][a-zA-Z0-9+.-]*:/.test(value)) { return fallbackHref; } // http: javascript: data: …
    if (value.charAt(0) === '\\') { return fallbackHref; }
    if (value.slice(0, 2) === '//') { return fallbackHref; }
    if (value.charAt(0) === '#') { return fallbackHref; }

    var probe = document.createElement('a');
    probe.setAttribute('href', value);
    var resolved = probe.href || '';
    if (!resolved) { return fallbackHref; }

    try {
      if (resolved.indexOf(window.location.origin + '/') !== 0) { return fallbackHref; }
    } catch (e) {
      if (resolved.charAt(0) !== '/') { return fallbackHref; }
    }
    return value;
  }

  function currentRelative() {
    var path = window.location.pathname || '';
    var cut = path.lastIndexOf('/');
    var file = cut >= 0 ? path.slice(cut + 1) : path;
    if (!file) { file = 'account.html'; }
    return file + (window.location.search || '');
  }

  function urlParam(name) {
    var query = window.location.search || '';
    if (query.charAt(0) === '?') { query = query.slice(1); }
    if (!query) { return ''; }
    var pairs = query.split('&');
    for (var i = 0; i < pairs.length; i++) {
      var pair = pairs[i];
      if (!pair) { continue; }
      var eq = pair.indexOf('=');
      var key = eq < 0 ? pair : pair.slice(0, eq);
      if (decodeURIComponent(key.replace(/\+/g, ' ')) !== name) { continue; }
      var value = eq < 0 ? '' : pair.slice(eq + 1);
      try {
        return decodeURIComponent(value.replace(/\+/g, ' '));
      } catch (e) {
        return value;
      }
    }
    return '';
  }

  function go(href) {
    try {
      window.location.replace(href);
    } catch (e) {
      window.location.href = href;
    }
  }

  /* ---------- 字段错误状态 ---------- */
  function errorBox(field) {
    var wrap = field && field.parentNode;
    while (wrap && wrap.nodeType === 1) {
      if (wrap.classList && wrap.classList.contains('field')) {
        return wrap.querySelector('.field-error');
      }
      wrap = wrap.parentNode;
    }
    return null;
  }

  function setError(field, text) {
    var box = errorBox(field);
    if (box) { box.textContent = text ? String(text) : ''; }
    if (text) {
      field.classList.add('is-invalid');
      field.setAttribute('aria-invalid', 'true');
    } else {
      field.classList.remove('is-invalid');
      field.removeAttribute('aria-invalid');
    }
    return !text;
  }

  function formError(form, text) {
    if (!form) { return; }
    var box = form.querySelector('[data-form-error]');
    if (box) { box.textContent = text ? String(text) : ''; }
  }

  /* ---------- 校验规则 ---------- */
  function makeRules(mode) {
    var rules = {
      phone: function (field) {
        var value = digitsOnly(field);
        if (!value) { return '请填写手机号'; }
        if (!/^1\d{10}$/.test(value)) { return '手机号应为 11 位数字，以 1 开头'; }
        return '';
      },
      password: function (field) {
        var value = rawValue(field);
        if (!value) { return '请填写密码'; }
        if (value.length < 6) { return '密码至少 6 位'; }
        return '';
      }
    };

    if (mode === 'register') {
      rules.code = function (field) {
        var value = digitsOnly(field);
        if (!value) { return '请填写验证码'; }
        if (value !== '888888') { return '验证码不正确，演示环境固定为 888888'; }
        return '';
      };
      rules.confirm = function (field) {
        var value = rawValue(field);
        if (!value) { return '请再输入一次密码'; }
        var pwd = field.form ? field.form.querySelector('[name="password"]') : null;
        if (pwd && value !== rawValue(pwd)) { return '两次输入的密码不一致'; }
        return '';
      };
    }
    return rules;
  }

  /* ---------- 注册页：验证码倒计时 ---------- */
  function initCountdown(errors) {
    var button = document.querySelector('[data-code-btn]');
    var codeField = document.querySelector('[name="code"]');
    if (!button) { return; }

    var timer = null;
    var left = 0;

    function restore() {
      if (timer) { window.clearInterval(timer); timer = null; }
      left = 0;
      button.removeAttribute('disabled');
      button.removeAttribute('aria-disabled');
      button.textContent = '获取验证码';
    }

    function tick() {
      left -= 1;
      if (left <= 0) {
        /* 倒计时结束必须恢复可点——初稿卡死在 disabled 状态 */
        restore();
        return;
      }
      button.textContent = '重新获取（' + left + 's）';
    }

    button.addEventListener('click', function (e) {
      e.preventDefault();
      if (timer) { return; }

      if (codeField) { setError(codeField, ''); }
      button.setAttribute('disabled', 'disabled');
      button.setAttribute('aria-disabled', 'true');
      left = COUNTDOWN_SECONDS;
      button.textContent = '重新获取（' + left + 's）';
      timer = window.setInterval(tick, 1000);

      toast('演示环境：验证码固定为 888888');
      if (codeField && typeof codeField.focus === 'function') { codeField.focus(); }
    });

    window.addEventListener('pagehide', restore);
    errors.push(restore);
  }

  /* ---------- 页面主体 ---------- */
  onReady(function () {
    var form = document.querySelector('[data-auth-form]');
    if (!form) { return; }

    var auth = (window.DY && window.DY.auth) ? window.DY.auth : null;
    if (!auth) { return; }

    var mode = form.getAttribute('data-auth-form') === 'register' ? 'register' : 'login';
    var submitBtn = form.querySelector('[type="submit"]');
    var rules = makeRules(mode);
    var resets = [];

    function validate(field) {
      if (!field || !field.name || !rules[field.name]) { return true; }
      return setError(field, rules[field.name](field));
    }

    function validateAll(extra) {
      var fields = form.querySelectorAll('.input');
      var firstBad = null;
      var bad = 0;

      for (var i = 0; i < fields.length; i++) {
        if (!validate(fields[i])) {
          bad += 1;
          if (!firstBad) { firstBad = fields[i]; }
        }
      }
      if (!bad && typeof extra === 'function') {
        if (!extra()) { bad += 1; }
      }
      return { ok: bad === 0, firstBad: firstBad, count: bad };
    }

    /* 失焦即校验 */
    form.addEventListener('focusout', function (e) {
      var field = e.target;
      if (!field || !field.name || !rules[field.name]) { return; }
      validate(field);
    });

    /* 输入时即时纠正已标错的字段 */
    form.addEventListener('input', function (e) {
      var field = e.target;
      if (!field || !field.name || !rules[field.name]) { return; }
      if (field.classList.contains('is-invalid')) { validate(field); return; }
      if (field.name === 'password' && mode === 'register') {
        var confirm = form.querySelector('[name="confirm"]');
        if (confirm && rawValue(confirm) && confirm.classList.contains('is-invalid')) {
          validate(confirm);
        }
      }
    });

    /* ---------- login ---------- */
    if (mode === 'login') {
      var next = safeNext(urlParam('next'), 'account.html');
      var rememberBox = form.querySelector('[data-remember]');
      var phoneField = form.querySelector('[name="phone"]');

      /* 记住我只存手机号（dooyoor.remember.v1），不存密码 */
      var saved = typeof auth.remembered === 'function' ? auth.remembered() : '';
      if (saved && phoneField) {
        phoneField.value = saved;
        if (rememberBox) { rememberBox.checked = true; }
      }

      /* 已登录直接进账户页 */
      if (auth.isLoggedIn()) {
        go(next);
        return;
      }

      form.addEventListener('submit', function (e) {
        e.preventDefault();
        formError(form, '');
        if (typeof submitBtn.blur === 'function') { submitBtn.blur(); }

        var check = validateAll();
        if (!check.ok) {
          formError(form, '还有 ' + check.count + ' 处需要修改');
          toast('还有 ' + check.count + ' 处需要修改');
          if (check.firstBad && typeof check.firstBad.focus === 'function') { check.firstBad.focus(); }
          return;
        }

        var phone = digitsOnly(phoneField);
        var result = auth.login(phone, rawValue(form.querySelector('[name="password"]')));

        if (!result || !result.ok) {
          var message = (result && result.message) ? result.message : '登录失败，请重试';
          formError(form, esc(message));
          setError(phoneField, esc(message));
          toast(message);
          if (typeof phoneField.focus === 'function') { phoneField.focus(); }
          return;
        }

        if (typeof auth.remember === 'function') {
          if (rememberBox && rememberBox.checked) { auth.remember(phone); } else { auth.forget(); }
        }
        formError(form, '');
        toast('登录成功，正在进入我的账户');
        go(next);
      });

      return;
    }

    /* ---------- register ---------- */
    var from = currentRelative();

    /* 已登录不必再注册 */
    if (auth.isLoggedIn()) {
      go('account.html');
      return;
    }

    initCountdown(resets);

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      formError(form, '');
      if (typeof submitBtn.blur === 'function') { submitBtn.blur(); }

      var check = validateAll();
      if (!check.ok) {
        formError(form, '还有 ' + check.count + ' 处需要修改');
        toast('还有 ' + check.count + ' 处需要修改');
        if (check.firstBad && typeof check.firstBad.focus === 'function') { check.firstBad.focus(); }
        return;
      }

      var result = auth.register(
        digitsOnly(form.querySelector('[name="phone"]')),
        digitsOnly(form.querySelector('[name="code"]')),
        rawValue(form.querySelector('[name="password"]'))
      );

      if (!result || !result.ok) {
        var message = (result && result.message) ? result.message : '注册失败，请重试';
        formError(form, esc(message));
        var busy = /验证码/.test(message) ? form.querySelector('[name="code"]') : form.querySelector('[name="phone"]');
        setError(busy, esc(message));
        toast(message);
        if (busy && typeof busy.focus === 'function') { busy.focus(); }
        return;
      }

      if (typeof auth.remember === 'function') { auth.forget(); }
      formError(form, '');
      toast('注册成功，已为你登录');

      /* 兜底：万一注册页自己出问题，用户仍能手动进账户页 */
      if (from === 'register.html' || from.indexOf('register.html') === 0) {
        var help = form.querySelector('[data-auth-help]');
        if (help) { help.removeAttribute('hidden'); }
      }
      go('account.html');
    });

    /* 离页时清掉倒计时，避免后台计时器 */
    window.addEventListener('pagehide', function () {
      for (var i = 0; i < resets.length; i++) {
        try { resets[i](); } catch (err) { /* 忽略 */ }
      }
    });
  });
})();

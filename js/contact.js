/* ==========================================================================
   dooyoor 㛊䎟 — 联系我们页
   职责：右侧联系方式渲染、留言表单校验与字数计数、常见问题手风琴
   依赖：js/site-config.js（DY_CONFIG）、js/cart.js（DY.escape / DY.toast）
   说明：纯前端演示，不做任何网络请求，提交后只切换到成功态。
   ========================================================================== */
(function () {
  'use strict';

  var MAX_MESSAGE = 500;
  var MIN_MESSAGE = 10;
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  var CHEVRON = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>';

  function onReady(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  }

  onReady(function () {
    var CFG = window.DY_CONFIG || {};
    var BRAND = CFG.brand || {};
    var FAQS = CFG.faqs || [];
    var DY = window.DY || {};

    /* 所有插入 DOM 的文本都先转义 */
    function esc(value) {
      if (typeof DY.escape === 'function') { return DY.escape(value); }
      if (value === null || value === undefined) { return ''; }
      return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    /* ---------- 1. 右侧信息卡：值全部来自 DY_CONFIG.brand ---------- */
    function setTextAll(selector, value) {
      if (value === null || value === undefined || value === '') { return; }
      var nodes = document.querySelectorAll(selector);
      for (var i = 0; i < nodes.length; i++) {
        nodes[i].innerHTML = esc(value);
      }
    }

    function fillBrand() {
      var email = BRAND.email || '';
      var phone = BRAND.phone || '';
      var tel = String(phone).replace(/[^0-9+]/g, '');

      if (email) {
        var mailNodes = document.querySelectorAll('[data-brand-email]');
        for (var m = 0; m < mailNodes.length; m++) {
          mailNodes[m].setAttribute('href', 'mailto:' + email);
          mailNodes[m].innerHTML = esc(email);
        }
      }

      if (phone) {
        var phoneNodes = document.querySelectorAll('[data-brand-phone]');
        for (var p = 0; p < phoneNodes.length; p++) {
          if (tel) { phoneNodes[p].setAttribute('href', 'tel:' + tel); }
          phoneNodes[p].innerHTML = esc(phone);
        }
      }

      /* 溯源卡里的邮箱是「发溯源码来人工核验」的入口，一并带上真实地址 */
      if (email) {
        var chainMail = document.querySelector('.chain-actions [data-brand-email]');
        if (chainMail) {
          chainMail.setAttribute('href', 'mailto:' + email);
          chainMail.innerHTML = esc(email);
        }
      }

      setTextAll('[data-brand-address]', BRAND.address);
      setTextAll('[data-brand-hours]', BRAND.hours);
      setTextAll('[data-brand-wechat]', BRAND.wechat);
      setTextAll('[data-brand-redbook]', BRAND.redbook);
    }

    /* ---------- 2. 常见问题手风琴：一次只开一条 ---------- */
    function closeAll() {
      var heads = document.querySelectorAll('[data-faq] .accordion-head');
      for (var i = 0; i < heads.length; i++) {
        heads[i].setAttribute('aria-expanded', 'false');
        var body = document.getElementById(heads[i].getAttribute('aria-controls'));
        if (body) { body.setAttribute('hidden', 'hidden'); }
      }
    }

    function onAccordionClick(e) {
      var head = e.currentTarget;
      var body = document.getElementById(head.getAttribute('aria-controls'));
      var wasOpen = head.getAttribute('aria-expanded') === 'true';

      closeAll();

      if (!wasOpen) {
        head.setAttribute('aria-expanded', 'true');
        if (body) { body.removeAttribute('hidden'); }
      }
    }

    function renderFaq() {
      var host = document.querySelector('[data-faq]');
      if (!host || !FAQS.length) { return; }

      var html = '';
      for (var i = 0; i < FAQS.length; i++) {
        var item = FAQS[i] || {};
        var idx = i + 1;
        html += '<div class="accordion-item">'
          + '<button class="accordion-head" type="button" id="faqHead' + idx + '" aria-expanded="false" aria-controls="faqBody' + idx + '">'
          + '<span>' + esc(item.q) + '</span>'
          + CHEVRON
          + '</button>'
          + '<div class="accordion-body" id="faqBody' + idx + '" role="region" aria-labelledby="faqHead' + idx + '" hidden>'
          + '<p>' + esc(item.a) + '</p>'
          + '</div>'
          + '</div>';
      }
      host.innerHTML = html;

      var heads = host.querySelectorAll('.accordion-head');
      for (var h = 0; h < heads.length; h++) {
        heads[h].addEventListener('click', onAccordionClick);
      }
    }

    /* ---------- 3. 留言表单：失焦校验 + 字数计数 + 提交校验 ---------- */
    function overText(len) {
      return '留言最多 500 字，请删减 ' + (len - MAX_MESSAGE) + ' 字';
    }

    function initForm() {
      var form = document.querySelector('[data-contact-form]');
      if (!form) { return; }

      var success = document.querySelector('[data-form-success]');
      var counter = document.querySelector('[data-char-count]');
      var message = form.querySelector('.textarea');

      var RULES = {
        name: function (v) {
          if (!v) { return '请填写姓名'; }
          if (v.length < 2) { return '姓名至少 2 个字，方便我们称呼你'; }
          return '';
        },
        email: function (v) {
          if (!v) { return '请填写邮箱'; }
          if (!EMAIL_RE.test(v)) { return '邮箱格式不正确，请检查一下'; }
          return '';
        },
        /* 主题必须落在下拉里真实存在的选项上：
           既覆盖「溯源查询」，也挡住旧浏览器回填的失效值。 */
        topic: function (v) {
          if (!v) { return '请选择咨询主题'; }
          var select = form.querySelector('select[name="topic"]');
          if (select) {
            var found = false;
            for (var t = 0; t < select.options.length; t++) {
              if (select.options[t].value === v) { found = true; break; }
            }
            if (!found) { return '请从列表中选择一个主题'; }
          }
          return '';
        },
        message: function (v) {
          if (!v) { return '请填写留言内容'; }
          if (v.length < MIN_MESSAGE) { return '留言至少 10 个字，方便我们准确回复'; }
          if (v.length > MAX_MESSAGE) { return overText(v.length); }
          return '';
        }
      };

      function rawText(field) {
        return String(field.value === undefined || field.value === null ? '' : field.value);
      }

      function trimText(field) {
        return rawText(field).replace(/^\s+|\s+$/g, '');
      }

      function setState(field, text) {
        var box = field.parentNode ? field.parentNode.querySelector('.field-error') : null;
        if (box) { box.textContent = text || ''; }
        if (text) {
          field.classList.add('is-invalid');
          field.setAttribute('aria-invalid', 'true');
        } else {
          field.classList.remove('is-invalid');
          field.removeAttribute('aria-invalid');
        }
        return !text;
      }

      function validate(field) {
        var rule = field.name ? RULES[field.name] : null;
        if (!rule) { return true; }
        return setState(field, rule(trimText(field)));
      }

      /* 字数计数：上限 500，超出时 .char-count 加 .is-over，输入框标 .is-invalid */
      function syncCount() {
        if (!message) { return; }
        var len = rawText(message).length;

        if (counter) {
          counter.textContent = len + ' / ' + MAX_MESSAGE;
          if (len > MAX_MESSAGE) {
            counter.classList.add('is-over');
          } else {
            counter.classList.remove('is-over');
          }
        }

        if (len > MAX_MESSAGE) {
          setState(message, overText(len));
        } else if (message.classList.contains('is-invalid')) {
          setState(message, RULES.message(trimText(message)));
        }
      }

      /* 失焦即校验单个字段（focusout 会冒泡） */
      form.addEventListener('focusout', function (e) {
        var field = e.target;
        if (!field || !field.name || !RULES[field.name]) { return; }
        validate(field);
        if (field === message) { syncCount(); }
      });

      /* 主题下拉是选择动作，change 时直接校验 */
      form.addEventListener('change', function (e) {
        var field = e.target;
        if (!field || field.tagName !== 'SELECT' || !RULES[field.name]) { return; }
        validate(field);
      });

      /* 输入时：留言更新计数；已标错的字段即时纠错 */
      form.addEventListener('input', function (e) {
        var field = e.target;
        if (!field || !field.name) { return; }
        if (field === message) { syncCount(); return; }
        if (RULES[field.name] && field.classList.contains('is-invalid')) { validate(field); }
      });

      /* 提交：校验全部字段；纯静态，不发起任何请求 */
      form.addEventListener('submit', function (e) {
        e.preventDefault();

        var fields = form.querySelectorAll('.input, .select, .textarea');
        var firstBad = null;
        var badCount = 0;

        for (var i = 0; i < fields.length; i++) {
          if (!validate(fields[i])) {
            badCount += 1;
            if (!firstBad) { firstBad = fields[i]; }
          }
        }
        syncCount();

        if (firstBad) {
          if (typeof DY.toast === 'function') {
            DY.toast('还有 ' + badCount + ' 处需要修改');
          }
          firstBad.focus();
          return;
        }

        if (success) {
          form.classList.add('u-hide');
          success.removeAttribute('hidden');
          if (typeof success.focus === 'function') { success.focus(); }
        }
      });

      syncCount();
    }

    fillBrand();
    renderFaq();
    initForm();
  });
})();

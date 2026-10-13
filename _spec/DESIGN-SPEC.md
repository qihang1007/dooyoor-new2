# dooyoor 㛊䎟 — 官网构建规范（唯一事实来源 / Single Source of Truth）

> 本文件是全部构建者与校验者的契约。**任何与本文件冲突的"更好的想法"都必须放弃**。
> 目标：6 个页面 + 共享层由多个智能体并行产出，合并后必须像同一个人一次写完的。

---

## 0. 硬性约束（违反即判失败）

1. **零依赖**：不得使用任何框架、库、CDN、外链字体、外链图片、外链脚本。全部本地文件。
2. **无构建步骤**：纯静态。必须能在 `file://` 协议下直接双击打开正常运行。
3. **移动端优先**：默认写手机样式，用 `min-width` 媒体查询向上适配。基准视口 360×640、390×844、414×896 必须无横向滚动。
4. **文件路径全部相对路径**，且大小写完全一致（`assets/products/p01.svg`，不是 `Assets/...`）。
5. **JS 必须容错**：`localStorage` 全部包在 `try/catch` 内，失败时退化为内存存储（file:// 下可能被禁用）。
6. **不使用内联 `style=""`**（唯一例外：JS 运行时设置 CSS 变量做色块/进度条）。所有样式进 `css/style.css`。
7. **不使用内联事件属性**（禁止 `onclick="..."`）。事件在 JS 文件里绑定。
8. **类名逐字照抄本规范**。不得自创近似名（不要 `.product-card-v2`、`.btnPrimary`、`.card`）。
9. **可访问性**：交互元素用 `<button>`/`<a>`（不要 div 冒充按钮）；图标装饰加 `aria-hidden="true"`；表单有 `<label>`；图片有 `alt`；焦点样式不可移除。
10. **文案语言**：简体中文为主，英文名/英文短语为辅。标点使用中文全角（英文名与价格除外）。
11. **不使用 emoji** 作为图标。图标一律内联 SVG（见 §5.6）。
12. 每个 HTML 文件 **缩进 2 空格**，标签闭合完整，属性用双引号。

---

## 1. 品牌定义

| 项 | 值 |
| --- | --- |
| 英文名 | `DOOYOOR`（**视觉词标全大写**；代码、文件名、JS 变量中仍用全小写 `dooyoor`） |
| 中文名 | `㛊䎟` |
| 定位 | 自主牛仔品牌 · **只做牛仔**（上衣 / 裤子 / 裙子 / 包包）· 区块链溯源 + 认证二手流转 |
| 一句话 | 只做牛仔 |
| 英文标语 | Denim only, done properly. |
| 声调 | 克制、具体、可验证。说盎司克重、说水洗工序、说产地与检测报告编号，不说"潮流""极致""奢华""尊享"。 |
| 价格带 | 上衣 ¥880–1280 / 裤子 ¥580–1080 / 裙子 ¥780–920 / 包包 ¥220–460 |
| 主色 | 靛蓝 `#1F3B63`，深 `#142943`，浅 `#2E5288`，浅底 `#EEF2F8` |
| 辅助色 | 铜棕缝线 `#A85A16`→`#C97A2B`（五金 / 认证二手 / 警示）；石洗灰 `#4A5560` |
| 配送政策 | 满 ¥999 免运费，未满 ¥20；30 天无理由，认证二手 7 天且需保持成色 |

品牌叙事主轴（所有页面文案必须与之一致）：
> 我们只做能穿很多年的衣服。少一点款式，好一点面料，稳一点版型。
> 一件衣服的价值不在第一眼，而在第五十次穿它的时候。
> 每件成衣出厂即上链——面料、工坊、质检与每一次流转都不可篡改，任何人按吊牌内侧的溯源码即可查证。

### 1.1 中文名的技术风险（必须写进 README 提示用户）
`㛊䎟` 是 CJK 扩展 A 区字符（U+36CA、U+438F），**部分手机字体不含这两个字形，会显示成方框（豆腐块）**。
因此：`dooyoor` 拉丁词标在任何页面都必须是**第一视觉主体**；`㛊䎟` 作为次级标识出现在品牌名旁、页脚与品牌故事页。所有出现处都必须与 `js/site-config.js` 的 `brand.nameCn` 一致，便于一处替换。

---

## 2. 目录结构与文件归属

```
dooyoor-site/
├── index.html          首页
├── shop.html           全部商品
├── product.html        商品详情（?id=p01）
├── about.html          品牌故事
├── cart.html           购物袋
├── contact.html        联系我们
├── css/
│   └── style.css       设计系统 + 全部组件（总控编写，构建者只读）
├── js/
│   ├── site-config.js  品牌与商品数据（总控编写，构建者只读）
│   ├── cart.js         购物袋内核（总控编写，构建者只读）
│   ├── main.js         全局交互（总控编写，构建者只读）
│   ├── shop.js         商品列表页逻辑（构建者编写）
│   ├── product.js      商品详情页逻辑（构建者编写）
│   ├── cart-page.js    购物袋页逻辑（构建者编写）
│   └── contact.js      联系页逻辑（构建者编写）
├── assets/
│   ├── logo-mark.svg
│   ├── hero.svg
│   ├── look-01.svg  look-02.svg
│   ├── about-workshop.svg
│   ├── detail-01.svg  detail-02.svg
│   ├── col-01.svg  col-02.svg  col-03.svg  col-04.svg
│   └── products/
│       ├── p01.svg … p08.svg
└── README.md
```

**构建者只能创建/修改分配给自己的文件。** 不得改动 `css/style.css`、`js/site-config.js`、`js/cart.js`、`js/main.js`。若发现它们缺东西，在返回结果里写 `blockers`，由总控统一修。

---

## 3. 设计令牌（已在 style.css 中定义，直接使用变量名）

| 变量 | 值 | 用途 |
| --- | --- | --- |
| `--paper` | `#F5F6F8` | 页面底色 |
| `--paper-2` | `#EDEFF2` | 次级底色 / 卡片底 |
| `--paper-3` | `#E3E6EA` | 三级底色 / 图底 |
| `--ink` | `#14181D` | 主文字 |
| `--ink-2` | `#454C55` | 次级文字 |
| `--ink-3` | `#7A838E` | 三级文字 / 说明 |
| `--line` | `#E2E6EA` | 分隔线 |
| `--line-2` | `#C6CED6` | 强分隔线 / 输入框边 |
| `--accent` | `#1F3B63` | 强调色（靛蓝丹宁） |
| `--accent-2` | `#142943` | 强调色深 |
| `--accent-soft` | `#EEF2F8` | 强调色浅底 |
| `--tertiary` | `#A85A16` | 铜棕缝线色（五金 / 认证二手） |
| `--sage` | `#4A5560` | 辅助色（石洗灰） |
| `--white` | `#FFFFFF` | |
| `--ok` | `#2E7D5B` | 成功 |
| `--err` | `#B3261E` | 错误 |

字体：`--font-display`（衬线，用于标题/品牌/大字）、`--font-sans`（正文与 UI）。**不得指定具体字体文件的 URL。**

布局：`--container:1200px`、`--gutter:20px`、`--header-h:60px`、`--bottomnav-h:60px`。
圆角：`--radius-s:6px`、`--radius-m:12px`、`--radius-l:20px`、`--radius-pill:999px`。
阴影：`--shadow-1`（轻）、`--shadow-2`（浮层）。缓动：`--ease`。

断点（`min-width`）：`480px`（大手机）、`768px`（平板，**此断点起隐藏底部导航、显示桌面导航**）、`1024px`、`1280px`。

---

## 4. 页面统一骨架（逐字照抄）

每个页面都是下面这个结构。`{{...}}` 处由该页构建者填写，其余**一个字都不许改**。

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>{{PAGE_TITLE}} · dooyoor 㛊䎟</title>
  <meta name="description" content="{{PAGE_DESC}}">
  <meta name="theme-color" content="#F5F6F8">
  <meta property="og:type" content="website">
  <meta property="og:title" content="{{PAGE_TITLE}} · dooyoor 㛊䎟">
  <meta property="og:description" content="{{PAGE_DESC}}">
  <meta property="og:image" content="assets/hero.svg">
  <link rel="icon" href="assets/logo-mark.svg" type="image/svg+xml">
  <link rel="apple-touch-icon" href="assets/logo-mark.svg">
  <link rel="stylesheet" href="css/style.css">
</head>
<body data-page="{{PAGE_ID}}">

  <a class="skip-link" href="#main">跳到主要内容</a>

  {{HEADER}}        <!-- §5.1，逐字照抄 -->

  {{DRAWER}}        <!-- §5.2，逐字照抄 -->
  {{SEARCH}}        <!-- §5.3，逐字照抄 -->

  <main id="main">
    {{PAGE_CONTENT}}  <!-- 该页独有内容 -->
  </main>

  {{FOOTER}}        <!-- §5.4，逐字照抄 -->
  {{BOTTOMNAV}}     <!-- §5.5，逐字照抄 -->
  <div class="toast" data-toast role="status" aria-live="polite"></div>

  <script src="js/site-config.js"></script>
  <script src="js/cart.js"></script>
  <script src="js/main.js"></script>
  {{PAGE_SCRIPT}}   <!-- 如 <script src="js/shop.js"></script>，无则留空 -->
</body>
</html>
```

`PAGE_ID` 取值：`index` / `shop` / `product` / `about` / `cart` / `contact`。
导航高亮由 `main.js` 依据 `body[data-page]` 自动设置，**构建者不要手写 `aria-current`**。
页面脚本放在 body 末尾**不带 defer**。

---

## 5. 共享组件（逐字照抄，禁止改写）

### 5.1 HEADER

```html
  <header class="site-header" data-header>
    <div class="container header-inner">
      <button class="icon-btn menu-toggle" type="button" aria-label="打开菜单" aria-expanded="false" aria-controls="drawer" data-menu-toggle>
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M3 6h18M3 12h18M3 18h18"/></svg>
      </button>

      <a class="brand" href="index.html">
        <img class="brand-mark" src="assets/logo-mark.svg" alt="" width="26" height="26" decoding="async">
        <span class="brand-name">dooyoor</span>
        <span class="brand-cn" aria-hidden="true">㛊䎟</span>
      </a>

      <nav class="nav-primary" aria-label="主导航">
        <a class="nav-link" href="index.html" data-nav="index">首页</a>
        <a class="nav-link" href="shop.html" data-nav="shop">全部商品</a>
        <a class="nav-link" href="preowned.html" data-nav="preowned">二手商城</a>
        <a class="nav-link" href="about.html" data-nav="about">品牌故事</a>
        <a class="nav-link" href="contact.html" data-nav="contact">联系我们</a>
      </nav>

      <div class="header-actions">
        <button class="icon-btn" type="button" aria-label="搜索商品" aria-expanded="false" aria-controls="search" data-search-toggle>
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
        </button>
        <a class="icon-btn" href="account.html" aria-label="我的" data-account-link>
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="3.5"/><path d="M5 20c0-3.9 3.1-6 7-6s7 2.1 7 6"/></svg>
        </a>
        <a class="icon-btn fav-link" href="shop.html?fav=1" aria-label="我的收藏">
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20.2S4.6 15.5 4.6 10.4A4.3 4.3 0 0 1 12 7.5a4.3 4.3 0 0 1 7.4 2.9c0 5.1-7.4 9.8-7.4 9.8Z"/></svg>
          <span class="cart-badge" data-fav-count hidden>0</span>
        </a>
        <a class="icon-btn" href="cart.html" aria-label="购物袋">
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8h12l1 12H5L6 8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg>
          <span class="cart-badge" data-cart-count hidden>0</span>
        </a>
      </div>
    </div>
  </header>
```

### 5.2 DRAWER

```html
  <div class="drawer" id="drawer" data-drawer hidden>
    <div class="drawer-backdrop" data-drawer-close></div>
    <aside class="drawer-panel" role="dialog" aria-modal="true" aria-label="站点菜单">
      <div class="drawer-head">
        <span class="drawer-title">dooyoor</span>
        <button class="icon-btn" type="button" aria-label="关闭菜单" data-drawer-close>
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
        </button>
      </div>
      <nav class="drawer-nav" aria-label="移动端导航">
        <a class="drawer-link" href="index.html" data-nav="index">首页</a>
        <a class="drawer-link" href="shop.html" data-nav="shop">全部商品</a>
        <a class="drawer-link" href="preowned.html" data-nav="preowned">二手商城</a>
        <a class="drawer-link" href="verify.html" data-nav="verify">溯源查询</a>
        <a class="drawer-link" href="about.html" data-nav="about">品牌故事</a>
        <a class="drawer-link" href="contact.html" data-nav="contact">联系我们</a>
        <a class="drawer-link" href="cart.html" data-nav="cart">购物袋</a>
        <a class="drawer-link" href="shop.html?fav=1">我的收藏</a>
        <a class="drawer-link" href="account.html">我的账户</a>
      </nav>
      <div class="drawer-foot">
        <p class="drawer-note">满 ¥999 免运费 · 认证二手 7 天无理由</p>
        <a class="drawer-mail" href="mailto:hello@dooyoor.com">hello@dooyoor.com</a>
      </div>
    </aside>
  </div>
```

### 5.3 SEARCH

```html
  <div class="search-overlay" id="search" data-search hidden>
    <div class="search-backdrop" data-search-close></div>
    <div class="search-panel" role="dialog" aria-modal="true" aria-label="搜索商品">
      <form class="search-form" action="shop.html" method="get" role="search">
        <label class="u-sr-only" for="siteSearch">搜索商品</label>
        <div class="search-field">
          <input class="input search-input" id="siteSearch" name="q" type="search" placeholder="搜索商品名或品类，如：丹宁" autocomplete="off">
          <button class="search-clear" type="button" aria-label="清空搜索内容" data-search-clear hidden>
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
          </button>
        </div>
        <button class="btn btn--primary" type="submit">搜索</button>
      </form>
      <div class="search-suggest">
        <span class="search-suggest-label">热门搜索</span>
        <a class="filter-chip" href="shop.html?q=丹宁">丹宁</a>
        <a class="filter-chip" href="shop.html?q=牛仔">牛仔裤</a>
        <a class="filter-chip" href="shop.html?q=裙">裙子</a>
        <a class="filter-chip" href="shop.html?cond=used">认证二手</a>
      </div>
      <button class="btn btn--ghost search-close" type="button" data-search-close>关闭</button>
    </div>
  </div>
```

### 5.4 FOOTER

```html
  <footer class="site-footer">
    <div class="container">
      <div class="footer-grid">
        <div class="footer-col footer-brand">
          <p class="footer-logo">dooyoor<span class="footer-cn">㛊䎟</span></p>
          <p class="footer-tagline">只做牛仔。上衣、裤子、裙子、包包，全部围绕一种面料。</p>
          <p class="footer-social">
            <a class="footer-link" href="contact.html">微信 dooyoor</a>
            <a class="footer-link" href="contact.html">小红书 @dooyoor</a>
          </p>
        </div>
        <div class="footer-col">
          <h2 class="footer-title">购物</h2>
          <a class="footer-link" href="shop.html">全部商品</a>
          <a class="footer-link" href="shop.html?c=tops">上衣</a>
          <a class="footer-link" href="shop.html?c=bottoms">裤子</a>
          <a class="footer-link" href="shop.html?c=skirts">裙子</a>
          <a class="footer-link" href="shop.html?c=bags">包包</a>
        </div>
        <div class="footer-col">
          <h2 class="footer-title">帮助</h2>
          <a class="footer-link" href="contact.html#faq">常见问题</a>
          <a class="footer-link" href="verify.html">溯源查询</a>
          <a class="footer-link" href="contact.html#faq">尺码与版型</a>
          <a class="footer-link" href="contact.html#faq">配送与退换</a>
          <a class="footer-link" href="contact.html">联系我们</a>
        </div>
        <div class="footer-col footer-news">
          <h2 class="footer-title">订阅新品通知</h2>
          <p class="footer-note">每月一封信，只讲新面料与新款式，不发广告。</p>
          <form class="news-form" data-news-form novalidate>
            <label class="u-sr-only" for="newsEmail">邮箱地址</label>
            <input class="input" id="newsEmail" name="email" type="email" placeholder="你的邮箱" autocomplete="email" required>
            <button class="btn btn--outline" type="submit">订阅</button>
          </form>
          <p class="form-note" data-news-note></p>
        </div>
      </div>
      <div class="footer-bottom">
        <p>© <span data-year>2025</span> dooyoor 㛊䎟 · 保留所有权利</p>
        <p class="footer-legal"><a class="footer-link" href="#">隐私政策</a><a class="footer-link" href="#">服务条款</a></p>
      </div>
    </div>
  </footer>
```

### 5.5 BOTTOM NAV（仅移动端显示）

```html
  <nav class="bottom-nav" aria-label="底部导航">
    <a class="bottom-nav-item" href="index.html" data-nav="index">
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 11l8-6 8 6"/><path d="M6 10v9h12v-9"/></svg>
      <span class="bottom-nav-label">首页</span>
    </a>
    <a class="bottom-nav-item" href="shop.html" data-nav="shop">
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16l-1.5 13h-13L4 6Z"/><path d="M9 6a3 3 0 0 1 6 0"/></svg>
      <span class="bottom-nav-label">商品</span>
    </a>
    <a class="bottom-nav-item" href="preowned.html" data-nav="preowned">
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12a8 8 0 0 1 13-6"/><path d="M20 12a8 8 0 0 1-13 6"/><path d="M17 3v3h-3"/><path d="M7 21v-3h3"/></svg>
      <span class="bottom-nav-label">二手</span>
    </a>
    <a class="bottom-nav-item" href="cart.html" data-nav="cart">
      <span class="bottom-nav-icon-wrap">
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8h12l1 12H5L6 8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg>
        <span class="cart-badge" data-cart-count hidden>0</span>
      </span>
      <span class="bottom-nav-label">购物袋</span>
    </a>
    <a class="bottom-nav-item" href="account.html" data-nav="account">
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="3.5"/><path d="M5 20c0-3.9 3.1-6 7-6s7 2.1 7 6"/></svg>
      <span class="bottom-nav-label">我的</span>
    </a>
  </nav>
```

### 5.6 图标集（内联 SVG，统一 24 格、`stroke="currentColor"`、`stroke-width="1.5"`、`fill="none"`）

| 名称 | 内容 |
| --- | --- |
| 购物袋 | `<path d="M6 8h12l1 12H5L6 8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>` |
| 搜索 | `<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>` |
| 关闭 | `<path d="M6 6l12 12M18 6L6 18"/>` |
| 加 | `<path d="M12 5v14M5 12h14"/>` |
| 减 | `<path d="M5 12h14"/>` |
| 右箭头 | `<path d="M5 12h14M13 6l6 6-6 6"/>` |
| 下箭头 | `<path d="M6 9l6 6 6-6"/>` |
| 对勾 | `<path d="M5 13l4 4L19 7"/>` |
| 卡车 | `<path d="M3 7h11v10H3z"/><path d="M14 10h4l3 3v4h-7z"/><circle cx="7" cy="18" r="1.6"/><circle cx="17" cy="18" r="1.6"/>` |
| 循环退换 | `<path d="M4 12a8 8 0 0 1 13-6"/><path d="M20 12a8 8 0 0 1-13 6"/><path d="M17 3v3h-3"/><path d="M7 21v-3h3"/>` |
| 线轴 | `<circle cx="12" cy="12" r="7"/><path d="M12 5v14M5 12h14"/>` |
| 叶子 | `<path d="M5 19c0-8 5-13 14-13 0 9-5 14-14 13Z"/><path d="M5 19c3-4 6-6 10-8"/>` |
| 盾牌 | `<path d="M12 3l7 3v6c0 5-3 8-7 9-4-1-7-4-7-9V6l7-3Z"/><path d="M9 12l2 2 4-4"/>` |
| 邮件 | `<path d="M4 6h16v12H4z"/><path d="M4 7l8 6 8-6"/>` |
| 电话 | `<path d="M5 4h4l2 5-2 1a10 10 0 0 0 5 5l1-2 5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1Z"/>` |
| 定位 | `<path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11Z"/><circle cx="12" cy="10" r="2.5"/>` |
| 星 | `<path d="M12 4l2.4 5 5.6.7-4 3.9.9 5.4-4.9-2.6-4.9 2.6.9-5.4-4-3.9 5.6-.7Z"/>` |
| 用户 | `<circle cx="12" cy="8" r="3.5"/><path d="M5 20c0-3.9 3.1-6 7-6s7 2.1 7 6"/>` |
| 钱包 | `<path d="M4 7h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4z"/><path d="M4 7V6a2 2 0 0 1 2-2h11"/><circle cx="16" cy="13" r="1.2"/>` |
| 包裹 | `<path d="M3 8l9-5 9 5v8l-9 5-9-5z"/><path d="M3 8l9 5 9-5"/><path d="M12 13v8"/>` |
| 时钟 | `<circle cx="12" cy="12" r="8"/><path d="M12 8v4.5l3 1.8"/>` |
| 上传 | `<path d="M12 17V5"/><path d="M7 10l5-5 5 5"/><path d="M5 19h14"/>` |

用法示例：
```html
<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8h12l1 12H5L6 8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg>
```

---

## 6. JS 契约

### 6.1 `window.DY_CONFIG`（由 `js/site-config.js` 提供，结构固定）

```js
window.DY_CONFIG = {
  brand:   { name, nameCn, tagline, taglineEn, founded, city, email, phone, wechat, redbook, address, hours, story[] },
  currency:{ symbol:"¥", code:"CNY", decimals:0 },
  shipping:{ freeThreshold:999, fee:20 },
  nav:     [ {id,name,href} ],
  collections: [ { id, name, en, href, image, note } ],   // 4 项
  products:    [ { id, name, en, category, categoryName, price, compareAt, badge, colors[], sizes[],
                   image, gallery[], short, fabric, care[], details[], fit, rating, reviews } ], // 8 项，id = p01…p08
  pillars:     [ { icon, title, text } ],   // 3 项，icon 为 §5.6 图标名
  timeline:    [ { year, title, text } ],   // 4 项
  faqs:        [ { q, a } ]                 // 6 项
};
```
商品 `id`：`p01`…`p08`；`category`：`tops` / `bottoms` / `outerwear` / `accessories`。

### 6.2 `window.DY`（由 `js/cart.js` + `js/main.js` 提供）

| API | 说明 |
| --- | --- |
| `DY.money(n)` | 返回 `"¥460"` 形态字符串 |
| `DY.getProduct(id)` | 返回商品对象或 `null` |
| `DY.cart.items()` | `[{ key, id, size, qty, product }]` |
| `DY.cart.count()` | 总件数 |
| `DY.cart.subtotal()` | 小计（元，数字） |
| `DY.cart.shipping()` | 运费（元） |
| `DY.cart.discount()` | 优惠金额（元） |
| `DY.cart.total()` | 合计（元） |
| `DY.cart.add(id, size, qty)` | 加入，返回 `{ok, message}`；尺码必填，否则 `{ok:false}` |
| `DY.cart.setQty(key, qty)` | qty ≤ 0 时删除 |
| `DY.cart.remove(key)` | 删除 |
| `DY.cart.clear()` | 清空 |
| `DY.cart.applyPromo(code)` | `"WELCOME10"` → 9 折，返回 `{ok, message}` |
| `DY.el(html)` | 把 HTML 字符串转成元素 |
| `DY.toast(msg)` | 右下角轻提示，2.4s 自动消失 |
| `DY.escape(str)` | HTML 转义，**所有来自数据或 URL 的文本插入 DOM 前必须转义** |

事件：`document` 上派发 `dy:cart-change`（`detail = {count, subtotal}`）。

`main.js` 自动完成：抽屉开合与 Esc 关闭、搜索层开合、**搜索框清除按钮**（`[data-search-clear]`：有输入时移除 `hidden` 并加 `.is-visible`，清空时反向操作并聚焦输入框）、底部/顶部导航高亮、页脚年份、`[data-news-form]` 订阅提示、`[data-reveal]` 滚动淡入、把 `[data-cart-count]` 同步为件数并控制 `hidden`。
`fav.js` 自动完成：把 `[data-fav-count]` 同步为收藏件数并控制 `hidden`；在 `document` 上委托处理所有 `[data-fav-id]` 的点击（切换收藏、同步 `.is-active`/`aria-pressed`、弹 toast），监听 `dy:fav-change` 事件重同步全部按钮状态。**因此页面渲染收藏按钮时只需插入 `DY.fav.buttonHtml(id, name)`，不要自己绑定事件。**

**页面脚本只做本页的事**，逻辑包在 `DOMContentLoaded` 内。

---

## 7. 各页面内容要求

> 通用：`{{PAGE_CONTENT}}` 内每个大区块用 `<section class="section">`，标题区用 `.section-head` + `.eyebrow` + `.h2` + `.lead`。
> 商品/系列/FAQ/时间线/pillars 全部由 `js/site-config.js` 的数据渲染，**不得把商品硬编码进 HTML**。

### 7.1 `index.html` — 首页（PAGE_ID `index`，只加载 main.js）

1. **Hero** `.hero`：`.hero-media` 用 `assets/hero.svg`（`<img>` 带 `alt="dooyoor 当季系列"`），`.hero-body` 内含 `.eyebrow`（"2025 春夏季"）、`.hero-title`、`.hero-sub`、`.hero-cta`（`.btn--primary` → `shop.html`，`.btn--outline` → `about.html`）、`.hero-meta` 三个小指标（"一物一码上链 / 2 款认证二手在售 / 满 ¥999 免运费"）。
2. **系列入口** `.collection-grid`：由 `DY_CONFIG.collections` 渲染 4 张 `.collection-card`（`.collection-media` 用 `col-01…04.svg`，`.collection-label` 显示中英文名）。
3. **精选商品** `.product-grid`：渲染 `products` 前 4 件 `.product-card`；`.section-head` 右侧放"查看全部"链接。
4. **工艺三原则** `.pillars`：由 `pillars` 渲染 3 个 `.pillar`（图标 + 标题 + 说明）。
5. **面料横条**：`<section class="section section--ink">`，两栏：左 `assets/look-01.svg`，右文字讲面料（长绒棉 / 美利奴羊毛 / 天丝），必须出现"我们只做能穿很多年的衣服"。
6. **Lookbook** `.lookbook`：`look-02.svg` + 一段引语 `.quote`。
7. **服务承诺**：三个 `.pillar` 用图标 卡车 / 循环退换 / 盾牌 —— 满 ¥999 免运费（未满 ¥20）、全新 30 天 / 认证二手 7 天无理由退换、一物一码可溯源。

### 7.2 `shop.html` — 全部商品（PAGE_ID `shop`，加载 `js/shop.js`）

1. `.page-head`：`.eyebrow` + `.h1`（"全部商品"）+ `.lead`（说明共 8 款）。
2. `.shop-toolbar`：左侧 `.filter-bar` 分类 chip（全部 / 上装 / 下装 / 外套 / 配件，用 `.filter-chip`，`data-filter="all|tops|bottoms|outerwear|accessories"`）；右侧 `<select class="select sort-select" data-sort>`（推荐 / 价格从低到高 / 价格从高到低 / 新品优先）。
3. `.result-count` 显示"共 N 件"。
4. `.product-grid` 渲染全部商品卡（结构见 §7.7）。
5. `.empty-state`（`hidden`，无结果时显示）："没有找到相关商品" + 一个"清除筛选"按钮。
6. `shop.js` 必须支持 URL 参数 `?c=tops`（预设分类）与 `?q=针织`（关键词匹配 `name`/`en`/`categoryName`），且筛选/排序变化时用 `history.replaceState` 同步 URL，不刷新页面。

### 7.3 `product.html` — 商品详情（PAGE_ID `product`，加载 `js/product.js`）

数据源：`?id=p01`；无参数或非法 id 时回落到 `p01`。商品不存在时用 `.empty-state` 提示并提供返回 `shop.html` 的按钮。

1. `.pdp` 两栏（移动端上下堆叠）：
   - `.pdp-gallery`：`.gallery-main`（大图 `<img>`，JS 切换）+ `.gallery-thumbs` 内 3 个 `<button class="thumb" data-index="0..2">`（`gallery[0]`、`assets/detail-01.svg`、`assets/detail-02.svg`）。
   - `.pdp-info`：`.breadcrumb`（首页 / 全部商品 / 当前商品）、`.pdp-title`、`.pdp-en`、`.pdp-price`（`.price`，若有 `compareAt` 加 `.price--was`）、`.pdp-rating`（星标 + `rating` + `reviews` 条评价）、`.pdp-short`。
2. `.option-group` 颜色：`.option-label`（"颜色：<当前色名>"）+ `.swatch-list`（`.swatch`，`style="--sw:#XXXXXX"` 由 CSS 画色块，JS 切换 `.is-active`）。**这是唯一允许用 `style` 属性的地方，且只能设置 `--sw`。**
3. `.option-group` 尺码：`.size-list` 内 `.size-btn`；未选尺码时加入购物袋要报错提示；提供"尺码指南"按钮打开尺码表。
4. `.qty`：`.qty-btn`（减）+ `.qty-input`（`<input type="text" inputmode="numeric" value="1" readonly>`）+ `.qty-btn`（加），范围 1–9。
5. `.pdp-actions`：`.btn--primary.btn--block` 加入购物袋（调 `DY.cart.add`，成功 `DY.toast`）、`.btn--outline.btn--block` 立即购买（加入后跳 `cart.html`）。
6. `.pdp-promise`：三个小项（卡车 满 ¥999 免运费 / 循环退换 全新 30 天、认证二手 7 天无理由 / 盾牌 一物一码已上链）。
7. `.accordion`：4 项 —— 面料与工艺（`fabric`）、版型与尺码（`fit` + `.size-table`）、洗护建议（`care` 列表）、配送与退换（固定文案）。用 `<button class="accordion-head" aria-expanded="false">` + `.accordion-body`，JS 切换。
8. `.related`：同 `category` 的其他商品（最多 4 件，不足用其他商品补齐）渲染为 `.product-card`。

`.size-table` 列：尺码 / 衣长 / 胸围 / 肩宽 / 袖长（cm），行取自 `XS S M L XL`，数值合理递增（静态 HTML，可硬编码）。

### 7.4 `about.html` — 品牌故事（PAGE_ID `about`，只加载 main.js）

1. `.about-hero`：`assets/about-workshop.svg` + 大标题"我们只做能穿很多年的衣服" + `.lead`。
2. `.prose`：品牌故事正文，取自 `DY_CONFIG.brand.story`（4–6 段），必须包含创立年份、城市、"第五十次穿它"的表述。
3. `.timeline`：`DY_CONFIG.timeline` 渲染 4 个 `.timeline-item`。
4. `.pillars`：`DY_CONFIG.pillars` 渲染 3 个 `.pillar`。
5. **面料说明**：三栏卡片（长绒棉 / 美利奴羊毛 / 天丝莱赛尔），讲清纤维来源与手感，诚实、不夸张。
6. `.lookbook`：`look-01.svg` + `look-02.svg` 两张 `.look-card`。
7. **价格透明**：一段 `.quote` 说明"我们把成本花在哪里"，列面料 / 版型打样 / 工费三项占比（45% / 25% / 30%）。
8. 结尾 CTA：`.btn--primary` → `shop.html`。

### 7.5 `cart.html` — 购物袋（PAGE_ID `cart`，加载 `js/cart-page.js`）

1. `.page-head`：`.h1` "购物袋" + `.lead`（满 ¥999 免运费提示）。
2. `.cart-layout` 两栏：左 `.cart-list`，右 `.summary`（移动端 summary 在下方，不 sticky）。
3. `.cart-list` 由 `DY.cart.items()` 渲染 `.cart-item`：`.cart-item-media`（图，链接到 `product.html?id=`）、`.cart-item-info`（名称、英文名、尺码、单价）、`.cart-item-actions`（`.qty` 增减、`移除` 按钮 `.link-btn`）。数量变化即时重算。
4. 空购物袋显示 `.cart-empty`：说明 + `.btn--primary` → `shop.html`（"去挑一件"）。空态时隐藏 `.cart-layout` 与结算按钮。
5. `.summary`：`.summary-row` 小计、运费（免运费时显示"免运费"，否则金额）、优惠（有优惠时显示负值）、`.summary-total` 合计。
6. `.promo-form`：输入优惠码 + 应用按钮；`WELCOME10` 提示"已应用：9 折"，错误码提示"优惠码无效或已过期"。
7. 结算按钮 `.btn--primary.btn--block`："去结算"——无支付后端，点击后 `DY.toast("演示站点：结算功能待接入支付")`。
8. **免运费进度条** `.ship-bar`：未达标显示"再买 ¥N 即免运费"，进度用 JS 设置 `--p` 变量。
9. `cart-page.js` 必须监听 `dy:cart-change` 重新渲染。

### 7.6 `contact.html` — 联系我们（PAGE_ID `contact`，加载 `js/contact.js`）

1. `.contact-layout`：左表单，右信息卡。移动端上下堆叠。
2. `.form` 字段：姓名（必填，≥2 字）、邮箱（必填，正则校验）、主题（`<select>`：订单咨询 / 尺码建议 / 退换货 / 合作 / 其他）、订单号（选填）、留言（必填，≥10 字，`.textarea`，带字数计数 `.char-count`）。
3. 校验：失焦即校验，错误显示在 `.field-error` 并给输入框加 `.is-invalid`；提交时全部校验，通过后把表单替换为成功态 `.form-success`（"我们已收到，1 个工作日内回复"）。**不发起真实网络请求。**
4. 右侧 `.info-card` ×3：客服邮箱（`mailto:`）、客服电话、工作室地址与营业时间；外加微信 / 小红书。
5. `#faq` 区块：`DY_CONFIG.faqs` 渲染 6 条 `.accordion-item`（手风琴，一次只开一条）。
6. 底部一行说明：工作日 10:00–19:00，节假日顺延。

### 7.7 `.product-card` 统一结构（首页、列表页、相关推荐都必须用这个）

```html
      <article class="product-card">
        <a class="product-media" href="product.html?id=p01">
          <img src="assets/products/p01.svg" alt="云絮圆领针织衫" loading="lazy" decoding="async" width="800" height="1000">
          <span class="product-badge">新品</span>
        </a>
        <div class="product-body">
          <h3 class="product-name"><a href="product.html?id=p01">云絮圆领针织衫</a></h3>
          <p class="product-en">Cloud Knit Crew</p>
          <p class="product-price"><span class="price">¥460</span></p>
          <ul class="product-swatches" aria-label="可选颜色">
            <li><span class="swatch" style="--sw:#EDE7DC" title="米白"></span></li>
          </ul>
        </div>
      </article>
```
`badge` 为 `null` 时不渲染 `.product-badge`。`compareAt` 存在时追加 `<span class="price--was">原价</span>`。

---

## 8. SVG 资产配方（必须按此产图，避免风格漂移）

**通用**
- 根元素：`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1000" role="img" aria-labelledby="t01"><title id="t01">…</title>`（`id` 每文件内唯一）。
- 禁止：`<script>`、外链 `href`、`@import`、位图 `<image>`、字体文件。可用 `<defs>` + `linearGradient` + 一个 `feGaussianBlur`（`stdDeviation` ≤ 12）。
- 单文件 ≤ 8 KB，节点数 ≤ 100（画具象单品必然比抽象色块复杂，故此上限已放宽）。
- 基调：**具象单品**——商品图必须画出可辨认的服装结构（领子、门襟、纽扣、口袋、罗纹、缝线、五金），因为顾客要看清买的是什么；氛围图与面料特写可用半抽象处理。不画人、不写字。
- 每个文件重复"模板骨架"，只改渐变色、曲线与色带：

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1000" role="img" aria-labelledby="t01">
  <title id="t01">dooyoor 织物肌理</title>
  <defs>
    <linearGradient id="g01" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#EFE9DF"/>
      <stop offset="1" stop-color="#DCD3C4"/>
    </linearGradient>
    <linearGradient id="g02" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#17140F" stop-opacity=".16"/>
      <stop offset="1" stop-color="#17140F" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect width="800" height="1000" fill="url(#g01)"/>
  <path d="M0 300 C 200 240, 600 360, 800 300 L800 420 C 600 480, 200 360, 0 420 Z" fill="#17140F" opacity=".10"/>
  <path d="M400 60 V940" stroke="#17140F" stroke-opacity=".12" stroke-width="1"/>
  <rect width="800" height="1000" fill="url(#g02)"/>
</svg>
```

**配色池**（每文件挑 2–4 个，不得用池外颜色）
底色：`#EFE9DF` `#E6DFD3` `#DCD3C4` `#E9E4DA` `#E3E0D6` `#EDE7DC` `#E7E2D8`
色带：`#17140F`（opacity .06–.20）、`#A24E2A`（.08–.30）、`#6B7355`（.10–.26）、`#8A8175`（.10–.24）、`#7C3A1E`（.06–.18）

**逐文件差异要求**
- `products/p01…p08.svg`：8 张底色与色带组合**各不相同**，图像语言可区分为不同单品（针织=密集横弧线；丹宁=竖向斜纹线组；外套=大面积厚重色块；托特=方形轮廓暗示）。每张只用 1 个强调色带。
- `col-01…04.svg`：比商品图更大气，色带更疏、留白更多，可含一个大的圆形或拱形色块。
- `detail-01.svg` / `detail-02.svg`：特写感——线条更密更细（`stroke-width` 1–2，间距 12–24px 平行线组）。
- `look-01.svg` / `look-02.svg`：构图偏"人像留白"，中部留出干净区域，适合叠加引语文字。
- `hero.svg`：`viewBox="0 0 1600 1100"`，左侧 40% 保持干净低对比（用于叠标题），右侧放主要色带构成。
- `about-workshop.svg`：`viewBox="0 0 1200 800"`，抽象工作室感——水平长条（工作台）、竖向细线（线架）、若干圆形（线轴），全部低饱和。
- `logo-mark.svg`：64×64，透明背景，墨色 `#17140F`，一个"折布/垂坠"母题：两条叠合弧线 + 一条竖线，`stroke-width="3"`，`stroke-linecap="round"`，居中，四边各留 8px。**不得含文字。**

---

## 9. 自检清单（每个构建者返回前逐项确认）

- [ ] 文件路径与 §2 完全一致（大小写一致）。
- [ ] HEADER / DRAWER / SEARCH / FOOTER / BOTTOMNAV 与 §5 **逐字一致**（除缩进）。
- [ ] `<body data-page="…">` 正确，`<html lang="zh-CN">`。
- [ ] 未创建或修改 `css/style.css`、`js/site-config.js`、`js/cart.js`、`js/main.js`。
- [ ] 所有 class 都在本规范名单内。
- [ ] 无内联 `style`（`.swatch` 的 `--sw` 与 `.ship-bar` 的 `--p` 除外）、无 `onclick`、无外链。
- [ ] 图片有 `alt`，图标 SVG 有 `aria-hidden="true"`，表单控件有 `label`（可 `.u-sr-only`）。
- [ ] 360px 宽无横向滚动；移动端 `main` 有底部内边距避免被底部导航遮挡。
- [ ] 商品数据全部来自 `DY_CONFIG`，无硬编码。
- [ ] 插入 DOM 的文本经 `DY.escape()`。
- [ ] 已用 write 工具把文件写盘，并读回确认内容完整（不是只输出到回答里）。

---

## 10. README 必含内容（由总控完成）

如何打开、目录说明、**哪些是占位内容需替换**（联系方式、地址、备案号、价格、商品描述、图片）、如何替换商品数据（改 `js/site-config.js` 一个文件）、中文名缺字风险与替换方法、后续接入真实支付/后端的位置。

---

## 11. 附录：品牌覆盖层可用类名（`style.css` §23 / §25 已定义）

> 这批类名在规范初版之后新增，用于支持轻奢 + 区块链 + 认证二手 + 后台。**页面可以直接使用，但不得修改 style.css。**

**成色与角标**：`.cond-tag` `.cond-tag--used` `.cond-tag--verified` `.product-badge--used` `.product-badge--muted` `.badge` `.badge--ok` `.badge--warn` `.badge--muted` `.badge--accent`

**区块链溯源**：`.chain-panel` `.chain-head` `.chain-title` `.chain-hash` `.chain-grid` `.chain-item` `.chain-item-label` `.chain-item-value` `.chain-actions` `.chain-note`

**流转生命周期**：`.lifecycle` `.lifecycle-list` `.lifecycle-item` `.lifecycle-marker` `.lifecycle-date` `.lifecycle-title` `.lifecycle-desc`

**溯源查询页**：`.verify-box` `.verify-form` `.verify-input` `.verify-hint` `.verify-result` `.verify-result--ok` `.verify-result--fail` `.verify-result-head` `.verify-sub` `.verify-steps` `.verify-step` `.verify-item` `.verify-item-media`

**统计与订单**：`.stat-grid` `.stat-card` `.stat-label` `.stat-value` `.stat-delta` `.stat-delta--down` `.order-card` `.order-head` `.order-no` `.order-name` `.order-meta` `.order-foot` `.order-amount`

**商家后台**：`.admin-shell` `.admin-side` `.admin-side-head` `.admin-logo` `.admin-nav` `.admin-nav-link`（`.is-active`）`.admin-drawer` `.admin-drawer-backdrop` `.admin-drawer-panel` `.admin-main` `.admin-topbar` `.admin-title` `.admin-user` `.admin-user-name` `.admin-avatar` `.admin-menu-btn` `.admin-card` `.admin-card-title` `.admin-toolbar` `.admin-list` `.admin-row` `.admin-row-media` `.admin-row-body` `.admin-row-title` `.admin-row-meta` `.admin-row-actions` `.admin-modal` `.admin-modal-backdrop` `.admin-modal-panel` `.admin-modal-head` `.admin-modal-title` `.admin-modal-body` `.admin-modal-foot` `.admin-login` `.admin-login-card` `.admin-login-title` `.admin-login-sub` `.admin-login-tip`

**商城增强（对应初稿已有功能）**：`.banner` `.banner-swiper` `.banner-track` `.banner-slide` `.banner-overlay` `.banner-content` `.banner-title` `.banner-desc` `.banner-cta` `.banner-dots` `.banner-dot`（`.is-active`）`.banner-arrow` `.banner-arrow--prev` `.banner-arrow--next` `.product-fav-btn`（`.is-active`）`.fav-link` `.search-field` `.search-clear`（`.is-visible`）`.skeleton` `.skeleton-card` `.skeleton-line`

### 两条必须遵守的口径

1. **价格**：`compareAt` 存在时，现价用 `<span class="price price--sale">`，原价用 `<span class="price--was">`。全站统一，不得有的页面加 `.price--sale` 有的不加。
2. **隐藏**：`style.css` §23.1 已定义全局 `[hidden]{display:none!important}`，**不要再用 `.u-hide` 去打补丁**，直接用 `hidden` 属性。

---

## 12. 账户 / 钱包 / 订单 / 二手交易 / 增值抵扣层（最终形态）

> 这一层是从初稿 `服装商城_优化版.html` 移植并修正过来的。**所有模块的签名与存储结构在本节冻结**，并行开发必须严格照此实现，不得自行改名或改结构。

### 12.1 新增文件与加载顺序

**新增页面（4 个）**：`login.html`、`register.html`、`account.html`、`preowned.html`
**新增 JS（6 个）**：`js/auth.js`、`js/wallet.js`、`js/orders.js`、`js/preowned.js`（数据层）；`js/auth-page.js`、`js/account-page.js`、`js/preowned-page.js`（页面层）

**全站脚本顺序（冻结，不可改）**：
```html
<script src="js/site-config.js"></script>
<script src="js/cart.js"></script>
<script src="js/main.js"></script>
<script src="js/fav.js"></script>
<script src="js/auth.js"></script>
<script src="js/wallet.js"></script>
<script src="js/orders.js"></script>
<script src="js/preowned.js"></script>
{{PAGE_SCRIPT}}
```
`admin.html` 例外：只加载 `site-config` → `cart` → `admin.js`。

### 12.2 存储键（一律经 `DY.store.get/set`，内部已 try/catch 降级）

| 键 | 内容 |
| --- | --- |
| `dooyoor.users.v1` | `{ "<手机号>": userRecord }`（**一个大对象，绝不逐用户一个键**——初稿扫描全部 localStorage key 的做法必须废弃） |
| `dooyoor.session.v1` | `{ phone, at }` —— **只存手机号，绝不存密码** |
| `dooyoor.preowned.v1` | `[ listing ]` 全局二手列表 |
| `dooyoor.cart.v1` | 购物袋（已有，**游客袋，不随登录变化**——这是对初稿"每人一个购物袋"的简化） |
| `dooyoor.fav.v1` | 收藏（已有） |

### 12.3 `userRecord`

```js
{
  phone: '13800138000',        // 主键
  name: '用户 8000',            // 可编辑
  avatar: '',                   // data URI，可空
  registerDate: '2025-04-20',   // YYYY-MM-DD
  balance: 10000,               // 演示余额（数字，元）
  pwdHash: '<32 位十六进制>',    // 仅演示用，见 12.11
  prefs: { msg: true, promo: false },
  orders: [],                   // order[]（12.4）
  balanceHistory: [],           // tx[]（见 DY.wallet）
  myProducts: [],               // myProduct[]（12.8 抵扣用）
  myUsedGoods: []               // listing[]（本人发布的二手）
}
```

### 12.4 `order`

```js
{
  no: 'DY202504200001',         // 唯一单号
  type: 'new' | 'used',
  items: [ { productId, name, image, size, qty, unitPrice, lineTotal } ],
  // 二手单只有 1 个 item，且 productId 为 listing.id
  total: 2980,                  // 实付合计（含运费，已减优惠）
  pay: { subtotal, discount, shipping, balance },
  status: 'pending'|'shipped'|'done'|'refund',
  date: '2025-04-20', time: '2025-04-20 14:03',
  chainCode: 'DY-2025-000101',  // 商品的溯源码（新品）
  txHash: '0x…64 位十六进制',    // **下单时生成并写死，绝不渲染时重算**
  sellerPhone: '',              // 二手单才有
  settled: true,                // 二手单：卖家是否已入账
  settleTo: '',                 // 未能入账时记录待结算对象
  usedPublished: false          // 发布二手后置 true，防重复发布
}
```

### 12.5 `listing`（二手商品）

```js
{
  id: 'u101',                   // 'u' 前缀，与商品 id 空间隔离
  name, nameEn, image,
  price,                        // 转让价
  origin,                       // 原价
  category, categoryName,
  sellerPhone: '',              // 空字符串 = 官方渠道
  sellerName: 'DOOYOOR 官方',
  grade: 'A-'|'B+'|'B',         // 成色评级
  chainCode: 'DY-…',            // 归属的溯源码
  note: '…',
  createdAt: 'YYYY-MM-DD'
}
```

### 12.6 API 契约（**签名冻结**）

**`window.DY.auth`**
| 方法 | 返回 | 说明 |
| --- | --- | --- |
| `current()` | `userRecord \| null` | 从 session 解析当前用户；session 无效返回 `null` |
| `isLoggedIn()` | `boolean` | |
| `register(phone, code, password)` | `{ok, message, user?}` | 手机号 `^1\d{10}$`；验证码固定 `888888`（演示）；密码 ≥6 位；手机号不可重复 |
| `login(phone, password)` | `{ok, message, user?}` | **明文不落盘**，只比对 `pwdHash` |
| `logout()` | `void` | 清除 session；**不动购物袋与收藏** |
| `update(patch)` | `{ok, message}` | 合并进 userRecord 并保存 |
| `changePassword(oldPwd, newPwd)` | `{ok, message}` | 替换 3 次 `prompt()` 的实现 |
| `hash(text)` | `string` | 确定性 32 位十六进制（见 12.11） |

**`window.DY.wallet`**
| 方法 | 返回 | 说明 |
| --- | --- | --- |
| `balance()` | `number` | 未登录返回 0 |
| `history()` | `tx[]` | 按时间倒序 |
| `spend(amount, description)` | `{ok, message}` | 余额不足返回 `{ok:false}`；**写一条 expense 流水** |
| `earn(amount, description)` | `{ok, message}` | 写一条 income 流水 |
| `discountUnlocked()` | `number` | 当前可抵扣总额（12.8） |
| `discountDetail()` | `[{myProduct, unlocked, months, bonus}]` | 逐件明细，供"我的抵扣"页 |
| `monthsHeld(buyTime)` | `number` | 整月数 |

`tx` 结构：`{ id, amount, type:'income'|'expense', description, time, date }`

**`window.DY.orders`**
| 方法 | 返回 | 说明 |
| --- | --- | --- |
| `list(status)` | `order[]` | 当前用户订单，可按 status 过滤；未登录返回 `[]` |
| `find(no)` | `order \| null` | |
| `checkout(opts)` | `{ok, message, order?}` | 购物袋结算，见 12.7 |
| `buyNow(productId, size, qty)` | `{ok, message, order?}` | 立即购买，见 12.7 |
| `buyUsed(listingId)` | `{ok, message, order?}` | 二手下单，见 12.10 |
| `setStatus(no, status)` | `{ok, message}` | 仅供后台演示 |
| `nextNo()` | `string` | 生成单号 |

**`window.DY.preowned`**
| 方法 | 返回 | 说明 |
| --- | --- | --- |
| `list()` | `listing[]` | 读 `dooyoor.preowned.v1`，无存档时用 `DY_CONFIG.preowned` 播种 |
| `mine()` | `listing[]` | 当前用户发布的 |
| `publish({name, price, origin, note, sourceOrderNo})` | `{ok, message, listing?}` | 见 12.9 |
| `remove(id)` | `{ok, message}` | 只能删自己的 |
| `find(id)` | `listing \| null` | |

**`window.DY.chain`**
| 方法 | 返回 | 说明 |
| --- | --- | --- |
| `hash(seed)` | `'0x' + 64 位十六进制` | **确定性**：同一 seed 永远同一哈希（12.12） |

### 12.7 结算与下单流程（**修掉初稿"漏乘数量"的缺陷**）

`DY.orders.checkout()` 必须按以下顺序执行，任何一步失败即中止并保持数据不变：

1. 未登录 → `{ok:false, message:'请先登录'}`。
2. 购物袋为空 → `{ok:false, message:'购物袋是空的'}`。
3. 取 `DY.cart.items()`，逐项 `lineTotal = unitPrice * qty`，`subtotal = Σ lineTotal`。
4. `discount` = 本次使用的抵扣额（未在结算中使用抵扣时记 0；抵扣在 `buyNow` 中优先使用）。
5. `shipping` = `subtotal - discount >= DY_CONFIG.shipping.freeThreshold ? 0 : DY_CONFIG.shipping.fee`。
6. `payable = subtotal - discount + shipping`，**若 `payable > balance` → `{ok:false, message:'余额不足'}`**（比较对象必须是乘以数量后的总额）。
7. `DY.wallet.spend(payable, '订单支付 ' + no)` —— **只扣一次，金额为 payable**。
   > 初稿的错误是逐项写 `balance -= item.price`，漏乘 `qty`。**严禁逐项扣款。**
8. 生成 1 个 order，`items` 含全部行、`qty` 与 `lineTotal`。**不要每行拆一个订单**。
9. 每个订单行向 `myProducts` 追加 1 条（供抵扣），`price = lineTotal`。
10. `DY.cart.clear()`；派发 `dy:cart-change`；返回订单。

`buyNow(productId, size, qty)`：校验尺码与登录 → 计算 `unitPrice*qty` → **先用抵扣再用余额**（`useDiscount` 记入 `pay`）→ 余额不足即失败 → 扣款 → 写单 → 写 `myProducts`。抵扣不足部分才动余额；若抵扣已覆盖全部，**仍必须写一条 amount 为 0 的流水说明**（初稿漏写导致明细与订单对不上）。

### 12.8 增值抵扣算法（把初稿"只有文案没有实现"的规则真正实现）

对 `myProducts` 每一项：

```
months = monthsHeld(buyTime)                    // 整月数
if (months < 12) → unlocked = 0
else:
  base  = price                                  // 该件实付价
  bonus = months >= 36 ? (floor(months/12) - 2) * 100 : 0
  unlocked = base + bonus
```
- `DY_CONFIG.discountRule` 提供 `holdMonths:12`、`bonusStartMonths:36`、`bonusPerYear:100`。
- `buyTime` **必须存 ISO 字符串**（`new Date().toISOString()`），**不得沿用初稿的 `Date.toString()`**。
- 页面文案必须与算法一致：满 12 个月按实付价抵扣；满 36 个月起每满一年 +¥100。

### 12.9 发布二手

`DY.preowned.publish({name, price, origin, note, sourceOrderNo})`：
1. **必须校验登录**（初稿漏了，导致卖家为 null 的"无主商品"）。
2. `price`、`origin` 必须是正数且 `price <= origin`。
3. 若给了 `sourceOrderNo`：用**单号**（不是名称——初稿按名称反查会错配）找到订单，取其商品的 `image` 与 `chainCode`；并校验该订单 `usedPublished !== true`，否则 `{ok:false, message:'该订单已发布过二手'}`；成功后置 `usedPublished = true`。
4. 生成 `listing`（`id = 'u' + Date.now()`，`sellerPhone = 当前用户手机号`），**同时写入全局列表与用户 `myUsedGoods`**（初稿两者割裂易不同步）。
5. 返回 `{ok:true, listing}`。

### 12.10 二手交易（**修掉初稿"钱货两空"的缺陷**）

`DY.orders.buyUsed(listingId)`：
1. 未登录 → 失败。
2. `sellerPhone === 当前用户` → `{ok:false, message:'不能购买自己发布的商品'}`。
3. `balance < listing.price` → `{ok:false, message:'余额不足'}`。
4. 扣买家余额（`DY.wallet.spend`）。
5. **给卖家入账，且绝不能静默丢钱**：
   - 若 `sellerPhone` 为空（官方渠道）或该用户不存在 → 订单记 `settled:false`、`settleTo:'官方待结算'` 或 `待结算给卖家 <phone>`，页面必须显示这笔待结算；
   - 若卖家存在 → 给卖家 `balance += price` 并写一条 `income` 流水，订单记 `settled:true`。
   > 初稿只在卖家存在时才加钱、没有 else 分支，导致初始示例商品必然丢钱。
6. 从全局二手列表移除该 listing；写订单；把该件加入买家 `myProducts`。

### 12.11 账户安全口径（演示，但必须比初稿更诚实）

- **绝不存储明文密码**。`pwdHash = DY.auth.hash(password)`，`hash` 为确定性字符串散列。
- `dy:session` **只存手机号**。
- **"记住我"只记手机号**，不记密码。
- 所有涉及余额的界面必须显示 `DY_CONFIG.demoBalanceNote`（"演示余额，不涉及真实资金"），用 `.badge--warn` 或 `.chain-note` 呈现。
- 页面必须写明：这是**纯前端演示**，账号、余额、订单、链上记录全部保存在浏览器本地，清缓存即丢失，**不具备任何安全性，不可用于真实交易**。

### 12.12 确定性哈希（修掉初稿"每次渲染随机生成"的缺陷）

`DY.chain.hash(seed)` 用确定性算法（FNV-1a 或类似）把 `seed` 映射为 64 位十六进制并加 `0x` 前缀。
**严禁**在任何渲染函数里调用 `Math.random()` 生成哈希或溯源码——初稿因此每次进页面哈希都不同，与"唯一凭证"语义冲突。

### 12.13 页面契约

**`login.html`**（`data-page="login"`，`js/auth-page.js`）
`.page-head` + 卡片式表单（手机号、密码、`.field-error`、登录按钮、去注册链接）+ `.admin-login-tip` 风格的**演示账号提示**（提示可用 `13800138000` / `dooyoor` 登录，并说明会预置演示数据）+ 演示声明。支持 `?next=<相对路径>` 登录后跳回。登录成功写 session，未登录时自动播种一个演示账号（见 12.14）。

**`register.html`**（`data-page="register"`，复用 `js/auth-page.js`）
手机号、验证码（含 60 秒倒计时按钮）、密码、确认密码。验证码固定 `888888` 但要**明确标注为演示验证码**（不得像初稿那样把它当"发给用户"的提示弹出来）。注册成功即自动登录并跳 `account.html`。

**`account.html`**（`data-page="account"`，`js/account-page.js`）
- 顶部未登录时重定向到 `login.html?next=account.html`（路由守卫）。
- 资料卡（头像、昵称、注册日期、编辑资料按钮）、余额卡（金额 + `.badge--warn` 演示标注 + 去充值/明细入口）。
- **内部视图路由**：用 `?view=` 切换，取值来自 `DY_CONFIG.accountViews`：`overview|orders|wallet|discount|preowned|chain|favorites|settings`，默认 `overview`。切换时用 `history.replaceState` 写回 URL（try/catch）。导航为 `.admin-nav-link` 样式的侧栏（≥768px）与抽屉/横滑（移动端），**或**用 `.filter-bar` 的 chip 行做移动端视图切换（实现者二选一，但必须键盘可达）。
- 8 个视图：
  1. `overview` — 资料卡 + 余额卡 + 8 宫格入口（对应 `accountViews` 其余项）+ 退出登录。
  2. `orders` — 订单列表，`.order-card`，含类型角标、支付明细（抵扣/余额）、状态 `.badge`、以及**"发布二手"按钮**（`type==='new'` 且 `!usedPublished` 时显示）。
  3. `wallet` — 余额明细，逐条 tx（收入/支出用 `.badge--ok`/`.badge--muted`），空态提示。
  4. `discount` — 可抵扣总额 + 规则说明（`discountRule.note`）+ 逐件明细（`discountDetail()`，显示已持有月数、是否解锁、解锁后金额、未解锁的剩余天数）。
  5. `preowned` — 我发布的二手，可下架（`DY.preowned.remove`）。
  6. `chain` — 我的区块链凭证，逐单显示 `chainCode`、`txHash`（`.chain-hash`，**取自订单、不重算**）、状态、日期。
  7. `favorites` — 收藏网格，复用 `DY.fav.list()`，点击进 `product.html?id=`（**二手收藏品不得在此点击无反应**——若 `id` 以 `u` 开头则进 `preowned.html#<id>`）。
  8. `settings` — 个人资料（编辑弹窗：昵称 + 头像上传）、修改密码、通知设置（`notifyPrefs` 两个开关，**必须真的持久化到 `prefs`**，不得像初稿那样点了无效）、关于（版本号），以及"清空演示数据"按钮（谨慎：需二次确认）。

**`preowned.html`**（`data-page="preowned"`，`js/preowned-page.js`）
- `.page-head`（"二手商城" + 认证二手说明 + "发布二手"CTA → 未登录跳登录）。
- 筛选：分类 + 成色等级（`filter-chip`）。
- 网格：`.product-card` 结构 + `.cond-tag--used` 显示评级 + 卖家（官方/用户脱敏）+ "立即购买"按钮 → `DY.orders.buyUsed`。
- 每张卡可点进 `product.html` 对应的**原商品**详情（通过 `chainCode` 反查商品），二手本身不单独建详情页。
- 空态与演示声明。

### 12.14 演示数据播种

`login.html` 首次访问且 `dooyoor.users.v1` 为空时，**自动创建一个演示账号**：手机号 `13800138000`、密码 `dooyoor`、昵称"演示用户"、`balance = DY_CONFIG.demoBalance`（10000），并写一条 `{amount:10000, type:'income', description:'演示初始余额'}` 流水。这样任何访客都能立刻体验完整闭环（初稿"必须先注册且知道 888888 才能进"是硬缺陷）。

### 12.15 必须修掉的初稿缺陷对照表（验收标准）

| 初稿缺陷 | 本层要求 |
| --- | --- |
| 结算漏乘 `qty` | 12.7：只扣一次 `payable`，含数量 |
| 返回按钮乒乓死循环 | 不存在返回栈：用 `?view=` 深链 + `history.replaceState` |
| 刷新即掉登录 | session 持久化到 `dooyoor.session.v1` |
| 明文密码落盘 | 只存 `pwdHash`，session 只存手机号 |
| 渲染时随机生成哈希 | 12.12 确定性 `DY.chain.hash`，订单下单时写死 |
| XSS（数据拼 innerHTML） | 一律 `DY.escape()`；禁止把数据拼进 `onclick` 等属性 |
| 按名称反查订单 | 12.9：按**单号**反查 |
| 二手交易钱货两空 | 12.10：`settled`/`settleTo` 显式记录待结算 |
| 抵扣规则与文案矛盾 | 12.8：按文案实现 |
| 通知开关点了无效 | `settings` 视图必须真正持久化 `prefs` |
| 未登录可进"我的" | 12.13：路由守卫重定向登录 |
| 收藏二手点击无反应 | `favorites` 视图按 id 前缀分流 |
| 系统 `prompt`/`confirm` | 一律改用站点 Modal（`.admin-modal` 或 `.drawer` 样式）与二次确认按钮 |
| 无收货信息 | 结算表单必须收集收件人、手机号、地址，并校验 |
| 分类 `used` 无 chip | `preowned.html` 提供独立入口与筛选 |
| 三套颜色体系 | 只用 `css/style.css` 的 CSS 变量 |
| 无 `prefers-reduced-motion` | 全部动效遵循 `css/style.css` §22 |

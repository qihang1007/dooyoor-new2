# DOOYOOR 牛仔系列 — AI 出图提示词包

> 这份文件解决一件事：**把站内的示意图换成真实的 AI 生成商品图。**
>
> 我（构建方）没有图像生成能力，只能产出 SVG。所以站内现在是**手绘的丹宁单品 SVG**（结构准确、可辨认，但不是照片）。你拿这份提示词去任意出图工具生成照片后，按下文「怎么替换」三步就能换上，**不需要改任何代码逻辑**。

---

## 一、统一风格（保证 14 张图看起来像同一个品牌）

所有图都建议带上这段**共用前缀**，这是整套图一致性的关键：

```
Editorial e-commerce product photography for a premium raw denim brand.
Subject centered on a seamless light neutral background (very light cool grey, #F5F6F8).
Soft diffused daylight from the upper left, gentle falloff to a soft shadow under the subject.
Muted indigo and slate-blue palette with subtle copper-orange contrast stitching.
Matte film-like color grading, low saturation, no HDR look.
Shot on 85mm lens at f/8, sharp focus across the whole garment, no depth-of-field blur.
No text, no logo, no watermark, no visible brand tag, no human face, no hands.
```

**负向提示词（通用）**：

```
text, watermark, logo, brand label, signature, human face, hands, mannequin face,
oversaturated colors, neon, HDR, heavy vignette, clutter, busy background,
distorted seams, extra buttons, low resolution, jpeg artifacts
```

**配色关键词（写进提示词，锁定品牌色）**：

```
deep indigo #1B2A42 · raw indigo #2B3F5C · mid indigo #3D5473 ·
stone-washed light blue #7C93AE · bleached blue #A9BCCF ·
black denim #22262B · copper-orange stitching #A85A16 / #C97A2B
```

---

## 二、8 件商品图

**统一要求**：画幅 **4:5**（建议生成 1600×2000 或 1200×1500），单品**居中、完整、不裁切**，背景与光线按上面的共用前缀。

> 商品图建议用 **ghost mannequin（隐形人台）** 或 **flat lay（平铺）** 二选一，**整套 8 张必须统一**——混用会显得杂乱。

### 1 → `p01` 赤耳丹宁夹克 / Selvedge Denim Jacket

```
[共用前缀]
A classic raw indigo denim trucker jacket, 14oz rigid Japanese selvedge denim,
worn as a ghost mannequin shot facing the camera, sleeves straight down.
Deep raw indigo #2B3F5C with visible indigo dye depth, no fading.
Copper-orange contrast topstitching on shoulders, chest pockets, placket and cuffs.
Three copper shank buttons down the center placket, two chest flap pockets with copper rivets,
a horizontal waistband with subtle pleats, visible selvedge seam on the inner placket.
Crisp fabric structure, slight natural creases at the elbows. Front view, centered, full garment in frame.
```

### 2 → `p02` 落肩丹宁衬衫 / Oversized Denim Shirt

```
[共用前缀]
An oversized drop-shoulder denim shirt in light stone-washed blue #7C93AE, 6oz soft denim,
ghost mannequin shot facing the camera, sleeves straight down.
Relaxed boxy silhouette, hem clearly longer than a standard shirt, wide dropped shoulders.
Pointed shirt collar, center placket with five off-white shell buttons,
one square chest pocket, curved shirt-tail hem with tonal stitching.
Pale tonal topstitching instead of copper, soft washed-out variation across the fabric.
Front view, centered, full garment in frame.
```

### 3 → `p03` 直筒赤耳牛仔裤 / Straight Selvedge Jeans

```
[共用前缀]
A pair of straight-leg raw indigo selvedge jeans, 13.5oz rigid Japanese denim,
photographed as a flat lay, laid out vertically with the two legs parallel and straight.
Deep raw indigo #2B3F5C, no fading, crisp and slightly stiff looking.
Visible waistband with five belt loops, button fly with a copper top button and hidden zip,
two slanted front pockets each secured with a copper rivet, a small coin pocket on the right,
a clear selvedge outseam running down the outside of both legs with a lighter edge stripe.
Copper-orange contrast topstitching along the outseam, inseam, yoke, waistband and pocket edges.
Straight from hip to hem — the leg width stays almost constant.
Top-down view, centered, full garment in frame.
```

### 4 → `p04` 高腰阔腿牛仔裤 / High-Rise Wide Jeans

```
[共用前缀]
A pair of high-rise wide-leg jeans in stone-washed light blue #7C93AE, 11oz denim,
photographed as a flat lay, laid out vertically with the two legs parallel.
Clearly high waistband (wider and higher than a standard jean), five belt loops,
a hidden drawstring opening at the waistband, two slanted front pockets with copper rivets.
Wide leg that flares noticeably from the thigh down — the hem opening is much wider than the thigh.
Soft pale tonal topstitching.
Sold as certified pre-owned, grade B+: visible soft fading patches across both knees
and a light worn band at both hems, gentle overall wash-out, but no tears and no holes.
Top-down view, centered, full garment in frame.
```

### 5 → `p05` A 字丹宁半身裙 / A-Line Denim Skirt

```
[共用前缀]
An A-line denim mini skirt in stone-washed light blue #7C93AE, 10oz rigid denim with a crisp hand,
ghost mannequin shot facing the camera.
Clear A-line silhouette — narrow at the waist, flaring steadily to a wide hem.
Structured and stand-away, not soft or clingy.
Wide waistband with five belt loops and two hidden adjustment buttons on the right side.
Center-front button placket with five copper buttons, two patch pockets with copper rivets
and copper contrast topstitching, double-needle stitched hem, subtle vertical creases
showing the stiffness of the fabric. Skirt length ends above the knee.
Front view, centered, full garment in frame.
```

### 6 → `p06` 前开衩长款牛仔裙 / Front-Slit Denim Maxi Skirt

```
[共用前缀]
A long denim maxi skirt in raw indigo #2B3F5C, 12oz mid-weight denim, unwashed,
ghost mannequin shot facing the camera.
High waistband with five belt loops, hidden drawstring opening, visible elastic gathering
at the back of the waistband. Straight-to-slightly-A silhouette reaching the ankle.
The skirt is built from 13 vertical panels with clearly visible vertical panel seams
running the full length. A center-front slit opens from the hem upward for about half
the skirt length, with clean bound edges on both sides of the slit.
Tonal or light topstitching along all panel seams and edges, minimal fading.
Front view, centered, full garment in frame.
```

### 7 → `p07` 牛仔拼接托特包 / Denim Patchwork Tote

```
[共用前缀]
A denim patchwork tote bag made from leftover selvedge denim scraps,
studio product shot standing upright on the neutral background, soft contact shadow beneath.
The body is assembled from six to eight irregular blocks of different denim tones —
deep indigo #1B2A42, raw indigo #2B3F5C, mid indigo #3D5473, stone-washed light blue #7C93AE,
black denim #22262B — each block separated by a visible copper-orange stitched seam.
Two arch-shaped webbing handles with X-shaped bar-tack reinforcement stitching at the roots.
Bound top edge, a sliver of natural off-white canvas lining visible at the opening.
Slightly tapered trapezoid shape, tall body, visible side gusset depth.
Three-quarter front view, centered, whole bag in frame.
```

### 8 → `p08` 迷你牛仔斜挎包 / Mini Denim Crossbody

```
[共用前缀]
A small square denim crossbody bag in stone-washed light blue #7C93AE, 8oz denim,
studio product shot standing upright, soft contact shadow beneath.
Compact rounded-square body, a front flap covering roughly the top 45% with a soft curved edge.
A copper magnetic snap closure centered on the flap with two short stitched bars beside it.
An adjustable shoulder strap arching above the bag with several horizontal stitch lines
and a small copper slider buckle on the right side.
Copper or tonal contrast topstitching around the body, flap edge and strap.
Sold as certified pre-owned grade A-: essentially no visible wear.
Three-quarter front view, centered, whole bag in frame.
```

---

## 三、6 张氛围图与面料图

### `hero.svg` → 首页首屏（**画幅 16:11**，建议生成 2400×1650）

```
[共用前缀, but replace the background sentence with:]
Wide editorial hero image, deep indigo raw denim fabric draped and folded in broad soft waves
filling only the RIGHT 60% of the frame. The LEFT 40% must stay clean, bright and almost empty —
plain very light grey seamless background with no pattern, reserved for overlaid text.
Extreme close-up of selvedge denim texture: visible twill diagonal weave, deep indigo dye
variation, a copper-orange stitched seam running through the folds, one copper rivet glinting.
No garment silhouette, no product, no text.
```

### `look-01.svg` / `look-02.svg` → Lookbook（**画幅 4:5**，生成 1600×2000）

```
[look-01 — 原色靛蓝]
[共用前缀]
Vertical editorial composition of folded raw indigo selvedge denim.
Denim texture occupies the top and bottom thirds; the MIDDLE third stays clean,
calm and low-contrast (plain neutral background) so text can be overlaid there.
Visible twill weave, deep #2B3F5C indigo, one copper-orange stitched seam, soft shadow.
No garment, no product, no text.

[look-02 — 石洗浅蓝]
Same composition as look-01 but stone-washed light blue #7C93AE,
with soft wash-out variation and a paler, airier feel.
```

### `about-workshop.svg` → 品牌故事页头图（**画幅 3:2**，生成 1800×1200）

```
[共用前缀]
Moody low-saturation denim workshop interior, no people.
A long horizontal cutting table in the foreground, vertical spools of indigo thread on a rack,
several round copper rivet tins and thread cones, folded stacks of indigo denim on a side table.
Cool grey concrete and pale wood surfaces, single soft window light from the left.
Deep indigo and slate palette with a few copper accents. Shallow but not blurry.
```

### `detail-01.svg` / `detail-02.svg` → 面料特写（**画幅 4:5**，生成 1600×2000）

```
[detail-01 — 斜纹织纹]
[共用前缀]
Extreme macro of raw indigo selvedge denim twill weave. Diagonal warp threads clearly visible,
crisp thread definition, tiny cotton fibres, deep indigo #2B3F5C with natural dye variation.
A single copper-orange double-stitched seam crossing the frame diagonally. No product, no text.

[detail-02 — 纬向织纹 + 五金]
[共用前缀]
Extreme macro of stone-washed denim, weft-dominant close weave with a soft worn surface.
One copper rivet pressed through the fabric near the lower third, with copper-orange bar-tack
stitching beside it. Light stone-washed blue #7C93AE, soft wash-out. No product, no text.
```

### `logo-mark.svg` → 品牌标记（**正方形 1:1**）

Logo 建议**继续用现有的 SVG**（矢量在 favicon 尺寸下比位图清晰得多）。如果一定要用 AI 生成，请生成**纯图形、透明背景**的版本，并在生成后手动矢量化；否则 favicon 会糊。

### `col-01` ~ `col-04` → 系列入口卡（**画幅 4:5**）

沿用上面 `look-01/02` 的构图逻辑（中部留白、上下放质感），四张分别对应：
- `col-01` 当季新款：原色靛蓝折叠丹宁
- `col-02` 赤耳丹宁：深靛色 + 一条明显的**赤耳布边**（浅色边缘条纹）
- `col-03` 认证二手：石洗浅蓝 + 膝盖般的柔和褪色斑
- `col-04` 牛仔包袋：拼接色块构成

---

## 四、怎么替换（三步，不需要改代码逻辑）

### 第 1 步：按文件名生成并保存

保存到 `assets/products/`（商品图）与 `assets/`（氛围图），**文件名必须与站内引用一致**：

| 生成内容 | 保存为 |
| --- | --- |
| p01 夹克 | `assets/products/p01.jpg` |
| p02 衬衫 | `assets/products/p02.jpg` |
| p03 直筒牛仔裤 | `assets/products/p03.jpg` |
| p04 阔腿牛仔裤 | `assets/products/p04.jpg` |
| p05 A 字半身裙 | `assets/products/p05.jpg` |
| p06 长款开衩裙 | `assets/products/p06.jpg` |
| p07 托特包 | `assets/products/p07.jpg` |
| p08 斜挎包 | `assets/products/p08.jpg` |
| 首屏图 | `assets/hero.jpg` |
| Lookbook 1 / 2 | `assets/look-01.jpg`、`assets/look-02.jpg` |
| 工坊头图 | `assets/about-workshop.jpg` |
| 系列卡 1–4 | `assets/col-01.jpg` … `assets/col-04.jpg` |
| 面料特写 1 / 2 | `assets/detail-01.jpg`、`assets/detail-02.jpg` |

> 用 `.webp` 也可以，体积更小；把下面的扩展名一起改掉即可。建议商品图压到 **200KB 以内**、氛围图 **300KB 以内**，宽高比按上面的要求。

### 第 2 步：改 `js/site-config.js` 里的路径

只改 `image` 与 `gallery` 两个字段，例如：

```js
// 改前
image: 'assets/products/p01.svg',
gallery: ['assets/products/p01.svg', 'assets/detail-01.svg', 'assets/detail-02.svg'],

// 改后
image: 'assets/products/p01.jpg',
gallery: ['assets/products/p01.jpg', 'assets/detail-01.jpg', 'assets/detail-02.jpg'],
```

8 件商品的 `image`/`gallery` 都在这个文件里，一处改完全站生效（首页、列表页、详情页、购物袋、收藏、相关推荐、后台都会跟着变）。

### 第 3 步：改氛围图引用

`assets/hero.svg`、`assets/look-0*.svg`、`assets/col-0*.svg`、`assets/about-workshop.svg` 的引用分布在：

- `index.html`（hero、lookbook、面料横条）
- `about.html`（头图、lookbook）
- `js/site-config.js` 的 `collections[].image` 与 `banners[].image`（系列卡与首页轮播）
- `js/home.js`（轮播渲染，读的是 config 的 `image` 字段）

把 `.svg` 改成 `.jpg` 即可。改完用编辑器全局搜索 `.svg` 复查一遍，确认没有遗漏。

---

## 五、一个建议

**8 张商品图一次生成、同一套提示词前缀**，不要分几次零散生成——AI 出图的风格波动很大，分批做出来的 8 张会不像同一个品牌。生成后如果某张明显跑偏，只重做那一张，并把你满意的那张作为参考图（image-to-image 或 style reference）喂给模型，一致性会好很多。

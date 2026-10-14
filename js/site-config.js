/* ==========================================================================
   DOOYOOR 㛊䎟 — 站点数据（唯一数据源）
   只做丹宁：上衣 / 裤子 / 裙子 / 包包

   替换商品、价格、溯源码、联系方式只需改这一个文件，十二个页面自动同步。
   字段名与结构被各页面渲染器依赖，改内容请「只改值、不改字段名」。
   ========================================================================== */
(function () {
  'use strict';

  var CARE_DENIM_RAW = ['反面冷水手洗，前 3 次单独洗（原色丹宁会自然掉色）', '不可漂白，不可烘干', '反面阴干，避免暴晒', '需要时低温熨烫反面'];
  var CARE_DENIM_WASH = ['反面冷水机洗轻柔档，与浅色分开', '不可漂白，不可烘干', '悬挂阴干，及时整形', '中温熨烫反面'];
  var CARE_SKIRT = ['反面冷水手洗或机洗轻柔档', '不可漂白，不可烘干', '悬挂阴干，避免暴晒', '低温熨烫反面'];
  var CARE_BAG = ['局部污渍用湿布轻擦', '不可机洗，不可漂白', '避免长时间暴晒', '收纳时保持干燥、避免重压'];

  var CHAIN_NOTE = '每件单品出厂即写入 DOOYOOR 溯源链，生成唯一溯源码。丹宁面料批次、水洗工艺、工坊与质检记录一经上链不可篡改。';

  window.DY_CONFIG = {
    brand: {
      name: 'dooyoor',
      nameCn: '㛊䎟',
      tagline: '懂你的美，更懂你的身',
      taglineEn: 'Reads you. Then dresses you.',
      founded: '2026',
      city: '上海',
      email: 'hello@dooyoor.com',
      phone: '400-000-0000',
      wechat: 'dooyoor',
      redbook: '@dooyoor',
      address: '上海市静安区某某路 000 号 3 楼',
      hours: '周一至周五 10:00–19:00',
      chain: {
        name: 'DOOYOOR Chain',
        network: 'Polygon PoS',
        verifyPrefix: 'DY-',
        note: CHAIN_NOTE,
        steps: [
          { title: '丹宁入库即登记', text: '每批丹宁登记织造厂、盎司克重、靛蓝染法与检测报告编号，原色与石洗分开建档。' },
          { title: '成衣出品即上链', text: '水洗定型与质检完成后写入溯源链，生成唯一溯源码——这条裤子洗过几次水、在哪家水洗厂做的，都记着。' },
          { title: '流转记录不可改', text: '每次售出、回收、养护、再次上架都会追加一条记录，历史记录只增不改，我们也改不了。' },
          { title: '任何人可查证', text: '在溯源页输入吊牌上的溯源码即可看到全部记录，无需登录。' }
        ]
      },
      story: [
        '2026 年，我们在古籍里翻到两个几乎被遗忘的字——㛊与䎟。㛊，是古人对“精准感知、温柔揣度”的注解；䎟，是古籍中专为形容女子柔婉舒展的神态而生的字。我们把这两个字拼成品牌名，从一开始就不想做追逐潮流快消的服装。',
        '但我们也清楚：东方的柔婉不能只停在字面上。于是我们选了丹宁——一种最西方的面料，用它硬朗的骨架，去承托东方剪裁的松弛。这是“㛊䎟”这个名字里最核心的一次碰撞。',
        '每一条腰线的弧度，都反复比对过数百位普通女性的日常身形。我们不追求极端的“纸片人效果”，只让丹宁妥帖地承托你最舒服的状态：肩线落一点、腰身收一点、裤腿阔而不垮，硬面料也能穿出柔软的轮廓。',
        '每一块面料的选择，都兼顾了办公室久坐的透气感、周末逛街的松弛感、赴约小聚的精致感。日本冈山赤耳丹宁的骨感、新疆长绒棉靛蓝纱线的亲肤、意大利环保水洗的柔和——不用在不同场景下频繁换装。',
        '我们始终相信，女性的美从来没有统一模板。你不必硬塞进不合身的潮流，不必为了标签化的风格勉强自己。穿上㛊䎟，衣服会先读懂你，再把你独有的柔美，自然地显露出来。'
      ],
      slogans: {
        primary: '㛊䎟，懂你的美，更懂你的身。',
        secondary: '一衣藏古意，柔媚自天成。',
        tertiary: '㛊䎟，把日常穿成独属于你的风景。'
      },
      shortStory: [
        '我们在古籍里挑了两个字，',
        '一个用来“读懂你的身形”，',
        '一个用来“衬托你的气质”，',
        '于是有了㛊䎟。',
        '希望你穿上这件衣服的时候，',
        '不用费力调整，',
        '就刚好是你最舒服、最好看的样子。'
      ],
      scenes: [
        { id: 'commute', name: '通勤', en: 'Commute', line: '版型妥帖不紧绷，办公室一整天都舒展。', detail: '不用刻意凹造型，通勤也能穿出自然质感。', point: '一件适配早高峰地铁、会议室、下班小聚，不用中途换衣。' },
        { id: 'everyday', name: '休闲日常', en: 'Everyday', line: '软乎乎的面料，裹住周末所有松弛时刻。', detail: '逛老街、喝咖啡、赴野餐，每一步都自在好看。', point: '不被风格定义，你的日常穿搭本来就很好看。' },
        { id: 'vintage', name: '复古风格', en: 'Vintage', line: '复刻老剪裁，却完全适配当代生活的穿搭习惯。', detail: '把旧时光里的优雅，穿成今天的日常。', point: '复古不挑人，普通身形也能穿出画报里的氛围感。' }
      ]
    },

    currency: { symbol: '¥', code: 'CNY', decimals: 0 },

    shipping: {
      freeThreshold: 0,
      fee: 0,
      excludedRegions: ['西藏', '新疆', '台湾', '香港', '澳门'],
      policy: '全国包邮（西藏、新疆、台湾、香港、澳门除外）',
      excludedNote: '该地区运费另计，下单后客服会与你确认。'
    },

    nav: [
      { id: 'index', name: '首页', href: 'index.html' },
      { id: 'shop', name: '全部商品', href: 'shop.html' },
      { id: 'about', name: '品牌故事', href: 'about.html' },
      { id: 'contact', name: '联系我们', href: 'contact.html' }
    ],

    conditionOptions: [
      { id: 'all', name: '全部成色' },
      { id: 'new', name: '全新' },
      { id: 'used', name: '认证二手' }
    ],

    bannersKey: 'dooyoor.banners.v1',

    /* 首页轮播。后台「广告栏装修」模块写同一个 localStorage 键，
       前台优先读本地存档，没有或损坏时回落到这里的默认值。 */
    banners: [
      { id: 'b1', image: 'assets/hero.svg', title: '㛊䎟，懂你的美，更懂你的身。', desc: '东方古字为名，西方丹宁为体。做适配当代都市女性的松弛感丹宁女装。', link: 'shop.html', linkText: '看全部单品', sort: 1, status: 'active' },
      { id: 'b2', image: 'assets/look-01.svg', title: '一衣藏古意，柔媚自天成。', desc: '赤耳丹宁的骨感，东方剪裁的松弛。落肩、微收腰、阔而不垮。', link: 'shop.html?c=bottoms', linkText: '看裤子', sort: 2, status: 'active' },
      { id: 'b3', image: 'assets/col-03.svg', title: '认证二手丹宁', desc: '回收 · 验真 · 养护 · 二次上链。回收价与售价都写在商品页。', link: 'shop.html?cond=used', linkText: '看认证二手', sort: 3, status: 'active' }
    ],

    collections: [
      { id: 'new', name: '当季新款', en: 'New Season', href: 'shop.html', image: 'assets/col-01.svg', note: '6 款' },
      { id: 'jeans', name: '赤耳丹宁', en: 'Selvedge', href: 'shop.html?c=bottoms', image: 'assets/col-02.svg', note: '2 款' },
      { id: 'used', name: '认证二手', en: 'Certified Pre-owned', href: 'shop.html?cond=used', image: 'assets/col-03.svg', note: '2 款' },
      { id: 'bags', name: '牛仔包袋', en: 'Denim Bags', href: 'shop.html?c=bags', image: 'assets/col-04.svg', note: '2 款' }
    ],

    products: [
      {
        id: 'p01',
        name: '赤耳丹宁夹克',
        en: 'Selvedge Denim Jacket',
        category: 'tops',
        categoryName: '上衣',
        condition: 'new',
        conditionName: '全新',
        price: 1280,
        compareAt: null,
        badge: '新品',
        colors: [
          { name: '原色靛蓝', hex: '#2B3F5C' },
          { name: '石洗浅蓝', hex: '#7C93AE' },
          { name: '黑丹宁', hex: '#22262B' }
        ],
        sizes: ['XS', 'S', 'M', 'L', 'XL'],
        image: 'assets/products/p01.svg',
        gallery: ['assets/products/p01.svg', 'assets/detail-01.svg', 'assets/detail-02.svg'],
        short: '14oz 日本冈山赤耳丹宁，三步式排扣门襟。铜色缝线，穿三个月开始出现属于你的褶皱。',
        fabric: '14oz 日本冈山赤耳丹宁，老式梭织机低速织造，布边自带赤耳。经纱用绳染工艺反复浸染 8 次，靛蓝上得深而慢，所以褪色有层次、不会发灰。缝线用铜棕色高强涤纶线，与靛蓝形成经典对比。',
        care: CARE_DENIM_RAW,
        details: [
          '14oz 日本冈山赤耳丹宁',
          '三步式排扣门襟，铜质复古扣',
          '双针平缝，受力点打枣加固',
          '胸前双袋，左袋内加笔插'
        ],
        fit: '标准工装版型，肩宽与衣长按亚洲身形调整。内搭卫衣建议大一码。',
        rating: 4.8,
        reviews: 96,
        chain: {
          code: 'DY-2025-000201',
          hash: '0x7f3a9c41d8e2b6a05f17c93d4e8b2a61c7f0d5e3948a1b6c2d70e9f4a3b8c1502',
          network: 'Polygon PoS',
          block: 62840117,
          mintedAt: '2025-03-18',
          owners: 1,
          verified: true,
          workshop: '上海 · 丹宁工坊',
          batch: 'DEN-OKY-1402'
        },
        lifecycle: [
          { date: '2025-02-06', title: '丹宁入库登记', text: '日本冈山 14oz 赤耳丹宁入库，关联检测报告 QC-1402-118。' },
          { date: '2025-03-11', title: '成衣出品质检', text: '完成缝制与五金检验，质检结论：合格。' },
          { date: '2025-03-18', title: '写入溯源链', text: '生成溯源码 DY-2025-000201，区块高度 62840117。' }
        ]
      },
      {
        id: 'p02',
        name: '落肩丹宁衬衫',
        en: 'Oversized Denim Shirt',
        category: 'tops',
        categoryName: '上衣',
        condition: 'new',
        conditionName: '全新',
        price: 880,
        compareAt: null,
        badge: null,
        colors: [
          { name: '石洗浅蓝', hex: '#7C93AE' },
          { name: '原色靛蓝', hex: '#2B3F5C' },
          { name: '黑丹宁', hex: '#22262B' }
        ],
        sizes: ['XS', 'S', 'M', 'L', 'XL'],
        image: 'assets/products/p02.svg',
        gallery: ['assets/products/p02.svg', 'assets/detail-01.svg', 'assets/detail-02.svg'],
        short: '6oz 轻薄丹宁，做成衬衫的厚度。落肩廓形，洗过之后手感最好。',
        fabric: '6oz 轻薄丹宁，比常规牛仔布薄一半，适合做衬衫内搭或外穿。面料经过一次轻酵素石洗，去掉了新布的僵硬感，但保留了丹宁的骨架。领口用双层本布加固，不是贴一条衬布了事。',
        care: CARE_DENIM_WASH,
        details: [
          '6oz 轻薄丹宁，轻酵素石洗',
          '落肩廓形，后背横向育克',
          '贝壳扣，扣眼手工锁边',
          '侧缝双针平缝，下摆弧形收尾'
        ],
        fit: '落肩宽松版型，胸围余量较大。当外套穿可按平时尺码，单穿想要利落可小一码。',
        rating: 4.7,
        reviews: 143,
        chain: {
          code: 'DY-2025-000202',
          hash: '0x2b8e14fa6c09d3e75a81f204b6c9e3d178a0f5b2c4d6e8903a1b7c5d2e4f6081',
          network: 'Polygon PoS',
          block: 62840132,
          mintedAt: '2025-03-18',
          owners: 1,
          verified: true,
          workshop: '上海 · 丹宁工坊',
          batch: 'DEN-LGT-0604'
        },
        lifecycle: [
          { date: '2025-02-14', title: '丹宁入库登记', text: '6oz 轻薄丹宁入库，关联检测报告 QC-0604-052。' },
          { date: '2025-03-12', title: '成衣出品质检', text: '完成缝制与石洗复检，质检结论：合格。' },
          { date: '2025-03-18', title: '写入溯源链', text: '生成溯源码 DY-2025-000202，区块高度 62840132。' }
        ]
      },
      {
        id: 'p03',
        name: '直筒赤耳牛仔裤',
        en: 'Straight Selvedge Jeans',
        category: 'bottoms',
        categoryName: '裤子',
        condition: 'new',
        conditionName: '全新',
        price: 1080,
        compareAt: null,
        badge: '新品',
        colors: [
          { name: '原色靛蓝', hex: '#2B3F5C' },
          { name: '深靛', hex: '#1B2A42' },
          { name: '黑丹宁', hex: '#22262B' }
        ],
        sizes: ['XS', 'S', 'M', 'L', 'XL'],
        image: 'assets/products/p03.svg',
        gallery: ['assets/products/p03.svg', 'assets/detail-01.svg', 'assets/detail-02.svg'],
        short: '13.5oz 冈山赤耳丹宁，不做水洗的原色裤。穿三个月，它会记住你的坐姿和膝盖。',
        fabric: '13.5oz 赤耳丹宁，日本冈山织造。原色未水洗，出厂即定型，穿后会自然松展约半码。经纱绳染浸染 8 次，褪色慢而分层。后袋用双线弧缝，铆钉为实心铜质。',
        care: CARE_DENIM_RAW,
        details: [
          '13.5oz 赤耳丹宁，日本冈山织造',
          'YKK 黄铜拉链，实心铜铆钉加固',
          '前袋内衬本布，后袋双线弧缝',
          '裤脚原始锁边，可自行裁改'
        ],
        fit: '中腰直筒，臀围合身、裤腿笔直。原色丹宁无弹力，前两次穿着略紧属正常。',
        rating: 4.9,
        reviews: 218,
        chain: {
          code: 'DY-2025-000203',
          hash: '0x9d4c70b2e8a1f36d05c7b94e2a8d61f307b5c9e4a2d8f0613b7e5c9a4d2f83076',
          network: 'Polygon PoS',
          block: 62840155,
          mintedAt: '2025-03-20',
          owners: 1,
          verified: true,
          workshop: '上海 · 丹宁工坊',
          batch: 'DEN-OKY-1350'
        },
        lifecycle: [
          { date: '2025-02-20', title: '丹宁入库登记', text: '13.5oz 赤耳丹宁入库，关联检测报告 QC-1350-007。' },
          { date: '2025-03-14', title: '成衣出品质检', text: '完成缝制与五金检验，质检结论：合格。' },
          { date: '2025-03-20', title: '写入溯源链', text: '生成溯源码 DY-2025-000203，区块高度 62840155。' }
        ]
      },
      {
        id: 'p04',
        name: '高腰阔腿牛仔裤',
        en: 'High-Rise Wide Jeans',
        category: 'bottoms',
        categoryName: '裤子',
        condition: 'used',
        conditionName: '认证二手',
        price: 580,
        compareAt: 980,
        badge: '认证二手',
        colors: [
          { name: '石洗浅蓝', hex: '#7C93AE' },
          { name: '原色靛蓝', hex: '#2B3F5C' }
        ],
        sizes: ['XS', 'S', 'M', 'L'],
        image: 'assets/products/p04.svg',
        gallery: ['assets/products/p04.svg', 'assets/detail-01.svg', 'assets/detail-02.svg'],
        short: '官方回收验真后二次上链。上一位穿着者穿了约 30 次，膝盖褪色已经成型。',
        fabric: '11oz 弹力丹宁，高腰阔腿版型。本品为官方认证二手：经回收验真、专业清洁养护、重新上链后再次上架，原始售价与回收记录均可在溯源链上查到。',
        care: CARE_DENIM_WASH,
        details: [
          '11oz 弹力丹宁（98% 棉 / 2% 弹性纤维）',
          '官方回收验真，已清洁养护',
          '原始交易记录与回收记录均可溯源',
          '成色评级：B+（膝盖轻微褪色，无破损）'
        ],
        fit: '高腰阔腿，裤长按 168cm 身高设计为及踝长度。二手成色下已充分软化，无需磨合期。',
        rating: 4.7,
        reviews: 41,
        chain: {
          code: 'DY-2024-000204',
          hash: '0x5a1f83c07e2b94d618a3c05f7b2e94d183a0c6f529b7e3418d0a6c4f2b8e57190',
          network: 'Polygon PoS',
          block: 62840510,
          mintedAt: '2024-11-02',
          owners: 2,
          verified: true,
          workshop: '上海 · 丹宁工坊',
          batch: 'DEN-STR-1108'
        },
        lifecycle: [
          { date: '2024-11-02', title: '首次写入溯源链', text: '生成溯源码 DY-2024-000204，区块高度 60118224。' },
          { date: '2024-11-19', title: '首次售出', text: '由上海买家购入，成交价 ¥980。' },
          { date: '2025-03-27', title: '官方回收验真', text: '买家寄回，验真通过，穿着约 30 次，无破损。' },
          { date: '2025-04-03', title: '养护与二次上链', text: '专业清洁养护完成，追加流转记录，重新上架。' }
        ]
      },
      {
        id: 'p05',
        name: 'A 字丹宁半身裙',
        en: 'A-Line Denim Skirt',
        category: 'skirts',
        categoryName: '裙子',
        condition: 'new',
        conditionName: '全新',
        price: 780,
        compareAt: null,
        badge: null,
        colors: [
          { name: '石洗浅蓝', hex: '#7C93AE' },
          { name: '原色靛蓝', hex: '#2B3F5C' },
          { name: '黑丹宁', hex: '#22262B' }
        ],
        sizes: ['XS', 'S', 'M', 'L', 'XL'],
        image: 'assets/products/p05.svg',
        gallery: ['assets/products/p05.svg', 'assets/detail-01.svg', 'assets/detail-02.svg'],
        short: '10oz 硬挺丹宁，A 字廓形不塌。前中开襟配铜扣，腰头暗藏调节扣。',
        fabric: '10oz 无弹力丹宁，硬挺度足以撑住 A 字廓形，不会软塌塌贴着腿。腰头内置两档调节扣，体重变化时可微调 2–3cm。前中五粒铜扣门襟，缝线为同色靛蓝。',
        care: CARE_SKIRT,
        details: [
          '10oz 无弹力丹宁，硬挺 A 字廓形',
          '前中五粒铜扣门襟，腰头两档调节',
          '前后各一双贴袋，铜铆钉加固',
          '裙摆双线锁边，长度 46cm（M 码）'
        ],
        fit: '高腰 A 字，裙长 46cm 落在膝上约 10cm。喜欢更长可看「前开衩长款牛仔裙」。',
        rating: 4.8,
        reviews: 127,
        chain: {
          code: 'DY-2025-000205',
          hash: '0x3e7b20d95a4c81f607e2b9d4a0c5f83e17b6d2a9048c5e1f3a7b9d0c6e4f28157',
          network: 'Polygon PoS',
          block: 62840301,
          mintedAt: '2025-03-24',
          owners: 1,
          verified: true,
          workshop: '苏州 · 梭织工坊',
          batch: 'DEN-ASK-1002'
        },
        lifecycle: [
          { date: '2025-03-01', title: '丹宁入库登记', text: '10oz 无弹力丹宁入库，关联检测报告 QC-1002-041。' },
          { date: '2025-03-19', title: '成衣出品质检', text: '完成缝制与定型，质检结论：合格。' },
          { date: '2025-03-24', title: '写入溯源链', text: '生成溯源码 DY-2025-000205，区块高度 62840301。' }
        ]
      },
      {
        id: 'p06',
        name: '前开衩长款牛仔裙',
        en: 'Front-Slit Denim Maxi Skirt',
        category: 'skirts',
        categoryName: '裙子',
        condition: 'new',
        conditionName: '全新',
        price: 920,
        compareAt: null,
        badge: '新品',
        colors: [
          { name: '原色靛蓝', hex: '#2B3F5C' },
          { name: '深靛', hex: '#1B2A42' }
        ],
        sizes: ['XS', 'S', 'M', 'L', 'XL'],
        image: 'assets/products/p06.svg',
        gallery: ['assets/products/p06.svg', 'assets/detail-01.svg', 'assets/detail-02.svg'],
        short: '12oz 丹宁长裙，前中开衩到大腿中段。走路不绊腿，坐下不绷。',
        fabric: '12oz 中厚丹宁，13 片裁片拼接，越往下越宽。前中开衩用包边处理而非直接剪开，避免走光也防止开衩口变形。后腰松紧加隐藏抽绳，不用皮带也能合身。',
        care: CARE_SKIRT,
        details: [
          '12oz 中厚丹宁，13 片裁片拼接',
          '前中开衩 52cm，边缘包边处理',
          '后腰松紧 + 隐藏抽绳',
          '裙长 88cm（M 码），侧缝双针平缝'
        ],
        fit: '高腰直筒长裙，开衩位置在膝上约 25cm。身高 160cm 以下建议自行锁边改短。',
        rating: 4.6,
        reviews: 64,
        chain: {
          code: 'DY-2025-000206',
          hash: '0x8c02f7a3e5b1d94c60a8e2f7b3d5c1904a6e8b2d0f4c7a1e3b5d9f0c2a4e6813',
          network: 'Polygon PoS',
          block: 62840288,
          mintedAt: '2025-03-26',
          owners: 1,
          verified: true,
          workshop: '苏州 · 梭织工坊',
          batch: 'DEN-MAX-1205'
        },
        lifecycle: [
          { date: '2025-02-28', title: '丹宁入库登记', text: '12oz 中厚丹宁入库，关联检测报告 QC-1205-003。' },
          { date: '2025-03-16', title: '成衣出品质检', text: '完成 13 片拼接与定型，质检结论：合格。' },
          { date: '2025-03-26', title: '写入溯源链', text: '生成溯源码 DY-2025-000206，区块高度 62840288。' }
        ]
      },
      {
        id: 'p07',
        name: '牛仔拼接托特包',
        en: 'Denim Patchwork Tote',
        category: 'bags',
        categoryName: '包包',
        condition: 'new',
        conditionName: '全新',
        price: 460,
        compareAt: null,
        badge: null,
        colors: [
          { name: '三色拼接', hex: '#40506B' },
          { name: '原色靛蓝', hex: '#2B3F5C' },
          { name: '黑丹宁', hex: '#22262B' }
        ],
        sizes: ['ONE SIZE'],
        image: 'assets/products/p07.svg',
        gallery: ['assets/products/p07.svg', 'assets/detail-01.svg', 'assets/detail-02.svg'],
        short: '用裁床余料拼的包。每条都不一样，装得下一台 15 寸笔记本。',
        fabric: '用生产线上裁下来的丹宁余料拼接而成，所以每个包的色块分布都不完全相同——这不是瑕疵，是它唯一的地方。内衬用 12oz 本白帆布，提手根部 X 形交叉缝加固，能装重物。',
        care: CARE_BAG,
        details: [
          '丹宁余料拼接，每件配色分布不同',
          '12oz 本白帆布内衬，两个开放口袋 + 一个拉链暗袋',
          '提手根部 X 形交叉加固缝',
          '容量约 16L，可放 15 寸笔记本'
        ],
        fit: '单一尺码。袋身 38 × 40 × 12cm，提手垂直长度 24cm，可肩背。',
        rating: 4.8,
        reviews: 189,
        chain: {
          code: 'DY-2025-000207',
          hash: '0x0a6d94e2c8f1b37059e4a2c7d6b8f1035e9c7a4d2b6f8e0c1a3d5b7f9e2c4068',
          network: 'Polygon PoS',
          block: 62840420,
          mintedAt: '2025-03-28',
          owners: 1,
          verified: true,
          workshop: '杭州 · 制包工坊',
          batch: 'DEN-PAT-0001'
        },
        lifecycle: [
          { date: '2025-03-04', title: '余料登记', text: '丹宁裁床余料登记入库，关联批次 DEN-OKY-1402 / DEN-LGT-0604。' },
          { date: '2025-03-22', title: '成品出品质检', text: '完成拼接、加固缝与质检，质检结论：合格。' },
          { date: '2025-03-28', title: '写入溯源链', text: '生成溯源码 DY-2025-000207，区块高度 62840420。' }
        ]
      },
      {
        id: 'p08',
        name: '迷你牛仔斜挎包',
        en: 'Mini Denim Crossbody',
        category: 'bags',
        categoryName: '包包',
        condition: 'used',
        conditionName: '认证二手',
        price: 220,
        compareAt: 380,
        badge: '认证二手',
        colors: [
          { name: '石洗浅蓝', hex: '#7C93AE' },
          { name: '黑丹宁', hex: '#22262B' }
        ],
        sizes: ['ONE SIZE'],
        image: 'assets/products/p08.svg',
        gallery: ['assets/products/p08.svg', 'assets/detail-01.svg', 'assets/detail-02.svg'],
        short: '装手机、卡和一支口红。官方回收验真后二次上链，成色评级 A-。',
        fabric: '8oz 石洗丹宁，翻盖配铜质磁扣。肩带可调 90–120cm，取下来能当手拿包。本品为官方认证二手，几乎无使用痕迹，已完成清洁养护。',
        care: CARE_BAG,
        details: [
          '8oz 石洗丹宁，铜质磁扣翻盖',
          '肩带可调 90–120cm，可拆卸',
          '内置一个卡片位与一个拉链暗袋',
          '成色评级：A-（几乎无使用痕迹）'
        ],
        fit: '单一尺码。包身 18 × 13 × 6cm，可放 6.7 寸手机。',
        rating: 4.9,
        reviews: 73,
        chain: {
          code: 'DY-2024-000208',
          hash: '0x6f1b38d0a5c9e2471803b6d9f4a2c70e5b8d1f3a6049c2e7b5d0a8f6c4e29317',
          network: 'Polygon PoS',
          block: 62840711,
          mintedAt: '2024-12-15',
          owners: 2,
          verified: true,
          workshop: '杭州 · 制包工坊',
          batch: 'DEN-MIN-0802'
        },
        lifecycle: [
          { date: '2024-12-15', title: '首次写入溯源链', text: '生成溯源码 DY-2024-000208，区块高度 60441907。' },
          { date: '2025-01-08', title: '首次售出', text: '由北京买家购入，成交价 ¥380。' },
          { date: '2025-04-02', title: '官方回收验真', text: '买家寄回，验真通过，成色评级 A-。' },
          { date: '2025-04-08', title: '清洁与二次上链', text: '清洁养护完成，追加流转记录，重新上架。' }
        ]
      }
    ],

    pillars: [
      { icon: 'spool', title: '版型先读懂身形', text: '每一条腰线的弧度都反复比对过数百位普通女性的日常身形。不追求极端的“纸片人效果”，只让丹宁妥帖地承托你最舒服的状态。' },
      { icon: 'leaf', title: '面料适配三种场景', text: '办公室久坐的透气感、周末逛街的松弛感、赴约小聚的精致感。赤耳丹宁的骨感与长绒棉靛蓝纱线的亲肤，一件不用中途换装。' },
      { icon: 'shield', title: '不做潮流的快消', text: '不刻意讨好审美，也不追每一季的潮流。我们只做能穿很多年的丹宁，版型定下来就一直做下去，只改毫米级的地方。' }
    ],

    timeline: [
      { year: '古字', title: '在古籍里找到㛊与䎟', text: '两个几乎被遗忘的字：一个注解“精准感知”，一个描摹女子柔婉舒展的神态。' },
      { year: '撞色', title: '用西方丹宁承托东方剪裁', text: '选了最西方的面料，把东方剪裁的松弛缝进去——肩线、腰身、裤腿，一处一处调。' },
      { year: '量体', title: '腰线比对数百位身形', text: '不追求纸片人效果，只求妥帖。版型定下来后一直做下去，只改毫米级的地方。' },
      { year: '长久', title: '不做快消，只做能穿很多年', text: '回收 · 验真 · 养护 · 二次上链的认证二手闭环，让一件丹宁被穿得更久。' }
    ],

    faqs: [
      { q: '版型怎么选尺码？', a: '我们的丹宁版型偏松弛：肩线略落、腰身微收、裤腿阔而不垮。原色丹宁无弹力，前两次穿着略紧属正常，会自然松展约半码，所以宁可选合身而非偏大。每件商品页有厘米级尺码表，拿一件你穿着合身的衣服平铺量胸围或腰围对照最准。' },
      { q: '一件能兼顾通勤和周末吗？', a: '能。我们做面料选择时就是按这个标准来的：办公室久坐要透气、周末逛街要松弛、赴约小聚要精致。赤耳丹宁的骨感和长绒棉靛蓝纱线的亲肤，让同一件衣服在三种场景下都不违和。' },
      { q: '原色丹宁会掉色吗？', a: '会，这是绳染靛蓝的正常特性——靛蓝染在纱线表面，摩擦与洗涤会自然脱落，所以膝盖和口袋边缘会磨出只属于你的褪色。前 3 次请单独反面冷水洗，避免染到浅色衣物。不想要掉色过程可以选石洗款。' },
      { q: '溯源码在哪里？怎么查？', a: '每件单品的吊牌内侧印有以 DY- 开头的溯源码。打开「溯源查询」页输入该码，即可看到这批丹宁的织造厂、盎司克重、水洗工艺、质检结论与全部流转记录，不需要登录。' },
      { q: '认证二手是什么意思？', a: '你把不再穿的 㛊䎟 丹宁寄回，我们做三件事：验真（确认是正品且与链上记录一致）、养护（专业清洁与修复，必要时重新压线）、二次上链（追加一条流转记录）。之后以透明价格重新上架，回收价与新售价都写在商品页上。' },
      { q: '配送与退换怎么算？', a: '除西藏、新疆、台湾、香港、澳门地区外，全国包邮；上述地区运费另计，下单后客服会与你确认。现货 48 小时内从上海仓发出。签收后 30 天内、吊牌完整、未经洗涤穿着可无理由退换。全新品质量问题我们承担来回运费；认证二手支持 7 天无理由，需保持成色与寄出时一致。' }
    ],

    /* ---- 二手商城（认证二手） ---- */
    preownedKey: 'dooyoor.preowned.v1',

    /* 示范二手单品。sellerPhone 为空字符串表示卖家是官方渠道，
       成交款记入「官方待结算」而不是凭空消失。 */
    preowned: [
      { id: 'u101', name: '直筒赤耳牛仔裤（个人闲置）', nameEn: 'Straight Selvedge Jeans', price: 680, origin: 1080, image: 'assets/products/p03.svg', category: 'bottoms', categoryName: '裤子', sellerPhone: '', sellerName: 'DOOYOOR 官方', grade: 'A-', chainCode: 'DY-2025-000203', note: '穿着约 15 次，褪色刚起步，无破损，已清洁养护并二次上链。', createdAt: '2025-04-06' },
      { id: 'u102', name: '赤耳丹宁夹克（9 成新）', nameEn: 'Selvedge Denim Jacket', price: 780, origin: 1280, image: 'assets/products/p01.svg', category: 'tops', categoryName: '上衣', sellerPhone: '', sellerName: 'DOOYOOR 官方', grade: 'B+', chainCode: 'DY-2025-000201', note: '穿着约 25 次，袖口有轻微褪色，五金完好。', createdAt: '2025-04-09' },
      { id: 'u103', name: 'A 字丹宁半身裙（个人转让）', nameEn: 'A-Line Denim Skirt', price: 420, origin: 780, image: 'assets/products/p05.svg', category: 'skirts', categoryName: '裙子', sellerPhone: '13800138000', sellerName: '用户 8000', grade: 'B+', chainCode: 'DY-2025-000205', note: '买大了一码，只穿过两次，已验真。', createdAt: '2025-04-12' }
    ],

    /* 增值抵扣规则：把初稿「只有文案、没有实现」的规则真正实现 */
    discountRule: {
      holdMonths: 12,
      bonusStartMonths: 36,
      bonusPerYear: 100,
      note: '购买记录满 12 个月后，该件可按实付价抵扣；满 36 个月起，每满一年额外增加 ¥100 抵扣额。'
    },

    demoBalance: 10000,
    demoBalanceNote: '演示余额，不涉及真实资金。',

    orderStatuses: [
      { id: 'all', name: '全部' },
      { id: 'pending', name: '待发货' },
      { id: 'shipped', name: '已发货' },
      { id: 'done', name: '已完成' },
      { id: 'refund', name: '退款中' }
    ],

    txTypes: { income: '收入', expense: '支出' },

    notifyPrefs: [
      { id: 'msg', name: '消息通知', desc: '订单状态变化时通知我', def: true },
      { id: 'promo', name: '优惠活动通知', desc: '新品与二手置换活动', def: false }
    ],

    accountViews: [
      { id: 'overview', name: '我的' },
      { id: 'orders', name: '我的订单' },
      { id: 'wallet', name: '余额明细' },
      { id: 'discount', name: '我的抵扣' },
      { id: 'preowned', name: '我的二手' },
      { id: 'chain', name: '我的区块链' },
      { id: 'favorites', name: '我的收藏' },
      { id: 'settings', name: '设置' }
    ],

    /* ---- 后台演示数据（admin.html 使用） ---- */
    adminUser: { name: '运营账号', role: '超级管理员', initial: 'D' },

    stats: [
      { label: '在售单品', value: '8', delta: '2 款认证二手' },
      { label: '本月订单', value: '126', delta: '较上月 +18%' },
      { label: '本月销售额', value: '¥286,400', delta: '较上月 +12%' },
      { label: '溯源查询次数', value: '1,842', delta: '较上月 +41%' }
    ],

    orders: [
      { no: 'DY202504180001', name: '赤耳丹宁夹克', size: 'M', qty: 1, amount: 1280, status: '待发货', statusKey: 'pending', date: '2025-04-18', buyer: '陈**', code: 'DY-2025-000201' },
      { no: 'DY202504180002', name: '落肩丹宁衬衫', size: 'S', qty: 2, amount: 1760, status: '已发货', statusKey: 'shipped', date: '2025-04-18', buyer: '林**', code: 'DY-2025-000202' },
      { no: 'DY202504170003', name: '高腰阔腿牛仔裤', size: 'M', qty: 1, amount: 580, status: '已完成', statusKey: 'done', date: '2025-04-17', buyer: '王**', code: 'DY-2024-000204' },
      { no: 'DY202504170004', name: '前开衩长款牛仔裙', size: 'L', qty: 1, amount: 920, status: '已完成', statusKey: 'done', date: '2025-04-17', buyer: '赵**', code: 'DY-2025-000206' },
      { no: 'DY202504160005', name: '迷你牛仔斜挎包', size: 'ONE SIZE', qty: 1, amount: 220, status: '退款中', statusKey: 'refund', date: '2025-04-16', buyer: '周**', code: 'DY-2024-000208' },
      { no: 'DY202504160006', name: '牛仔拼接托特包', size: 'ONE SIZE', qty: 3, amount: 1380, status: '已发货', statusKey: 'shipped', date: '2025-04-16', buyer: '吴**', code: 'DY-2025-000207' }
    ],

    /* ---- 溯源查询页的示例码 ---- */
    verifySamples: ['DY-2025-000203', 'DY-2024-000204', 'DY-2025-000201']
  };
})();

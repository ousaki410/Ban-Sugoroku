// 六大時代・実寸比率盤制・文化意匠・初期配置定義
export const KANJI = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '廿', '廿一', '廿二', '廿三', '廿四'];
export const DEME_NAMES = {
    '1-1': { call: '畳一', yomi: 'でっち' },
    '2-2': { call: '重二', yomi: 'じゅうに' },
    '3-3': { call: '重三', yomi: 'じゅうさん' },
    '4-4': { call: '重四', yomi: 'じゅうし' },
    '5-5': { call: '重五', yomi: 'じゅうご' },
    '6-6': { call: '重六', yomi: 'じゅうろく' },
    '5-6': { call: '五六', yomi: 'ごろく' },
    '6-5': { call: '五六', yomi: 'ごろく' },
    '4-3': { call: '四三', yomi: 'しそう' },
    '3-4': { call: '四三', yomi: 'しそう' },
    '2-1': { call: '二一', yomi: 'にいち' },
    '1-2': { call: '二一', yomi: 'にいち' },
    '6-4': { call: '六四', yomi: 'ろくし' },
    '4-6': { call: '六四', yomi: 'ろくし' }
  };

  // ==================== 1. 六大時代・実寸比率盤制・文化意匠定義 ====================
export const ERA_MODES = [
    {
      id: 'heian_kuge',
      numKanji: '壱',
      culture: '公家文化・平安朝寝殿造',
      title: '唐風・古流本双六',
      stoneCount: 15,
      stoneLabel: '十五石・三処五石制',
      boardLabel: '正倉院紫檀木画・床脚薄盤',
      ruleSummary: '重目は二回のみ。内陣集結または無地勝ち六連荷完封にて決着す。',
      zoromeMoves: 2,
      canBearOff: false,
      allowMujiWin: true,
      allowIkkaSmash: false,
      freeBarEntry: false,
      isOimawashi: false,
      // 正倉院実物比率：横長・薄盤・格狭間床脚付き
      geom: { x: 200, y: 108, w: 860, h: 410, midH: 50, wallH: 84, sideW: 32, sideDY: 20, hasTray: false, style: 'heian' },
      sfx: { rattleFreq: 1180, woodRes: 205, cupType: 'horn' },
      theme: {
        roomGlow: ['rgba(86, 26, 32, 0.55)', 'rgba(10, 4, 5, 0.96)'],
        feltColor: '#59121a',
        woodStops: ['#5c221c', '#732c24', '#4a1915'],
        wallStops: ['#2b100e', '#1a0807', '#0d0303'],
        lineColor: '#f7efe0'
      },
      setup(pts) {
        pts[23] = 5;  pts[12] = 5;  pts[5]  = 5;
        pts[0]  = -5; pts[11] = -5; pts[18] = -5;
      }
    },
    {
      id: 'kamakura_jike',
      numKanji: '弐',
      culture: '寺家文化・比叡山宿坊',
      title: '山法師・荒双六',
      stoneCount: 14,
      stoneLabel: '十四石・宿坊早駆け制',
      boardLabel: '白木蓮華梵字・重厚盤',
      ruleSummary: '十四石の乱戦。畳一と重六にて敵の二石一荷を強襲粉砕す。',
      zoromeMoves: 4,
      canBearOff: false,
      allowMujiWin: true,
      allowIkkaSmash: true,
      freeBarEntry: false,
      isOimawashi: false,
      // 宿坊重厚盤：奥行き深く背が高い塊状盤
      geom: { x: 256, y: 74, w: 740, h: 486, midH: 56, wallH: 148, sideW: 48, sideDY: 30, hasTray: false, style: 'jike' },
      sfx: { rattleFreq: 1580, woodRes: 108, cupType: 'iron_bowl' },
      theme: {
        roomGlow: ['rgba(62, 50, 28, 0.52)', 'rgba(6, 5, 3, 0.96)'],
        feltColor: '#332514',
        woodStops: ['#bda072', '#cfb384', '#a6885b'],
        wallStops: ['#1c1610', '#110d09', '#080604'],
        lineColor: '#291d12'
      },
      setup(pts) {
        pts[23] = 2;  pts[12] = 4;  pts[7]  = 3;  pts[5]  = 5;
        pts[0]  = -2; pts[11] = -4; pts[16] = -3; pts[18] = -5;
      }
    },
    {
      id: 'muromachi_buke',
      numKanji: '参',
      culture: '武家文化・室町東山御物',
      title: '正統・本双六',
      stoneCount: 15,
      stoneLabel: '十五石・二五三五正統陣',
      boardLabel: '鉄線亀甲檜扇蒔絵・八寸厚盤',
      ruleSummary: '室町幕府の正統本双六。十五石すべてを内陣六目へ集結させれば勝利。',
      zoromeMoves: 4,
      canBearOff: false,
      allowMujiWin: true,
      allowIkkaSmash: false,
      freeBarEntry: false,
      isOimawashi: false,
      // 博物館実物比率（縦29×横40.3×高23cm）完全再現
      geom: { x: 240, y: 78, w: 780, h: 476, midH: 56, wallH: 136, sideW: 44, sideDY: 28, hasTray: false, style: 'muromachi' },
      sfx: { rattleFreq: 940, woodRes: 122, cupType: 'bamboo' },
      theme: {
        roomGlow: ['rgba(68, 36, 14, 0.52)', 'rgba(7, 3, 1, 0.96)'],
        feltColor: '#4a0e0b',
        woodStops: ['#9c6e3e', '#ad7d49', '#8c6032'],
        wallStops: ['#1c1009', '#110905', '#070302'],
        lineColor: '#efe5d2'
      },
      setup(pts) {
        pts[23] = 2;  pts[12] = 5;  pts[7]  = 3;  pts[5]  = 5;
        pts[0]  = -2; pts[11] = -5; pts[16] = -3; pts[18] = -5;
      }
    },
    {
      id: 'sengoku_yamato',
      numKanji: '肆',
      culture: '武家豪商・安土桃山堺座敷',
      title: '大和・端双六',
      stoneCount: 15,
      stoneLabel: '十五石・盤外上がり制',
      boardLabel: '黒漆青貝螺鈿盤・上がり盆付',
      ruleSummary: '中帯の手石は起点の任意の空目へ復帰可。内陣集結後、すべて盤外へ上がれば勝ち。',
      zoromeMoves: 4,
      canBearOff: true,
      allowMujiWin: false,
      allowIkkaSmash: false,
      freeBarEntry: true,
      isOimawashi: false,
      geom: { x: 185, y: 82, w: 736, h: 468, midH: 56, wallH: 126, sideW: 40, sideDY: 26, hasTray: true, trayX: 972, trayW: 122, style: 'momoyama' },
      sfx: { rattleFreq: 1080, woodRes: 138, cupType: 'makie_tube' },
      theme: {
        roomGlow: ['rgba(85, 62, 18, 0.48)', 'rgba(8, 5, 2, 0.96)'],
        feltColor: '#3d1d08',
        woodStops: ['#1a1512', '#241d18', '#120e0b'],
        wallStops: ['#140d06', '#0c0703', '#050301'],
        lineColor: '#8ce6d4'
      },
      setup(pts) {
        pts[23] = 2;  pts[12] = 5;  pts[7]  = 3;  pts[5]  = 5;
        pts[0]  = -2; pts[11] = -5; pts[16] = -3; pts[18] = -5;
      }
    },
    {
      id: 'edo_oriha',
      numKanji: '伍',
      culture: '茶人文化・江戸初期方丈茶席',
      title: '折葉・長途下り端',
      stoneCount: 12,
      stoneLabel: '十二石・起点一斉出陣制',
      boardLabel: '桑木真鍮蝶番・携帯折盤',
      ruleSummary: '全十二石が第一目より一斉出陣。長途を駆け抜けて内陣へ入り、盤外へ下り切る。',
      zoromeMoves: 4,
      canBearOff: true,
      allowMujiWin: false,
      allowIkkaSmash: false,
      freeBarEntry: false,
      isOimawashi: false,
      // 携帯用蝶番折盤：胴箱のない極めて薄い二つ折り盤（wallH わずか 26px）
      geom: { x: 205, y: 132, w: 716, h: 432, midH: 48, wallH: 26, sideW: 20, sideDY: 14, hasTray: true, trayX: 962, trayW: 120, style: 'oriha' },
      sfx: { rattleFreq: 1320, woodRes: 245, cupType: 'tea_bamboo' },
      theme: {
        roomGlow: ['rgba(38, 58, 42, 0.45)', 'rgba(5, 8, 6, 0.96)'],
        feltColor: '#1b3326',
        woodStops: ['#78522b', '#8c6236', '#694521'],
        wallStops: ['#382310', '#26170a', '#170d05'],
        lineColor: '#ede3cf'
      },
      setup(pts) {
        pts[23] = 12;
        pts[0]  = -12;
      }
    },
    {
      id: 'edo_oimawashi',
      numKanji: '陸',
      culture: '町人文化・歌川国芳一門錦絵',
      title: '百鬼英勇・飛び廻り絵双六',
      stoneCount: 12,
      stoneLabel: '錦絵札二十四撰・図鑑蒐集制',
      boardLabel: '大判奉書紙錦絵摺・懐中守り札付',
      ruleSummary: '振出しより二十四枚の浮世絵駒（化物・忠臣蔵・昔咄・名物）を巡り中央の上りへ。止まった錦絵札を図鑑に蒐集す。',
      zoromeMoves: 4,
      canBearOff: false,
      allowMujiWin: false,
      allowIkkaSmash: false,
      freeBarEntry: false,
      isOimawashi: true,
      geom: { x: 252, y: 92, w: 756, h: 460, midH: 52, wallH: 116, sideW: 38, sideDY: 24, hasTray: false, style: 'chonin' },
      sfx: { rattleFreq: 2150, woodRes: 150, cupType: 'teacup' },
      theme: {
        roomGlow: ['rgba(45, 52, 68, 0.48)', 'rgba(5, 6, 9, 0.96)'],
        feltColor: '#162436',
        woodStops: ['#7d532e', '#8f6038', '#6b4524'],
        wallStops: ['#1a1410', '#120d0a', '#080504'],
        lineColor: '#e6dac3'
      },
      setup(pts) {
        for (let i = 18; i <= 23; i++) pts[i] = 2;
        for (let i = 6; i <= 11; i++)  pts[i] = -2;
      }
    }
  ];

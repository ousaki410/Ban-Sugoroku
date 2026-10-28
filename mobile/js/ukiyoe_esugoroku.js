// 江戸浮世絵・百鬼英勇絵双六（廻り・飛び双六 ＋ 錦絵札二十四撰コレクションシステム）
import { KANJI } from './eras.js';
import {
  ctx, W, H, FONT_BRUSH, FONT_MINCHO,
  NEW_GAME_BTN, CHANGE_ERA_BTN, G,
  showStamp, isInsideRect
} from './state.js';
import {
  playSingleRattleGrain, playDiceBounce, playStoneLift,
  playStoneImpact, playVictoryFanfare, playDefeatBell
} from './audio.js';

const STORAGE_KEY = 'ban_sugoroku_ukiyoe_cards_v1';

export const UKIYOE_CARDS = [
  {
    id: 1, iroha: 'い', name: '百物語灯籠', sub: '日本橋・振出脇', cat: '名物',
    source: '歌川芳員『百種怪談妖物双六』振出し（安政五年・1858）',
    ruleType: 'jump', val: 2, ruleLabel: '飛び・二ます進む',
    bg: '#4e7ca1', accent: '#e8b954',
    lore: '油皿の灯を囲み百物語を語る江戸の夜会。一話語るごとに灯を消し、怪異と道中が始まる。'
  },
  {
    id: 2, iroha: 'ろ', name: '桃太郎', sub: '鬼ヶ島征伐', cat: '昔咄',
    source: '落合芳幾『昔咄赤本寿語禄』（万延元年・1860）',
    ruleType: 'jump', val: 3, ruleLabel: '順風飛・三ます進む',
    bg: '#df9677', accent: '#c94030',
    lore: '黍団子を腰に犬・猿・雉を従え鬼ヶ島へ渡る赤本昔咄の筆頭。順風満帆にて三ます飛躍す。'
  },
  {
    id: 3, iroha: 'は', name: '坂東太郎河童', sub: '利根川水虎', cat: '化物',
    source: '歌川芳員『百種怪談妖物双六』（安政五年・1858）',
    ruleType: 'odd_boost', val: 2, ruleLabel: '奇数目なら二ます進む',
    bg: '#568678', accent: '#98c973',
    lore: '坂東太郎（利根川）に棲む皿頭の河童。相撲を好み、奇数目の勢いに乗れば水路を二ます進む。'
  },
  {
    id: 4, iroha: 'に', name: '早野勘平', sub: '忠臣蔵・山崎街道', cat: '英勇',
    source: '歌川芳虎『新板誠忠義士伝双六』（嘉永年間）',
    ruleType: 'jump', val: 2, ruleLabel: '早駆・二ます進む',
    bg: '#737c88', accent: '#d9a74a',
    lore: '仮名手本忠臣蔵の若き義士。火縄銃を携え夜の山崎街道を疾駆し、二ます先へと駆け抜ける。'
  },
  {
    id: 5, iroha: 'ほ', name: 'かちかち山', sub: '兎の仇討・つちぶね', cat: '昔咄',
    source: '落合芳幾『昔咄赤本寿語禄』第四駒＜つちぶね＞（1860）',
    ruleType: 'back', val: -2, ruleLabel: '泥舟沈没・二ます戻る',
    bg: '#c79e59', accent: '#3d5c78',
    lore: '木の舟に乗る兎と泥舟（つちぶね）で沈みゆく狸の名場面。泥舟が崩れ二ます後方へ流される。'
  },
  {
    id: 6, iroha: 'へ', name: '中河内雪女郎', sub: '吹雪の怪異', cat: '化物',
    source: '歌川芳員『百種怪談妖物双六』（1858）',
    ruleType: 'stay', val: 1, ruleLabel: '泊・吹雪にて一回休み',
    bg: '#8aa6bd', accent: '#f5f8fa',
    lore: '白装束にて吹雪の峠に現れる雪女郎。凍てつく吹雪に足止めされ、宿場にて一回休みとなる。'
  },
  {
    id: 7, iroha: 'と', name: '善玉悪玉', sub: '心学道中相撲', cat: '名物',
    source: '歌川国芳『善悪道中出世寿古六』（安政二年・1855）',
    ruleType: 'roll_again', val: 1, ruleLabel: '善玉勝・もう一振り',
    bg: '#e2b24c', accent: '#c93b2b',
    lore: '山東京伝の黄表紙を受け国芳が描いた善玉・悪玉の相撲取組。善玉が白星を挙げ賽をもう一振り！'
  },
  {
    id: 8, iroha: 'ち', name: '武蔵坊弁慶', sub: '五条大橋・七つ道具', cat: '英勇',
    source: '『源平ふりわけ双六』・芳虎『英勇揃伊呂波双六』',
    ruleType: 'jump', val: 3, ruleLabel: '怪力飛・三ます進む',
    bg: '#61564a', accent: '#d95338',
    lore: '七つ道具を背負い大薙刀を振るう無双の荒法師。敵をなぎ倒し三ます前方へ豪快に飛び越える。'
  },
  {
    id: 9, iroha: 'り', name: '腥寺の猫俣', sub: '二股尾の怪猫', cat: '化物',
    source: '歌川芳員『百種怪談妖物双六』（1858）',
    ruleType: 'jump', val: 1, ruleLabel: '手招き・一ます進む',
    bg: '#b57c6a', accent: '#2b2420',
    lore: '古寺の行灯の影で手拭いを被り踊る二股尾の猫俣。妖しい手招きに導かれ一ます前へ進む。'
  },
  {
    id: 10, iroha: 'ぬ', name: '舌切雀', sub: '大葛籠と小葛籠', cat: '昔咄',
    source: '落合芳幾『昔咄赤本寿語禄』・芳年『おもゐつつら』',
    ruleType: 'back', val: -2, ruleLabel: '欲張葛籠・二ます戻る',
    bg: '#7d8c69', accent: '#d96b43',
    lore: '雀のお宿の土産に重い大葛籠を選べば中から化物が飛び出す。欲張りの戒めにて二ます戻る。'
  },
  {
    id: 11, iroha: 'る', name: '巴御前', sub: '粟津合戦・女武者', cat: '英勇',
    source: '『源平ふりわけ双六』義仲妾巴御前',
    ruleType: 'jump', val: 3, ruleLabel: '剛勇飛・三ます進む',
    bg: '#c76d5b', accent: '#f0d278',
    lore: '木曾義仲に従い剛弓と太刀を振るった天下無双の女武者。敵陣を突破し三ます先へ躍り出る。'
  },
  {
    id: 12, iroha: 'を', name: '茂林寺文福釜', sub: '化け狸の茶釜', cat: '化物',
    source: '歌川芳員『百種怪談妖物双六』・昔咄『文ぶく』',
    ruleType: 'roll_again', val: 1, ruleLabel: '福茶釜・もう一振り',
    bg: '#9e7b56', accent: '#e3b448',
    lore: '上野国茂林寺の茶釜から手足と狸の尾が生え綱渡りを見せる吉兆の化物。福徳にて賽をもう一振り！'
  },
  {
    id: 13, iroha: 'わ', name: '八百善会席', sub: '御府内流行名物', cat: '名物',
    source: '歌川芳艶『新版御府内流行名物案内双六』（嘉永年間）',
    ruleType: 'stay', val: 1, ruleLabel: '泊・名物料理に一回休み',
    bg: '#d9a464', accent: '#36587a',
    lore: 'どぜう・稲荷寿司から最高峰の料理茶屋「八百善」まで江戸の美食を巡る。美酒佳肴に酔い一回休み。'
  },
  {
    id: 14, iroha: 'か', name: '三目大僧', sub: '朝比奈切通の怪', cat: '化物',
    source: '歌川芳員『百種怪談妖物双六』（1858）',
    ruleType: 'back', val: -2, ruleLabel: '大睨み・二ます戻る',
    bg: '#6d6875', accent: '#e05a47',
    lore: '鎌倉朝比奈切通に立ち塞がる三つ目の巨僧。額の第三の眼に睨みすくめられ二ます退却す。'
  },
  {
    id: 15, iroha: 'よ', name: '花咲爺', sub: '枯木に花を咲かせ', cat: '昔咄',
    source: '落合芳幾『昔咄赤本寿語禄』（1860）',
    ruleType: 'jump', val: 4, ruleLabel: '満開飛・四ます進む',
    bg: '#e39e98', accent: '#fff2f0',
    lore: '灰を撒けば枯木に満開の桜が咲き誇り、殿様より褒美を賜る大吉の駒。一気に四ます飛躍す！'
  },
  {
    id: 16, iroha: 'た', name: '鯨波の船幽霊', sub: '荒海の亡霊', cat: '化物',
    source: '歌川芳員『百種怪談妖物双六』（1858）',
    ruleType: 'back', val: -3, ruleLabel: '底抜柄杓・三ます戻る',
    bg: '#3f627d', accent: '#a8d0e6',
    lore: '夜の荒海に現れ柄杓を求める船幽霊。底を抜いた柄杓を渡さねば舟を沈められ三ます流される。'
  },
  {
    id: 17, iroha: 'れ', name: '朝比奈義秀', sub: '万国巡り・怪力豪傑', cat: '英勇',
    source: '落合芳幾『万国寿吾陸』（万延元年・1860）',
    ruleType: 'jump', val: 3, ruleLabel: '豪傑飛・三ます進む',
    bg: '#52796f', accent: '#e09f3e',
    lore: '『万国寿吾陸』の中央に鎮座し世界各国を巡る鎌倉の怪力豪傑。大門を押し破り三ます進む。'
  },
  {
    id: 18, iroha: 'そ', name: '挑灯お岩', sub: '四谷怪談・破れ提灯', cat: '化物',
    source: '歌川芳員『百種怪談妖物双六』（1858）',
    ruleType: 'back', val: -3, ruleLabel: '執念祟り・三ます戻る',
    bg: '#4a3b4e', accent: '#d94e34',
    lore: '燃え上がる破れ提灯より現れるお岩の怨念。凄まじい妖気に当てられ三ます後方へ引き戻される。'
  },
  {
    id: 19, iroha: 'つ', name: '九郎判官義経', sub: '壇ノ浦・八艘飛び', cat: '英勇',
    source: '『源平ふりわけ双六』伊予守源義経',
    ruleType: 'jump', val: 4, ruleLabel: '八艘飛・四ます進む',
    bg: '#4b7299', accent: '#f2cc68',
    lore: '源平合戦の花形・源義経。平家の軍船を次々と飛び越える八艘飛びの妙技にて四ます大飛躍す！'
  },
  {
    id: 20, iroha: 'ね', name: '古葛籠飛頭蛮', sub: 'ろくろ首の怪', cat: '化物',
    source: '歌川芳員『百種怪談妖物双六』（1858）',
    ruleType: 'jump', val: 2, ruleLabel: '長首飛・二ます進む',
    bg: '#8c6d53', accent: '#e8c574',
    lore: '古葛籠より長く伸びるろくろ首（飛頭蛮）。伸びる首に乗って二ます先の駒へと飛び移る。'
  },
  {
    id: 21, iroha: 'な', name: '玄海灘海坊主', sub: '黒入道の大波', cat: '化物',
    source: '歌川芳員『百種怪談妖物双六』（1858）',
    ruleType: 'stay', val: 1, ruleLabel: '泊・時化にて一回休み',
    bg: '#2f4b66', accent: '#d9e6f2',
    lore: '玄海灘の黒雲より聳え立つ巨大な海坊主。大時化により船が出せず港にて一回休みとなる。'
  },
  {
    id: 22, iroha: 'ら', name: '金毛九尾の狐', sub: '那須野・大妖狐', cat: '化物',
    source: '歌川芳員『百種怪談妖物双六』（1858）',
    ruleType: 'roll_again', val: 1, ruleLabel: '神通力・もう一振り',
    bg: '#d98a3c', accent: '#fff0b3',
    lore: '天竺・唐・本朝を股にかけた金毛九尾の妖狐。九つの尾が放つ神通力により賽をもう一振り！'
  },
  {
    id: 23, iroha: 'む', name: '見越入道', sub: '夜道の巨大入道', cat: '化物',
    source: '歌川芳員『百種怪談妖物双六』・『ももんがあ対見越入道』',
    ruleType: 'back', val: -2, ruleLabel: '見越し・二ます戻る',
    bg: '#59544b', accent: '#c94a38',
    lore: '見上げれば見上げるほど背が高くなる夜道の妖怪。「見越入道見越した」と唱え損ね二ます戻る。'
  },
  {
    id: 24, iroha: 'う', name: '大星由良助', sub: '忠臣蔵・討入本懐', cat: '英勇',
    source: '歌川芳綱『新版誠忠義士伝双六』・芳虎『誠忠義士伝』',
    ruleType: 'jump', val: 1, ruleLabel: '討入突撃・上りへ直行！',
    bg: '#2b2623', accent: '#e8b954',
    lore: '赤穂四十七士を率いる大星由良助。陣太鼓を打ち鳴らし、最後の一歩を超えて中央「上り」へ突入す！'
  }
];

export const EState = {
  pos: [0, 0],
  skipTurns: [0, 0],
  dieVal: 1,
  rolling: false,
  rollTimer: 0,
  holdingTube: false,
  holdPower: 0,
  rattleCooldown: 0,
  stepAnim: null,
  boostArmed: false,
  boostUsed: [false, false],
  albumOpen: false,
  selectedCardId: 1,
  unlocked: new Set([1, 2, 8]),
  loadout: [8, 1, 2],
  lastEventText: '右下の竹筒を長押しして賽を振り、「振出し」より出陣されたし',
  _lastPhase: '',
  _lastTime: 0
};

function loadCollection() {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.unlocked) && parsed.unlocked.length > 0) {
          EState.unlocked = new Set(parsed.unlocked);
        }
        if (Array.isArray(parsed.loadout) && parsed.loadout.length > 0) {
          EState.loadout = parsed.loadout.slice(0, 3);
        }
      }
    }
  } catch { /* ignore */ }
}

function saveCollection() {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        unlocked: Array.from(EState.unlocked),
        loadout: EState.loadout
      }));
    }
  } catch { /* ignore */ }
}
loadCollection();

export function initEdoEsugorokuMatch() {
  EState.pos = [0, 0];
  EState.skipTurns = [0, 0];
  EState.dieVal = 1;
  EState.rolling = false;
  EState.rollTimer = 0;
  EState.holdingTube = false;
  EState.holdPower = 0;
  EState.stepAnim = null;
  EState.boostArmed = false;
  EState.boostUsed = [false, false];
  EState.albumOpen = false;
  EState.lastEventText = '「振出し（日本橋）」より出陣！中央の「上り」へ一番乗りを目指せ';
  if (G.eraIdx === 5 && G.phase === 'PLAY' && G.turn !== G.humanSide) {
    setTimeout(() => triggerRoll(G.turn), 650);
  }
}

const GRID_COORDS = [
  { c: 5, r: 4, w: 1, h: 1 },
  { c: 4, r: 4, w: 1, h: 1 },
  { c: 3, r: 4, w: 1, h: 1 },
  { c: 2, r: 4, w: 1, h: 1 },
  { c: 1, r: 4, w: 1, h: 1 },
  { c: 0, r: 4, w: 1, h: 1 },
  { c: 0, r: 3, w: 1, h: 1 },
  { c: 0, r: 2, w: 1, h: 1 },
  { c: 0, r: 1, w: 1, h: 1 },
  { c: 0, r: 0, w: 1, h: 1 },
  { c: 1, r: 0, w: 1, h: 1 },
  { c: 2, r: 0, w: 1, h: 1 },
  { c: 3, r: 0, w: 1, h: 1 },
  { c: 4, r: 0, w: 1, h: 1 },
  { c: 5, r: 0, w: 1, h: 1 },
  { c: 5, r: 1, w: 1, h: 1 },
  { c: 5, r: 2, w: 1, h: 1 },
  { c: 5, r: 3, w: 1, h: 1 },
  { c: 4, r: 3, w: 1, h: 1 },
  { c: 3, r: 3, w: 1, h: 1 },
  { c: 2, r: 3, w: 1, h: 1 },
  { c: 1, r: 3, w: 1, h: 1 },
  { c: 1, r: 2, w: 1, h: 1 },
  { c: 1, r: 1, w: 1, h: 1 },
  { c: 4, r: 1, w: 1, h: 2 },
  { c: 2, r: 1, w: 2, h: 2 }
];

const SHEET = { x: 186, y: 38, w: 836, h: 612, gridX: 198, gridY: 50, gridW: 762, gridH: 588 };

export function getSquareRect(sqIdx) {
  const cw = SHEET.gridW / 6;
  const ch = SHEET.gridH / 5;
  const g = GRID_COORDS[Math.max(0, Math.min(25, sqIdx))];
  return {
    x: SHEET.gridX + g.c * cw,
    y: SHEET.gridY + g.r * ch,
    w: g.w * cw,
    h: g.h * ch,
    cx: SHEET.gridX + (g.c + g.w * 0.5) * cw,
    cy: SHEET.gridY + (g.r + g.h * 0.5) * ch
  };
}

function hasEquippedCategory(player, cat) {
  if (player !== G.humanSide) return false;
  return EState.loadout.some(cid => {
    const c = UKIYOE_CARDS.find(k => k.id === cid);
    return c && c.cat === cat;
  });
}

function drawCardUkiyoeArt(ctx, x, y, w, h, card) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x + 2, y + 2, w - 4, h - 4);
  ctx.clip();

  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, card.bg);
  g.addColorStop(1, '#261e18');
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);

  ctx.fillStyle = 'rgba(246, 234, 206, 0.22)';
  ctx.fillRect(x, y + h * 0.58, w, h * 0.18);

  const cx = x + (w - 28) * 0.48;
  const cy = y + h * 0.52;

  if (card.cat === '化物') {
    ctx.fillStyle = card.accent;
    ctx.beginPath();
    ctx.arc(cx, cy - 4, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#1a110b';
    ctx.lineWidth = 1.8;
    ctx.stroke();

    ctx.fillStyle = '#1a110b';
    ctx.beginPath();
    ctx.arc(cx - 6, cy - 6, 2.5, 0, Math.PI * 2);
    ctx.arc(cx + 6, cy - 6, 2.5, 0, Math.PI * 2);
    if (card.id === 14 || card.id === 23) {
      ctx.arc(cx, cy - 13, 2.8, 0, Math.PI * 2);
    }
    ctx.fill();

    ctx.fillStyle = 'rgba(255, 90, 50, 0.78)';
    ctx.beginPath();
    ctx.arc(x + 16, y + h - 18, 5, 0, Math.PI * 2);
    ctx.fill();
  } else if (card.cat === '英勇') {
    ctx.fillStyle = '#1c1510';
    ctx.beginPath();
    ctx.moveTo(cx - 22, cy + 24);
    ctx.lineTo(cx, cy - 16);
    ctx.lineTo(cx + 22, cy + 24);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = '#f2c955';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.arc(cx, cy - 10, 15, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();

    ctx.fillStyle = '#f5ead6';
    ctx.beginPath();
    ctx.arc(cx, cy + 2, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#c93022';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(cx - 6, cy);
    ctx.lineTo(cx - 2, cy + 2);
    ctx.moveTo(cx + 6, cy);
    ctx.lineTo(cx + 2, cy + 2);
    ctx.stroke();
  } else if (card.cat === '昔咄') {
    ctx.fillStyle = card.accent;
    ctx.beginPath();
    ctx.arc(cx, cy, 17, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f7edd4';
    ctx.beginPath();
    ctx.arc(cx - 4, cy - 3, 10, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = '#f7efe0';
    ctx.beginPath();
    ctx.arc(cx, cy, 17, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#c93022';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#1a110b';
    ctx.font = `800 15px ${FONT_BRUSH}`;
    ctx.textAlign = 'center';
    ctx.fillText(card.id === 7 ? '善' : '名', cx, cy + 5);
  }
  ctx.restore();
}

function drawSingleSquare(ctx, sqIdx) {
  const r = getSquareRect(sqIdx);

  if (sqIdx === 0) {
    ctx.fillStyle = '#c9432c';
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.strokeStyle = '#1c140d';
    ctx.lineWidth = 2;
    ctx.strokeRect(r.x, r.y, r.w, r.h);

    ctx.fillStyle = '#f7ecd5';
    ctx.fillRect(r.x + 8, r.y + 8, r.w - 16, r.h - 16);
    ctx.strokeRect(r.x + 8, r.y + 8, r.w - 16, r.h - 16);

    ctx.fillStyle = '#b82918';
    ctx.font = `800 22px ${FONT_BRUSH}`;
    ctx.textAlign = 'center';
    ctx.fillText('振出し', r.cx, r.y + 42);
    ctx.fillStyle = '#24180e';
    ctx.font = `600 12px ${FONT_MINCHO}`;
    ctx.fillText('江戸日本橋・出陣', r.cx, r.y + 66);
    ctx.fillText('◄ 左へ廻る', r.cx, r.y + 92);
    return;
  }

  if (sqIdx === 25) {
    const grad = ctx.createLinearGradient(r.x, r.y, r.x, r.y + r.h);
    grad.addColorStop(0, '#3a668c');
    grad.addColorStop(0.45, '#ebd082');
    grad.addColorStop(1, '#d49b4b');
    ctx.fillStyle = grad;
    ctx.fillRect(r.x, r.y, r.w, r.h);

    ctx.fillStyle = '#b8422a';
    ctx.beginPath();
    ctx.moveTo(r.cx - 85, r.y + r.h - 28);
    ctx.lineTo(r.cx - 18, r.y + 54);
    ctx.lineTo(r.cx + 18, r.y + 54);
    ctx.lineTo(r.cx + 85, r.y + r.h - 28);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#f7f2e6';
    ctx.beginPath();
    ctx.moveTo(r.cx - 32, r.y + 90);
    ctx.lineTo(r.cx - 18, r.y + 54);
    ctx.lineTo(r.cx + 18, r.y + 54);
    ctx.lineTo(r.cx + 32, r.y + 90);
    ctx.lineTo(r.cx + 10, r.y + 80);
    ctx.lineTo(r.cx, r.y + 94);
    ctx.lineTo(r.cx - 12, r.y + 80);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = 'rgba(244, 216, 138, 0.88)';
    ctx.fillRect(r.x + 12, r.y + r.h - 54, r.w - 24, 38);

    ctx.fillStyle = '#cc3722';
    ctx.beginPath();
    ctx.arc(r.x + 44, r.y + 44, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#1e140c';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#160d06';
    ctx.font = `800 28px ${FONT_BRUSH}`;
    ctx.textAlign = 'center';
    ctx.fillText('上り', r.x + 44, r.y + 53);

    ctx.fillStyle = '#1d1209';
    ctx.font = `800 20px ${FONT_BRUSH}`;
    ctx.fillText('大江戸百鬼英勇・大団円', r.cx + 18, r.y + 42);
    ctx.font = `600 12.5px ${FONT_MINCHO}`;
    ctx.fillText('一番乗りにて褒美錦絵札を下賜す', r.cx + 12, r.y + r.h - 30);

    ctx.strokeStyle = '#1c140d';
    ctx.lineWidth = 2.6;
    ctx.strokeRect(r.x, r.y, r.w, r.h);
    return;
  }

  const card = UKIYOE_CARDS[sqIdx - 1];
  const isOwned = EState.unlocked.has(card.id);
  const isEquipped = EState.loadout.includes(card.id);

  drawCardUkiyoeArt(ctx, r.x, r.y, r.w, r.h, card);

  const stripW = 26;
  const stripX = r.x + r.w - stripW - 3;
  const stripY = r.y + 4;
  const stripH = r.h - 26;
  ctx.fillStyle = card.ruleType === 'jump' || card.ruleType === 'roll_again'
    ? '#d94b34'
    : (card.ruleType === 'stay' ? '#d9a441' : '#4a6b82');
  ctx.fillRect(stripX, stripY, stripW, stripH);
  ctx.strokeStyle = '#1e140c';
  ctx.lineWidth = 1.1;
  ctx.strokeRect(stripX, stripY, stripW, stripH);

  ctx.fillStyle = '#fcf5e5';
  ctx.font = `800 11.5px ${FONT_MINCHO}`;
  ctx.textAlign = 'center';
  const nameChars = Array.from(card.name).slice(0, 5);
  for (let i = 0; i < nameChars.length; i++) {
    ctx.fillText(nameChars[i], stripX + stripW / 2, stripY + 13 + i * 13);
  }

  ctx.fillStyle = '#f2ca52';
  ctx.beginPath();
  ctx.arc(r.x + 15, r.y + 15, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#1c140d';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.fillStyle = '#1a1109';
  ctx.font = `800 12px ${FONT_BRUSH}`;
  ctx.textAlign = 'center';
  ctx.fillText(card.iroha, r.x + 15, r.y + 19);

  if (card.ruleType === 'stay') {
    ctx.fillStyle = '#c93422';
    ctx.beginPath();
    ctx.arc(r.x + 16, r.y + 38, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff5e4';
    ctx.font = `800 11px ${FONT_MINCHO}`;
    ctx.fillText('泊', r.x + 16, r.y + 42);
  }

  ctx.fillStyle = 'rgba(248, 238, 215, 0.94)';
  ctx.fillRect(r.x + 2, r.y + r.h - 21, r.w - 4, 19);
  ctx.fillStyle = card.ruleType === 'back' ? '#a82416' : (card.ruleType === 'stay' ? '#8c5210' : '#184e32');
  ctx.font = `800 10.5px ${FONT_MINCHO}`;
  ctx.textAlign = 'center';
  ctx.fillText(card.ruleLabel, r.cx, r.y + r.h - 7);

  if (isOwned) {
    ctx.fillStyle = 'rgba(204, 52, 34, 0.88)';
    ctx.fillRect(r.x + 30, r.y + 4, 18, 15);
    ctx.fillStyle = '#fff6e5';
    ctx.font = `800 10px ${FONT_MINCHO}`;
    ctx.fillText('蔵', r.x + 39, r.y + 15);
  }
  if (isEquipped) {
    ctx.strokeStyle = '#ffd24c';
    ctx.lineWidth = 2.6;
    ctx.strokeRect(r.x + 2, r.y + 2, r.w - 4, r.h - 4);
  }

  ctx.strokeStyle = '#1e1610';
  ctx.lineWidth = 1.6;
  ctx.strokeRect(r.x, r.y, r.w, r.h);
}

function drawRouteArrows(ctx) {
  ctx.save();
  ctx.font = `800 13px ${FONT_MINCHO}`;
  ctx.textAlign = 'center';
  for (let i = 0; i < 25; i++) {
    const a = getSquareRect(i);
    const b = getSquareRect(i + 1);
    const mx = (a.cx + b.cx) / 2;
    const my = (a.cy + b.cy) / 2;
    const dx = b.cx - a.cx;
    const dy = b.cy - a.cy;
    let arrow = '►';
    if (Math.abs(dx) > Math.abs(dy)) arrow = dx > 0 ? '►' : '◄';
    else arrow = dy > 0 ? '▼' : '▲';
    ctx.beginPath();
    ctx.arc(mx, my, 8.5, 0, Math.PI * 2);
    ctx.fillStyle = '#f7ebd2';
    ctx.fill();
    ctx.strokeStyle = '#b82e1c';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.fillStyle = '#b82e1c';
    ctx.fillText(arrow, mx, my + 4.5);
  }
  ctx.restore();
}

function drawPlayerKoma(ctx, x, y, player, isHighlight) {
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 4;

  const r = 17;
  ctx.beginPath();
  ctx.moveTo(x, y - r * 1.15);
  ctx.lineTo(x + r * 0.92, y - r * 0.35);
  ctx.lineTo(x + r * 0.78, y + r);
  ctx.lineTo(x - r * 0.78, y + r);
  ctx.lineTo(x - r * 0.92, y - r * 0.35);
  ctx.closePath();

  if (player === 0) {
    ctx.fillStyle = '#1d1612';
    ctx.fill();
    ctx.strokeStyle = isHighlight ? '#ffd859' : '#d9a84e';
    ctx.lineWidth = isHighlight ? 2.8 : 1.8;
    ctx.stroke();
    ctx.fillStyle = '#f2cb6c';
    ctx.font = `800 13px ${FONT_BRUSH}`;
    ctx.textAlign = 'center';
    ctx.fillText('黒駒', x, y + 6);
  } else {
    ctx.fillStyle = '#f7efe0';
    ctx.fill();
    ctx.strokeStyle = isHighlight ? '#ff5733' : '#b83724';
    ctx.lineWidth = isHighlight ? 2.8 : 1.8;
    ctx.stroke();
    ctx.fillStyle = '#b82918';
    ctx.font = `800 13px ${FONT_BRUSH}`;
    ctx.textAlign = 'center';
    ctx.fillText('白駒', x, y + 6);
  }
  ctx.restore();
}

function renderUkiyoeAlbumModal(ctx) {
  ctx.save();
  ctx.fillStyle = 'rgba(10, 6, 4, 0.88)';
  ctx.fillRect(0, 0, W, H);

  const px = 84, py = 36, pw = W - 168, ph = H - 72;
  ctx.fillStyle = '#f1e4c8';
  ctx.fillRect(px, py, pw, ph);
  ctx.strokeStyle = '#24180e';
  ctx.lineWidth = 3;
  ctx.strokeRect(px + 6, py + 6, pw - 12, ph - 12);

  ctx.fillStyle = '#1e130a';
  ctx.font = `800 25px ${FONT_BRUSH}`;
  ctx.textAlign = 'left';
  ctx.fillText(`江戸錦絵大図鑑 ── 歌川国芳一門・二十四撰 （蒐集 ${EState.unlocked.size} ／ 二十四枚）`, px + 26, py + 42);

  const closeBtn = { x: px + pw - 134, y: py + 16, w: 112, h: 36 };
  ctx.fillStyle = '#b83220';
  ctx.fillRect(closeBtn.x, closeBtn.y, closeBtn.w, closeBtn.h);
  ctx.fillStyle = '#fff6e6';
  ctx.font = `800 15px ${FONT_MINCHO}`;
  ctx.textAlign = 'center';
  ctx.fillText('盤面へ戻る', closeBtn.x + closeBtn.w / 2, closeBtn.y + 24);

  const gx = px + 24, gy = py + 62;
  const cw = 104, ch = 142, gapX = 10, gapY = 10;

  for (let i = 0; i < 24; i++) {
    const card = UKIYOE_CARDS[i];
    const col = i % 6, row = Math.floor(i / 6);
    const cx = gx + col * (cw + gapX);
    const cy = gy + row * (ch + gapY);
    const owned = EState.unlocked.has(card.id);
    const equipped = EState.loadout.includes(card.id);
    const isSel = EState.selectedCardId === card.id;

    if (owned) {
      drawCardUkiyoeArt(ctx, cx, cy, cw, ch, card);
      ctx.fillStyle = 'rgba(24, 15, 8, 0.82)';
      ctx.fillRect(cx, cy + ch - 38, cw, 38);
      ctx.fillStyle = '#f7ebd2';
      ctx.font = `800 12.5px ${FONT_MINCHO}`;
      ctx.textAlign = 'center';
      ctx.fillText(`${card.iroha}・${card.name}`, cx + cw / 2, cy + ch - 21);
      ctx.fillStyle = '#e8b954';
      ctx.font = `600 10.5px ${FONT_MINCHO}`;
      ctx.fillText(`[${card.cat}] ${card.ruleLabel.slice(0, 7)}`, cx + cw / 2, cy + ch - 6);
    } else {
      ctx.fillStyle = '#cfc0a3';
      ctx.fillRect(cx, cy, cw, ch);
      ctx.fillStyle = 'rgba(60, 44, 28, 0.55)';
      ctx.font = `800 22px ${FONT_BRUSH}`;
      ctx.textAlign = 'center';
      ctx.fillText('未収蔵', cx + cw / 2, cy + ch / 2 - 4);
      ctx.font = `600 12px ${FONT_MINCHO}`;
      ctx.fillText(`${card.iroha}・第${KANJI[card.id]}駒`, cx + cw / 2, cy + ch / 2 + 22);
    }

    if (equipped) {
      ctx.fillStyle = '#c93422';
      ctx.fillRect(cx + 4, cy + 4, 46, 18);
      ctx.fillStyle = '#fff5e4';
      ctx.font = `800 11px ${FONT_MINCHO}`;
      ctx.textAlign = 'center';
      ctx.fillText('装備中', cx + 27, cy + 17);
    }

    ctx.strokeStyle = isSel ? '#c93422' : '#261b12';
    ctx.lineWidth = isSel ? 3.2 : 1.4;
    ctx.strokeRect(cx, cy, cw, ch);
  }

  const dx = gx + 6 * (cw + gapX) + 14;
  const dy = gy;
  const dw = px + pw - dx - 22;
  const dh = 4 * ch + 3 * gapY;

  ctx.fillStyle = '#faf3e3';
  ctx.fillRect(dx, dy, dw, dh);
  ctx.strokeStyle = '#261b12';
  ctx.lineWidth = 2;
  ctx.strokeRect(dx, dy, dw, dh);

  const selCard = UKIYOE_CARDS.find(c => c.id === EState.selectedCardId) || UKIYOE_CARDS[0];
  const selOwned = EState.unlocked.has(selCard.id);
  const selEquipped = EState.loadout.includes(selCard.id);

  drawCardUkiyoeArt(ctx, dx + 22, dy + 18, dw - 44, 190, selCard);
  ctx.strokeStyle = '#1e140c';
  ctx.lineWidth = 2;
  ctx.strokeRect(dx + 22, dy + 18, dw - 44, 190);

  ctx.fillStyle = '#1c1209';
  ctx.font = `800 22px ${FONT_BRUSH}`;
  ctx.textAlign = 'center';
  ctx.fillText(`【${selCard.iroha}】 ${selCard.name} （${selCard.sub}）`, dx + dw / 2, dy + 238);

  ctx.fillStyle = '#8c2d19';
  ctx.font = `800 13px ${FONT_MINCHO}`;
  ctx.fillText(`分類：${selCard.cat}札 ／ 盤上効果：${selCard.ruleLabel}`, dx + dw / 2, dy + 264);

  ctx.fillStyle = '#3b2a1a';
  ctx.font = `600 12px ${FONT_MINCHO}`;
  ctx.fillText(`原典：${selCard.source}`, dx + dw / 2, dy + 288);

  ctx.fillStyle = '#24180e';
  ctx.font = `600 13px ${FONT_MINCHO}`;
  ctx.textAlign = 'left';
  const loreText = selOwned
    ? selCard.lore
    : '【未収蔵】対局中にこの駒へ止まるか、「上り」一番乗りを果たすと画帖へ収蔵されます。';
  const lineLen = 22;
  for (let i = 0; i < Math.ceil(loreText.length / lineLen); i++) {
    ctx.fillText(loreText.slice(i * lineLen, (i + 1) * lineLen), dx + 22, dy + 320 + i * 21);
  }

  const boonDesc = selCard.cat === '英勇'
    ? '◆懐中守り札ご利益【英勇】：対局中一回、賽の出目に「＋二」を加勢できる'
    : (selCard.cat === '化物'
      ? '◆懐中守り札ご利益【化物】：怪異・泥舟などの「戻り」マスを無効化する'
      : '◆懐中守り札ご利益【名物・昔咄】：「泊（一回休み）」を無効化し一ます進む');
  ctx.fillStyle = '#184e32';
  ctx.font = `800 12px ${FONT_MINCHO}`;
  ctx.fillText(boonDesc, dx + 18, dy + 412);

  const eqBtn = { x: dx + 34, y: dy + dh - 118, w: dw - 68, h: 42 };
  ctx.fillStyle = !selOwned ? '#9e9280' : (selEquipped ? '#4a3b2c' : '#c93724');
  ctx.fillRect(eqBtn.x, eqBtn.y, eqBtn.w, eqBtn.h);
  ctx.fillStyle = '#fff6e5';
  ctx.font = `800 15px ${FONT_MINCHO}`;
  ctx.textAlign = 'center';
  ctx.fillText(
    !selOwned ? '未収蔵（盤上で止まると解放）' : (selEquipped ? '懐中守り札より外す' : '懐中守り札に装備する（最大三枚）'),
    eqBtn.x + eqBtn.w / 2,
    eqBtn.y + 27
  );

  const unlockAllBtn = { x: dx + 34, y: dy + dh - 62, w: dw - 68, h: 36 };
  ctx.fillStyle = '#2d536c';
  ctx.fillRect(unlockAllBtn.x, unlockAllBtn.y, unlockAllBtn.w, unlockAllBtn.h);
  ctx.fillStyle = '#f5ebd6';
  ctx.font = `600 13px ${FONT_MINCHO}`;
  ctx.fillText('★ 鑑賞・検証用：全二十四枚の錦絵札を一括解放', unlockAllBtn.x + unlockAllBtn.w / 2, unlockAllBtn.y + 23);

  ctx.restore();
}

export const ALBUM_BTN = { x: 18, y: 310, w: 152, h: 44 };
export const BOOST_BTN = { x: 18, y: 366, w: 152, h: 44 };
export const DICE_TUBE_RECT = { x: 1044, y: 470, w: 210, h: 175 };

export function renderEdoEsugoroku() {
  // フェーズ遷移の自動検知＆フレームdt更新
  const now = (typeof performance !== 'undefined') ? performance.now() : Date.now();
  const dt = EState._lastTime ? Math.min(0.1, (now - EState._lastTime) / 1000) : 0.016;
  EState._lastTime = now;

  if (EState._lastPhase !== G.phase) {
    if (G.phase === 'PLAY') {
      initEdoEsugorokuMatch();
    }
    EState._lastPhase = G.phase;
  }

  if (G.phase === 'PLAY') {
    G.diceRolling = false;
    G.animStone = null;
    updateEdoEsugoroku(dt);
  }

  const bgGrad = ctx.createRadialGradient(W / 2, H / 2, 80, W / 2, H / 2, 760);
  bgGrad.addColorStop(0, '#2b2017');
  bgGrad.addColorStop(1, '#0d0906');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.65)';
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 10;
  const paperGrad = ctx.createLinearGradient(SHEET.x, SHEET.y, SHEET.x + SHEET.w, SHEET.y + SHEET.h);
  paperGrad.addColorStop(0, '#f2e6cb');
  paperGrad.addColorStop(0.5, '#eadbc0');
  paperGrad.addColorStop(1, '#dfd0b1');
  ctx.fillStyle = paperGrad;
  ctx.fillRect(SHEET.x, SHEET.y, SHEET.w, SHEET.h);
  ctx.restore();

  ctx.strokeStyle = 'rgba(110, 86, 56, 0.25)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(SHEET.x + SHEET.w / 2, SHEET.y);
  ctx.lineTo(SHEET.x + SHEET.w / 2, SHEET.y + SHEET.h);
  ctx.moveTo(SHEET.x, SHEET.y + SHEET.h / 2);
  ctx.lineTo(SHEET.x + SHEET.w, SHEET.y + SHEET.h / 2);
  ctx.stroke();

  const earX = SHEET.gridX + SHEET.gridW + 8;
  const earW = SHEET.x + SHEET.w - earX - 6;
  ctx.fillStyle = '#1d140c';
  ctx.font = `800 22px ${FONT_BRUSH}`;
  ctx.textAlign = 'center';
  const mainTitle = '新板浮世絵百鬼英勇双六';
  for (let i = 0; i < mainTitle.length; i++) {
    ctx.fillText(mainTitle[i], earX + earW / 2, SHEET.y + 42 + i * 26);
  }
  ctx.fillStyle = '#593a22';
  ctx.font = `800 13px ${FONT_MINCHO}`;
  const subAuthor = '一勇斎国芳・芳員画';
  for (let i = 0; i < subAuthor.length; i++) {
    ctx.fillText(subAuthor[i], earX + earW / 2, SHEET.y + 365 + i * 16);
  }
  ctx.strokeStyle = '#c93724';
  ctx.lineWidth = 1.6;
  ctx.strokeRect(earX + 8, SHEET.y + 535, earW - 16, 56);
  ctx.fillStyle = '#c93724';
  ctx.font = `800 11px ${FONT_MINCHO}`;
  ctx.fillText('江戸', earX + earW / 2, SHEET.y + 554);
  ctx.fillText('蔦屋', earX + earW / 2, SHEET.y + 570);
  ctx.fillText('寿梓', earX + earW / 2, SHEET.y + 586);

  for (let sq = 0; sq <= 25; sq++) {
    drawSingleSquare(ctx, sq);
  }
  drawRouteArrows(ctx);

  ctx.strokeStyle = '#1a120b';
  ctx.lineWidth = 3.0;
  ctx.strokeRect(SHEET.gridX - 3, SHEET.gridY - 3, SHEET.gridW + 6, SHEET.gridH + 6);

  for (let p = 0; p < 2; p++) {
    let cx, cy;
    if (EState.stepAnim && EState.stepAnim.player === p) {
      const a = getSquareRect(EState.stepAnim.fromSq);
      const b = getSquareRect(EState.stepAnim.toSq);
      const t = EState.stepAnim.t;
      cx = a.cx + (b.cx - a.cx) * t;
      cy = a.cy + (b.cy - a.cy) * t - Math.sin(t * Math.PI) * 38;
    } else {
      const r = getSquareRect(EState.pos[p]);
      const offset = (EState.pos[0] === EState.pos[1]) ? (p === 0 ? -16 : 16) : 0;
      cx = r.cx + offset;
      cy = r.cy + 6;
    }
    drawPlayerKoma(ctx, cx, cy, p, G.turn === p && G.phase === 'PLAY');
  }

  ctx.fillStyle = 'rgba(20, 13, 8, 0.88)';
  ctx.fillRect(12, 38, 164, 612);
  ctx.strokeStyle = 'rgba(212, 166, 74, 0.55)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(12, 38, 164, 612);

  ctx.fillStyle = '#f2d388';
  ctx.font = `800 18px ${FONT_BRUSH}`;
  ctx.textAlign = 'center';
  ctx.fillText('陸・江戸絵双六', 94, 68);

  const p0Sq = EState.pos[0] === 0 ? '振出' : (EState.pos[0] === 25 ? '上り' : `${UKIYOE_CARDS[EState.pos[0] - 1].iroha}・${KANJI[EState.pos[0]]}`);
  const p1Sq = EState.pos[1] === 0 ? '振出' : (EState.pos[1] === 25 ? '上り' : `${UKIYOE_CARDS[EState.pos[1] - 1].iroha}・${KANJI[EState.pos[1]]}`);

  ctx.fillStyle = '#f7ebd2';
  ctx.font = `800 13.5px ${FONT_MINCHO}`;
  ctx.fillText(`貴殿（${G.humanSide === 0 ? '黒駒' : '白駒'}）`, 94, 108);
  ctx.fillStyle = '#ffd25a';
  ctx.fillText(`現在地：${G.humanSide === 0 ? p0Sq : p1Sq}`, 94, 130);
  ctx.fillText(`残り：${KANJI[25 - EState.pos[G.humanSide]] || (25 - EState.pos[G.humanSide])} ます`, 94, 152);

  ctx.fillStyle = '#cfc2ad';
  ctx.fillText(`相手（${G.humanSide === 0 ? '白駒' : '黒駒'}）`, 94, 194);
  ctx.fillText(`現在地：${G.humanSide === 0 ? p1Sq : p0Sq}`, 94, 216);
  ctx.fillText(`残り：${KANJI[25 - EState.pos[1 - G.humanSide]] || (25 - EState.pos[1 - G.humanSide])} ます`, 94, 238);

  ctx.fillStyle = G.turn === G.humanSide ? '#c93724' : '#3a5875';
  ctx.fillRect(20, 256, 148, 36);
  ctx.fillStyle = '#fff6e6';
  ctx.font = `800 14px ${FONT_MINCHO}`;
  ctx.fillText(G.turn === G.humanSide ? '◆ 貴殿の振り番' : '◇ 相手の振り番', 94, 279);

  ctx.fillStyle = '#8c2d19';
  ctx.fillRect(ALBUM_BTN.x, ALBUM_BTN.y, ALBUM_BTN.w, ALBUM_BTN.h);
  ctx.strokeStyle = '#f2c955';
  ctx.lineWidth = 1.6;
  ctx.strokeRect(ALBUM_BTN.x, ALBUM_BTN.y, ALBUM_BTN.w, ALBUM_BTN.h);
  ctx.fillStyle = '#fff5e4';
  ctx.font = `800 13.5px ${FONT_MINCHO}`;
  ctx.fillText(`浮世絵図鑑 (${EState.unlocked.size}/24)`, ALBUM_BTN.x + ALBUM_BTN.w / 2, ALBUM_BTN.y + 27);

  const canBoost = hasEquippedCategory(G.humanSide, '英勇') && !EState.boostUsed[G.humanSide];
  ctx.fillStyle = EState.boostArmed ? '#d98a2b' : (canBoost ? '#2e5942' : '#3d352e');
  ctx.fillRect(BOOST_BTN.x, BOOST_BTN.y, BOOST_BTN.w, BOOST_BTN.h);
  ctx.strokeStyle = 'rgba(242, 201, 85, 0.5)';
  ctx.strokeRect(BOOST_BTN.x, BOOST_BTN.y, BOOST_BTN.w, BOOST_BTN.h);
  ctx.fillStyle = canBoost ? '#fff6e5' : '#8c8275';
  ctx.font = `800 12.5px ${FONT_MINCHO}`;
  ctx.fillText(
    EState.boostArmed ? '★ 武威＋二 発動中' : (canBoost ? '英勇札：出目＋二' : '英勇札：使用済'),
    BOOST_BTN.x + BOOST_BTN.w / 2,
    BOOST_BTN.y + 27
  );

  ctx.fillStyle = '#e8c574';
  ctx.font = `800 13px ${FONT_MINCHO}`;
  ctx.fillText('▼ 懐中守り札（三枚）', 94, 434);
  for (let i = 0; i < 3; i++) {
    const cid = EState.loadout[i];
    const c = UKIYOE_CARDS.find(k => k.id === cid);
    const by = 446 + i * 62;
    ctx.fillStyle = '#2a1d13';
    ctx.fillRect(20, by, 148, 54);
    ctx.strokeStyle = '#a67c38';
    ctx.strokeRect(20, by, 148, 54);
    if (c) {
      ctx.fillStyle = '#f7ebd2';
      ctx.font = `800 12.5px ${FONT_MINCHO}`;
      ctx.fillText(`【${c.cat}】${c.name}`, 94, by + 22);
      ctx.fillStyle = '#d9a84e';
      ctx.font = `600 10.5px ${FONT_MINCHO}`;
      const effectShort = c.cat === '英勇' ? '主動：出目＋二' : (c.cat === '化物' ? '常駐：戻り無効' : '常駐：泊まり無効');
      ctx.fillText(effectShort, 94, by + 42);
    }
  }

  ctx.fillStyle = 'rgba(20, 13, 8, 0.88)';
  ctx.fillRect(1034, 38, 232, 612);
  ctx.strokeStyle = 'rgba(212, 166, 74, 0.55)';
  ctx.strokeRect(1034, 38, 232, 612);

  ctx.fillStyle = '#f2d388';
  ctx.font = `800 17px ${FONT_BRUSH}`;
  ctx.textAlign = 'center';
  ctx.fillText('道中案内・遊び方', 1150, 68);

  ctx.fillStyle = '#e8dcc4';
  ctx.font = `600 12px ${FONT_MINCHO}`;
  const guideLines = [
    '一、右下の「振出し」より出陣',
    '二、外周より内周へ二十四枚の',
    '  浮世絵駒を巡り中央「上り」へ',
    '三、止まった駒の錦絵札を',
    '  「浮世絵図鑑」へ永久収蔵！',
    '四、盤上の任意の浮世絵駒を',
    '  クリックで拡大鑑賞・解説表示'
  ];
  guideLines.forEach((ln, idx) => {
    ctx.fillText(ln, 1150, 98 + idx * 21);
  });

  const dx = 1118, dy = 290, ds = 64;
  ctx.fillStyle = '#fcf6e8';
  ctx.fillRect(dx, dy, ds, ds);
  ctx.strokeStyle = '#261a10';
  ctx.lineWidth = 2.5;
  ctx.strokeRect(dx, dy, ds, ds);

  const pipVal = EState.rolling ? (1 + (Math.floor(Date.now() / 60) % 6)) : EState.dieVal;
  ctx.fillStyle = pipVal === 1 || pipVal === 4 ? '#c92a1d' : '#1a120b';
  ctx.font = `800 32px ${FONT_BRUSH}`;
  ctx.fillText(KANJI[pipVal], dx + ds / 2, dy + 44);
  ctx.fillStyle = '#f2c955';
  ctx.font = `800 13px ${FONT_MINCHO}`;
  ctx.fillText(`出目：${KANJI[pipVal]}`, 1150, dy + ds + 24);

  const canRoll = G.phase === 'PLAY' && G.turn === G.humanSide && !EState.rolling && !EState.stepAnim;
  const shakeX = EState.holdingTube ? (Math.sin(Date.now() * 0.06) * 5) : 0;
  ctx.fillStyle = canRoll ? '#8c3b20' : '#3a2c22';
  ctx.fillRect(DICE_TUBE_RECT.x + shakeX, DICE_TUBE_RECT.y, DICE_TUBE_RECT.w, DICE_TUBE_RECT.h);
  ctx.strokeStyle = canRoll ? '#ffd25a' : '#6e5a46';
  ctx.lineWidth = 2.2;
  ctx.strokeRect(DICE_TUBE_RECT.x + shakeX, DICE_TUBE_RECT.y, DICE_TUBE_RECT.w, DICE_TUBE_RECT.h);

  ctx.fillStyle = '#fff5e4';
  ctx.font = `800 20px ${FONT_BRUSH}`;
  ctx.fillText(EState.holdingTube ? '竹筒振り中…' : '賽を振る（竹筒）', DICE_TUBE_RECT.x + DICE_TUBE_RECT.w / 2, DICE_TUBE_RECT.y + 78);
  ctx.fillStyle = '#f2d388';
  ctx.font = `600 12.5px ${FONT_MINCHO}`;
  ctx.fillText(canRoll ? 'クリックまたは長押しで振る' : '相手の番／移動中', DICE_TUBE_RECT.x + DICE_TUBE_RECT.w / 2, DICE_TUBE_RECT.y + 112);

  ctx.fillStyle = 'rgba(18, 11, 6, 0.92)';
  ctx.fillRect(186, 662, 836, 46);
  ctx.strokeStyle = 'rgba(212, 166, 74, 0.45)';
  ctx.strokeRect(186, 662, 836, 46);
  ctx.fillStyle = '#f7ebd2';
  ctx.font = `800 14px ${FONT_MINCHO}`;
  ctx.textAlign = 'center';
  ctx.fillText(EState.lastEventText, 604, 690);

  for (const [btn, label] of [[NEW_GAME_BTN, '新局'], [CHANGE_ERA_BTN, '時代替']]) {
    ctx.fillStyle = '#2b1b10';
    ctx.fillRect(btn.x, btn.y, btn.w, btn.h);
    ctx.strokeStyle = '#c89e52';
    ctx.lineWidth = 1.6;
    ctx.strokeRect(btn.x, btn.y, btn.w, btn.h);
    ctx.fillStyle = '#f3dfb4';
    ctx.font = `800 15px ${FONT_MINCHO}`;
    ctx.textAlign = 'center';
    ctx.fillText(label, btn.x + btn.w / 2, btn.y + 27);
  }

  if (G.stamp && G.stamp.alpha > 0) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, G.stamp.alpha);
    ctx.fillStyle = 'rgba(20, 10, 6, 0.88)';
    ctx.fillRect(W / 2 - 220, H / 2 - 58, 440, 116);
    ctx.strokeStyle = '#e04832';
    ctx.lineWidth = 3;
    ctx.strokeRect(W / 2 - 214, H / 2 - 52, 428, 104);
    ctx.fillStyle = '#ff6b4a';
    ctx.font = `800 32px ${FONT_BRUSH}`;
    ctx.textAlign = 'center';
    ctx.fillText(G.stamp.text, W / 2, H / 2 - 4);
    ctx.fillStyle = '#f7ebd2';
    ctx.font = `600 15px ${FONT_MINCHO}`;
    ctx.fillText(G.stamp.sub || '', W / 2, H / 2 + 32);
    ctx.restore();
  }

  if (EState.albumOpen) {
    renderUkiyoeAlbumModal(ctx);
  }
}

function finishMatch(winner) {
  G.winner = winner;
  G.winReason = '新板浮世絵双六・中央「上り」一番乗り完遂';
  if (winner === G.humanSide) {
    const locked = UKIYOE_CARDS.filter(c => !EState.unlocked.has(c.id));
    if (locked.length > 0) {
      const bonus = locked[Math.floor(Math.random() * locked.length)];
      EState.unlocked.add(bonus.id);
      saveCollection();
      G.winReason = `上り一番乗り！褒美錦絵札「${bonus.name}」を収蔵`;
    }
    playVictoryFanfare();
  } else {
    playDefeatBell();
  }
  G.phase = 'SETTLEMENT';
}

function advanceTurn() {
  const nextP = 1 - G.turn;
  if (EState.skipTurns[nextP] > 0) {
    EState.skipTurns[nextP]--;
    const who = nextP === G.humanSide ? '貴殿' : '相手';
    showStamp('宿場泊まり', `${who}は一回休みにつき手番見送り`);
    EState.lastEventText = `${who}は「泊（一回休み）」につき、続けて${G.turn === G.humanSide ? '貴殿' : '相手'}の振り番！`;
    if (G.turn !== G.humanSide && G.phase === 'PLAY') {
      setTimeout(() => triggerRoll(G.turn), 700);
    }
    return;
  }
  G.turn = nextP;
  if (G.turn !== G.humanSide && G.phase === 'PLAY') {
    setTimeout(() => triggerRoll(G.turn), 650);
  }
}

function applySquareArrival(player, sq, rolledDie) {
  const opp = 1 - player;
  if (sq >= 1 && sq <= 24 && EState.pos[opp] === sq) {
    EState.pos[opp] = Math.max(0, EState.pos[opp] - 3);
    showStamp('追突はじき', '相手の駒を三ます後方へ弾き飛ばす！');
  }

  if (sq >= 25) {
    EState.pos[player] = 25;
    finishMatch(player);
    return;
  }

  const card = UKIYOE_CARDS[sq - 1];
  if (!card) {
    advanceTurn();
    return;
  }

  let newlyUnlocked = false;
  if (player === G.humanSide && !EState.unlocked.has(card.id)) {
    EState.unlocked.add(card.id);
    EState.selectedCardId = card.id;
    saveCollection();
    newlyUnlocked = true;
  }

  const who = player === G.humanSide ? '貴殿' : '相手';
  const unlockNote = newlyUnlocked ? `【新収蔵：${card.name}】 ` : '';
  EState.lastEventText = `${unlockNote}${who}が「${card.iroha}・${card.name}」に到着 ── ${card.ruleLabel}`;

  if (card.ruleType === 'jump' || (card.ruleType === 'odd_boost' && rolledDie % 2 === 1)) {
    const jumpSteps = card.val;
    const targetSq = Math.min(25, sq + jumpSteps);
    showStamp(`${card.name}`, `${unlockNote}${card.ruleLabel}！`);
    EState.stepAnim = {
      player,
      fromSq: sq,
      toSq: targetSq,
      t: 0,
      duration: 0.42,
      onComplete: () => {
        EState.pos[player] = targetSq;
        playStoneImpact(false);
        if (targetSq >= 25) {
          finishMatch(player);
        } else {
          advanceTurn();
        }
      }
    };
    return;
  }

  if (card.ruleType === 'back') {
    if (hasEquippedCategory(player, '化物')) {
      showStamp('化物守り札発動', `「${card.name}」の怪異戻りを無効化！`);
      EState.lastEventText = `懐中の【化物札】が「${card.name}」の怪異戻りを退けた！`;
      advanceTurn();
      return;
    }
    const targetSq = Math.max(0, sq + card.val);
    showStamp(`${card.name}`, `${card.ruleLabel}`);
    EState.stepAnim = {
      player,
      fromSq: sq,
      toSq: targetSq,
      t: 0,
      duration: 0.42,
      onComplete: () => {
        EState.pos[player] = targetSq;
        playStoneImpact(false);
        advanceTurn();
      }
    };
    return;
  }

  if (card.ruleType === 'stay') {
    if (hasEquippedCategory(player, '昔咄') || hasEquippedCategory(player, '名物')) {
      const targetSq = Math.min(25, sq + 1);
      showStamp('通行手形発動', '「泊」を免除し一ます前進！');
      EState.pos[player] = targetSq;
      if (targetSq >= 25) { finishMatch(player); return; }
      advanceTurn();
      return;
    }
    EState.skipTurns[player] = 1;
    showStamp(`泊・${card.name}`, card.ruleLabel);
    advanceTurn();
    return;
  }

  if (card.ruleType === 'roll_again') {
    showStamp(`${card.name}`, '吉兆！賽をもう一振り');
    if (player !== G.humanSide && G.phase === 'PLAY') {
      setTimeout(() => triggerRoll(player), 650);
    }
    return;
  }

  if (newlyUnlocked) {
    showStamp(`錦絵収蔵：${card.name}`, '浮世絵図鑑に新たな一図が加わった');
  }
  advanceTurn();
}

export function triggerRoll(player) {
  if (EState.rolling || EState.stepAnim || G.phase !== 'PLAY') return;
  EState.rolling = true;
  EState.rollTimer = 0.38;
  playDiceBounce();

  let rawDie = 1 + Math.floor(Math.random() * 6);
  if (player === G.humanSide && EState.boostArmed && !EState.boostUsed[player]) {
    rawDie += 2;
    EState.boostArmed = false;
    EState.boostUsed[player] = true;
    showStamp('英勇武威加勢', `出目に＋二が加わり「${KANJI[rawDie]}」ます前進！`);
  }
  EState.dieVal = rawDie;
  G.stats.turns++;
}

export function updateEdoEsugoroku(dt) {
  if (EState.holdingTube) {
    EState.holdPower = Math.min(1, EState.holdPower + dt * 1.8);
    EState.rattleCooldown -= dt;
    if (EState.rattleCooldown <= 0) {
      playSingleRattleGrain(EState.holdPower);
      EState.rattleCooldown = 0.085;
    }
  }

  if (EState.rolling) {
    EState.rollTimer -= dt;
    if (EState.rollTimer <= 0) {
      EState.rolling = false;
      const p = G.turn;
      const fromSq = EState.pos[p];
      const toSq = Math.min(25, fromSq + EState.dieVal);
      playStoneLift();
      EState.stepAnim = {
        player: p,
        fromSq,
        toSq,
        t: 0,
        duration: 0.45,
        onComplete: () => {
          EState.pos[p] = toSq;
          playStoneImpact(false);
          applySquareArrival(p, toSq, EState.dieVal);
        }
      };
    }
  }

  if (EState.stepAnim) {
    EState.stepAnim.t += dt / EState.stepAnim.duration;
    if (EState.stepAnim.t >= 1) {
      const done = EState.stepAnim.onComplete;
      EState.stepAnim = null;
      if (done) done();
    }
  }
}

export function handleEdoEsugorokuPointerDown(bx, by) {
  if (EState.albumOpen) {
    const px = 84, py = 36, pw = W - 168, ph = H - 72;
    const closeBtn = { x: px + pw - 134, y: py + 16, w: 112, h: 36 };
    if (isInsideRect(bx, by, closeBtn)) {
      EState.albumOpen = false;
      return true;
    }
    const gx = px + 24, gy = py + 62, cw = 104, ch = 142, gapX = 10, gapY = 10;
    for (let i = 0; i < 24; i++) {
      const col = i % 6, row = Math.floor(i / 6);
      const rect = { x: gx + col * (cw + gapX), y: gy + row * (ch + gapY), w: cw, h: ch };
      if (isInsideRect(bx, by, rect)) {
        EState.selectedCardId = UKIYOE_CARDS[i].id;
        playStoneLift();
        return true;
      }
    }
    const dx = gx + 6 * (cw + gapX) + 14;
    const dy = gy, dw = px + pw - dx - 22, dh = 4 * ch + 3 * gapY;
    const eqBtn = { x: dx + 34, y: dy + dh - 118, w: dw - 68, h: 42 };
    if (isInsideRect(bx, by, eqBtn)) {
      const cid = EState.selectedCardId;
      if (EState.unlocked.has(cid)) {
        const idx = EState.loadout.indexOf(cid);
        if (idx >= 0) {
          EState.loadout.splice(idx, 1);
        } else {
          if (EState.loadout.length >= 3) EState.loadout.shift();
          EState.loadout.push(cid);
        }
        saveCollection();
        playStoneImpact(false);
      }
      return true;
    }
    const unlockAllBtn = { x: dx + 34, y: dy + dh - 62, w: dw - 68, h: 36 };
    if (isInsideRect(bx, by, unlockAllBtn)) {
      UKIYOE_CARDS.forEach(c => EState.unlocked.add(c.id));
      saveCollection();
      showStamp('全二十四撰解放', 'すべての錦絵札を図鑑へ収蔵せり');
      playVictoryFanfare();
      return true;
    }
    return true;
  }

  if (isInsideRect(bx, by, ALBUM_BTN)) {
    EState.albumOpen = true;
    playStoneLift();
    return true;
  }

  if (isInsideRect(bx, by, BOOST_BTN)) {
    if (hasEquippedCategory(G.humanSide, '英勇') && !EState.boostUsed[G.humanSide]) {
      EState.boostArmed = !EState.boostArmed;
      playStoneLift();
    }
    return true;
  }

  for (let sq = 1; sq <= 24; sq++) {
    if (isInsideRect(bx, by, getSquareRect(sq))) {
      EState.selectedCardId = sq;
      EState.albumOpen = true;
      playStoneLift();
      return true;
    }
  }

  if (G.phase === 'PLAY' && G.turn === G.humanSide && !EState.rolling && !EState.stepAnim) {
    if (isInsideRect(bx, by, DICE_TUBE_RECT)) {
      EState.holdingTube = true;
      EState.holdPower = 0.2;
      playSingleRattleGrain(0.3);
      return true;
    }
  }

  return false;
}

export function handleEdoEsugorokuPointerUp() {
  if (EState.holdingTube) {
    EState.holdingTube = false;
    triggerRoll(G.humanSide);
    return true;
  }
  return false;
}

// ブラウザ環境でキャプチャフェーズのポインタイベントを自動登録
if (typeof window !== 'undefined') {
  window.addEventListener('pointerdown', (e) => {
    if (G.eraIdx !== 5 || G.phase !== 'PLAY') return;
    const canvasEl = (ctx && ctx.canvas) || document.querySelector('canvas');
    if (!canvasEl) return;
    const rect = canvasEl.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const bx = (e.clientX - rect.left) * (W / rect.width);
    const by = (e.clientY - rect.top) * (H / rect.height);

    if (!EState.albumOpen && isInsideRect(bx, by, NEW_GAME_BTN)) {
      setTimeout(() => initEdoEsugorokuMatch(), 10);
      return;
    }
    if (!EState.albumOpen && isInsideRect(bx, by, CHANGE_ERA_BTN)) {
      return;
    }
    if (handleEdoEsugorokuPointerDown(bx, by)) {
      e.stopImmediatePropagation();
      e.preventDefault();
    }
  }, { capture: true });

  window.addEventListener('pointerup', (e) => {
    if (G.eraIdx !== 5 || G.phase !== 'PLAY') return;
    if (handleEdoEsugorokuPointerUp()) {
      e.stopImmediatePropagation();
    }
  }, { capture: true });
}

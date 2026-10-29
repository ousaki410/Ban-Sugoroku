// 全局状態機 G・盤面幾何座標換算・共通文字描画
import { ERA_MODES } from './eras.js';

export const canvas = document.getElementById('stage');
export const ctx = canvas.getContext('2d');

export const FONT_BRUSH = '"Yuji Syuku", "Shippori Mincho B1", "Hiragino Mincho ProN", "Yu Mincho", serif';
export const FONT_MINCHO = '"Shippori Mincho B1", "Hiragino Mincho ProN", "Yu Mincho", serif';

export const W = 1280, H = 760;
export let scale = 1, offsetX = 0, offsetY = 0;

export function resize() {
  canvas.width = window.innerWidth * window.devicePixelRatio;
  canvas.height = window.innerHeight * window.devicePixelRatio;
  scale = Math.min(canvas.width / W, canvas.height / H);
  offsetX = (canvas.width - W * scale) / 2;
  offsetY = (canvas.height - H * scale) / 2;
}
window.addEventListener('resize', resize);
resize();

export function currentEra() {
  return ERA_MODES[G.eraIdx];
}

export function showStamp(text, sub = '') {
  G.stamp = { text, sub, alpha: 1.5 };
}

// ==================== 4. 画面遷移・盤面幾何・王手演出・決済画面 ====================
export const NEW_GAME_BTN = { x: 1126, y: 618, w: 108, h: 42 };
export const CHANGE_ERA_BTN = { x: 1126, y: 672, w: 108, h: 42 };

export const G = {
    screen: 'SELECT_ERA', // 'SELECT_ERA' | 'SELECT_COLOR' | 'PLAYING'
    eraIdx: 2,            // 参：室町幕府・正統本双六
    hoverEraIdx: -1,
    humanSide: 0,
    hoverColorBtn: -1,
    hoverSettleBtn: -1,
    pts: new Array(24).fill(0),
    bar: [0, 0],
    off: [0, 0],
    turn: 0,
    dice: [0, 0],
    rem: [],
    rolledPair: false,
    selectedFrom: null,
    hoveredFrom: null,
    hoveredTargetTo: null,
    pointerX: W / 2,
    pointerY: H / 2,
    phase: 'WAIT_ROLL', // 'WAIT_ROLL' | 'PLAYER_HOLD_TUBE' | 'AI_SHAKE_TUBE' | 'DICE_TUMBLE' | 'PLAYER_MOVE' | 'STONE_FLY' | 'AI_WAIT' | 'SETTLEMENT'
    winner: -1,
    winReason: '',
    oteAlerted: [false, false],
    oteActive: [false, false],
    stats: { turns: 0, hits: 0, doubles: 0 },
    shakeTicks: 0,
    rattleCooldown: 0,
    pulseTick: 0,
    tubeHintFlash: 0,
    boardShake: 0,
    tube: { baseX: 630, baseY: 316, dx: 0, dy: 0, angle: 0, tipped: false, hovering: false },
    physDice: [
      { x: 0, y: 0, vx: 0, vy: 0, rot: 0, vrot: 0, val: 6, settled: true, bounceCount: 0 },
      { x: 0, y: 0, vx: 0, vy: 0, rot: 0, vrot: 0, val: 5, settled: true, bounceCount: 0 }
    ],
    flyingStone: null,
    stamp: null,
    statusText: '',
    shockwaves: [],
    dust: []
  };

export function spawnShockwave(boardX, boardY, mag = 1) {
  const intensity = Math.max(0.3, Math.min(1, mag));
  const base = Math.max(10, mag);
  // 金色冲击波环
  G.shockwaves.push({ x: boardX, y: boardY, intensity, t: 0, life: 0.5 + intensity * 0.3 });
  // 放射状刀锉火花 + 墨色木屑 (16~24 颗)
  const count = Math.floor(16 + intensity * 8);
  for (let i = 0; i < count; i++) {
    const a = (Math.PI * 2 * i) / count + (Math.PI / count) * (Math.random() - 0.5);
    const kind = i % 3; // 0:金星火 1:朱火花 2:墨木屑
    const speed = 0.7 + Math.random() * 1.8 * base;
    G.dust.push({
      x: boardX, y: boardY,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed - speed * 0.6, // 初速度抛上
      gravity: kind === 2 ? 0.18 : 0.08,
      life: 0.45 + Math.random() * 0.22, t: 0,
      kind
    });
  }
}

export function B() {
    return currentEra().geom;
  }

export function getLaneGeom(idx) {
    const b = B();
    const laneW = b.w / 12;
    const laneH = (b.h - b.midH) / 2;
    const isTop = idx >= 12;
    const col = isTop ? (idx - 12) : (11 - idx);
    const x = b.x + col * laneW;
    const y = isTop ? b.y : (b.y + laneH + b.midH);
    return { idx, col, isTop, x, y, w: laneW, h: laneH, cx: x + laneW / 2 };
  }

export function getStoneSlotXY(idx, slotIndex) {
    const b = B();
    if (idx === 'bar0') return { x: b.x + 145 + slotIndex * 36, y: b.y + b.h / 2 };
    if (idx === 'bar1') return { x: b.x + b.w - 145 - slotIndex * 36, y: b.y + b.h / 2 };
    if (idx === 'off0') {
      const tx = b.trayX || (b.x + b.w + 55);
      const ty = b.y + b.h - 190;
      return { x: tx + 32 + (slotIndex % 3) * 28, y: ty + 54 + Math.floor(slotIndex / 3) * 26 };
    }
    if (idx === 'off1') {
      const tx = b.trayX || (b.x + b.w + 55);
      const ty = b.y + 10;
      return { x: tx + 32 + (slotIndex % 3) * 28, y: ty + 54 + Math.floor(slotIndex / 3) * 26 };
    }
    const lane = getLaneGeom(idx);
    const clamped = Math.min(slotIndex, 4);
    const layer = Math.floor(slotIndex / 5);
    const spacing = Math.min(34, (lane.h - 46) / 4.2);
    const sy = lane.isTop
      ? (lane.y + 24 + clamped * spacing - layer * 5)
      : (lane.y + lane.h - 24 - clamped * spacing - layer * 5);
    return { x: lane.cx + layer * 3, y: sy };
  }

export function getTargetSealXY(targetObj) {
    const b = B();
    if (targetObj.to === 'off') {
      const trayKey = G.humanSide === 0 ? 'off0' : 'off1';
      const stXY = getStoneSlotXY(trayKey, G.off[G.humanSide]);
      const ty = G.humanSide === 0 ? (b.y + b.h - 95) : (b.y + 95);
      return { stoneX: stXY.x, stoneY: stXY.y, sealX: (b.trayX || (b.x + b.w + 55)) + 59, sealY: ty };
    }
    const lane = getLaneGeom(targetObj.to);
    const stoneCnt = Math.min(Math.abs(G.pts[targetObj.to]), 4);
    const stoneXY = getStoneSlotXY(targetObj.to, stoneCnt);
    const sealY = lane.isTop ? (lane.y + lane.h - 24) : (lane.y + 24);
    return { stoneX: stoneXY.x, stoneY: stoneXY.y, sealX: lane.cx, sealY };
  }

export function drawMakiEText(text, x, y, size, align = 'center', useBrush = true, alpha = 1.0) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = `${useBrush ? '400' : '700'} ${size}px ${useBrush ? FONT_BRUSH : FONT_MINCHO}`;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(5, 2, 0, 0.92)';
    ctx.fillText(text, x + 1.5, y + 2);
    const g = ctx.createLinearGradient(x, y - size * 0.5, x, y + size * 0.5);
    g.addColorStop(0, '#fff2c6');
    g.addColorStop(0.48, '#e3ba62');
    g.addColorStop(1, '#9e7225');
    ctx.fillStyle = g;
    ctx.fillText(text, x, y);
    ctx.restore();
  }

// ==================== 6. 入力判定システム ====================
export function toBoardXY(clientX, clientY) {
    const r = canvas.getBoundingClientRect();
    const cx = (clientX - r.left) * (canvas.width / r.width);
    const cy = (clientY - r.top) * (canvas.height / r.height);
    return { x: (cx - offsetX) / scale, y: (cy - offsetY) / scale };
  }

export function isInsideRect(px, py, r) {
    return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
  }

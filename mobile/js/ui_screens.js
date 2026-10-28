import { ERA_MODES, KANJI } from './eras.js';
import { ctx, W, H, FONT_MINCHO, G, currentEra, drawMakiEText } from './state.js';
import { SugorokuCore } from './core.js';
import { drawDimpledStone } from './board_renderer.js';

// ==================== 5. 時代選択屏風・手番選択・時代別実寸盤面・勝敗決済画面 ====================
export function getEraCardRect(idx) {
    const col = idx % 3;
    const row = Math.floor(idx / 3);
    const cw = 356, ch = 258;
    const gapX = 28, gapY = 26;
    const startX = (W - (cw * 3 + gapX * 2)) / 2;
    const startY = 148;
    return { x: startX + col * (cw + gapX), y: startY + row * (ch + gapY), w: cw, h: ch };
  }

export function renderEraSelectScreen() {
    const roomGlow = ctx.createRadialGradient(W / 2, H * 0.45, 50, W / 2, H * 0.45, 760);
    roomGlow.addColorStop(0, 'rgba(72, 38, 16, 0.55)');
    roomGlow.addColorStop(1, 'rgba(6, 3, 1, 0.98)');
    ctx.fillStyle = roomGlow;
    ctx.fillRect(0, 0, W, H);

    drawMakiEText('盤双六 ── 時代・遊び方撰び', W / 2, 58, 34, 'center', true);
    drawMakiEText('公家・寺家・武家・茶人・町人 ── 六つの時代背景と古流ルールより撰ばれよ', W / 2, 102, 16.5, 'center', false, 0.85);

    ERA_MODES.forEach((m, idx) => {
      const r = getEraCardRect(idx);
      const isHov = (G.hoverEraIdx === idx);

      ctx.save();
      const g = ctx.createLinearGradient(r.x, r.y, r.x, r.y + r.h);
      g.addColorStop(0, isHov ? '#331c0d' : '#1e1108');
      g.addColorStop(1, isHov ? '#1a0d05' : '#0e0703');
      ctx.fillStyle = g;
      ctx.fillRect(r.x, r.y, r.w, r.h);

      ctx.strokeStyle = isHov ? '#ffe285' : '#8c692e';
      ctx.lineWidth = isHov ? 2.8 : 1.6;
      ctx.strokeRect(r.x, r.y, r.w, r.h);
      ctx.strokeStyle = 'rgba(212, 166, 74, 0.25)';
      ctx.lineWidth = 1;
      ctx.strokeRect(r.x + 5, r.y + 5, r.w - 10, r.h - 10);

      ctx.fillStyle = 'rgba(162, 28, 20, 0.85)';
      ctx.fillRect(r.x + 16, r.y + 16, 34, 34);
      ctx.strokeStyle = '#f2c977';
      ctx.strokeRect(r.x + 16, r.y + 16, 34, 34);
      drawMakiEText(m.numKanji, r.x + 33, r.y + 33, 20, 'center', true);

      ctx.fillStyle = '#d9b671';
      ctx.font = `600 13.5px ${FONT_MINCHO}`;
      ctx.textAlign = 'left';
      ctx.fillText(m.culture, r.x + 60, r.y + 34);

      drawMakiEText(m.title, r.x + r.w / 2, r.y + 82, 25, 'center', true);

      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.fillRect(r.x + 18, r.y + 114, r.w - 36, 52);
      ctx.strokeStyle = 'rgba(180, 138, 62, 0.35)';
      ctx.strokeRect(r.x + 18, r.y + 114, r.w - 36, 52);

      ctx.fillStyle = '#ebd4a2';
      ctx.font = `600 13px ${FONT_MINCHO}`;
      ctx.textAlign = 'left';
      ctx.fillText(`◆ 石数：${m.stoneLabel}`, r.x + 28, r.y + 134);
      ctx.fillText(`◆ 盤制：${m.boardLabel}`, r.x + 28, r.y + 154);

      ctx.fillStyle = '#c9b38b';
      ctx.font = `13px ${FONT_MINCHO}`;
      const line1 = m.ruleSummary.slice(0, 22);
      const line2 = m.ruleSummary.slice(22);
      ctx.fillText(line1, r.x + 20, r.y + 194);
      if (line2) ctx.fillText(line2, r.x + 20, r.y + 214);

      drawMakiEText(isHov ? 'この時代・遊び方で対局する' : '── 撰ぶ ──', r.x + r.w / 2, r.y + 240, 14.5, 'center', true);
      ctx.restore();
    });
  }

export function renderColorSelectModal() {
    const mode = currentEra();
    ctx.save();
    ctx.fillStyle = 'rgba(6, 3, 1, 0.78)';
    ctx.fillRect(0, 0, W, H);

    const mw = 680, mh = 390;
    const mx = (W - mw) / 2, my = (H - mh) / 2;

    ctx.fillStyle = '#170d06';
    ctx.fillRect(mx, my, mw, mh);
    ctx.strokeStyle = '#c99b3b';
    ctx.lineWidth = 2.4;
    ctx.strokeRect(mx, my, mw, mh);
    ctx.strokeStyle = 'rgba(212, 166, 74, 0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(mx + 6, my + 6, mw - 12, mh - 12);

    drawMakiEText(`${mode.numKanji}・${mode.title}`, W / 2, my + 48, 28, 'center', true);
    drawMakiEText(`${mode.culture} ｜ ${mode.stoneLabel} ｜ ${mode.boardLabel}`, W / 2, my + 86, 15, 'center', false, 0.9);
    drawMakiEText('執る石と手番を撰ばれよ', W / 2, my + 132, 20, 'center', true);

    const boxes = [
      { side: 0, x: mx + 64, y: my + 164, w: 250, h: 148, title: '黒石を執る・先手', sub: '那智黒石にて先陣を切る' },
      { side: 1, x: mx + 366, y: my + 164, w: 250, h: 148, title: '白石を執る・後手', sub: '日向蛤石にて後手より応撃' }
    ];

    boxes.forEach(bx => {
      const isHov = (G.hoverColorBtn === bx.side);
      ctx.fillStyle = isHov ? '#331d0e' : '#211208';
      ctx.fillRect(bx.x, bx.y, bx.w, bx.h);
      ctx.strokeStyle = isHov ? '#ffe285' : '#967130';
      ctx.lineWidth = isHov ? 2.6 : 1.6;
      ctx.strokeRect(bx.x, bx.y, bx.w, bx.h);

      drawDimpledStone(bx.x + bx.w / 2, bx.y + 46, 24, bx.side, isHov, isHov);
      drawMakiEText(bx.title, bx.x + bx.w / 2, bx.y + 100, 19, 'center', true);
      drawMakiEText(bx.sub, bx.x + bx.w / 2, bx.y + 128, 13.5, 'center', false, 0.85);
    });

    const backHov = (G.hoverColorBtn === 2);
    ctx.fillStyle = backHov ? '#2e1a0c' : '#1a0e06';
    ctx.fillRect(W / 2 - 110, my + 332, 220, 38);
    ctx.strokeStyle = backHov ? '#ffe285' : '#7d5d26';
    ctx.strokeRect(W / 2 - 110, my + 332, 220, 38);
    drawMakiEText('◄ 時代・遊び方撰びへ戻る', W / 2, my + 351, 15, 'center', true);

    ctx.restore();
  }

  // 勝利・敗北の専用決済画面（金屏風絵巻 vs 水墨残燭絵巻）
export function renderSettlementOverlay() {
    const mode = currentEra();
    const isWin = (G.winner === G.humanSide);
    ctx.save();
    ctx.fillStyle = isWin ? 'rgba(12, 7, 2, 0.82)' : 'rgba(4, 5, 8, 0.86)';
    ctx.fillRect(0, 0, W, H);

    const pw = 660, ph = 420;
    const px = (W - pw) / 2, py = (H - ph) / 2;

    // パネル背景（勝利＝金泥黒漆屏風、敗北＝水墨寒色巻物）
    const g = ctx.createLinearGradient(px, py, px, py + ph);
    if (isWin) {
      g.addColorStop(0, '#2e1a08');
      g.addColorStop(0.5, '#1c1005');
      g.addColorStop(1, '#120902');
    } else {
      g.addColorStop(0, '#16171a');
      g.addColorStop(0.5, '#0f1012');
      g.addColorStop(1, '#08090a');
    }
    ctx.fillStyle = g;
    ctx.fillRect(px, py, pw, ph);

    ctx.strokeStyle = isWin ? '#e6bc5c' : '#6e737b';
    ctx.lineWidth = 3;
    ctx.strokeRect(px, py, pw, ph);
    ctx.strokeStyle = isWin ? 'rgba(245, 208, 115, 0.35)' : 'rgba(140, 148, 160, 0.25)';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(px + 8, py + 8, pw - 16, ph - 16);

    // 勝利時の舞い散る金砂子エフェクト
    if (isWin) {
      ctx.fillStyle = 'rgba(245, 208, 110, 0.38)';
      for (let i = 0; i < 24; i++) {
        const gx = px + 30 + ((i * 97 + Math.floor(G.pulseTick * 8)) % (pw - 60));
        const gy = py + 20 + ((i * 61 + Math.floor(G.pulseTick * 5)) % (ph - 40));
        ctx.beginPath();
        ctx.arc(gx, gy, (i % 3) + 1.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 大朱印落款
    const sealX = px + 56, sealY = py + 44, sealS = 64;
    ctx.fillStyle = isWin ? 'rgba(178, 28, 18, 0.9)' : 'rgba(72, 42, 38, 0.8)';
    ctx.fillRect(sealX, sealY, sealS, sealS);
    ctx.strokeStyle = isWin ? '#f7d486' : '#9c8d84';
    ctx.lineWidth = 2;
    ctx.strokeRect(sealX, sealY, sealS, sealS);
    drawMakiEText(isWin ? '大勝' : '惜敗', sealX + sealS / 2, sealY + sealS / 2 + 2, 24, 'center', true);

    // 主題と決着理由
    drawMakiEText(isWin ? '勝鬨 ── 貴殿の勝利' : '無念 ── 相手の勝利', W / 2 + 20, py + 62, 34, 'center', true);
    drawMakiEText(`${mode.title} ｜ ${G.winReason}`, W / 2 + 20, py + 104, 16.5, 'center', false, 0.92);

    // 戦績明細枠
    const sx = px + 56, sy = py + 140, sw = pw - 112, sh = 166;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.fillRect(sx, sy, sw, sh);
    ctx.strokeStyle = isWin ? 'rgba(212, 166, 74, 0.4)' : 'rgba(130, 135, 145, 0.3)';
    ctx.strokeRect(sx, sy, sw, sh);

    const bIn = mode.canBearOff || mode.isOimawashi ? G.off[0] : SugorokuCore.countInner(G.pts, 0);
    const wIn = mode.canBearOff || mode.isOimawashi ? G.off[1] : SugorokuCore.countInner(G.pts, 1);
    const unitLabel = mode.isOimawashi ? '絵合納め数' : (mode.canBearOff ? '上がり石数' : '内陣集結石数');
    const goalCnt = mode.isOimawashi ? 6 : mode.stoneCount;

    const rows = [
      [`対局手数`, `全 ${KANJI[Math.min(24, G.stats.turns)] || G.stats.turns} 手`],
      [`黒石・${unitLabel}`, `${KANJI[bIn] || bIn} ／ ${KANJI[goalCnt]}`],
      [`白石・${unitLabel}`, `${KANJI[wIn] || wIn} ／ ${KANJI[goalCnt]}`],
      [`叩き回数・重目回数`, `叩き ${KANJI[Math.min(24, G.stats.hits)] || G.stats.hits} 回 ・ 重目 ${KANJI[Math.min(24, G.stats.doubles)] || G.stats.doubles} 回`]
    ];

    rows.forEach(([k, v], idx) => {
      const ry = sy + 30 + idx * 35;
      ctx.fillStyle = '#cbb692';
      ctx.font = `600 15px ${FONT_MINCHO}`;
      ctx.textAlign = 'left';
      ctx.fillText(`◆ ${k}`, sx + 32, ry);
      drawMakiEText(v, sx + sw - 32, ry, 16.5, 'right', false);
    });

    // 再戦・時代撰びボタン
    const btns = [
      { id: 0, x: px + 96, y: py + 334, w: 216, h: 52, label: isWin ? '再戦する' : '雪辱を果たす' },
      { id: 1, x: px + 348, y: py + 334, w: 216, h: 52, label: '時代・遊び方を替える' }
    ];

    btns.forEach(b => {
      const isHov = (G.hoverSettleBtn === b.id);
      ctx.fillStyle = isHov ? '#3b210f' : '#211208';
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.strokeStyle = isHov ? '#ffe285' : '#b58d3d';
      ctx.lineWidth = isHov ? 2.6 : 1.8;
      ctx.strokeRect(b.x, b.y, b.w, b.h);
      drawMakiEText(b.label, b.x + b.w / 2, b.y + b.h / 2 + 1, 18, 'center', true);
    });

    ctx.restore();
  }

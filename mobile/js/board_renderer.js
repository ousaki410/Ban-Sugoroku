import { KANJI } from './eras.js';
import { canvas, ctx, W, H, scale, offsetX, offsetY, FONT_BRUSH, FONT_MINCHO, NEW_GAME_BTN, CHANGE_ERA_BTN, G, currentEra, B, getLaneGeom, getStoneSlotXY, getTargetSealXY, drawMakiEText } from './state.js';
import { SugorokuCore } from './core.js';
import { renderEraSelectScreen, renderColorSelectModal, renderSettlementOverlay } from './ui_screens.js';

function render() {
    ctx.save();
    ctx.fillStyle = '#090503';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const shakeDX = (Math.random() - 0.5) * G.boardShake;
    const shakeDY = (Math.random() - 0.5) * G.boardShake;
    ctx.translate(offsetX + shakeDX * scale, offsetY + shakeDY * scale);
    ctx.scale(scale, scale);

    if (G.screen === 'SELECT_ERA') {
      renderEraSelectScreen();
      ctx.restore();
      return;
    }

    const mode = currentEra();
    const b = mode.geom;

    // 1. 時代別座敷照明と敷物（緋毛氈／市松茶席／賭場藍染布）
    const roomGlow = ctx.createRadialGradient(W / 2, H * 0.44, 60, W / 2, H * 0.44, 740);
    roomGlow.addColorStop(0, mode.theme.roomGlow[0]);
    roomGlow.addColorStop(1, mode.theme.roomGlow[1]);
    ctx.fillStyle = roomGlow;
    ctx.fillRect(0, 0, W, H);

    drawEraMatAndSurroundings(mode, b);

    // 王手（リーチ）状態の緊迫紅金オーラ
    if (G.oteActive[0] || G.oteActive[1]) {
      const pulse = 0.25 + Math.sin(G.pulseTick * 2.5) * 0.15;
      ctx.save();
      ctx.strokeStyle = G.oteActive[G.humanSide]
        ? `rgba(255, 200, 65, ${pulse + 0.2})`
        : `rgba(220, 45, 30, ${pulse + 0.2})`;
      ctx.lineWidth = 8;
      ctx.strokeRect(b.x - 6, b.y - 6, b.w + 12, b.h + b.wallH + 12);
      ctx.restore();
    }

    // 2. 右側面黒漆壁
    ctx.fillStyle = '#110905';
    ctx.beginPath();
    ctx.moveTo(b.x + b.w, b.y);
    ctx.lineTo(b.x + b.w + b.sideW, b.y + b.sideDY);
    ctx.lineTo(b.x + b.w + b.sideW, b.y + b.h + b.wallH + b.sideDY);
    ctx.lineTo(b.x + b.w, b.y + b.h + b.wallH);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#5c421c';
    ctx.stroke();

    // 3. 時代別・正面胴部と脚部造形
    drawEraCabinetWall(mode, b);

    // 4. 盤面と区分け線
    drawBoardSurfaceAndInlays(mode, b);

    // 5. 大和・折葉用の盤外上がり盆
    if (b.hasTray) {
      drawBearOffTrays(b);
    }

    const legal = (G.screen === 'PLAYING' && G.phase === 'PLAYER_MOVE' && G.turn === G.humanSide)
      ? SugorokuCore.getLegalSteps(G.pts, G.bar, G.off, G.humanSide, G.rem, mode, G.rolledPair)
      : [];
    const movableSources = new Set(legal.map(s => s.from));
    const activeFrom = G.selectedFrom !== null ? G.selectedFrom : G.hoveredFrom;
    const expandedTargets = (G.screen === 'PLAYING' && G.phase === 'PLAYER_MOVE' && G.turn === G.humanSide && activeFrom !== null)
      ? SugorokuCore.getExpandedTargetsForSource(G.pts, G.bar, G.off, G.humanSide, activeFrom, G.rem, mode, G.rolledPair)
      : [];

    if (expandedTargets.length > 0) {
      expandedTargets.forEach(tObj => {
        if (tObj.to === 'off') return;
        const lane = getLaneGeom(tObj.to);
        const isHov = (G.hoveredTargetTo === tObj.to);
        ctx.save();
        ctx.fillStyle = isHov ? 'rgba(255, 215, 90, 0.22)' : 'rgba(240, 185, 65, 0.09)';
        ctx.fillRect(lane.x + 2, lane.y + 2, lane.w - 4, lane.h - 4);
        ctx.restore();
      });
    }

    // 6. 二十四目の石
    for (let i = 0; i < 24; i++) {
      const cnt = G.pts[i];
      if (cnt === 0) continue;
      const player = cnt > 0 ? 0 : 1;
      const absCnt = Math.abs(cnt);
      const canMove = (player === G.humanSide && movableSources.has(i));
      const isSelected = (activeFrom === i);

      for (let k = 0; k < absCnt; k++) {
        const isTop = (k === absCnt - 1);
        const pos = getStoneSlotXY(i, k);
        const liftY = (isTop && isSelected && canMove) ? -5 : 0;
        drawDimpledStone(pos.x, pos.y + liftY, 20, player, isTop && canMove, isTop && isSelected);
      }
    }

    // 7. 中帯の石
    for (let k = 0; k < G.bar[0]; k++) {
      const isTop = (k === G.bar[0] - 1);
      const pos = getStoneSlotXY('bar0', k);
      drawDimpledStone(pos.x, pos.y, 20, 0, G.humanSide === 0 && isTop && movableSources.has('bar'), activeFrom === 'bar');
    }
    for (let k = 0; k < G.bar[1]; k++) {
      const isTop = (k === G.bar[1] - 1);
      const pos = getStoneSlotXY('bar1', k);
      drawDimpledStone(pos.x, pos.y, 20, 1, G.humanSide === 1 && isTop && movableSources.has('bar'), activeFrom === 'bar');
    }

    // 8. 高アーチ軌道・影石・着点印
    if (expandedTargets.length > 0) {
      expandedTargets.forEach((tObj, idx) => {
        drawNonInterferingTarget(activeFrom, tObj, idx, G.hoveredTargetTo === tObj.to);
      });
    }

    // 9. 飛翔中の石
    if (G.flyingStone) {
      const f = G.flyingStone;
      const p = f.t / f.duration;
      const ease = 1 - Math.pow(1 - p, 2);
      const cx = f.sx + (f.tx - f.sx) * ease;
      const cy = f.sy + (f.ty - f.sy) * ease - Math.sin(p * Math.PI) * 58;
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.ellipse(f.sx + (f.tx - f.sx) * ease, f.sy + (f.ty - f.sy) * ease + 18, 22, 16, 0, 0, Math.PI * 2);
      ctx.fill();
      drawDimpledStone(cx, cy, 21.5, f.player, true, true);
    }

    // 10. 時代別の振筒と賽
    drawEraShakerAndDice(mode);

    // 11. 木札と算木札
    drawWoodPlaquesAndCounters(mode, b);

    // 12. 朱印スタンプ
    if (G.stamp && G.stamp.alpha > 0) drawCalloutStamp(b);

    if (G.screen === 'SELECT_COLOR') {
      renderColorSelectModal();
    } else if (G.phase === 'SETTLEMENT') {
      renderSettlementOverlay();
    }

    ctx.restore();
  }

  // 時代別の敷物と周囲の小道具（市松茶席畳、寛永通宝銅銭、暈繝縁など）
  function drawEraMatAndSurroundings(mode, b) {
    ctx.save();
    const feltExtraW = b.hasTray ? 185 : 84;
    const mx = b.x - 42, my = b.y + 24, mw = b.w + b.sideW + feltExtraW, mh = b.h + b.wallH + 38;

    ctx.fillStyle = mode.theme.feltColor;
    ctx.beginPath();
    ctx.roundRect(mx, my, mw, mh, 8);
    ctx.fill();

    if (b.style === 'heian') {
      // 平安・寝殿造の暈繝縁（うんげんべり）錦帯
      ctx.strokeStyle = '#c99b3b';
      ctx.lineWidth = 4;
      ctx.strokeRect(mx + 6, my + 6, mw - 12, mh - 12);
    } else if (b.style === 'oriha') {
      // 茶席の市松模様（チェッカー織）敷布
      ctx.fillStyle = 'rgba(12, 24, 16, 0.35)';
      const sq = 28;
      for (let x = mx; x < mx + mw; x += sq) {
        for (let y = my; y < my + mh; y += sq) {
          if (((Math.floor(x / sq) + Math.floor(y / sq)) % 2) === 0) {
            ctx.fillRect(x, y, Math.min(sq, mx + mw - x), Math.min(sq, my + mh - y));
          }
        }
      }
    } else if (b.style === 'chonin') {
      // 江戸深川賭場：盆ござの上に散らばる「寛永通宝」銅銭
      const coins = [
        [mx + 22, my + 48], [mx + 28, my + 82], [mx + mw - 28, my + mh - 42], [mx + mw - 52, my + mh - 28]
      ];
      coins.forEach(([cx, cy]) => {
        ctx.fillStyle = '#9c7834';
        ctx.beginPath(); ctx.arc(cx, cy, 11, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#3b280c'; ctx.lineWidth = 1.2; ctx.stroke();
        ctx.fillStyle = '#162436';
        ctx.fillRect(cx - 3.5, cy - 3.5, 7, 7);
      });
    }

    ctx.strokeStyle = '#70441d';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(mx, my, mw, mh);
    ctx.restore();
  }

  function drawEraCabinetWall(mode, b) {
    const fx = b.x, fy = b.y + b.h, fw = b.w, fh = b.wallH;
    ctx.save();
    const g = ctx.createLinearGradient(fx, fy, fx, fy + fh);
    g.addColorStop(0, mode.theme.wallStops[0]);
    g.addColorStop(0.5, mode.theme.wallStops[1]);
    g.addColorStop(1, mode.theme.wallStops[2]);
    ctx.fillStyle = g;
    ctx.fillRect(fx, fy, fw, fh);

    ctx.strokeStyle = '#6e5023';
    ctx.lineWidth = 2;
    ctx.strokeRect(fx, fy, fw, fh);

    ctx.beginPath();
    ctx.rect(fx + 4, fy + 4, fw - 8, fh - 8);
    ctx.clip();

    const cx = fx + fw / 2, cy = fy + fh / 2;

    if (b.style === 'heian') {
      // 【壱・平安朝】：正倉院紫檀木画双六局の「床脚（格狭間透かし彫り台座）」と象牙唐花菱木画
      ctx.strokeStyle = 'rgba(245, 225, 185, 0.65)';
      ctx.lineWidth = 1.4;
      // 上縁の象牙木画連珠紋
      for (let x = fx + 24; x < fx + fw - 20; x += 36) {
        ctx.beginPath();
        ctx.moveTo(x, fy + 8);
        ctx.lineTo(x + 10, fy + 16);
        ctx.lineTo(x, fy + 24);
        ctx.lineTo(x - 10, fy + 16);
        ctx.closePath();
        ctx.stroke();
      }
      // 格狭間（こうざま）の透かし床脚 3 基
      ctx.fillStyle = '#060202';
      ctx.strokeStyle = '#d9b05b';
      ctx.lineWidth = 2;
      [-260, 0, 260].forEach(dx => {
        ctx.beginPath();
        ctx.moveTo(cx + dx - 82, fy + fh);
        ctx.quadraticCurveTo(cx + dx - 72, fy + 32, cx + dx, fy + 28);
        ctx.quadraticCurveTo(cx + dx + 72, fy + 32, cx + dx + 82, fy + fh);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      });
    } else if (b.style === 'jike') {
      // 【弐・寺家比叡山】：八葉蓮華座＋不動明王梵字「憾」＋左右に八輻法輪と五鈷杵
      ctx.strokeStyle = 'rgba(218, 175, 78, 0.58)';
      ctx.fillStyle = 'rgba(218, 175, 78, 0.20)';
      ctx.lineWidth = 1.5;
      for (let i = -3; i <= 3; i++) {
        ctx.beginPath();
        ctx.ellipse(cx + i * 22, cy + 18, 14, 36, i * 0.18, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      drawMakiEText('憾', cx, cy + 4, 44, 'center', true);
      [-235, 235].forEach(dx => {
        ctx.beginPath();
        ctx.arc(cx + dx, cy, 30, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx + dx, cy, 10, 0, Math.PI * 2);
        ctx.stroke();
        for (let k = 0; k < 8; k++) {
          const a = (Math.PI / 4) * k;
          ctx.beginPath();
          ctx.moveTo(cx + dx + Math.cos(a) * 10, cy + Math.sin(a) * 10);
          ctx.lineTo(cx + dx + Math.cos(a) * 30, cy + Math.sin(a) * 30);
          ctx.stroke();
        }
      });
    } else if (b.style === 'muromachi') {
      // 【参・室町幕府】：完全復元の「六角亀甲＋六弁鉄線蓮花蒔絵」＆「公家の和扇（檜扇）」
      ctx.strokeStyle = 'rgba(198, 154, 66, 0.42)';
      ctx.fillStyle = 'rgba(198, 154, 66, 0.22)';
      ctx.lineWidth = 1.2;

      const hexList = [
        [fx + 95, fy + 46], [fx + 135, fy + 70], [fx + 95, fy + 94],
        [fx + 225, fy + 58], [fx + fw - 225, fy + 58],
        [fx + fw - 135, fy + 70], [fx + fw - 95, fy + 46], [fx + fw - 95, fy + 94]
      ];
      hexList.forEach(([hx, hy]) => {
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = (Math.PI / 3) * i + Math.PI / 6;
          const px = hx + Math.cos(a) * 22, py = hy + Math.sin(a) * 22;
          if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();

        // 亀甲内部の六弁「鉄線花」金蒔絵を完全復元
        ctx.save();
        ctx.translate(hx, hy);
        for (let i = 0; i < 6; i++) {
          ctx.rotate(Math.PI / 3);
          ctx.beginPath();
          ctx.ellipse(0, 6, 2.5, 5, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      });

      drawKugeFoldingFan(cx, fy + fh * 0.78);
    } else if (b.style === 'momoyama') {
      // 【肆・安土桃山】：金泥青海波（せいがいは）と青貝螺鈿の五七桐紋
      ctx.strokeStyle = 'rgba(212, 168, 72, 0.32)';
      ctx.lineWidth = 1.2;
      for (let row = 0; row < 3; row++) {
        for (let x = fx + 30; x < fx + fw - 20; x += 48) {
          const wx = x + (row % 2) * 24;
          const wy = fy + 38 + row * 34;
          [18, 12, 6].forEach(r => {
            ctx.beginPath();
            ctx.arc(wx, wy, r, Math.PI, 0, false);
            ctx.stroke();
          });
        }
      }
      // 中央と左右に青貝螺鈿（エメラルド箔）の桐紋・花紋メダリオン
      [-210, 0, 210].forEach((dx, idx) => {
        const mr = idx === 1 ? 36 : 26;
        ctx.fillStyle = '#090604';
        ctx.beginPath(); ctx.arc(cx + dx, cy, mr, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#8ce6d4'; ctx.lineWidth = 2; ctx.stroke();
        // 桐の三葉立姿
        ctx.fillStyle = 'rgba(140, 230, 212, 0.65)';
        ctx.fillRect(cx + dx - 3, cy - mr * 0.55, 6, mr * 1.1);
        ctx.fillRect(cx + dx - 12, cy - mr * 0.35, 5, mr * 0.85);
        ctx.fillRect(cx + dx + 7, cy - mr * 0.35, 5, mr * 0.85);
      });
    } else if (b.style === 'oriha') {
      // 【伍・江戸茶席】：二つ折り薄盤の真鍮蝶番（ちょうつがい）と留め具
      ctx.fillStyle = '#c59b41';
      ctx.fillRect(cx - 28, fy + 3, 56, fh - 6);
      ctx.strokeStyle = '#2b1906';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(cx - 28, fy + 3, 56, fh - 6);
      ctx.beginPath();
      ctx.moveTo(cx, fy + 3); ctx.lineTo(cx, fy + fh - 3);
      ctx.stroke();
      // 蝶番の鋲
      [-18, -8, 8, 18].forEach(dx => {
        ctx.fillStyle = '#3b2408';
        ctx.beginPath(); ctx.arc(cx + dx, cy, 2.2, 0, Math.PI * 2); ctx.fill();
      });
    } else if (b.style === 'chonin') {
      // 【陸・江戸町人賭場】：黒鉄鋲打ち隅金具と荒縄（麻縄）の引手環
      ctx.fillStyle = '#1f1c19';
      ctx.fillRect(fx, fy, 52, fh);
      ctx.fillRect(fx + fw - 52, fy, 52, fh);
      ctx.fillStyle = '#8c7f70';
      [fy + 22, fy + fh / 2, fy + fh - 22].forEach(ry => {
        ctx.beginPath(); ctx.arc(fx + 26, ry, 4, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(fx + fw - 26, ry, 4, 0, Math.PI * 2); ctx.fill();
      });
      // 中央の黒鉄座金と太い麻縄引手
      ctx.fillStyle = '#1a1612';
      ctx.beginPath(); ctx.arc(cx, cy - 8, 16, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#6e6256'; ctx.lineWidth = 2.5; ctx.stroke();
      ctx.strokeStyle = '#b59862';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(cx, cy + 10, 22, 0.15 * Math.PI, 0.85 * Math.PI, false);
      ctx.stroke();
    }

    ctx.restore();
  }

  // 完全復元の「公家和扇（檜扇・二色組紐・朱霞・十一本扇骨・折り目）」
  function drawKugeFoldingFan(cx, pivotY) {
    ctx.save();
    const rOuter = 68;
    const rInner = 22;
    const startAngle = -Math.PI * 0.80;
    const endAngle = -Math.PI * 0.20;
    const ribCount = 11;

    // 1. 両側に垂れる公家飾り組紐（朱紅と金線の二重流蘇）
    ctx.strokeStyle = '#9e2a1f';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(cx - 16, pivotY - 6);
    ctx.bezierCurveTo(cx - 48, pivotY + 12, cx - 56, pivotY - 24, cx - 86, pivotY + 6);
    ctx.moveTo(cx + 16, pivotY - 6);
    ctx.bezierCurveTo(cx + 48, pivotY + 12, cx + 56, pivotY - 24, cx + 86, pivotY + 6);
    ctx.stroke();

    ctx.strokeStyle = '#c99b3b';
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(cx - 18, pivotY - 4);
    ctx.bezierCurveTo(cx - 44, pivotY + 16, cx - 54, pivotY - 18, cx - 82, pivotY + 10);
    ctx.moveTo(cx + 18, pivotY - 4);
    ctx.bezierCurveTo(cx + 44, pivotY + 16, cx + 54, pivotY - 18, cx + 82, pivotY + 10);
    ctx.stroke();

    // 2. 金泥扇面
    const fanGrad = ctx.createRadialGradient(cx, pivotY, rInner, cx, pivotY, rOuter);
    fanGrad.addColorStop(0, '#593e16');
    fanGrad.addColorStop(0.35, '#b88c38');
    fanGrad.addColorStop(0.75, '#e0b85c');
    fanGrad.addColorStop(1, '#966d22');

    ctx.beginPath();
    ctx.arc(cx, pivotY, rOuter, startAngle, endAngle, false);
    ctx.arc(cx, pivotY, rInner, endAngle, startAngle, true);
    ctx.closePath();
    ctx.fillStyle = fanGrad;
    ctx.fill();
    ctx.strokeStyle = '#f5d986';
    ctx.lineWidth = 1.6;
    ctx.stroke();

    // 扇面上の朱霞と瑞雲紋
    ctx.save();
    ctx.clip();
    ctx.fillStyle = 'rgba(142, 28, 18, 0.48)';
    ctx.beginPath();
    ctx.ellipse(cx - 18, pivotY - 44, 24, 7, -0.25, 0, Math.PI * 2);
    ctx.ellipse(cx + 20, pivotY - 38, 22, 6, 0.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 3. 放射状檜扇骨（11本）と扇面の山折り・谷折り陰影線
    for (let i = 0; i < ribCount; i++) {
      const a = startAngle + (endAngle - startAngle) * (i / (ribCount - 1));
      ctx.beginPath();
      ctx.moveTo(cx, pivotY);
      ctx.lineTo(cx + Math.cos(a) * rInner, pivotY + Math.sin(a) * rInner);
      ctx.strokeStyle = (i === 0 || i === ribCount - 1) ? '#e8c26b' : 'rgba(224, 184, 92, 0.72)';
      ctx.lineWidth = (i === 0 || i === ribCount - 1) ? 2.2 : 1.1;
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * rInner, pivotY + Math.sin(a) * rInner);
      ctx.lineTo(cx + Math.cos(a) * rOuter, pivotY + Math.sin(a) * rOuter);
      ctx.strokeStyle = i % 2 === 0 ? 'rgba(60, 36, 8, 0.42)' : 'rgba(255, 240, 190, 0.35)';
      ctx.lineWidth = 1.0;
      ctx.stroke();
    }

    // 4. 扇要（かなめ）
    ctx.beginPath();
    ctx.arc(cx, pivotY, 4.2, 0, Math.PI * 2);
    ctx.fillStyle = '#fae094';
    ctx.fill();
    ctx.strokeStyle = '#3b2408';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.restore();
  }

  function drawBoardSurfaceAndInlays(mode, b) {
    const laneW = b.w / 12;
    const laneH = (b.h - b.midH) / 2;
    ctx.save();
    const g = ctx.createLinearGradient(b.x, b.y, b.x, b.y + b.h);
    g.addColorStop(0, mode.theme.woodStops[0]);
    g.addColorStop(0.5, mode.theme.woodStops[1]);
    g.addColorStop(1, mode.theme.woodStops[2]);
    ctx.fillStyle = g;
    ctx.fillRect(b.x, b.y, b.w, b.h);

    ctx.strokeStyle = 'rgba(48, 26, 9, 0.14)';
    ctx.lineWidth = 1;
    for (let y = b.y + 6; y < b.y + b.h; y += 5) {
      ctx.beginPath();
      ctx.moveTo(b.x, y);
      ctx.bezierCurveTo(
        b.x + b.w * 0.3, y + Math.sin(y * 0.07) * 3,
        b.x + b.w * 0.7, y - Math.cos(y * 0.07) * 3,
        b.x + b.w, y
      );
      ctx.stroke();
    }

    if (!mode.isOimawashi) {
      const rightHalfX = b.x + b.w / 2;
      ctx.fillStyle = 'rgba(255, 225, 145, 0.06)';
      ctx.fillRect(rightHalfX, b.y, b.w / 2, laneH);
      ctx.fillRect(rightHalfX, b.y + laneH + b.midH, b.w / 2, laneH);
    }

    const midTop = b.y + laneH;
    const midBot = midTop + b.midH;
    ctx.strokeStyle = mode.theme.lineColor;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(b.x + 8, midTop); ctx.lineTo(b.x + b.w - 8, midTop);
    ctx.moveTo(b.x + 8, midBot); ctx.lineTo(b.x + b.w - 8, midBot);
    ctx.stroke();

    for (let c = 1; c <= 11; c++) {
      const x = b.x + c * laneW;
      const gap = 11;
      ctx.beginPath();
      ctx.moveTo(x, b.y + 8);
      ctx.lineTo(x, b.y + laneH / 2 - gap);
      ctx.moveTo(x, b.y + laneH / 2 + gap);
      ctx.lineTo(x, midTop);

      ctx.moveTo(x, midBot);
      ctx.lineTo(x, midBot + laneH / 2 - gap);
      ctx.moveTo(x, midBot + laneH / 2 + gap);
      ctx.lineTo(x, b.y + b.h - 8);
      ctx.stroke();
    }

    // 伍・折葉の「蝶番折盤」は中央に二つ折り継ぎ目と上縁の真鍮蝶番金具を描画
    if (b.style === 'oriha') {
      const seamX = b.x + 6 * laneW;
      ctx.strokeStyle = '#241407';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(seamX, b.y);
      ctx.lineTo(seamX, b.y + b.h);
      ctx.stroke();
      ctx.fillStyle = '#c59b41';
      ctx.fillRect(seamX - 18, b.y, 36, 7);
      ctx.fillRect(seamX - 18, midTop + b.midH / 2 - 5, 36, 10);
    }

    ctx.fillStyle = b.style === 'momoyama' ? 'rgba(215, 245, 238, 0.68)' : 'rgba(42, 22, 6, 0.65)';
    ctx.font = `600 13.5px ${FONT_MINCHO}`;
    ctx.textAlign = 'right';
    if (mode.isOimawashi) {
      ctx.fillText('◄ 周回追撃 ── 黒乞い目 二・五 ／ 白乞い目 三・四', b.x + b.w - 14, midTop + 20);
      ctx.fillText('共通飛び目 一・六・重目 ►', b.x + b.w - 14, midBot - 9);
    } else {
      ctx.fillText('▲ 白の内陣・奥一〜六', b.x + b.w - 14, midTop + 19);
      ctx.fillText('▼ 黒の内陣・手前一〜六', b.x + b.w - 14, midBot - 9);
    }

    const starX = b.x + 6 * laneW;
    if (b.style === 'heian') {
      ctx.fillStyle = '#f7efe0';
      [midTop + 14, midBot - 14].forEach(sy => {
        ctx.beginPath(); ctx.arc(starX, sy, 7, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = mode.theme.woodStops[1];
        ctx.beginPath(); ctx.arc(starX + 3, sy - 1, 5.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#f7efe0';
      });
    } else {
      [midTop + 12, midBot - 12].forEach(sy => {
        ctx.fillStyle = mode.theme.lineColor;
        ctx.beginPath(); ctx.arc(starX, sy, 2.3, 0, Math.PI * 2); ctx.fill();
        for (let i = 0; i < 6; i++) {
          const a = (Math.PI / 3) * i;
          ctx.beginPath();
          ctx.arc(starX + Math.cos(a) * 6.2, sy + Math.sin(a) * 6.2, 2.0, 0, Math.PI * 2);
          ctx.fill();
        }
      });
    }

    ctx.strokeStyle = '#38200d';
    ctx.lineWidth = 4;
    ctx.strokeRect(b.x, b.y, b.w, b.h);
    ctx.restore();
  }

  function drawBearOffTrays(b) {
    const tx = b.trayX, tw = b.trayW, th = 195;
    ctx.save();
    ctx.fillStyle = '#170e07';
    ctx.fillRect(tx, b.y + 8, tw, th);
    ctx.strokeStyle = '#9e7830';
    ctx.lineWidth = 2;
    ctx.strokeRect(tx, b.y + 8, tw, th);
    drawMakiEText('白・上がり盆', tx + tw / 2, b.y + 28, 13.5, 'center', true);
    for (let i = 0; i < G.off[1]; i++) {
      const pos = getStoneSlotXY('off1', i);
      drawDimpledStone(pos.x, pos.y, 12.5, 1, false, false);
    }

    const by = b.y + b.h - th - 8;
    ctx.fillStyle = '#170e07';
    ctx.fillRect(tx, by, tw, th);
    ctx.strokeStyle = '#c99b3b';
    ctx.lineWidth = 2;
    ctx.strokeRect(tx, by, tw, th);
    drawMakiEText('黒・上がり盆', tx + tw / 2, by + 20, 13.5, 'center', true);
    for (let i = 0; i < G.off[0]; i++) {
      const pos = getStoneSlotXY('off0', i);
      drawDimpledStone(pos.x, pos.y, 12.5, 0, false, false);
    }
    ctx.restore();
  }

export function drawDimpledStone(x, y, r, player, canMove, isSelected) {
    ctx.save();
    const h = 6.5;
    ctx.fillStyle = 'rgba(0,0,0,0.52)';
    ctx.beginPath();
    ctx.ellipse(x + 2.5, y + h + 2.5, r, r * 0.84, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = player === 0 ? '#110e0c' : '#b8a484';
    ctx.beginPath();
    ctx.ellipse(x, y + h, r, r * 0.84, 0, 0, Math.PI * 2);
    ctx.fill();

    const g = ctx.createRadialGradient(x - r * 0.28, y - r * 0.28, r * 0.1, x, y, r);
    if (player === 0) {
      g.addColorStop(0, '#4f4842');
      g.addColorStop(0.5, '#24201d');
      g.addColorStop(1, '#100d0b');
    } else {
      g.addColorStop(0, '#fdfaf2');
      g.addColorStop(0.65, '#eadcc4');
      g.addColorStop(1, '#c7b392');
    }
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * 0.84, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.ellipse(x, y, r * 0.45, r * 0.37, 0, 0, Math.PI * 2);
    ctx.fillStyle = player === 0 ? '#14110f' : '#cfc0a2';
    ctx.fill();
    ctx.strokeStyle = player === 0 ? 'rgba(255,255,255,0.18)' : 'rgba(90,65,35,0.38)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    if (canMove) {
      const pulse = 0.72 + Math.sin(G.pulseTick * 2) * 0.28;
      ctx.beginPath();
      ctx.ellipse(x, y, r + 2.8, (r + 2.8) * 0.84, 0, 0, Math.PI * 2);
      ctx.strokeStyle = isSelected ? '#fff6b3' : `rgba(242, 188, 64, ${pulse})`;
      ctx.lineWidth = isSelected ? 3.8 : 2.4;
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawNonInterferingTarget(activeFrom, targetObj, rankIdx, isHovered) {
    const b = B();
    const srcSlot = activeFrom === 'bar'
      ? Math.max(0, G.bar[G.humanSide] - 1)
      : Math.max(0, Math.abs(G.pts[activeFrom]) - 1);
    const barKey = G.humanSide === 0 ? 'bar0' : 'bar1';
    const sXY = getStoneSlotXY(activeFrom === 'bar' ? barKey : activeFrom, srcSlot);
    const tPos = getTargetSealXY(targetObj);

    ctx.save();
    ctx.globalAlpha = isHovered ? 0.75 : 0.42;
    drawDimpledStone(tPos.stoneX, tPos.stoneY, 19.5, G.humanSide, false, false);
    ctx.globalAlpha = 1.0;

    const midY = b.y + b.h / 2;
    const archPull = 55 + rankIdx * 38;
    const isTopDest = targetObj.to === 'off' ? (G.humanSide === 1) : (targetObj.to >= 12);
    const ctrlY = isTopDest
      ? Math.min(midY + 20, Math.max(sXY.y, tPos.sealY) + archPull)
      : Math.max(midY - 20, Math.min(sXY.y, tPos.sealY) - archPull);

    const strokeCol = targetObj.isCombined
      ? (isHovered ? '#b8ffda' : 'rgba(130, 235, 180, 0.85)')
      : (targetObj.isFar
          ? (isHovered ? '#ffdf9e' : 'rgba(255, 165, 95, 0.88)')
          : (isHovered ? '#fff6a8' : 'rgba(255, 222, 115, 0.85)'));

    ctx.strokeStyle = strokeCol;
    ctx.lineWidth = isHovered ? 3.2 : 2.2;
    ctx.setLineDash(targetObj.isCombined ? [3, 3] : [7, 4]);
    ctx.beginPath();
    ctx.moveTo(sXY.x, sXY.y);
    ctx.quadraticCurveTo((sXY.x + tPos.sealX) / 2, ctrlY, tPos.sealX, tPos.sealY);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.strokeStyle = 'rgba(255, 220, 120, 0.5)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(tPos.sealX, tPos.sealY);
    ctx.lineTo(tPos.stoneX, tPos.stoneY);
    ctx.stroke();

    const bw = targetObj.label.length >= 4 ? 72 : 58;
    const bh = 28;
    const bx = tPos.sealX - bw / 2;
    const by = tPos.sealY - bh / 2;

    ctx.fillStyle = isHovered ? 'rgba(255, 215, 90, 0.45)' : 'rgba(240, 180, 55, 0.22)';
    ctx.beginPath();
    ctx.ellipse(tPos.sealX, tPos.sealY, bw * 0.62, bh * 0.78, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = targetObj.isCombined
      ? (isHovered ? '#173828' : '#0f261b')
      : (targetObj.isFar
          ? (isHovered ? '#591a12' : '#3d100a')
          : (isHovered ? '#38220d' : '#211307'));
    ctx.fillRect(bx, by, bw, bh);

    ctx.strokeStyle = isHovered ? '#fff5ad' : (targetObj.isFar ? '#f09c67' : '#e0b34c');
    ctx.lineWidth = isHovered ? 2.6 : 1.8;
    ctx.strokeRect(bx, by, bw, bh);

    drawMakiEText(targetObj.label, tPos.sealX, tPos.sealY + 1, 14.5, 'center', true);
    ctx.restore();
  }

  function drawEraShakerAndDice(mode) {
    const cx = G.tube.baseX + G.tube.dx;
    const cy = G.tube.baseY + G.tube.dy;
    const cupType = mode.sfx.cupType;

    ctx.save();
    if (!G.tube.tipped) {
      if (G.phase === 'WAIT_ROLL' && G.turn === G.humanSide) {
        const ringAlpha = G.tubeHintFlash > 0
          ? Math.min(1, G.tubeHintFlash)
          : (G.tube.hovering ? 0.85 : (0.35 + Math.sin(G.pulseTick * 1.6) * 0.2));
        const ringRadius = G.tubeHintFlash > 0 ? 44 + G.tubeHintFlash * 12 : 42;
        ctx.save();
        ctx.strokeStyle = `rgba(246, 204, 92, ${ringAlpha})`;
        ctx.fillStyle = `rgba(246, 204, 92, ${ringAlpha * 0.18})`;
        ctx.lineWidth = G.tube.hovering || G.tubeHintFlash > 0 ? 2.8 : 1.8;
        ctx.beginPath();
        ctx.ellipse(cx, cy + 4, ringRadius, ringRadius * 0.58, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }

      ctx.translate(cx, cy);
      ctx.rotate(G.tube.angle);

      const isHeld = (G.phase === 'PLAYER_HOLD_TUBE' || G.phase === 'AI_SHAKE_TUBE');
      ctx.fillStyle = isHeld ? 'rgba(0,0,0,0.38)' : 'rgba(0,0,0,0.55)';
      ctx.beginPath();
      ctx.ellipse(isHeld ? 18 : 12, isHeld ? 22 : 10, isHeld ? 28 : 24, isHeld ? 17 : 15, 0, 0, Math.PI * 2);
      ctx.fill();

      if (cupType === 'iron_bowl' || cupType === 'teacup') {
        const r = 30;
        const g = ctx.createRadialGradient(-8, -22, 4, 0, -18, r);
        if (cupType === 'iron_bowl') {
          g.addColorStop(0, '#57524a');
          g.addColorStop(0.6, '#26231f');
          g.addColorStop(1, '#12100e');
        } else {
          g.addColorStop(0, '#d9cfc1');
          g.addColorStop(0.65, '#8f8272');
          g.addColorStop(1, '#4f463c');
        }
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, -18, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = cupType === 'iron_bowl' ? '#b89448' : '#36526e';
        ctx.lineWidth = 2;
        ctx.stroke();
      } else {
        const tw = 38, th = 98;
        const g = ctx.createLinearGradient(-tw / 2, 0, tw / 2, 0);
        g.addColorStop(0, '#140c07');
        g.addColorStop(0.38, cupType === 'horn' ? '#52221a' : '#3b2414');
        g.addColorStop(0.75, '#190e07');
        g.addColorStop(1, '#090402');
        ctx.fillStyle = g;
        ctx.fillRect(-tw / 2, -th + 8, tw, th);

        ctx.strokeStyle = 'rgba(212, 168, 76, 0.55)';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(-tw / 2, -th + 26); ctx.lineTo(tw / 2, -th + 26);
        ctx.moveTo(-tw / 2, -16); ctx.lineTo(tw / 2, -16);
        ctx.stroke();

        ctx.beginPath();
        ctx.ellipse(0, 8, tw / 2, 8.5, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.ellipse(0, -th + 8, tw / 2, 8.5, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#4f2912';
        ctx.fill();
        ctx.strokeStyle = G.tube.hovering || isHeld ? '#ffe280' : '#a8823c';
        ctx.lineWidth = G.tube.hovering || isHeld ? 2.4 : 1.5;
        ctx.stroke();
      }

      if (G.phase === 'WAIT_ROLL' && G.turn === G.humanSide) {
        ctx.fillStyle = 'rgba(18, 10, 4, 0.92)';
        ctx.fillRect(-62, 16, 124, 24);
        ctx.strokeStyle = G.tube.hovering ? '#ffe280' : '#b88b38';
        ctx.lineWidth = 1.3;
        ctx.strokeRect(-62, 16, 124, 24);
        drawMakiEText('長押しで振る', 0, 28, 14.5, 'center', true);
      } else if (G.phase === 'PLAYER_HOLD_TUBE') {
        ctx.fillStyle = 'rgba(28, 14, 5, 0.94)';
        ctx.fillRect(-66, 18, 132, 24);
        ctx.strokeStyle = '#ffe280';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(-66, 18, 132, 24);
        drawMakiEText('離して投擲', 0, 30, 15, 'center', true);
      }
    } else {
      ctx.save();
      ctx.translate(G.tube.baseX - 55, G.tube.baseY);
      ctx.rotate(0.18);
      ctx.fillStyle = 'rgba(0,0,0,0.48)';
      ctx.fillRect(-44, -12, 88, 30);

      const g = ctx.createLinearGradient(0, -15, 0, 15);
      g.addColorStop(0, '#140c07');
      g.addColorStop(0.45, '#3b2414');
      g.addColorStop(1, '#0c0603');
      ctx.fillStyle = g;
      ctx.fillRect(-46, -15, 88, 30);

      ctx.beginPath();
      ctx.ellipse(42, 0, 7, 15, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#241208';
      ctx.fill();
      ctx.strokeStyle = '#8c6b32';
      ctx.stroke();
      ctx.restore();

      G.physDice.forEach(d => drawBoneDie3D(d.x, d.y, 32, d.val, d.rot));
    }
    ctx.restore();
  }

  function drawBoneDie3D(x, y, s, val, rot) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot * 0.12);

    ctx.fillStyle = 'rgba(0,0,0,0.52)';
    ctx.fillRect(-s / 2 + 3, -s / 2 + 4, s, s);

    ctx.fillStyle = '#f2e5c9';
    ctx.fillRect(-s / 2, -s / 2, s, s);
    ctx.strokeStyle = '#6b5331';
    ctx.lineWidth = 1.6;
    ctx.strokeRect(-s / 2, -s / 2, s, s);

    const q = s * 0.25;
    const pts = {
      1: [[0, 0]],
      2: [[-q, -q], [q, q]],
      3: [[-q, -q], [0, 0], [q, q]],
      4: [[-q, -q], [q, -q], [-q, q], [q, q]],
      5: [[-q, -q], [q, -q], [0, 0], [-q, q], [q, q]],
      6: [[-q, -q], [q, -q], [-q, 0], [q, 0], [-q, q], [q, q]]
    }[val] || [];

    pts.forEach(([px, py]) => {
      ctx.beginPath();
      ctx.fillStyle = (val === 1 || val === 4) ? '#a81c14' : '#17110b';
      ctx.arc(px, py, val === 1 ? 5.0 : 3.1, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  }

  function drawWoodPlaquesAndCounters(mode, b) {
    ctx.save();
    const pw = 760, ph = 42;
    const px = (W - pw) / 2, py = 18;

    const g = ctx.createLinearGradient(px, py, px, py + ph);
    g.addColorStop(0, '#1f1209');
    g.addColorStop(1, '#0e0703');
    ctx.fillStyle = g;
    ctx.fillRect(px, py, pw, ph);
    ctx.strokeStyle = '#8f6c30';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(px, py, pw, ph);

    drawMakiEText(G.statusText, px + pw / 2, py + ph / 2 + 1, 16.5, 'center', true);

    const tot = KANJI[mode.stoneCount];
    let bLabel = '黒・内陣', wLabel = '白・内陣';
    let bVal = `${KANJI[SugorokuCore.countInner(G.pts, 0)]}／${tot}`;
    let wVal = `${KANJI[SugorokuCore.countInner(G.pts, 1)]}／${tot}`;

    if (mode.canBearOff) {
      bLabel = '黒・上がり'; wLabel = '白・上がり';
      bVal = `${KANJI[G.off[0]]}／${tot}`;
      wVal = `${KANJI[G.off[1]]}／${tot}`;
    } else if (mode.isOimawashi) {
      bLabel = '黒・討取'; wLabel = '白・討取';
      bVal = `${KANJI[G.off[0]]}／六`;
      wVal = `${KANJI[G.off[1]]}／六`;
    }

    drawSideTallyPlaque(42, b.y + 130, bLabel, bVal, 0, G.humanSide === 0 ? '貴殿' : '相手', G.oteActive[0]);
    drawSideTallyPlaque(1134, b.y + 130, wLabel, wVal, 1, G.humanSide === 1 ? '貴殿' : '相手', G.oteActive[1]);

    [
      { btn: NEW_GAME_BTN, text: '新局' },
      { btn: CHANGE_ERA_BTN, text: '時代替' }
    ].forEach(({ btn, text }) => {
      ctx.fillStyle = '#1d1007';
      ctx.fillRect(btn.x, btn.y, btn.w, btn.h);
      ctx.strokeStyle = '#b58d3d';
      ctx.lineWidth = 1.8;
      ctx.strokeRect(btn.x, btn.y, btn.w, btn.h);
      drawMakiEText(text, btn.x + btn.w / 2, btn.y + btn.h / 2 + 1, 17, 'center', true);
    });
    ctx.restore();
  }

  function drawSideTallyPlaque(x, y, title, countStr, player, roleTag, isOte) {
    const w = 104, h = 166;
    ctx.save();
    ctx.fillStyle = 'rgba(18, 10, 5, 0.92)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = isOte ? '#ff5938' : (player === G.humanSide ? '#d4a64a' : '#755624');
    ctx.lineWidth = isOte ? 2.6 : (player === G.humanSide ? 2.0 : 1.4);
    ctx.strokeRect(x, y, w, h);

    drawDimpledStone(x + w / 2, y + 26, 12, player, false, false);
    drawMakiEText(roleTag, x + w / 2, y + 54, 13.5, 'center', false, 0.88);
    drawMakiEText(title, x + w / 2, y + 84, 15.5, 'center', true);
    drawMakiEText(countStr, x + w / 2, y + 118, 17, 'center', false);
    if (isOte) {
      drawMakiEText('◆ 王手 ◆', x + w / 2, y + 148, 14, 'center', true);
    }
    ctx.restore();
  }

  function drawCalloutStamp(b) {
    const s = G.stamp;
    const a = Math.min(1, s.alpha);
    ctx.save();
    ctx.globalAlpha = a;
    const w = 360, h = 86;
    const x = b.x + (b.w - w) / 2;
    const y = b.y + 62;

    ctx.fillStyle = 'rgba(14, 8, 4, 0.94)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#c99b3b';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);

    ctx.strokeStyle = 'rgba(168, 28, 20, 0.75)';
    ctx.lineWidth = 1.8;
    ctx.strokeRect(x + 14, y + 14, 24, 24);
    ctx.fillStyle = 'rgba(168, 28, 20, 0.75)';
    ctx.font = `13px ${FONT_BRUSH}`;
    ctx.textAlign = 'center';
    ctx.fillText(currentEra().numKanji, x + 26, y + 30);

    drawMakiEText(s.text, x + w / 2, y + 32, 28, 'center', true, a);
    if (s.sub) {
      drawMakiEText(s.sub, x + w / 2, y + 64, 14.5, 'center', false, a * 0.92);
    }
    ctx.restore();
  }

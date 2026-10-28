import { ERA_MODES, KANJI, DEME_NAMES } from './eras.js';
import { canvas, W, H, NEW_GAME_BTN, CHANGE_ERA_BTN, G, currentEra, B, getLaneGeom, getStoneSlotXY, getTargetSealXY, showStamp, toBoardXY, isInsideRect } from './state.js';
import { playSingleRattleGrain, playDiceBounce, playStoneLift, playStoneImpact, playOteClimaxSound, playVictoryFanfare, playDefeatBell } from './audio.js';
import { SugorokuCore } from './core.js';
import { getEraCardRect } from './ui_screens.js';
import { render } from './board_renderer.js';

function startMatch() {
    const mode = currentEra();
    const b = mode.geom;
    G.pts.fill(0);
    mode.setup(G.pts);
    G.bar = [0, 0];
    G.off = [0, 0];
    G.turn = 0;
    G.dice = [0, 0];
    G.rem = [];
    G.rolledPair = false;
    G.selectedFrom = null;
    G.hoveredFrom = null;
    G.hoveredTargetTo = null;
    G.winner = -1;
    G.winReason = '';
    G.oteAlerted = [false, false];
    G.oteActive = [false, false];
    G.stats = { turns: 1, hits: 0, doubles: 0 };
    G.tube.baseX = b.x + b.w / 2;
    G.tube.baseY = b.y + b.h / 2;
    G.tube.tipped = false;
    G.tube.dx = 0; G.tube.dy = 0; G.tube.angle = 0;
    G.flyingStone = null;
    showStamp(mode.title, `${mode.culture}・${G.humanSide === 0 ? '黒石先手' : '白石後手'}`);

    if (G.turn === G.humanSide) {
      G.phase = 'WAIT_ROLL';
      G.statusText = `${G.humanSide === 0 ? '黒' : '白'}の番 ── 中央の筒を押さえて振り、離して投擲せよ`;
    } else {
      G.phase = 'AI_WAIT';
      G.statusText = `黒の番 ── 相手が筒を振っている…`;
      setTimeout(() => startAiTubeShake(), 650);
    }
  }


  // 王手チェック（象棋の「将軍」演出：盤面強振動＋大鼓轟鳴＋朱金オーラ）
  function checkAndTriggerOte(player) {
    const mode = currentEra();
    const isNowOte = SugorokuCore.isOteState(G.pts, G.bar, G.off, player, mode);
    G.oteActive[player] = isNowOte;
    if (isNowOte && !G.oteAlerted[player]) {
      G.oteAlerted[player] = true;
      G.boardShake = 18;
      playOteClimaxSound();
      if (player === G.humanSide) {
        showStamp('王手 ── 勝機到来', '決着まであと一歩、押し切れ！');
      } else {
        showStamp('危急 ── 敵陣王手', '相手が決着目前、叩いて阻止せよ！');
      }
    }
  }

  function startPlayerHoldTube(bx, by) {
    if (G.phase !== 'WAIT_ROLL' || G.turn !== G.humanSide) return;
    G.phase = 'PLAYER_HOLD_TUBE';
    G.tube.tipped = false;
    G.shakeTicks = 0;
    G.rattleCooldown = 0;
    G.pointerX = bx;
    G.pointerY = by;
    playSingleRattleGrain(1.1);
    G.statusText = '振賽中 ── 押さえたまま振り続け、指を離すと賽が飛び出す';
  }

  function releasePlayerTube() {
    if (G.phase !== 'PLAYER_HOLD_TUBE') return;
    const holdBoost = Math.min(1.55, 1.0 + G.shakeTicks / 60);
    G.tube.dx = 0; G.tube.dy = 0; G.tube.angle = 0;
    ejectPhysicsDice(holdBoost);
  }

  function startAiTubeShake() {
    if (G.phase === 'SETTLEMENT' || G.screen !== 'PLAYING') return;
    G.phase = 'AI_SHAKE_TUBE';
    G.tube.tipped = false;
    G.shakeTicks = 18;
    G.rattleCooldown = 0;
    G.statusText = `${G.turn === 0 ? '黒' : '白'}の番 ── 相手が振賽中…`;
  }

  function ejectPhysicsDice(boost = 1.0) {
    const d1 = 1 + Math.floor(Math.random() * 6);
    const d2 = 1 + Math.floor(Math.random() * 6);
    G.dice = [d1, d2];
    G.rolledPair = (d1 === d2);
    if (G.rolledPair) G.stats.doubles++;
    G.tube.tipped = true;
    playDiceBounce(0.95);

    const cx = G.tube.baseX;
    const cy = G.tube.baseY;
    G.physDice[0] = {
      x: cx - 26, y: cy + 8,
      vx: (-4.8 - Math.random() * 3.2) * boost,
      vy: (5.2 + Math.random() * 3.0) * boost,
      rot: Math.random() * 6, vrot: 0.38 * boost,
      val: d1, settled: false, bounceCount: 0
    };
    G.physDice[1] = {
      x: cx + 26, y: cy + 8,
      vx: (4.8 + Math.random() * 3.2) * boost,
      vy: (4.8 + Math.random() * 3.2) * boost,
      rot: Math.random() * 6, vrot: -0.42 * boost,
      val: d2, settled: false, bounceCount: 0
    };
    G.phase = 'DICE_TUMBLE';
  }

  function onDiceSettled() {
    const mode = currentEra();
    const [d1, d2] = G.dice;
    G.rem = (d1 === d2) ? new Array(mode.zoromeMoves).fill(d1) : [d1, d2];
    const key = `${d1}-${d2}`;
    const deme = DEME_NAMES[key] || { call: `${KANJI[d1]}${KANJI[d2]}`, yomi: `${KANJI[d1]}・${KANJI[d2]}` };

    const smashNote = (mode.allowIkkaSmash && d1 === d2 && (d1 === 1 || d1 === 6))
      ? '一荷崩し発動可'
      : (d1 === d2 ? `${deme.yomi}・重目${KANJI[mode.zoromeMoves]}連` : `出目 ${KANJI[d1]}と${KANJI[d2]}`);
    showStamp(deme.call, smashNote);

    const legal = SugorokuCore.getLegalSteps(G.pts, G.bar, G.off, G.turn, G.rem, mode, G.rolledPair);
    if (legal.length === 0) {
      G.statusText = `出目 ${deme.call} ── 手詰まりにつき進路なし`;
      showStamp('手詰まり', '一荷に阻まれし');
      G.rem = [];
      setTimeout(() => endTurn(), 1150);
      return;
    }

    if (G.turn === G.humanSide) {
      G.phase = 'PLAYER_MOVE';
      G.selectedFrom = legal[0].from;
      const sideStr = G.humanSide === 0 ? '黒' : '白';
      G.statusText = `${sideStr}の番 ── 出目 ${deme.call} ── 残り目 ${G.rem.map(d => KANJI[d]).join('・')} ── 光る${sideStr}石を撰び着点印を押せ`;
    } else {
      G.phase = 'AI_WAIT';
      G.statusText = `${G.turn === 0 ? '黒' : '白'}の番 ── 出目 ${deme.call} ── 相手が思案中…`;
      const seq = SugorokuCore.findBestAiTurn(G.pts, G.bar, G.off, G.turn, G.rem, mode, G.rolledPair);
      setTimeout(() => runAiSequence(seq), 520);
    }
  }

  function executeTargetSteps(player, stepsQueue, onAllComplete) {
    if (!stepsQueue || stepsQueue.length === 0) {
      onAllComplete();
      return;
    }
    const step = stepsQueue.shift();
    animateAndCommitStep(player, step, () => {
      if (G.phase === 'SETTLEMENT' || G.screen !== 'PLAYING') return;
      if (stepsQueue.length > 0) {
        setTimeout(() => executeTargetSteps(player, stepsQueue, onAllComplete), 90);
      } else {
        onAllComplete();
      }
    });
  }

  function animateAndCommitStep(player, step, onComplete) {
    const mode = currentEra();
    G.phase = 'STONE_FLY';
    G.hoveredTargetTo = null;

    const srcSlot = step.from === 'bar'
      ? Math.max(0, G.bar[player] - 1)
      : Math.max(0, Math.abs(G.pts[step.from]) - 1);
    const dstSlot = step.to === 'off' ? G.off[player] : Math.abs(G.pts[step.to]);

    const sXY = getStoneSlotXY(step.from === 'bar' ? (player === 0 ? 'bar0' : 'bar1') : step.from, srcSlot);
    const tXY = getStoneSlotXY(step.to === 'off' ? (player === 0 ? 'off0' : 'off1') : step.to, dstSlot);

    if (step.from === 'bar') G.bar[player]--;
    else G.pts[step.from] += (player === 0 ? -1 : 1);

    G.flyingStone = {
      player,
      sx: sXY.x, sy: sXY.y,
      tx: tXY.x, ty: tXY.y,
      t: 0,
      duration: 15,
      onDone: () => {
        let hit = false;
        let smashedIkka = false;

        if (step.to === 'off') {
          G.off[player]++;
        } else if (mode.isOimawashi) {
          if (player === 0 && G.pts[step.to] < 0) {
            G.off[0] += (-G.pts[step.to]);
            G.pts[step.to] = 1; hit = true;
          } else if (player === 1 && G.pts[step.to] > 0) {
            G.off[1] += G.pts[step.to];
            G.pts[step.to] = -1; hit = true;
          } else {
            G.pts[step.to] += (player === 0 ? 1 : -1);
          }
        } else {
          if (player === 0 && G.pts[step.to] < 0) {
            const cnt = -G.pts[step.to];
            if (cnt >= 2) smashedIkka = true;
            G.pts[step.to] = 1; G.bar[1] += cnt; hit = true;
          } else if (player === 1 && G.pts[step.to] > 0) {
            const cnt = G.pts[step.to];
            if (cnt >= 2) smashedIkka = true;
            G.pts[step.to] = -1; G.bar[0] += cnt; hit = true;
          } else {
            G.pts[step.to] += (player === 0 ? 1 : -1);
          }
        }

        if (hit) G.stats.hits++;
        playStoneImpact(hit);

        if (smashedIkka) {
          G.boardShake = 14;
          showStamp('一荷崩し', '敵の二石陣を強襲粉砕せり');
        } else if (hit) {
          G.boardShake = 8;
          showStamp(mode.isOimawashi ? '追い抜き討取' : '叩き', mode.isOimawashi ? '敵の殿石を討ち取る' : '孤石を中帯へ放逐す');
        }

        const idx = G.rem.indexOf(step.die);
        if (idx !== -1) G.rem.splice(idx, 1);

        const w = SugorokuCore.checkWinner(G.pts, G.bar, G.off, mode);
        if (w !== -1) {
          G.winner = w;
          const isMuji = mode.allowMujiWin && SugorokuCore.isMujiWin(G.pts, G.bar, w);
          G.winReason = isMuji
            ? '無地勝ち・内陣六連荷完封'
            : (mode.canBearOff ? '全石盤外上がり完遂' : (mode.isOimawashi ? '追廻し六石討取完遂' : '全石内陣集結・入勝'));
          G.boardShake = 16;
          if (w === G.humanSide) playVictoryFanfare();
          else playDefeatBell();
          G.phase = 'SETTLEMENT';
          return;
        }

        checkAndTriggerOte(player);
        onComplete();
      }
    };
  }

  function afterPlayerStep() {
    const mode = currentEra();
    if (G.rem.length === 0) {
      endTurn();
      return;
    }
    const nextLegal = SugorokuCore.getLegalSteps(G.pts, G.bar, G.off, G.humanSide, G.rem, mode, G.rolledPair);
    if (nextLegal.length === 0) {
      showStamp('手詰まり', 'これ以上進めず');
      G.rem = [];
      setTimeout(() => endTurn(), 900);
      return;
    }
    G.phase = 'PLAYER_MOVE';
    if (!nextLegal.some(s => s.from === G.selectedFrom)) {
      G.selectedFrom = nextLegal[0].from;
    }
    G.statusText = `${G.humanSide === 0 ? '黒' : '白'}の番 ── 残り目 ${G.rem.map(d => KANJI[d]).join('・')} ── 着点印を押して進む`;
  }

  function runAiSequence(seq) {
    if (G.phase === 'SETTLEMENT' || G.screen !== 'PLAYING') return;
    if (!seq || seq.length === 0) {
      G.rem = [];
      endTurn();
      return;
    }
    const aiSide = 1 - G.humanSide;
    const nextStep = seq.shift();
    animateAndCommitStep(aiSide, nextStep, () => {
      if (seq.length > 0 && G.phase !== 'SETTLEMENT') {
        setTimeout(() => runAiSequence(seq), 280);
      } else {
        G.rem = [];
        setTimeout(() => endTurn(), 380);
      }
    });
  }

  function endTurn() {
    if (G.phase === 'SETTLEMENT' || G.screen !== 'PLAYING') return;
    G.selectedFrom = null;
    G.hoveredFrom = null;
    G.hoveredTargetTo = null;
    G.turn = 1 - G.turn;
    G.stats.turns++;
    G.tube.tipped = false;
    if (G.turn !== G.humanSide) {
      G.phase = 'AI_WAIT';
      G.statusText = `${G.turn === 0 ? '黒' : '白'}の番 ── 相手が筒を振る…`;
      setTimeout(() => startAiTubeShake(), 480);
    } else {
      G.phase = 'WAIT_ROLL';
      G.statusText = `${G.humanSide === 0 ? '黒' : '白'}の番 ── 中央の筒を押さえて振り、離して投擲せよ`;
    }
  }

  function updatePhysics() {
    G.pulseTick += 0.08;
    if (G.boardShake > 0) G.boardShake *= 0.76;
    if (G.tubeHintFlash > 0) G.tubeHintFlash -= 0.05;
    if (G.screen !== 'PLAYING') return;

    const b = B();
    if (G.phase === 'PLAYER_HOLD_TUBE') {
      G.shakeTicks++;
      const targetDX = Math.max(-28, Math.min(28, (G.pointerX - G.tube.baseX) * 0.35));
      const targetDY = Math.max(-20, Math.min(20, (G.pointerY - G.tube.baseY) * 0.35));
      const vibeX = Math.sin(G.shakeTicks * 1.45) * 9;
      const vibeY = Math.cos(G.shakeTicks * 1.85) * 6 - 10;
      G.tube.dx = targetDX + vibeX;
      G.tube.dy = targetDY + vibeY;
      G.tube.angle = Math.sin(G.shakeTicks * 1.5) * 0.28 + targetDX * 0.008;

      G.rattleCooldown--;
      if (G.rattleCooldown <= 0) {
        playSingleRattleGrain(1.0 + Math.min(0.5, G.shakeTicks / 50));
        G.rattleCooldown = 5;
      }
    } else if (G.phase === 'AI_SHAKE_TUBE') {
      G.shakeTicks--;
      G.tube.dx = Math.sin(G.shakeTicks * 1.5) * 8;
      G.tube.dy = Math.cos(G.shakeTicks * 1.8) * 5 - 8;
      G.tube.angle = (G.shakeTicks % 2 === 0 ? 1 : -1) * 0.25;
      if (G.shakeTicks % 5 === 0) playSingleRattleGrain(1.0);
      if (G.shakeTicks <= 0) {
        G.tube.dx = 0; G.tube.dy = 0; G.tube.angle = 0;
        ejectPhysicsDice(1.0);
      }
    } else if (G.phase === 'DICE_TUMBLE') {
      let allSettled = true;
      const minX = b.x + 28, maxX = b.x + b.w - 28;
      const minY = b.y + 28, maxY = b.y + b.h - 28;

      G.physDice.forEach((d, idx) => {
        if (d.settled) return;
        d.x += d.vx; d.y += d.vy; d.rot += d.vrot;
        d.vx *= 0.89; d.vy *= 0.89; d.vrot *= 0.88;

        const speed = Math.hypot(d.vx, d.vy);
        d.bounceCount++;
        if (d.bounceCount % (4 + idx) === 0 && speed > 0.8) {
          playDiceBounce(Math.min(0.65, speed / 9));
        }

        if (d.x < minX) { d.x = minX; d.vx = -d.vx * 0.7; playDiceBounce(Math.min(0.8, speed / 7)); }
        if (d.x > maxX) { d.x = maxX; d.vx = -d.vx * 0.7; playDiceBounce(Math.min(0.8, speed / 7)); }
        if (d.y < minY) { d.y = minY; d.vy = -d.vy * 0.7; playDiceBounce(Math.min(0.8, speed / 7)); }
        if (d.y > maxY) { d.y = maxY; d.vy = -d.vy * 0.7; playDiceBounce(Math.min(0.8, speed / 7)); }

        if (speed < 0.24) {
          d.settled = true;
          playDiceBounce(0.22);
        } else {
          allSettled = false;
        }
      });

      const dx = G.physDice[1].x - G.physDice[0].x;
      const dy = G.physDice[1].y - G.physDice[0].y;
      const dist = Math.hypot(dx, dy);
      if (dist > 0 && dist < 44) {
        const push = (44 - dist) * 0.5;
        G.physDice[0].x -= (dx / dist) * push; G.physDice[0].y -= (dy / dist) * push;
        G.physDice[1].x += (dx / dist) * push; G.physDice[1].y += (dy / dist) * push;
        playDiceBounce(0.45);
      }

      if (allSettled) onDiceSettled();
    } else if (G.phase === 'STONE_FLY' && G.flyingStone) {
      G.flyingStone.t++;
      if (G.flyingStone.t >= G.flyingStone.duration) {
        const done = G.flyingStone.onDone;
        G.flyingStone = null;
        if (done) done();
      }
    }

    if (G.stamp && G.stamp.alpha > 0) G.stamp.alpha -= 0.017;
  }

function isInsideTubeHitbox(bx, by) {
    const cx = G.tube.baseX, cy = G.tube.baseY;
    return (Math.abs(bx - cx) <= 64 && by >= cy - 96 && by <= cy + 44);
  }

  function findHitTargetOption(bx, by, expandedTargets) {
    for (const tObj of expandedTargets) {
      const pos = getTargetSealXY(tObj);
      if (Math.abs(bx - pos.sealX) <= 38 && Math.abs(by - pos.sealY) <= 22) return tObj;
      if (Math.hypot(bx - pos.stoneX, by - pos.stoneY) <= 24) return tObj;
    }
    for (const tObj of expandedTargets) {
      if (tObj.to === 'off') continue;
      const l = getLaneGeom(tObj.to);
      if (bx >= l.x && bx <= l.x + l.w && by >= l.y && by <= l.y + l.h) {
        const hasOwnStoneHere = (G.humanSide === 0 ? G.pts[tObj.to] > 0 : G.pts[tObj.to] < 0);
        const isInnerHalf = l.isTop ? (by >= l.y + l.h * 0.45) : (by <= l.y + l.h * 0.55);
        if (!hasOwnStoneHere || isInnerHalf) return tObj;
      }
    }
    return null;
  }

  function hitTestScene(bx, by) {
    const b = B();
    if (isInsideRect(bx, by, NEW_GAME_BTN)) return { type: 'reset' };
    if (isInsideRect(bx, by, CHANGE_ERA_BTN)) return { type: 'change_era' };
    if (G.phase === 'WAIT_ROLL' && G.turn === G.humanSide && isInsideTubeHitbox(bx, by)) {
      return { type: 'tube' };
    }
    const midY = b.y + b.h / 2;
    if (G.humanSide === 0 && G.bar[0] > 0 && Math.abs(by - midY) <= 28 && bx < b.x + b.w / 2 - 48) {
      return { type: 'bar' };
    }
    if (G.humanSide === 1 && G.bar[1] > 0 && Math.abs(by - midY) <= 28 && bx > b.x + b.w / 2 + 48) {
      return { type: 'bar' };
    }
    for (let i = 0; i < 24; i++) {
      const l = getLaneGeom(i);
      if (bx >= l.x && bx <= l.x + l.w && by >= l.y && by <= l.y + l.h) {
        return { type: 'lane', id: i };
      }
    }
    return null;
  }

  canvas.addEventListener('pointermove', (e) => {
    const p = toBoardXY(e.clientX, e.clientY);
    G.pointerX = p.x;
    G.pointerY = p.y;

    if (G.screen === 'SELECT_ERA') {
      let hov = -1;
      ERA_MODES.forEach((_, idx) => {
        if (isInsideRect(p.x, p.y, getEraCardRect(idx))) hov = idx;
      });
      G.hoverEraIdx = hov;
      canvas.style.cursor = hov !== -1 ? 'pointer' : 'default';
      return;
    }

    if (G.screen === 'SELECT_COLOR') {
      const mw = 680, mh = 390;
      const mx = (W - mw) / 2, my = (H - mh) / 2;
      let hov = -1;
      if (isInsideRect(p.x, p.y, { x: mx + 64, y: my + 164, w: 250, h: 148 })) hov = 0;
      else if (isInsideRect(p.x, p.y, { x: mx + 366, y: my + 164, w: 250, h: 148 })) hov = 1;
      else if (isInsideRect(p.x, p.y, { x: W / 2 - 110, y: my + 332, w: 220, h: 38 })) hov = 2;
      G.hoverColorBtn = hov;
      canvas.style.cursor = hov !== -1 ? 'pointer' : 'default';
      return;
    }

    if (G.phase === 'SETTLEMENT') {
      const pw = 660, ph = 420;
      const px = (W - pw) / 2, py = (H - ph) / 2;
      let hov = -1;
      if (isInsideRect(p.x, p.y, { x: px + 96, y: py + 334, w: 216, h: 52 })) hov = 0;
      else if (isInsideRect(p.x, p.y, { x: px + 348, y: py + 334, w: 216, h: 52 })) hov = 1;
      G.hoverSettleBtn = hov;
      canvas.style.cursor = hov !== -1 ? 'pointer' : 'default';
      return;
    }

    if (G.phase === 'WAIT_ROLL' && G.turn === G.humanSide) {
      G.tube.hovering = isInsideTubeHitbox(p.x, p.y);
      canvas.style.cursor = G.tube.hovering ? 'grab' : 'default';
      return;
    }

    if (G.phase === 'PLAYER_HOLD_TUBE') {
      canvas.style.cursor = 'grabbing';
      return;
    }

    if (G.phase !== 'PLAYER_MOVE' || G.turn !== G.humanSide) {
      canvas.style.cursor = 'default';
      return;
    }

    const mode = currentEra();
    const legal = SugorokuCore.getLegalSteps(G.pts, G.bar, G.off, G.humanSide, G.rem, mode, G.rolledPair);
    const activeFrom = G.selectedFrom !== null ? G.selectedFrom : G.hoveredFrom;
    const expandedTargets = activeFrom !== null
      ? SugorokuCore.getExpandedTargetsForSource(G.pts, G.bar, G.off, G.humanSide, activeFrom, G.rem, mode, G.rolledPair)
      : [];

    const hitTarget = findHitTargetOption(p.x, p.y, expandedTargets);
    if (hitTarget) {
      G.hoveredTargetTo = hitTarget.to;
      G.hoveredFrom = null;
      canvas.style.cursor = 'pointer';
      return;
    }

    G.hoveredTargetTo = null;
    const hit = hitTestScene(p.x, p.y);
    let hovFrom = null;
    if (hit && hit.type === 'bar' && legal.some(s => s.from === 'bar')) hovFrom = 'bar';
    if (hit && hit.type === 'lane' && legal.some(s => s.from === hit.id)) hovFrom = hit.id;

    G.hoveredFrom = hovFrom;
    canvas.style.cursor = (hovFrom !== null) ? 'pointer' : 'default';
  });

  canvas.addEventListener('pointerdown', (e) => {
    const p = toBoardXY(e.clientX, e.clientY);
    G.pointerX = p.x;
    G.pointerY = p.y;

    if (G.screen === 'SELECT_ERA') {
      ERA_MODES.forEach((m, idx) => {
        if (isInsideRect(p.x, p.y, getEraCardRect(idx))) {
          playStoneLift();
          G.eraIdx = idx;
          G.pts.fill(0);
          m.setup(G.pts);
          G.bar = [0, 0];
          G.off = [0, 0];
          G.screen = 'SELECT_COLOR';
        }
      });
      return;
    }

    if (G.screen === 'SELECT_COLOR') {
      const mw = 680, mh = 390;
      const mx = (W - mw) / 2, my = (H - mh) / 2;
      if (isInsideRect(p.x, p.y, { x: mx + 64, y: my + 164, w: 250, h: 148 })) {
        playStoneImpact(false);
        G.humanSide = 0;
        G.screen = 'PLAYING';
        startMatch();
      } else if (isInsideRect(p.x, p.y, { x: mx + 366, y: my + 164, w: 250, h: 148 })) {
        playStoneImpact(false);
        G.humanSide = 1;
        G.screen = 'PLAYING';
        startMatch();
      } else if (isInsideRect(p.x, p.y, { x: W / 2 - 110, y: my + 332, w: 220, h: 38 })) {
        playStoneLift();
        G.screen = 'SELECT_ERA';
      }
      return;
    }

    if (G.phase === 'SETTLEMENT') {
      const pw = 660, ph = 420;
      const px = (W - pw) / 2, py = (H - ph) / 2;
      if (isInsideRect(p.x, p.y, { x: px + 96, y: py + 334, w: 216, h: 52 })) {
        playStoneImpact(false);
        startMatch();
        return;
      }
      if (isInsideRect(p.x, p.y, { x: px + 348, y: py + 334, w: 216, h: 52 })) {
        playStoneLift();
        G.screen = 'SELECT_ERA';
        return;
      }
      return;
    }

    const hit = hitTestScene(p.x, p.y);
    if (hit && hit.type === 'reset') {
      playStoneLift();
      G.screen = 'SELECT_COLOR';
      return;
    }
    if (hit && hit.type === 'change_era') {
      playStoneLift();
      G.screen = 'SELECT_ERA';
      return;
    }

    if (G.phase === 'WAIT_ROLL' && G.turn === G.humanSide) {
      if (hit && hit.type === 'tube') {
        startPlayerHoldTube(p.x, p.y);
      } else {
        G.tubeHintFlash = 1.0;
        G.statusText = '中央の振筒を押さえて振られよ';
      }
      return;
    }

    if (G.phase !== 'PLAYER_MOVE' || G.turn !== G.humanSide) return;

    const mode = currentEra();
    const legal = SugorokuCore.getLegalSteps(G.pts, G.bar, G.off, G.humanSide, G.rem, mode, G.rolledPair);
    const expandedTargets = G.selectedFrom !== null
      ? SugorokuCore.getExpandedTargetsForSource(G.pts, G.bar, G.off, G.humanSide, G.selectedFrom, G.rem, mode, G.rolledPair)
      : [];

    const chosenTarget = findHitTargetOption(p.x, p.y, expandedTargets);
    if (chosenTarget) {
      executeTargetSteps(G.humanSide, chosenTarget.steps.slice(), afterPlayerStep);
      return;
    }

    if (!hit) return;
    const clickedKey = hit.type === 'bar' ? 'bar' : (hit.type === 'lane' ? hit.id : null);
    if (clickedKey === null) return;

    const fromSteps = legal.filter(s => s.from === clickedKey);
    if (fromSteps.length > 0) {
      playStoneLift();
      if (G.selectedFrom === clickedKey && expandedTargets.length === 1) {
        executeTargetSteps(G.humanSide, expandedTargets[0].steps.slice(), afterPlayerStep);
      } else {
        G.selectedFrom = clickedKey;
      }
    }
  });

  window.addEventListener('pointerup', () => {
    if (G.phase === 'PLAYER_HOLD_TUBE') {
      releasePlayerTube();
      canvas.style.cursor = 'default';
    }
  });

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => render());
  }

  function loop() {
    updatePhysics();
    render();
    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);

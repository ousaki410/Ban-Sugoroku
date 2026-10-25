import { KANJI } from './eras.js';

// ==================== 3. 純整数の統合ルール・王手判定・AIエンジン ====================
export const SugorokuCore = {
    countInner(pts, player) {
      let n = 0;
      if (player === 0) {
        for (let i = 0; i <= 5; i++) if (pts[i] > 0) n += pts[i];
      } else {
        for (let i = 18; i <= 23; i++) if (pts[i] < 0) n += (-pts[i]);
      }
      return n;
    },

    allInInnerOrOff(pts, bar, off, player, mode) {
      if (bar[player] > 0) return false;
      return (this.countInner(pts, player) + off[player]) === mode.stoneCount;
    },

    isMujiWin(pts, bar, player) {
      if (bar[1 - player] === 0) return false;
      if (player === 0) {
        for (let i = 18; i <= 23; i++) if (pts[i] < 2) return false;
        return true;
      } else {
        for (let i = 0; i <= 5; i++) if (pts[i] > -2) return false;
        return true;
      }
    },

    // 将棋の「王手」に相当する決戦リーチ判定（あと1〜2手で決着する緊迫状態）
    isOteState(pts, bar, off, player, mode) {
      if (mode.isOimawashi) {
        return off[player] >= 4;
      }
      if (mode.canBearOff) {
        return off[player] >= mode.stoneCount - 3;
      }
      if (bar[player] > 0) return false;
      const inCnt = this.countInner(pts, player);
      if (inCnt >= mode.stoneCount - 2) return true;
      // 無地勝ちリーチ：敵が中帯におり、敵起点6目のうち5目を2石以上で封鎖している場合
      if (mode.allowMujiWin && bar[1 - player] > 0) {
        let locked = 0;
        if (player === 0) {
          for (let i = 18; i <= 23; i++) if (pts[i] >= 2) locked++;
        } else {
          for (let i = 0; i <= 5; i++) if (pts[i] <= -2) locked++;
        }
        if (locked >= 5) return true;
      }
      return false;
    },

    calcPips(pts, bar, player) {
      let p = bar[player] * 25;
      for (let i = 0; i < 24; i++) {
        if (player === 0 && pts[i] > 0) p += pts[i] * (i + 1);
        if (player === 1 && pts[i] < 0) p += (-pts[i]) * (24 - i);
      }
      return p;
    },

    checkWinner(pts, bar, off, mode) {
      if (mode.isOimawashi) {
        if (off[0] >= 6) return 0;
        if (off[1] >= 6) return 1;
        return -1;
      }
      if (mode.allowMujiWin) {
        if (this.isMujiWin(pts, bar, 0)) return 0;
        if (this.isMujiWin(pts, bar, 1)) return 1;
      }
      if (mode.canBearOff) {
        if (off[0] >= mode.stoneCount) return 0;
        if (off[1] >= mode.stoneCount) return 1;
        return -1;
      }
      if (bar[0] === 0 && this.countInner(pts, 0) === mode.stoneCount) return 0;
      if (bar[1] === 0 && this.countInner(pts, 1) === mode.stoneCount) return 1;
      return -1;
    },

    canLandOn(pts, player, to, canSmashIkka) {
      if (player === 0) {
        if (pts[to] >= -1) return true;
        if (canSmashIkka && pts[to] === -2) return true;
        return false;
      } else {
        if (pts[to] <= 1) return true;
        if (canSmashIkka && pts[to] === 2) return true;
        return false;
      }
    },

    getOimawashiTailAndHead(pts, player) {
      const occupied = [];
      for (let i = 0; i < 24; i++) {
        if ((player === 0 && pts[i] > 0) || (player === 1 && pts[i] < 0)) occupied.push(i);
      }
      if (occupied.length === 0) return null;
      let tail = occupied[0], head = occupied[occupied.length - 1];
      let maxGap = -1;
      for (let k = 0; k < occupied.length; k++) {
        const cur = occupied[k];
        const nxt = occupied[(k + 1) % occupied.length];
        const gap = (cur - nxt + 24) % 24;
        if (gap > maxGap) {
          maxGap = gap;
          head = cur;
          tail = nxt;
        }
      }
      return { tail, head };
    },

    getLegalSteps(pts, bar, off, player, remDice, mode, rolledPair = false) {
      const steps = [];
      const seen = new Set();

      if (mode.isOimawashi) {
        const th = this.getOimawashiTailAndHead(pts, player);
        if (!th) return [];
        remDice.forEach((die, dIdx) => {
          const isKoi = (player === 0)
            ? (die === 2 || die === 5 || die === 1 || die === 6 || rolledPair)
            : (die === 3 || die === 4 || die === 1 || die === 6 || rolledPair);
          const base = isKoi ? th.head : th.tail;
          const to = (base - die + 24) % 24;
          const from = th.tail;
          if (to !== from) {
            const k = `${from}->${to}:${die}`;
            if (!seen.has(k)) {
              seen.add(k);
              steps.push({ from, to, die, dIdx, isLeap: isKoi });
            }
          }
        });
        return steps;
      }

      const canSmash = mode.allowIkkaSmash && rolledPair && (remDice[0] === 1 || remDice[0] === 6);

      remDice.forEach((die, dIdx) => {
        if (bar[player] > 0) {
          if (mode.freeBarEntry) {
            const startRange = player === 0 ? [23, 22, 21, 20, 19, 18] : [0, 1, 2, 3, 4, 5];
            startRange.forEach(to => {
              if (this.canLandOn(pts, player, to, canSmash)) {
                const k = `bar->${to}:${die}`;
                if (!seen.has(k)) { seen.add(k); steps.push({ from: 'bar', to, die, dIdx }); }
              }
            });
          } else {
            const to = player === 0 ? (24 - die) : (die - 1);
            if (this.canLandOn(pts, player, to, canSmash)) {
              const k = `bar->${to}:${die}`;
              if (!seen.has(k)) { seen.add(k); steps.push({ from: 'bar', to, die, dIdx }); }
            }
          }
          return;
        }

        const readyBearOff = mode.canBearOff && this.allInInnerOrOff(pts, bar, off, player, mode);

        for (let i = 0; i < 24; i++) {
          if ((player === 0 && pts[i] > 0) || (player === 1 && pts[i] < 0)) {
            if (player === 0) {
              const to = i - die;
              if (to >= 0) {
                if (this.canLandOn(pts, 0, to, canSmash)) {
                  const k = `${i}->${to}:${die}`;
                  if (!seen.has(k)) { seen.add(k); steps.push({ from: i, to, die, dIdx }); }
                }
              } else if (readyBearOff) {
                let higherHasStone = false;
                for (let h = i + 1; h <= 5; h++) if (pts[h] > 0) higherHasStone = true;
                if (to === -1 || !higherHasStone) {
                  const k = `${i}->off:${die}`;
                  if (!seen.has(k)) { seen.add(k); steps.push({ from: i, to, die, dIdx }); }
                }
              }
            } else {
              const to = i + die;
              if (to <= 23) {
                if (this.canLandOn(pts, 1, to, canSmash)) {
                  const k = `${i}->${to}:${die}`;
                  if (!seen.has(k)) { seen.add(k); steps.push({ from: i, to, die, dIdx }); }
                }
              } else if (readyBearOff) {
                let lowerHasStone = false;
                for (let l = 18; l < i; l++) if (pts[l] < 0) lowerHasStone = true;
                if (to === 24 || !lowerHasStone) {
                  const k = `${i}->off:${die}`;
                  if (!seen.has(k)) { seen.add(k); steps.push({ from: i, to, die, dIdx }); }
                }
              }
            }
          }
        }
      });
      return steps;
    },

    getExpandedTargetsForSource(pts, bar, off, player, from, remDice, mode, rolledPair) {
      const direct = this.getLegalSteps(pts, bar, off, player, remDice, mode, rolledPair).filter(s => s.from === from);
      direct.sort((a, b) => a.die - b.die);

      const results = direct.map((st, idx) => ({
        from: st.from,
        to: st.to,
        die: st.die,
        label: st.to === 'off' ? `上がり${KANJI[st.die]}` : (st.isLeap ? `蛙飛${KANJI[st.die]}` : `${KANJI[st.die]}目`),
        isFar: idx > 0,
        isCombined: false,
        steps: [st]
      }));

      if (!mode.isOimawashi && remDice.length >= 2 && (from !== 'bar' || bar[player] === 1)) {
        for (let i = 0; i < direct.length; i++) {
          const first = direct[i];
          if (first.to === 'off') continue;
          const nextState = this.cloneApplyStep(pts, bar, off, player, first, mode);
          const remAfter = remDice.slice();
          const rmIdx = remAfter.indexOf(first.die);
          if (rmIdx !== -1) remAfter.splice(rmIdx, 1);

          const nextSteps = this.getLegalSteps(nextState.pts, nextState.bar, nextState.off, player, [remAfter[0]], mode, rolledPair)
            .filter(s => s.from === first.to);
          if (nextSteps.length > 0) {
            const second = nextSteps[0];
            if (!results.some(r => r.to === second.to)) {
              const totalMove = first.die + second.die;
              results.push({
                from,
                to: second.to,
                die: totalMove,
                label: second.to === 'off' ? `合上がり` : `合${KANJI[totalMove]}目`,
                isFar: true,
                isCombined: true,
                steps: [first, second]
              });
              break;
            }
          }
        }
      }
      return results;
    },

    cloneApplyStep(pts, bar, off, player, step, mode) {
      const nPts = pts.slice();
      const nBar = bar.slice();
      const nOff = off.slice();

      if (step.from === 'bar') nBar[player]--;
      else nPts[step.from] += (player === 0 ? -1 : 1);

      let hit = false;
      if (step.to === 'off') {
        nOff[player]++;
      } else if (mode.isOimawashi) {
        if (player === 0 && nPts[step.to] < 0) {
          nOff[0] += (-nPts[step.to]);
          nPts[step.to] = 1;
          hit = true;
        } else if (player === 1 && nPts[step.to] > 0) {
          nOff[1] += nPts[step.to];
          nPts[step.to] = -1;
          hit = true;
        } else {
          nPts[step.to] += (player === 0 ? 1 : -1);
        }
      } else {
        if (player === 0 && nPts[step.to] < 0) {
          const enemyCnt = -nPts[step.to];
          nPts[step.to] = 1;
          nBar[1] += enemyCnt;
          hit = true;
        } else if (player === 1 && nPts[step.to] > 0) {
          const enemyCnt = nPts[step.to];
          nPts[step.to] = -1;
          nBar[0] += enemyCnt;
          hit = true;
        } else {
          nPts[step.to] += (player === 0 ? 1 : -1);
        }
      }
      return { pts: nPts, bar: nBar, off: nOff, hit };
    },

    evaluateForPlayer(pts, bar, off, aiPlayer, mode) {
      const w = this.checkWinner(pts, bar, off, mode);
      if (w === aiPlayer) return 99999;
      if (w === (1 - aiPlayer)) return -99999;

      if (mode.isOimawashi) {
        return (off[aiPlayer] - off[1 - aiPlayer]) * 180;
      }

      const enemy = 1 - aiPlayer;
      let score = 0;
      const aiPips = this.calcPips(pts, bar, aiPlayer);
      const enPips = this.calcPips(pts, bar, enemy);
      score += (enPips - aiPips) * 2;
      score += this.countInner(pts, aiPlayer) * 28 - this.countInner(pts, enemy) * 26;
      score += (off[aiPlayer] - off[enemy]) * 55;
      score += bar[enemy] * 68 - bar[aiPlayer] * 75;

      let consecutiveWalls = 0;
      for (let i = 0; i < 24; i++) {
        const v = pts[i];
        const ownCnt = aiPlayer === 0 ? v : -v;
        if (ownCnt >= 2) {
          consecutiveWalls++;
          score += 18 + consecutiveWalls * 9;
        } else {
          consecutiveWalls = 0;
          if (ownCnt === 1) score -= 18;
        }
      }
      return score;
    },

    findBestAiTurn(pts, bar, off, aiPlayer, remDice, mode, rolledPair) {
      let bestSeq = [];
      let bestScore = -1e9;
      const self = this;

      function dfs(curPts, curBar, curOff, diceLeft, seq) {
        const legal = self.getLegalSteps(curPts, curBar, curOff, aiPlayer, diceLeft, mode, rolledPair);
        if (legal.length === 0 || diceLeft.length === 0) {
          const sc = self.evaluateForPlayer(curPts, curBar, curOff, aiPlayer, mode) + seq.length * 500;
          if (sc > bestScore) {
            bestScore = sc;
            bestSeq = seq.slice();
          }
          return;
        }
        const candidates = legal.slice(0, 12);
        for (const st of candidates) {
          const next = self.cloneApplyStep(curPts, curBar, curOff, aiPlayer, st, mode);
          const nextDice = diceLeft.slice();
          const idx = nextDice.indexOf(st.die);
          if (idx !== -1) nextDice.splice(idx, 1);
          seq.push(st);
          dfs(next.pts, next.bar, next.off, nextDice, seq);
          seq.pop();
        }
      }

      dfs(pts, bar, off, remDice, []);
      return bestSeq;
    }
  };

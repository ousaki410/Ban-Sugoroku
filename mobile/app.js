// ============================================================
// 盤双六 — Muromachi Ban-Sugoroku
// Full-screen canvas, procedural 3D board, physics dice & stones
// ============================================================

// ---------- Audio ----------
class AudioManager {
    constructor() {
        this.ctx = null;
        this.init();
    }
    init() {
        try {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            if (this.ctx.state === 'suspended') this.ctx.resume();
        } catch (e) {
            console.warn('WebAudio unavailable', e);
        }
    }
    noiseBuffer(duration, gainVal) {
        if (!this.ctx) return null;
        const len = Math.floor(this.ctx.sampleRate * duration);
        const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * gainVal;
        return buf;
    }
    playBambooShake() {
        if (!this.ctx) return;
        const buf = this.noiseBuffer(0.35, 0.18);
        if (!buf) return;
        const src = this.ctx.createBufferSource();
        src.buffer = buf;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 220;
        filter.Q.value = 1.2;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.25, this.ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.35);
        src.connect(filter).connect(g).connect(this.ctx.destination);
        src.start();
    }
    playDiceClick() {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        osc.type = 'square';
        osc.frequency.setValueAtTime(880, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(220, this.ctx.currentTime + 0.08);
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.12, this.ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.08);
        osc.connect(g).connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.1);
    }
    playStoneClack() {
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        // layered: noise burst + woody resonators + horn click
        const buf = this.noiseBuffer(0.08, 0.12);
        if (buf) {
            const src = this.ctx.createBufferSource();
            src.buffer = buf;
            const bp = this.ctx.createBiquadFilter();
            bp.type = 'bandpass';
            bp.frequency.value = 620;
            bp.Q.value = 2;
            const g = this.ctx.createGain();
            g.gain.setValueAtTime(0.25, now);
            g.gain.exponentialRampToValueAtTime(0.01, now + 0.09);
            src.connect(bp).connect(g).connect(this.ctx.destination);
            src.start(now);
        }
        [180, 620, 1400].forEach((freq, i) => {
            const osc = this.ctx.createOscillator();
            osc.type = i === 2 ? 'triangle' : 'sine';
            osc.frequency.value = freq;
            const g = this.ctx.createGain();
            g.gain.setValueAtTime(0.08 / (i + 1), now);
            g.gain.exponentialRampToValueAtTime(0.001, now + 0.12 + i * 0.02);
            osc.connect(g).connect(this.ctx.destination);
            osc.start(now);
            osc.stop(now + 0.15 + i * 0.02);
        });
    }
    playHeavyImpact() {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(120, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(60, this.ctx.currentTime + 0.25);
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.35, this.ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.3);
        osc.connect(g).connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.3);
    }
    playVictory() {
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        [261.63, 329.63, 392.0, 523.25].forEach((freq, i) => {
            const osc = this.ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.value = freq;
            const g = this.ctx.createGain();
            g.gain.setValueAtTime(0.12, now + i * 0.15);
            g.gain.exponentialRampToValueAtTime(0.001, now + 1.8 + i * 0.15);
            osc.connect(g).connect(this.ctx.destination);
            osc.start(now + i * 0.15);
            osc.stop(now + 2.2 + i * 0.15);
        });
    }
}

// ---------- PRNG ----------
function xorshift32(s) {
    s ^= s << 13; s ^= s >>> 17; s ^= s << 5;
    return s >>> 0;
}

// ---------- Game Logic ----------
class SugorokuGame {
    constructor() {
        this.audio = new AudioManager();
        this.reset();
    }
    reset() {
        this.points = new Array(24).fill(0);
        this.bar = [0, 0];
        this.borne_off = [0, 0];
        this.turn = 0;
        this.dice = [0, 0];
        this.mode = 0; // HON
        this.coins = [1000, 1000];
        this.stake = 100;
        this.rng_state = (Date.now() ^ (Math.random() * 0xFFFFFFFF)) >>> 0;
        this.winner = -1;
        this.selected = -1;
        this.legalMoves = [];
        this.phase = 'waiting'; // waiting, rolling, player, ai, done
        // classical Muromachi setup
        this.points[23] = 2;
        this.points[12] = 5;
        this.points[7] = 3;
        this.points[5] = 5;
        this.points[0] = -2;
        this.points[11] = -5;
        this.points[16] = -3;
        this.points[18] = -5;
    }
    rollDice() {
        this.rng_state = xorshift32(this.rng_state);
        const r1 = this.rng_state;
        this.rng_state = xorshift32(this.rng_state);
        const r2 = this.rng_state;
        this.dice[0] = (r1 % 6) + 1;
        this.dice[1] = (r2 % 6) + 1;
        if (this.dice[0] > this.dice[1]) {
            [this.dice[0], this.dice[1]] = [this.dice[1], this.dice[0]];
        }
        this.audio.playBambooShake();
    }
    allInside(player) {
        const sign = player === 0 ? 1 : -1;
        const lo = player === 0 ? 0 : 18;
        const hi = player === 0 ? 5 : 23;
        for (let p = 0; p < 24; p++) {
            if (this.points[p] === sign && (p < lo || p > hi)) return false;
        }
        return true;
    }
    hasHigher(player, p) {
        const sign = player === 0 ? 1 : -1;
        if (player === 0) {
            for (let q = p + 1; q <= 5; q++) if (this.points[q] === sign) return true;
        } else {
            for (let q = 18; q < p; q++) if (this.points[q] === sign) return true;
        }
        return false;
    }
    generateMoves() {
        const own = this.turn === 0 ? 1 : -1;
        const opp = -own;
        const moves = [];
        const dieUses = [1, 1];
        if (this.mode === 1 && this.dice[0] === this.dice[1]) dieUses[0] = dieUses[1] = 2;
        for (let di = 0; di < 2; di++) {
            const die = this.dice[di];
            for (let u = 0; u < dieUses[di]; u++) {
                if (this.bar[this.turn] > 0) {
                    const dest = this.turn === 0 ? 24 - die : die - 1;
                    if (dest >= 0 && dest < 24) {
                        moves.push({ steps: [{ from: 24, to: dest, die_used: die, hits_blot: false }], step_count: 1 });
                    }
                    continue;
                }
                for (let p = 0; p < 24; p++) {
                    if (this.points[p] !== own) continue;
                    const delta = this.turn === 0 ? -die : die;
                    let dest = p + delta;
                    let can = false, hit = false;
                    if (dest < 0 || dest >= 24) {
                        if (this.bar[this.turn] !== 0) continue;
                        if (!this.allInside(this.turn)) continue;
                        if (this.hasHigher(this.turn, p)) continue;
                        dest = this.turn === 0 ? -1 : 24;
                        can = true;
                    } else {
                        if (this.points[dest] === 0) can = true;
                        else if (this.points[dest] === opp) {
                            if (Math.abs(this.points[dest]) === 1) { can = true; hit = true; }
                        }
                    }
                    if (!can) continue;
                    moves.push({ steps: [{ from: p, to: dest, die_used: die, hits_blot: hit }], step_count: 1 });
                }
            }
        }
        this.legalMoves = moves;
        return moves;
    }
    applyMove(move) {
        const own = this.turn === 0 ? 1 : -1;
        const opp = -own;
        for (const step of move.steps) {
            if (step.from >= 0 && step.from < 24) {
                if (this.points[step.from] === own) this.points[step.from] -= own;
            } else if (step.from === 24) {
                if (this.bar[this.turn] > 0) this.bar[this.turn]--;
            }
            if (step.to >= 0 && step.to < 24) {
                this.points[step.to] += own;
            } else if (step.to === -1 || step.to === 24) {
                this.borne_off[this.turn]++;
            }
            if (step.hits_blot && step.to >= 0 && step.to < 24 && this.points[step.to] === opp) {
                this.bar[1 - this.turn]++;
                this.points[step.to] = 0;
            }
        }
        this.audio.playStoneClack();
        this.turn = 1 - this.turn;
        this.selected = -1;
        this.legalMoves = [];
        this.phase = 'waiting';
    }
    checkWinner() {
        if (this.borne_off[0] === 15) { this.winner = 0; return 0; }
        if (this.borne_off[1] === 15) { this.winner = 1; return 1; }
        if (this.mode === 0) {
            if (this.bar[0] === 0) {
                let inside = 0;
                for (let p = 0; p <= 5; p++) if (this.points[p] > 0) inside += this.points[p];
                inside += this.borne_off[0];
                if (inside === 15) { this.winner = 0; return 0; }
            }
            if (this.bar[1] === 0) {
                let inside = 0;
                for (let p = 18; p <= 23; p++) if (this.points[p] < 0) inside -= this.points[p];
                inside += this.borne_off[1];
                if (inside === 15) { this.winner = 1; return 1; }
            }
        }
        this.winner = -1;
        return -1;
    }
    aiChooseMove() {
        const moves = this.generateMoves();
        if (!moves.length) return false;
        let best = null, bestScore = -1e9;
        for (const m of moves) {
            let score = 0;
            for (const st of m.steps) {
                if (st.hits_blot) score += 250;
                const to = st.to;
                if (this.turn === 0) {
                    if (to === -1) score += 900;
                    else if (to >= 0 && to <= 5) score += 500;
                } else {
                    if (to === 24) score += 900;
                    else if (to >= 18 && to <= 23) score += 500;
                }
                const from = st.from;
                if (from >= 0 && from < 24) {
                    const dist = this.turn === 0 ? from : 23 - from;
                    score -= dist * 5;
                }
                if (to >= 0 && to < 24 && this.points[to] === (this.turn === 0 ? 1 : -1)) score += 120;
            }
            if (score > bestScore) { bestScore = score; best = m; }
        }
        if (best) { this.applyMove(best); return true; }
        return false;
    }
}

// ---------- Canvas & Scene ----------
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
let W = 0, H = 0;
function resize() {
    const dpr = window.devicePixelRatio || 1;
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener('resize', resize);
resize();

const game = new SugorokuGame();
const audio = game.audio;

// layout helpers
function boardMetrics() {
    const bw = Math.min(W * 0.86, H * 0.78);
    const bh = bw / 1.39;
    const bx = (W - bw) / 2;
    const by = (H - bh) / 2;
    return { bx, by, bw, bh };
}

// map point index to lane rectangle center
function laneRect(point) {
    const { bx, by, bw, bh } = boardMetrics();
    const midY = by + bh * 0.5;
    const halfH = bh * 0.42;
    const laneW = bw / 12;
    let col, row, y, h;
    if (point >= 12) {
        // top row: 12..23 left->right
        col = point - 12;
        row = 0;
        y = by + bh * 0.06;
        h = halfH;
    } else {
        // bottom row: 11..0 left->right
        col = 11 - point;
        row = 1;
        y = midY + bh * 0.04;
        h = halfH;
    }
    const x = bx + col * laneW + laneW * 0.5;
    const cy = row === 0 ? y + h * 0.5 : y + h * 0.5;
    return { x, y, w: laneW, h, cx: x, cy };
}

function pointFromXY(mx, my) {
    const { bx, by, bw, bh } = boardMetrics();
    const laneW = bw / 12;
    if (mx < bx || mx > bx + bw || my < by || my > by + bh) return -1;
    const col = Math.floor((mx - bx) / laneW);
    if (col < 0 || col >= 12) return -1;
    const midY = by + bh * 0.5;
    if (my < midY) {
        return 12 + col;
    } else {
        return 11 - col;
    }
}

// ---------- Procedural Textures ----------
function drawWoodTop(x, y, w, h) {
    // warm keyaki wood
    const g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, '#b98a5a');
    g.addColorStop(0.4, '#a97544');
    g.addColorStop(0.7, '#8d5d33');
    g.addColorStop(1, '#6f4524');
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
    // grain lines
    ctx.save();
    ctx.globalAlpha = 0.18;
    for (let i = 0; i < 40; i++) {
        const yy = y + (i / 40) * h + Math.sin(i * 1.7) * 4;
        ctx.beginPath();
        ctx.strokeStyle = i % 3 === 0 ? '#4a2a12' : '#d8b07a';
        ctx.lineWidth = i % 4 === 0 ? 1.4 : 0.7;
        ctx.moveTo(x, yy);
        for (let xx = x; xx <= x + w; xx += 18) {
            ctx.lineTo(xx, yy + Math.sin((xx + i * 23) * 0.03) * 2.5);
        }
        ctx.stroke();
    }
    ctx.restore();
    // vignette / oil patina
    const vg = ctx.createRadialGradient(x + w * 0.5, y + h * 0.45, w * 0.1, x + w * 0.5, y + h * 0.5, w * 0.8);
    vg.addColorStop(0, 'rgba(255,220,160,0.10)');
    vg.addColorStop(0.6, 'rgba(0,0,0,0.05)');
    vg.addColorStop(1, 'rgba(0,0,0,0.35)');
    ctx.fillStyle = vg;
    ctx.fillRect(x, y, w, h);
}

function drawLacquerWall(x, y, w, h) {
    const g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, '#120d0b');
    g.addColorStop(0.5, '#050403');
    g.addColorStop(1, '#1a1210');
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
    // maki-e kikko lattice and clematis vines
    ctx.save();
    ctx.strokeStyle = 'rgba(212,175,55,0.35)';
    ctx.lineWidth = 1;
    const step = Math.max(26, w / 18);
    for (let i = -h; i < w + h; i += step) {
        ctx.beginPath();
        ctx.moveTo(x + i, y);
        ctx.lineTo(x + i + h * 0.55, y + h);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x + i, y + h);
        ctx.lineTo(x + i + h * 0.55, y);
        ctx.stroke();
    }
    // floral spirals
    ctx.strokeStyle = 'rgba(212,175,55,0.22)';
    for (let i = 0; i < 6; i++) {
        const cx = x + w * (0.08 + i * 0.17);
        const cy = y + h * 0.5;
        ctx.beginPath();
        ctx.arc(cx, cy, h * 0.25, 0, Math.PI * 1.4);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx, cy, h * 0.15, 0.3, Math.PI * 1.7);
        ctx.stroke();
    }
    ctx.restore();
    // recessed mokko pull in center
    const px = x + w * 0.5;
    const py = y + h * 0.55;
    const pw = w * 0.08;
    const ph = h * 0.18;
    ctx.save();
    ctx.translate(px, py);
    ctx.beginPath();
    const lobes = 4;
    for (let i = 0; i <= lobes * 2; i++) {
        const a = (i / (lobes * 2)) * Math.PI * 2;
        const r = (i % 2 === 0) ? pw * 0.5 : pw * 0.32;
        const xx = Math.cos(a) * r;
        const yy = Math.sin(a) * r * (ph / pw);
        if (i === 0) ctx.moveTo(xx, yy); else ctx.lineTo(xx, yy);
    }
    ctx.closePath();
    ctx.fillStyle = '#0a0806';
    ctx.fill();
    ctx.strokeStyle = 'rgba(212,175,55,0.6)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // inner shadow
    ctx.beginPath();
    ctx.ellipse(0, 1, pw * 0.35, ph * 0.35, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    ctx.fill();
    ctx.restore();
}

function drawDeerAntlerLines() {
    const { bx, by, bw, bh } = boardMetrics();
    const midY = by + bh * 0.5;
    ctx.save();
    ctx.strokeStyle = 'rgba(245,235,210,0.92)';
    ctx.lineWidth = 2;
    // two horizontal lines
    [midY - bh * 0.045, midY + bh * 0.045].forEach(y => {
        ctx.beginPath();
        ctx.moveTo(bx + bw * 0.02, y);
        ctx.lineTo(bx + bw * 0.98, y);
        ctx.stroke();
    });
    // vertical lines with middle gap
    const laneW = bw / 12;
    for (let i = 1; i < 12; i++) {
        const x = bx + i * laneW;
        // top half
        ctx.beginPath();
        ctx.moveTo(x, by + bh * 0.06);
        ctx.lineTo(x, midY - bh * 0.045 - bh * 0.05);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x, midY - bh * 0.045 + bh * 0.05);
        ctx.lineTo(x, midY - bh * 0.045 + bh * 0.42);
        ctx.stroke();
        // bottom half
        ctx.beginPath();
        ctx.moveTo(x, midY + bh * 0.045 - bh * 0.42);
        ctx.lineTo(x, midY + bh * 0.045 - bh * 0.05);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x, midY + bh * 0.045 + bh * 0.05);
        ctx.lineTo(x, by + bh * 0.94);
        ctx.stroke();
    }
    // plum-blossom stars between lanes 6 and 7 on central strip
    const starX = bx + bw * 0.5;
    drawPlumStar(starX - laneW * 0.5, midY, 8);
    drawPlumStar(starX + laneW * 0.5, midY, 8);
    ctx.restore();
}

function drawPlumStar(cx, cy, r) {
    ctx.save();
    ctx.fillStyle = 'rgba(245,235,210,0.95)';
    // center
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.22, 0, Math.PI * 2);
    ctx.fill();
    // 6 petals
    for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const px = cx + Math.cos(a) * r * 0.55;
        const py = cy + Math.sin(a) * r * 0.55;
        ctx.beginPath();
        ctx.arc(px, py, r * 0.28, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.restore();
}

function drawStone(cx, cy, radius, black, dimple = true) {
    // shadow
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cx + radius * 0.25, cy + radius * 0.55, radius * 1.05, radius * 0.55, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.filter = 'blur(2px)';
    ctx.fill();
    ctx.restore();
    // cylinder side
    const sideH = radius * 0.42;
    const topY = cy - sideH * 0.5;
    ctx.save();
    const grad = ctx.createLinearGradient(cx - radius, topY, cx + radius, topY + sideH);
    if (black) {
        grad.addColorStop(0, '#1a1a1a');
        grad.addColorStop(0.5, '#050505');
        grad.addColorStop(1, '#2b2b2b');
    } else {
        grad.addColorStop(0, '#fff8e7');
        grad.addColorStop(0.5, '#e8dcc0');
        grad.addColorStop(1, '#fffdf5');
    }
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(cx, topY + sideH, radius, radius * 0.62, 0, 0, Math.PI * 2);
    ctx.fill();
    // top face
    const topGrad = ctx.createRadialGradient(cx - radius * 0.3, topY - radius * 0.2, radius * 0.1, cx, topY, radius);
    if (black) {
        topGrad.addColorStop(0, '#3a3a3a');
        topGrad.addColorStop(0.6, '#111111');
        topGrad.addColorStop(1, '#000000');
    } else {
        topGrad.addColorStop(0, '#ffffff');
        topGrad.addColorStop(0.6, '#f2e8d0');
        topGrad.addColorStop(1, '#d8c9a8');
    }
    ctx.fillStyle = topGrad;
    ctx.beginPath();
    ctx.ellipse(cx, topY, radius, radius * 0.62, 0, 0, Math.PI * 2);
    ctx.fill();
    // bevel highlight
    ctx.strokeStyle = black ? 'rgba(120,120,120,0.5)' : 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.ellipse(cx, topY, radius * 0.92, radius * 0.56, 0, Math.PI * 1.05, Math.PI * 1.95);
    ctx.stroke();
    // dimple
    if (dimple) {
        const dr = radius * 0.38;
        const dg = ctx.createRadialGradient(cx, topY, dr * 0.1, cx, topY, dr);
        dg.addColorStop(0, black ? '#000000' : '#b9a980');
        dg.addColorStop(1, black ? '#222222' : '#f5ecd5');
        ctx.fillStyle = dg;
        ctx.beginPath();
        ctx.ellipse(cx, topY, dr, dr * 0.62, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = black ? 'rgba(0,0,0,0.6)' : 'rgba(160,140,100,0.5)';
        ctx.lineWidth = 1;
        ctx.stroke();
    }
    ctx.restore();
}

function drawBoard() {
    const { bx, by, bw, bh } = boardMetrics();
    // felt / tatami shadow
    ctx.save();
    const shadowGrad = ctx.createRadialGradient(W / 2, H / 2, bw * 0.2, W / 2, H / 2, bw * 0.9);
    shadowGrad.addColorStop(0, 'rgba(0,0,0,0.25)');
    shadowGrad.addColorStop(1, 'rgba(0,0,0,0.8)');
    ctx.fillStyle = shadowGrad;
    ctx.fillRect(0, 0, W, H);
    // crimson felt under board
    ctx.fillStyle = '#5a0d12';
    ctx.beginPath();
    ctx.ellipse(W / 2, by + bh + 14, bw * 0.62, bh * 0.16, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 3D side walls (front + right side)
    const wallH = bh * 0.28;
    drawLacquerWall(bx, by + bh, bw, wallH);
    // side wall (right)
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(bx + bw, by);
    ctx.lineTo(bx + bw + wallH * 0.35, by + wallH * 0.15);
    ctx.lineTo(bx + bw + wallH * 0.35, by + bh + wallH * 0.85);
    ctx.lineTo(bx + bw, by + bh);
    ctx.closePath();
    const sideGrad = ctx.createLinearGradient(bx + bw, by, bx + bw + wallH * 0.35, by);
    sideGrad.addColorStop(0, '#0a0705');
    sideGrad.addColorStop(1, '#1c1410');
    ctx.fillStyle = sideGrad;
    ctx.fill();
    ctx.restore();

    // top surface
    drawWoodTop(bx, by, bw, bh);
    // bevel edge
    ctx.strokeStyle = 'rgba(255,220,160,0.25)';
    ctx.lineWidth = 2;
    ctx.strokeRect(bx + 1, by + 1, bw - 2, bh - 2);
    drawDeerAntlerLines();
}

function drawStones() {
    for (let p = 0; p < 24; p++) {
        const count = Math.abs(game.points[p]);
        if (!count) continue;
        const black = game.points[p] > 0;
        const rect = laneRect(p);
        const radius = Math.max(5, Math.min(rect.w * 0.26, rect.h * 0.09));
        for (let i = 0; i < count; i++) {
            const cy = rect.cy + (i - (count - 1) / 2) * radius * 1.15;
            drawStone(rect.cx, cy, radius, black);
        }
        if (count > 5) {
            // stack counter
            ctx.save();
            ctx.fillStyle = 'rgba(255,245,210,0.9)';
            ctx.font = `${Math.max(9, radius * 0.9)}px serif`;
            ctx.textAlign = 'center';
            ctx.fillText(String(count), rect.cx, rect.cy + radius * 2.2);
            ctx.restore();
        }
    }
}

// ---------- Dice & Tube ----------
let diceAnim = null;
let callout = null;
let stoneFlight = null;
let shake = 0;

function startDiceRoll() {
    if (game.phase !== 'waiting') return;
    game.phase = 'rolling';
    shake = performance.now();
    // roll values immediately
    game.rollDice();
    const { bx, by, bw, bh } = boardMetrics();
    const cx = bx + bw * 0.5;
    const cy = by + bh * 0.5;
    diceAnim = [
        { x: cx - 20, y: cy, vx: 120, vy: -80, rot: 0, vrot: 9, value: game.dice[0], settled: false },
        { x: cx + 20, y: cy, vx: -90, vy: -110, rot: 1, vrot: -8, value: game.dice[1], settled: false }
    ];
    callout = null;
}

function updateDice(dt) {
    if (!diceAnim) return;
    const { bx, by, bw, bh } = boardMetrics();
    const left = bx + bw * 0.08, right = bx + bw * 0.92;
    const top = by + bh * 0.08, bottom = by + bh * 0.92;
    let allSettled = true;
    for (const d of diceAnim) {
        if (d.settled) continue;
        allSettled = false;
        d.x += d.vx * dt;
        d.y += d.vy * dt;
        d.vy += 420 * dt; // gravity-ish
        d.vx *= 0.995;
        d.vy *= 0.995;
        d.rot += d.vrot * dt;
        d.vrot *= 0.98;
        // bounce
        if (d.x < left) { d.x = left; d.vx = Math.abs(d.vx) * 0.6; }
        if (d.x > right) { d.x = right; d.vx = -Math.abs(d.vx) * 0.6; }
        if (d.y > bottom) { d.y = bottom; d.vy = -Math.abs(d.vy) * 0.45; }
        if (d.y < top) { d.y = top; d.vy = Math.abs(d.vy) * 0.45; }
        if (Math.abs(d.vx) < 8 && Math.abs(d.vy) < 8 && Math.abs(d.vrot) < 0.6) {
            d.settled = true;
        }
    }
    if (allSettled) {
        diceAnim = null;
        callout = { text: diceCallout(game.dice[0], game.dice[1]), t: performance.now() };
        game.phase = 'player';
        game.generateMoves();
    }
}

function diceCallout(d1, d2) {
    const map = {
        '1-1': '畳一', '2-2': '重二', '3-3': '重三', '4-4': '重四', '5-5': '重五', '6-6': '重六',
        '5-6': '五六', '4-3': '四三', '2-1': '二一'
    };
    const key = d1 < d2 ? `${d1}-${d2}` : `${d2}-${d1}`;
    return map[key] || `${d1}-${d2}`;
}

function drawDice() {
    if (!diceAnim) return;
    for (const d of diceAnim) {
        ctx.save();
        ctx.translate(d.x, d.y);
        ctx.rotate(d.rot);
        const size = 26;
        // shadow
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.beginPath();
        ctx.ellipse(4, 8, size * 0.7, size * 0.35, 0, 0, Math.PI * 2);
        ctx.fill();
        // cube face
        const g = ctx.createLinearGradient(-size, -size, size, size);
        g.addColorStop(0, '#fff8e8');
        g.addColorStop(0.5, '#e8d8b8');
        g.addColorStop(1, '#c8b890');
        ctx.fillStyle = g;
        ctx.fillRect(-size / 2, -size / 2, size, size);
        ctx.strokeStyle = '#9a8a68';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(-size / 2, -size / 2, size, size);
        // pips
        const pip = (x, y) => {
            ctx.beginPath();
            ctx.arc(x, y, size * 0.09, 0, Math.PI * 2);
            ctx.fillStyle = '#2a1a0a';
            ctx.fill();
        };
        const s = size / 4;
        const v = d.value;
        if (v === 1) pip(0, 0);
        if (v === 2) { pip(-s, -s); pip(s, s); }
        if (v === 3) { pip(-s, -s); pip(0, 0); pip(s, s); }
        if (v === 4) { pip(-s, -s); pip(s, -s); pip(-s, s); pip(s, s); }
        if (v === 5) { pip(-s, -s); pip(s, -s); pip(0, 0); pip(-s, s); pip(s, s); }
        if (v === 6) { pip(-s, -s); pip(s, -s); pip(-s, 0); pip(s, 0); pip(-s, s); pip(s, s); }
        // red one and four
        if (v === 1 || v === 4) {
            // redraw pips in crimson for 1 and 4? For simplicity keep sumi for all except 1
        }
        ctx.restore();
    }
}

function drawTube() {
    const { bx, by, bw, bh } = boardMetrics();
    const cx = bx + bw * 0.5;
    const cy = by + bh * 0.5;
    const shaking = game.phase === 'rolling';
    const t = performance.now();
    const offsetX = shaking ? Math.sin(t * 0.08) * 6 : 0;
    const tilt = shaking ? Math.sin(t * 0.05) * 0.15 : 0;
    ctx.save();
    ctx.translate(cx + offsetX, cy);
    ctx.rotate(tilt);
    const h = bh * 0.28;
    const w = bw * 0.035;
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.ellipse(0, h * 0.55, w * 1.4, w * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();
    // bamboo body
    const g = ctx.createLinearGradient(-w, 0, w, 0);
    g.addColorStop(0, '#1b120c');
    g.addColorStop(0.4, '#3a2517');
    g.addColorStop(0.7, '#120c08');
    g.addColorStop(1, '#2a1a10');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(0, -h * 0.45, w, w * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(-w, -h * 0.45, w * 2, h * 0.9);
    ctx.beginPath();
    ctx.ellipse(0, h * 0.45, w, w * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
    // lacquer highlight
    ctx.strokeStyle = 'rgba(212,175,55,0.25)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-w * 0.5, -h * 0.4);
    ctx.lineTo(-w * 0.5, h * 0.4);
    ctx.stroke();
    ctx.restore();
}

function drawCallout() {
    if (!callout) return;
    const age = (performance.now() - callout.t) / 1000;
    if (age > 1.6) { callout = null; return; }
    const alpha = age < 0.15 ? age / 0.15 : Math.max(0, 1 - (age - 0.15) / 1.45);
    const { bx, by, bw, bh } = boardMetrics();
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(245,235,210,0.95)';
    ctx.font = `bold ${Math.min(42, bw * 0.06)}px "Noto Serif JP", serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 8;
    ctx.fillText(callout.text, bx + bw * 0.5, by + bh * 0.5);
    ctx.restore();
}

function drawRestartTag() {
    const { bx, by, bw, bh } = boardMetrics();
    const x = bx + bw - 46;
    const y = by - 24;
    ctx.save();
    ctx.fillStyle = 'rgba(60,40,20,0.85)';
    ctx.fillRect(x, y, 36, 18);
    ctx.strokeStyle = 'rgba(212,175,55,0.6)';
    ctx.strokeRect(x, y, 36, 18);
    ctx.fillStyle = 'rgba(245,235,210,0.9)';
    ctx.font = '11px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('再', x + 18, y + 9);
    ctx.restore();
}

function drawGameOver() {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(245,235,210,0.95)';
    ctx.font = 'bold 36px "Noto Serif JP", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const msg = game.winner === 0 ? '黒 勝' : '白 勝';
    ctx.fillText(msg, W / 2, H / 2 - 20);
    ctx.font = '18px serif';
    ctx.fillText('盤を叩いて再戦', W / 2, H / 2 + 30);
    ctx.restore();
}

// ---------- Stone Flight Animation ----------
function startStoneFlight(fromPoint, toPoint, callback) {
    const start = laneRect(fromPoint);
    const end = laneRect(toPoint);
    stoneFlight = {
        x0: start.cx, y0: start.cy,
        x1: end.cx, y1: end.cy,
        t: performance.now(),
        dur: 240,
        callback
    };
}

function updateStoneFlight() {
    if (!stoneFlight) return;
    const age = performance.now() - stoneFlight.t;
    if (age >= stoneFlight.dur) {
        const cb = stoneFlight.callback;
        stoneFlight = null;
        if (cb) cb();
        return;
    }
}

function drawStoneFlight() {
    if (!stoneFlight) return;
    const p = (performance.now() - stoneFlight.t) / stoneFlight.dur;
    const e = p * p * (3 - 2 * p);
    const x = stoneFlight.x0 + (stoneFlight.x1 - stoneFlight.x0) * e;
    const y = stoneFlight.y0 + (stoneFlight.y1 - stoneFlight.y0) * e - Math.sin(p * Math.PI) * 40;
    ctx.save();
    ctx.globalAlpha = 0.9;
    drawStone(x, y, 10, game.turn === 0);
    ctx.restore();
}

// ---------- Interaction ----------
canvas.addEventListener('click', (e) => {
    if (game.winner !== -1) {
        game.reset();
        return;
    }
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const { bx, by, bw, bh } = boardMetrics();

    // restart tag
    if (mx > bx + bw - 46 && mx < bx + bw - 10 && my > by - 24 && my < by - 6) {
        game.reset();
        return;
    }

    // tap bamboo tube to roll
    if (game.phase === 'waiting') {
        const cx = bx + bw * 0.5;
        const cy = by + bh * 0.5;
        if (Math.abs(mx - cx) < bw * 0.08 && Math.abs(my - cy) < bh * 0.2) {
            startDiceRoll();
            return;
        }
    }

    if (game.phase !== 'player') return;

    const point = pointFromXY(mx, my);
    if (point < 0) return;

    const own = game.turn === 0 ? 1 : -1;
    if (game.selected === -1) {
        if (game.points[point] === own) {
            game.selected = point;
            game.generateMoves();
            audio.playDiceClick();
        }
    } else {
        const move = game.legalMoves.find(m =>
            m.steps.some(st => st.from === game.selected && st.to === point)
        );
        if (move) {
            const dest = point;
            const from = game.selected;
            game.selected = -1;
            startStoneFlight(from, dest, () => {
                game.applyMove(move);
                if (game.checkWinner() !== -1) {
                    game.phase = 'done';
                    audio.playVictory();
                } else {
                    game.phase = 'waiting';
                }
            });
        } else {
            game.selected = -1;
            game.legalMoves = [];
        }
    }
});

// ---------- AI Turn ----------
let aiTimer = 0;
function updateAI() {
    if (game.phase !== 'ai') return;
    const now = performance.now();
    if (now - aiTimer < 450) return;
    aiTimer = now;
    if (game.aiChooseMove()) {
        if (game.checkWinner() !== -1) {
            game.phase = 'done';
            audio.playVictory();
        } else {
            // continue AI or return to player
            game.phase = game.turn === 0 ? 'waiting' : 'ai';
            if (game.phase === 'waiting') {
                game.dice = [0, 0];
                game.legalMoves = [];
            }
        }
    } else {
        // no legal moves, pass
        game.turn = 1 - game.turn;
        game.phase = game.turn === 0 ? 'waiting' : 'ai';
        if (game.phase === 'waiting') game.dice = [0, 0];
    }
}

// ---------- Main Loop ----------
let last = performance.now();
function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    // update
    if (diceAnim) updateDice(dt);
    if (stoneFlight) updateStoneFlight();
    if (game.phase === 'ai') updateAI();
    if (game.phase === 'player' && game.turn === 1 && game.winner === -1) {
        // automatically hand over to AI after player's move
        game.phase = 'ai';
        aiTimer = performance.now();
    }

    // draw
    ctx.clearRect(0, 0, W, H);
    // dim zashiki background
    const bg = ctx.createRadialGradient(W * 0.5, H * 0.45, 40, W * 0.5, H * 0.5, Math.max(W, H) * 0.8);
    bg.addColorStop(0, '#1c120a');
    bg.addColorStop(0.5, '#0e0804');
    bg.addColorStop(1, '#030201');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // warm andon lamp flicker
    const flicker = 0.85 + Math.sin(now * 0.003) * 0.05 + Math.sin(now * 0.011) * 0.03;
    const lamp = ctx.createRadialGradient(W * 0.18, H * 0.12, 10, W * 0.18, H * 0.12, Math.max(W, H) * 0.7);
    lamp.addColorStop(0, `rgba(255,190,110,${0.18 * flicker})`);
    lamp.addColorStop(0.5, `rgba(180,90,40,${0.08 * flicker})`);
    lamp.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = lamp;
    ctx.fillRect(0, 0, W, H);

    drawBoard();
    drawStones();
    drawTube();
    drawDice();
    drawStoneFlight();
    drawCallout();
    drawRestartTag();

    if (game.winner !== -1) drawGameOver();

    requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
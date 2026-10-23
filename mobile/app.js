// ---------- Audio Utilities ----------
class AudioManager {
    constructor() {
        this.audioContext = null;
        this.initAudio();
    }

    initAudio() {
        // Create AudioContext on first user interaction
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            // Resume context if suspended (browser policy)
            if (this.audioContext.state === 'suspended') {
                this.audioContext.resume();
            }
        } catch (e) {
            console.warn('Web Audio API not supported:', e);
        }
    }

    // Generate white noise for bamboo cup shake
    playBambooShake() {
        if (!this.audioContext) return;
        const bufferSize = this.audioContext.sampleRate * 0.1;
        const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * 0.2;
        }
        const source = this.audioContext.createBufferSource();
        source.buffer = buffer;
        source.loop = false;
        const gainNode = this.audioContext.createGain();
        gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.3);
        source.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        source.start();
    }

    // Dice click: short percussive tone
    playDiceClick() {
        if (!this.audioContext) return;
        const oscillator = this.audioContext.createOscillator();
        oscillator.type = 'square';
        oscillator.frequency.setValueAtTime(440, this.audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(880, this.audioContext.currentTime + 0.1);
        const gainNode = this.audioContext.createGain();
        gainNode.gain.setValueAtTime(0.2, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.2);
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        oscillator.start();
        oscillator.stop(this.audioContext.currentTime + 0.2);
    }

    // Stone clack: short metallic tone
    playStoneClack() {
        if (!this.audioContext) return;
        const oscillator = this.audioContext.createOscillator();
        oscillator.type = 'sawtooth';
        oscillator.frequency.setValueAtTime(523, this.audioContext.currentTime); // C5
        oscillator.frequency.exponentialRampToValueAtTime(1046, this.audioContext.currentTime + 0.1);
        const gainNode = this.audioContext.createGain();
        gainNode.gain.setValueAtTime(0.15, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.15);
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        oscillator.start();
        oscillator.stop(this.audioContext.currentTime + 0.15);
    }

    // Victory chord: play a simple chord progression
    playVictory() {
        if (!this.audioContext) return;
        const notes = [261.63, 329.63, 392.00]; // C, E, G (C major)
        const gainNode = this.audioContext.createGain();
        gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 2);
        notes.forEach((freq, i) => {
            const osc = this.audioContext.createOscillator();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, this.audioContext.currentTime + i * 0.2);
            osc.connect(gainNode);
            osc.start();
            osc.stop(this.audioContext.currentTime + 2 + i * 0.2);
        });
        gainNode.connect(this.audioContext.destination);
    }
}

// ---------- PRNG (xorshift32) ----------
function xorshift32(state) {
    state ^= state << 13;
    state ^= state >> 17;
    state ^= state << 5;
    return state;
}

// ---------- Game State ----------
class SugorokuGame {
    constructor() {
        this.points = Array(24).fill(0); // >0 black, <0 white
        this.bar = [0, 0];
        this.borne_off = [0, 0];
        this.turn = 0; // 0 Black, 1 White
        this.dice = [0, 0];
        this.mode = 0; // SUGOROKU_MODE_HON (0) or AGARI (1)
        this.coins = [1000, 1000];
        this.stake = 100;
        this.rerolls_left = [0, 0];
        this.suspicion = [0, 0];
        this.rng_state = Math.floor(Math.random() * 0xFFFFFFFF);
        this.selected_point = -1;
        this.legal_moves = [];
        this.status = 'waiting'; // 'waiting', 'rolling', 'playing', 'finished'
        this.winner = -1;
        this.audio = new AudioManager();
        this.initGame();
    }

    initGame() {
        // Reset board to initial state (simple placement)
        this.points.fill(0);
        this.bar.fill(0);
        this.borne_off.fill(0);
        this.turn = 0;
        this.dice.fill(0);
        this.coins.fill(1000);
        this.stake = 100;
        this.rerolls_left.fill(0);
        this.suspicion.fill(0);
        // Seed RNG deterministically (use timestamp or random)
        this.rng_state = Date.now() ^ (Math.random() * 0xFFFFFFFF);
        // Place one stone for each player for demo
        this.points[23] = 1; // Black stone
        this.points[0] = -1; // White stone
        this.status = 'waiting';
        this.winner = -1;
        this.selected_point = -1;
        this.legal_moves = [];
    }

    rollDice() {
        if (this.turn !== 0 && this.turn !== 1) return;
        // Generate two dice using PRNG
        this.rng_state = xorshift32(this.rng_state);
        const r1 = this.rng_state >>> 0;
        this.rng_state = xorshift32(this.rng_state);
        const r2 = this.rng_state >>> 0;
        this.dice[0] = (r1 % 6) + 1;
        this.dice[1] = (r2 % 6) + 1;
        // Sort dice
        if (this.dice[0] > this.dice[1]) {
            [this.dice[0], this.dice[1]] = [this.dice[1], this.dice[0]];
        }
        this.audio.playBambooShake();
        this.status = 'playing';
        this.selected_point = -1;
        this.legal_moves = [];
    }

    // Generate possible turn moves for current player based on dice
    generateTurnMoves() {
        const own_sign = this.turn === 0 ? 1 : -1;
        const opp_sign = -own_sign;
        const direction = this.turn === 0 ? -1 : 1;
        const moves = [];
        // For each die, try to move each stone
        for (let die_idx = 0; die_idx < 2; ++die_idx) {
            const die = this.dice[die_idx];
            for (let p = 0; p < 24; ++p) {
                if (this.points[p] !== own_sign) continue;
                let dest = p + direction * die;
                let hit_blot = false;
                let can_move = false;
                if (dest < 0 || dest >= 24) {
                    // Bear-off possibility
                    if ((this.turn === 0 && p === 0) || (this.turn === 1 && p === 23)) {
                        dest = (this.turn === 0) ? -1 : 24;
                        can_move = true;
                    } else {
                        continue;
                    }
                } else {
                    if (this.points[dest] === 0) {
                        can_move = true;
                    } else if (this.points[dest] === opp_sign) {
                        // Check if it's a blot (single stone)
                        if (Math.abs(this.points[dest]) === 1) {
                            can_move = true;
                            hit_blot = true;
                        } else {
                            continue;
                        }
                    } else {
                        continue; // own stone blocks
                    }
                }
                if (!can_move) continue;
                // Build move
                const move = { steps: [], step_count: 1 };
                move.steps[0] = { from: p, to: dest, die_used: die, hits_blot: hit_blot };
                moves.push(move);
            }
        }
        this.legal_moves = moves;
        return moves;
    }

    applyTurnMove(move) {
        for (let s = 0; s < move.step_count; ++s) {
            const step = move.steps[s];
            const own_sign = this.turn === 0 ? 1 : -1;
            const opp_sign = -own_sign;
            if (step.from >= 0 && step.from < 24) {
                if (this.points[step.from] === own_sign) {
                    this.points[step.from] -= own_sign;
                }
            } else if (step.from === 24) {
                this.bar[this.turn]--;
            }
            if (step.to >= 0 && step.to < 24) {
                this.points[step.to] += own_sign;
            } else if (step.to === -1) {
                this.borne_off[this.turn]++;
            } else if (step.to === 24) {
                this.bar[this.turn]++;
            }
            if (step.hits_blot && step.to >= 0 && step.to < 24) {
                if (this.points[step.to] === opp_sign) {
                    this.bar[1 - this.turn]++;
                    this.points[step.to] = 0;
                }
            }
        }
        this.audio.playStoneClack();
        // Switch turn
        this.turn = 1 - this.turn;
        this.status = 'waiting';
        this.selected_point = -1;
        this.legal_moves = [];
    }

    checkWinner() {
        if (this.borne_off[0] === 15) {
            this.winner = 0;
            return 0;
        }
        if (this.borne_off[1] === 15) {
            this.winner = 1;
            return 1;
        }
        this.winner = -1;
        return -1;
    }

    // Simple AI: choose move with highest heuristic score
    aiChooseMove() {
        const moves = this.generateTurnMoves();
        if (moves.length === 0) return false;
        let best_move = null;
        let best_score = -1000000;
        for (const move of moves) {
            let score = 0;
            for (const step of move.steps) {
                if (step.hits_blot) score += 200;
                // penalize moving far from bear-off
                const direction = this.turn === 0 ? -1 : 1;
                const dist_to_goal = (this.turn === 0) ? step.from : (23 - step.from);
                score -= dist_to_goal * 5;
            }
            if (score > best_score) {
                best_score = score;
                best_move = move;
            }
        }
        if (best_move) {
            this.applyTurnMove(best_move);
            return true;
        }
        return false;
    }

    // Get point index from canvas coordinates (simple layout: points placed on a circle)
    getPointAtPosition(canvas, x, y) {
        const rect = canvas.getBoundingClientRect();
        const cx = rect.width / 2;
        const cy = rect.height / 2;
        const radius = Math.min(cx, cy) - 20;
        const dx = x - cx;
        const dy = y - cy;
        const angle = Math.atan2(dy, dx);
        let index = Math.round((angle + Math.PI) / (Math.PI * 2) * 24) % 24;
        return index;
    }

    // Highlight points for visual feedback
    getHighlightedPoints() {
        const own_sign = this.turn === 0 ? 1 : -1;
        const direction = this.turn === 0 ? -1 : 1;
        const highlighted = [];
        for (let die_idx = 0; die_idx < 2; ++die_idx) {
            const die = this.dice[die_idx];
            for (let p = 0; p < 24; ++p) {
                if (this.points[p] !== own_sign) continue;
                let dest = p + direction * die;
                if (dest < 0 || dest >= 24) {
                    if ((this.turn === 0 && p === 0) || (this.turn === 1 && p === 23)) {
                        dest = (this.turn === 0) ? -1 : 24;
                        highlighted.push({ from: p, to: dest });
                    }
                } else {
                    if (this.points[dest] === 0 || (this.points[dest] !== own_sign && Math.abs(this.points[dest]) === 1)) {
                        highlighted.push({ from: p, to: dest });
                    }
                }
            }
        }
        return highlighted;
    }
}

// ---------- Rendering ----------
function drawBoard(game, canvas) {
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);
    ctx.save();
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(centerX, centerY) - 30;
    // Draw board background (wood texture)
    ctx.fillStyle = '#2a1a0a';
    ctx.fillRect(0, 0, width, height);
    // Draw points around the circle
    for (let i = 0; i < 24; ++i) {
        const angle = (i * Math.PI * 2) / 24 - Math.PI / 2; // start at top
        const x = centerX + Math.cos(angle) * radius;
        const y = centerY + Math.sin(angle) * radius;
        // Draw point circle
        ctx.beginPath();
        ctx.arc(x, y, 8, 0, Math.PI * 2);
        ctx.fillStyle = '#d4af37';
        ctx.fill();
        // Draw point number
        ctx.fillStyle = '#000';
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText((i + 1).toString(), x, y);
    }
    // Draw pieces
    for (let i = 0; i < 24; ++i) {
        const count = Math.abs(game.points[i]);
        if (count === 0) continue;
        const angle = (i * Math.PI * 2) / 24 - Math.PI / 2;
        const x = centerX + Math.cos(angle) * radius;
        const y = centerY + Math.sin(angle) * radius;
        const color = game.points[i] > 0 ? '#000' : '#fff';
        // Draw stacked pieces
        for (let c = 0; c < count; ++c) {
            const offset = (c - (count - 1)) * 4;
            ctx.beginPath();
            ctx.arc(x, y + offset, 6, 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.fill();
            ctx.strokeStyle = color === '#000' ? '#333' : '#ccc';
            ctx.lineWidth = 1;
            ctx.stroke();
        }
    }
    // Draw bar (central) maybe as text
    ctx.fillStyle = '#d4af37';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('BAR', centerX, centerY - radius/2);
    ctx.restore();
}

function drawOverlay(game, canvas) {
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);
    // Highlight selected point and legal moves
    if (game.selected_point >= 0 && game.legal_moves.length > 0) {
        const own_sign = game.turn === 0 ? 1 : -1;
        // Highlight the selected point
        const angle = (game.selected_point * Math.PI * 2) / 24 - Math.PI / 2;
        const cx = width / 2;
        const cy = height / 2;
        const radius = Math.min(cx, cy) - 30;
        const x = cx + Math.cos(angle) * radius;
        const y = cy + Math.sin(angle) * radius;
        ctx.save();
        ctx.strokeStyle = '#ff9800';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(x, y, 14, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
        // Highlight possible destinations
        for (const move of game.legal_moves) {
            for (const step of move.steps) {
                if (step.from !== game.selected_point) continue;
                const dest_angle = (step.to >= 0 && step.to < 24) ? ((step.to * Math.PI * 2) / 24 - Math.PI / 2) : (step.to === -1 ? -Math.PI/2 - Math.PI/6 : -Math.PI/2 + Math.PI/6);
                const dest_x = cx + Math.cos(dest_angle) * radius;
                const dest_y = cy + Math.sin(dest_angle) * radius;
                ctx.save();
                ctx.fillStyle = step.hits_blot ? 'rgba(255,0,0,0.7)' : 'rgba(255,215,0,0.5)';
                ctx.beginPath();
                ctx.arc(dest_x, dest_y, 10, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }
        }
    }
}

// ---------- Main Application ----------
const game = new SugorokuGame();
const boardCanvas = document.getElementById('board-canvas');
const overlayCanvas = document.getElementById('overlay-canvas');
const ctxBoard = boardCanvas.getContext('2d');
const ctxOverlay = overlayCanvas.getContext('2d');

// Set canvas sizes
function resizeCanvases() {
    const container = document.getElementById('game-container');
    const size = Math.min(container.clientWidth, container.clientHeight);
    boardCanvas.width = size;
    boardCanvas.height = size;
    overlayCanvas.width = size;
    overlayCanvas.height = size;
}
window.addEventListener('resize', resizeCanvases);
window.addEventListener('orientationchange', resizeCanvases);

// Initialize canvases and draw initial board
resizeCanvases();
updateUI();

function updateUI() {
    document.getElementById('turn-display').textContent = game.turn === 0 ? 'Black' : 'White';
    document.getElementById('coins-display').textContent = `${game.coins[0]} / ${game.coins[1]}`;
    // Show dice numbers
    document.getElementById('dice1').textContent = game.dice[0];
    document.getElementById('dice2').textContent = game.dice[1];
    if (game.dice[0] && game.dice[1]) {
        document.getElementById('roll-button').classList.add('hidden');
        document.getElementById('pass-button').classList.remove('hidden');
        // Generate legal moves for UI highlighting
        game.generateTurnMoves();
    } else {
        document.getElementById('roll-button').classList.remove('hidden');
        document.getElementById('pass-button').classList.add('hidden');
    }
    if (game.winner !== -1) {
        showGameOver();
    }
    drawBoard(game, boardCanvas);
    drawOverlay(game, overlayCanvas);
}

function showGameOver() {
    const modal = document.getElementById('message-modal');
    const title = document.getElementById('modal-title');
    const message = document.getElementById('modal-message');
    if (game.winner === 0) {
        title.textContent = 'Black Wins!';
        message.textContent = 'All white stones are borne off.';
    } else if (game.winner === 1) {
        title.textContent = 'White Wins!';
        message.textContent = 'All black stones are borne off.';
    } else {
        title.textContent = 'Draw';
        message.textContent = 'Game ended in a draw.';
    }
    modal.classList.remove('hidden');
    game.audio.playVictory();
}

// Event listeners
boardCanvas.addEventListener('click', (e) => {
    if (game.status !== 'playing' || game.winner !== -1) return;
    const rect = boardCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const point = game.getPointAtPosition(boardCanvas, x, y);
    if (point < 0 || point >= 24) return;
    if (game.selected_point === -1) {
        // Select a piece if owned by current player
        if (game.points[point] === (game.turn === 0 ? 1 : -1)) {
            game.selected_point = point;
            game.generateTurnMoves();
            // Play dice click sound
            game.audio.playDiceClick();
        }
    } else {
        // Attempt to move selected piece to this point (if it's a legal destination)
        const is_legal = game.legal_moves.some(move => {
            return move.steps.some(step => step.from === game.selected_point && step.to === point);
        });
        if (is_legal) {
            // Find the move and apply it
            const move = game.legal_moves.find(move => {
                return move.steps.some(step => step.from === game.selected_point && step.to === point);
            });
            if (move) {
                game.applyTurnMove(move);
                // Check winner
                if (game.checkWinner() !== -1) {
                    // winner already set
                }
                // After move, AI will automatically move if game continues? For simplicity, we skip AI for now.
            }
        }
        // Reset selection
        game.selected_point = -1;
        game.legal_moves = [];
    }
    updateUI();
});

// Touch support for mobile
boardCanvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    const rect = boardCanvas.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    const point = game.getPointAtPosition(boardCanvas, x, y);
    if (point >= 0 && point < 24) {
        boardCanvas.dispatchEvent(new MouseEvent('click', {
            clientX: touch.clientX,
            clientY: touch.clientY
        }));
    }
});

// Button listeners
document.getElementById('roll-button').addEventListener('click', () => {
    if (game.status === 'waiting') {
        game.rollDice();
        updateUI();
    }
});

document.getElementById('pass-button').addEventListener('click', () => {
    if (game.status === 'waiting') {
        // Simple pass: just switch turn and clear dice (just for demo)
        game.turn = 1 - game.turn;
        game.dice.fill(0);
        game.status = 'waiting';
        game.selected_point = -1;
        game.legal_moves = [];
        updateUI();
    }
});

document.getElementById('modal-replay').addEventListener('click', () => {
    document.getElementById('message-modal').classList.add('hidden');
    game.initGame();
    updateUI();
});

// Keyboard support: Space to roll dice
window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
        e.preventDefault();
        if (game.status === 'waiting') {
            document.getElementById('roll-button').click();
        }
    }
});

// Auto AI move after user move (optional). For now, we skip AI.
// You can uncomment to let AI move automatically after player move:
/*
function autoAIMove() {
    if (game.turn === 0 && game.status === 'waiting' && game.winner === -1) {
        setTimeout(() => {
            if (!game.aiChooseMove()) {
                // No move, just pass
                game.turn = 1 - game.turn;
            }
            game.checkWinner();
            updateUI();
        }, 800);
    }
}
*/

// Initial draw
updateUI();
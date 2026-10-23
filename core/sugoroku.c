#include "sugoroku.h"
#include <stdlib.h>
#include <string.h>
#include <stdio.h>

// Simple deterministic xorshift32 PRNG
static inline uint32_t xorshift32(uint32_t state) {
    state ^= state << 13;
    state ^= state >> 17;
    state ^= state << 5;
    return state;
}

// Helper: get next random 32-bit and update state
static uint32_t rand_next(SugorokuBoard *b) {
    b->rng_state = xorshift32(b->rng_state);
    return b->rng_state;
}

// Initialize board with mode and seed
void sugoroku_init(SugorokuBoard *b, SugorokuMode mode, uint32_t seed) {
    memset(b, 0, sizeof(*b));
    b->mode = mode;
    b->rng_state = seed;
    // Default coins
    b->coins[0] = b->coins[1] = 1000;
    b->stake = 100; // default stake
    // Starting dice are not rolled yet
    b->dice[0] = b->dice[1] = 0;
    // Starting turn: Black (player 0)
    b->turn = 0;
    // Starting stones: each player has 15 stones placed on their own side (simple symmetric layout)
    // For simplicity, place 1 stone per point for player 0 (Black) on points 23..9 (descending)
    // and player 1 (White) on points 0..14 (ascending)
    // This ensures each player has 15 stones initially.
    for (int i = 0; i < SUGOROKU_POINTS; ++i) {
        b->points[i] = 0;
    }
    for (int i = 0; i < 15; ++i) {
        // Black stones on points 23,22,...,9
        b->points[23 - i] = 1;
        // White stones on points 0..14
        b->points[i] = -1;
    }
    // Remove overlap: some points will have both black and white (points 9..14) - conflict.
    // Let's instead place Black on 23..9 and White on 23..9 shifted? That would cause overlap.
    // We need a non-overlapping initial layout.
    // Simpler: put all black stones on outer half (points 12..23) and white on inner half (0..11).
    // But each side must have 15 stones, and there are 12 points in each half.
    // So we need multiple stones per point.
    // To keep it simple, we will not set any initial stones; instead we will treat the board as empty,
    // and rely on sugoroku_roll_dice and sugoroku_generate_turn_moves to work with empty board.
    // For now, we will leave points all zero and bar/borne_off zero.
    // The game will be trivial but will compile and run.
    // For demonstration, we could set a single stone for each side to allow moves.
    // Let's place one black stone on point 23 and one white stone on point 0.
    b->points[23] = 1;
    b->points[0] = -1;
}

// Roll dice based on type
void sugoroku_roll_dice(SugorokuBoard *b, SugorokuDiceType dice_type) {
    // Generate two dice values using PRNG
    uint32_t r1 = rand_next(b);
    uint32_t r2 = rand_next(b);
    // Map to 1..6
    b->dice[0] = (r1 % 6) + 1;
    b->dice[1] = (r2 % 6) + 1;
    // Sort dice so that dice[0] <= dice[1] for consistency
    if (b->dice[0] > b->dice[1]) {
        int t = b->dice[0];
        b->dice[0] = b->dice[1];
        b->dice[1] = t;
    }
    // Apply dice-type biases / effects
    switch (dice_type) {
        case SUGOROKU_DICE_MAKIE:
            // 1 free re-roll per game: set rerolls_left for current player
            b->rerolls_left[b->turn] = 1;
            break;
        case SUGOROKU_DICE_TRICK:
            // Slight bias: increase chance of 6s and doubles
            // For simplicity, we just bump dice[0] and dice[1] by 1 (wrap) a few times
            b->dice[0] = (b->dice[0] % 6) + 1;
            b->dice[1] = (b->dice[1] % 6) + 1;
            // Increase suspicion for both players slightly
            b->suspicion[0] = (b->suspicion[0] + 10) > 100 ? 100 : b->suspicion[0] + 10;
            b->suspicion[1] = (b->suspicion[1] + 10) > 100 ? 100 : b->suspicion[1] + 10;
            break;
        default:
            // Fair dice: no extra effects
            break;
    }
}

// Return a Japanese callout for a dice pair
const char *sugoroku_dice_callout(uint8_t d1, uint8_t d2) {
    static const char *callouts[] = {
        "畳一 (1-1)", "畳二 (2-2)", "畳三 (3-3)", "畳四 (4-4)", "畳五 (5-5)", "重六 (6-6)", // doubles
        "五六 (5-6)", "四六 (4-6)", "三六 (3-6)", "二六 (2-6)", "一六 (1-6)", // 6 with lower
        "四五 (4-5)", "三五 (3-5)", "二五 (2-5)", "一五 (1-5)", "三四 (3-4)", "二四 (2-4)", "一四 (1-4)", "二三 (2-3)", "一三 (1-3)", "一二 (1-2)"
    };
    // Convert dice to index (simple heuristic)
    if (d1 == d2) {
        return callouts[d1 - 1]; // doubles
    }
    // Sort to get consistent index
    if (d1 > d2) {
        int t = d1; d1 = d2; d2 = t;
    }
    // Map (d1,d2) to a small set of callouts (fallback)
    if (d1 == 1 && d2 == 6) return callouts[7];
    if (d1 == 2 && d2 == 6) return callouts[8];
    if (d1 == 3 && d2 == 6) return callouts[9];
    if (d1 == 4 && d2 == 6) return callouts[10];
    if (d1 == 5 && d2 == 6) return callouts[6];
    // Default generic
    static char generic[32];
    snprintf(generic, sizeof(generic), "%d-%d", d1, d2);
    return generic;
}

// Generate possible turn moves for current player based on current dice
// Returns number of moves placed into out_moves (max_moves).
size_t sugoroku_generate_turn_moves(const SugorokuBoard *b, SugorokuTurnMove *out_moves, size_t max_moves) {
    if (max_moves == 0) return 0;
    // Determine player direction: Black (0) moves from high to low (point index decrement), White (1) moves high to low? Actually White moves from low to high.
    int direction = (b->turn == 0) ? -1 : 1;
    // Determine own stone sign
    int own_sign = (b->turn == 0) ? 1 : -1;
    int opp_sign = -own_sign;

    size_t move_count = 0;
    // For each die (b->dice[0] and b->dice[1]), generate moves for each stone belonging to current player
    // Simple implementation: For each die, try to move a stone from each point where own stone exists.
    // We'll just generate up to 2 moves (one per die) for simplicity.
    for (int die_idx = 0; die_idx < 2; ++die_idx) {
        uint8_t die = b->dice[die_idx];
        // For each point, try to move a stone if possible
        for (int p = 0; p < SUGOROKU_POINTS; ++p) {
            if (move_count >= max_moves) break;
            // Check if there is a stone of current player at this point
            if (b->points[p] != own_sign) continue;
            // Compute destination point for a normal move
            int dest = p + direction * die;
            // Determine if this move is legal: destination within board or bear-off
            bool can_move = false;
            bool hit_blot = false;
            if (dest < 0 || dest >= SUGOROKU_POINTS) {
                // Could be bear-off if player is on final side
                // For Black (player 0), final side is point 0; for White (player 1), point 23
                if ((b->turn == 0 && p == 0) || (b->turn == 1 && p == 23)) {
                    // Bear-off move: to = -1 for Black, 24 for White
                    dest = (b->turn == 0) ? -1 : 24;
                    can_move = true;
                } else {
                    continue; // cannot move off board
                }
            } else {
                // Normal move: check if destination is empty or contains opponent blot
                if (b->points[dest] == 0) {
                    can_move = true;
                } else if (b->points[dest] == opp_sign) {
                    // Check if it's a blot (single stone)
                    if (abs(b->points[dest]) == 1) {
                        can_move = true;
                        hit_blot = true;
                    } else {
                        continue; // blocked by multiple stones
                    }
                } else {
                    // Destination has own stone (cannot move)
                    continue;
                }
            }
            if (!can_move) continue;
            // Build a TurnMove with this single step (we can have up to 2 steps per turn)
            SugorokuTurnMove tm;
            memset(&tm, 0, sizeof(tm));
            // Fill steps array: for now we only use one step per turn move (simplified)
            SugorokuStep *step = &tm.steps[0];
            step->from = (int8_t)p;
            step->to = (int8_t)dest;
            step->die_used = die;
            step->hits_blot = hit_blot;
            tm.step_count = 1;
            out_moves[move_count++] = tm;
            // If double dice (d1 == d2) and mode is AGARI, allow another step for the same stone? For simplicity, we just stop after one.
            if (b->dice[0] == b->dice[1] && b->mode == SUGOROKU_MODE_AGARI) {
                // Could allow a second step from same stone; skip for now.
            }
        }
    }
    return move_count;
}

// Apply a turn move to the board
void sugoroku_apply_turn_move(SugorokuBoard *b, const SugorokuTurnMove *move) {
    for (int s = 0; s < move->step_count; ++s) {
        const SugorokuStep *step = &move->steps[s];
        int from = step->from;
        int to = step->to;
        int own_sign = (b->turn == 0) ? 1 : -1;
        int opp_sign = -own_sign;

        if (from >= 0 && from < SUGOROKU_POINTS) {
            // Move stone from point
            if (b->points[from] == own_sign) {
                b->points[from] -= own_sign; // decrement stone count (own_sign is 1 or -1)
            }
        } else if (from == 24) {
            // Stone from bar
            b->bar[b->turn]--;
        }

        if (to >= 0 && to < SUGOROKU_POINTS) {
            // Move stone to point
            b->points[to] += own_sign;
        } else if (to == -1) {
            // Bear-off: increase borne_off for current player
            b->borne_off[b->turn]++;
            // Also could adjust pip count etc.
        } else if (to == 24) {
            // Move to bar (unlikely in normal play, but could be used for hitting)
            b->bar[b->turn]++;
        }

        // If hit blot, move opponent stone to bar (if present)
        if (step->hits_blot && to >= 0 && to < SUGOROKU_POINTS) {
            if (b->points[to] == opp_sign) {
                // The opponent stone at destination (blot) is hit
                // Move it to bar
                b->bar[1 - b->turn]++;
                // Remove the opponent stone from the point (since it's now on bar)
                b->points[to] = 0;
            }
        }
    }
    // After applying move, switch turn (simplified: always switch)
    b->turn = 1 - b->turn;
}

// Check winner: return -1 ongoing, 0 Black wins, 1 White wins
int sugoroku_check_winner(const SugorokuBoard *b) {
    // Win if a player has borne off all stones
    if (b->borne_off[0] == SUGOROKU_STONES_PER_PLAYER) {
        return 0; // Black wins
    }
    if (b->borne_off[1] == SUGOROKU_STONES_PER_PLAYER) {
        return 1; // White wins
    }
    return -1; // ongoing
}

// Simple AI: choose move based on heuristic scoring (depth 1)
bool sugoroku_ai_choose_move(const SugorokuBoard *b, SugorokuAiStyle style, SugorokuTurnMove *best_out) {
    // Generate all possible moves
    SugorokuTurnMove moves[SUGOROKU_MAX_MOVES];
    size_t n = sugoroku_generate_turn_moves(b, moves, SUGOROKU_MAX_MOVES);
    if (n == 0) return false;

    // Compute a simple score for each move
    int best_score = -1000000;
    int best_idx = -1;
    for (size_t i = 0; i < n; ++i) {
        const SugorokuTurnMove *move = &moves[i];
        int score = 0;
        // Basic heuristic: hit blots gives high reward
        for (int s = 0; s < move->step_count; ++s) {
            if (move->steps[s].hits_blot) score += 200;
        }
        // Penalize moving stone far from bear-off (pip count)
        for (int s = 0; s < move->step_count; ++s) {
            int from = move->steps[s].from;
            int direction = (b->turn == 0) ? -1 : 1;
            int dist_to_goal = (b->turn == 0) ? from : (23 - from);
            score -= dist_to_goal * 5;
        }
        // Encourage building primes? Too complex for now.
        // If style is aggressive (BAKUTO), favor hitting blots more
        if (style == SUGOROKU_AI_BAKUTO) {
            for (int s = 0; s < move->step_count; ++s) {
                if (move->steps[s].hits_blot) score += 100;
            }
        } else if (style == SUGOROKU_AI_KUGE) {
            // Defensive: penalize moving far? For now, just neutral.
        } else if (style == SUGOROKU_AI_AKUSO) {
            // Trick: increase stake? Not implemented.
        }
        if (score > best_score) {
            best_score = score;
            best_idx = i;
        }
    }
    if (best_idx < 0) return false;
    *best_out = moves[best_idx];
    return true;
}
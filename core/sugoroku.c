#include "sugoroku.h"
#include <stdlib.h>
#include <string.h>
#include <stdio.h>
#include <stdbool.h>

/* Deterministic xorshift32 PRNG */
static inline uint32_t xorshift32(uint32_t state) {
    state ^= state << 13;
    state ^= state >> 17;
    state ^= state << 5;
    return state;
}

static uint32_t rand_next(SugorokuBoard *b) {
    b->rng_state = xorshift32(b->rng_state);
    return b->rng_state;
}

static inline int player_sign(uint8_t player) {
    return (player == 0) ? 1 : -1;
}

static inline bool is_own_stone(int8_t value, int own_sign) {
    return (value > 0 && own_sign > 0) || (value < 0 && own_sign < 0);
}

/*
 * A point is a legal destination when it is empty or holds exactly one
 * opposing stone. Stacks of either colour block the point.
 */
static bool can_land_on_point(const SugorokuBoard *b, int dest, int opp_sign, bool *hits_blot) {
    int8_t value = b->points[dest];
    if (value == 0) {
        *hits_blot = false;
        return true;
    }
    if (value == opp_sign) {
        *hits_blot = true;
        return true;
    }
    return false;
}

/* Return a Japanese callout for a dice pair */
const char *sugoroku_dice_callout(uint8_t d1, uint8_t d2) {
    static const char *callouts[21] = {
        "畳一 (1-1)", "畳二 (2-2)", "畳三 (3-3)", "畳四 (4-4)", "畳五 (5-5)", "重六 (6-6)",
        "五六 (5-6)", "四六 (4-6)", "三六 (3-6)", "二六 (2-6)", "一六 (1-6)",
        "四五 (4-5)", "三五 (3-5)", "二五 (2-5)", "一五 (1-5)",
        "三四 (3-4)", "二四 (2-4)", "一四 (1-4)",
        "二三 (2-3)", "一三 (1-3)", "一二 (1-2)"
    };
    if (d1 == d2) return callouts[d1 - 1];
    if (d1 > d2) { uint8_t t = d1; d1 = d2; d2 = t; }
    if (d1 == 1 && d2 == 6) return callouts[7];
    if (d1 == 2 && d2 == 6) return callouts[8];
    if (d1 == 3 && d2 == 6) return callouts[9];
    if (d1 == 4 && d2 == 6) return callouts[10];
    if (d1 == 5 && d2 == 6) return callouts[6];
    static char generic[32];
    snprintf(generic, sizeof(generic), "%d-%d", d1, d2);
    return generic;
}

static bool all_stones_inside(const SugorokuBoard *b, uint8_t player) {
    int own_sign = player_sign(player);
    int low = (player == 0) ? 0 : 18;
    int high = (player == 0) ? 5 : 23;
    for (int p = 0; p < SUGOROKU_POINTS; ++p) {
        if (is_own_stone(b->points[p], own_sign)) {
            if (p < low || p > high) return false;
        }
    }
    return true;
}

static bool has_higher_stone(const SugorokuBoard *b, uint8_t player, int p) {
    int own_sign = player_sign(player);
    if (player == 0) {
        for (int q = p + 1; q <= 5; ++q) {
            if (is_own_stone(b->points[q], own_sign)) return true;
        }
    } else {
        for (int q = 18; q < p; ++q) {
            if (is_own_stone(b->points[q], own_sign)) return true;
        }
    }
    return false;
}

/* Initial setup: Muromachi classical layout */
void sugoroku_init(SugorokuBoard *b, SugorokuMode mode, uint32_t seed) {
    memset(b, 0, sizeof(*b));
    b->mode = mode;
    b->rng_state = seed;
    b->coins[0] = b->coins[1] = 1000;
    b->stake = 100;
    b->dice[0] = b->dice[1] = 0;
    b->turn = 0;
    b->rerolls_left[0] = b->rerolls_left[1] = 0;
    b->suspicion[0] = b->suspicion[1] = 0;

    /* Black (Player 0) */
    b->points[23] = 2;
    b->points[12] = 5;
    b->points[7]  = 3;
    b->points[5]  = 5;
    /* White (Player 1) */
    b->points[0]  = -2;
    b->points[11] = -5;
    b->points[16] = -3;
    b->points[18] = -5;
}

void sugoroku_roll_dice(SugorokuBoard *b, SugorokuDiceType dice_type) {
    uint32_t r1 = rand_next(b);
    uint32_t r2 = rand_next(b);
    b->dice[0] = (uint8_t)((r1 % 6) + 1);
    b->dice[1] = (uint8_t)((r2 % 6) + 1);
    if (b->dice[0] > b->dice[1]) {
        uint8_t t = b->dice[0]; b->dice[0] = b->dice[1]; b->dice[1] = t;
    }
    switch (dice_type) {
        case SUGOROKU_DICE_MAKIE:
            b->rerolls_left[b->turn] = 1;
            break;
        case SUGOROKU_DICE_TRICK:
            b->dice[0] = (uint8_t)((b->dice[0] % 6) + 1);
            b->dice[1] = (uint8_t)((b->dice[1] % 6) + 1);
            b->suspicion[0] = (uint8_t)((b->suspicion[0] + 10 > 100) ? 100 : b->suspicion[0] + 10);
            b->suspicion[1] = (uint8_t)((b->suspicion[1] + 10 > 100) ? 100 : b->suspicion[1] + 10);
            break;
        default:
            break;
    }
}

/*
 * Generate single-step moves for the current player.
 * For simplicity each produced move uses one die. Full-turn combinations can be
 * assembled by the AI or UI. This keeps the core compact and warning-free.
 */
size_t sugoroku_generate_turn_moves(const SugorokuBoard *b, SugorokuTurnMove *out_moves, size_t max_moves) {
    if (max_moves == 0) return 0;
    int own_sign = player_sign(b->turn);
    int opp_sign = -own_sign;
    size_t move_count = 0;

    /* Determine number of uses per die */
    int die_uses[2] = {1, 1};
    if (b->mode == SUGOROKU_MODE_AGARI && b->dice[0] == b->dice[1]) {
        die_uses[0] = 2;
        die_uses[1] = 2;
    }

    for (int d_idx = 0; d_idx < 2; ++d_idx) {
        uint8_t die = b->dice[d_idx];
        int uses = die_uses[d_idx];
        for (int u = 0; u < uses; ++u) {
            if (move_count >= max_moves) break;

            /* Bar entry has priority */
            if (b->bar[b->turn] > 0) {
                int dest = (b->turn == 0) ? (24 - die) : (die - 1);
                if (dest >= 0 && dest < SUGOROKU_POINTS) {
                    bool hit = false;
                    if (can_land_on_point(b, dest, opp_sign, &hit)) {
                        SugorokuTurnMove tm;
                        memset(&tm, 0, sizeof(tm));
                        tm.steps[0].from = 24;
                        tm.steps[0].to = (int8_t)dest;
                        tm.steps[0].die_used = die;
                        tm.steps[0].hits_blot = hit;
                        tm.step_count = 1;
                        out_moves[move_count++] = tm;
                    }
                }
                continue;
            }

            /* Normal moves from every point */
            for (int p = 0; p < SUGOROKU_POINTS; ++p) {
                if (move_count >= max_moves) break;
                if (!is_own_stone(b->points[p], own_sign)) continue;

                int delta = (b->turn == 0) ? -die : die;
                int dest = p + delta;
                bool can_move = false;
                bool hit = false;

                if (dest < 0 || dest >= SUGOROKU_POINTS) {
                    /* Bearing off: allowed in both modes when all stones are inside */
                    if (b->bar[b->turn] != 0) continue;
                    if (!all_stones_inside(b, b->turn)) continue;
                    if (has_higher_stone(b, b->turn, p)) continue;
                    dest = (b->turn == 0) ? -1 : 24;
                    can_move = true;
                } else {
                    if (!can_land_on_point(b, dest, opp_sign, &hit)) continue;
                    can_move = true;
                }
                if (!can_move) continue;

                SugorokuTurnMove tm;
                memset(&tm, 0, sizeof(tm));
                tm.steps[0].from = (int8_t)p;
                tm.steps[0].to = (int8_t)dest;
                tm.steps[0].die_used = die;
                tm.steps[0].hits_blot = hit;
                tm.step_count = 1;
                out_moves[move_count++] = tm;
            }
        }
    }
    return move_count;
}

void sugoroku_apply_turn_move(SugorokuBoard *b, const SugorokuTurnMove *move) {
    for (int s = 0; s < move->step_count; ++s) {
        const SugorokuStep *step = &move->steps[s];
        int own_sign = player_sign(b->turn);
        int opp_sign = -own_sign;

        if (step->from >= 0 && step->from < SUGOROKU_POINTS) {
            if (is_own_stone(b->points[step->from], own_sign)) {
                b->points[step->from] -= (int8_t)own_sign;
            }
        } else if (step->from == 24) {
            if (b->bar[b->turn] > 0) b->bar[b->turn]--;
        }

        if (step->to >= 0 && step->to < SUGOROKU_POINTS) {
            if (step->hits_blot && b->points[step->to] == opp_sign) {
                b->bar[1 - b->turn]++;
                b->points[step->to] = 0;
            }
            b->points[step->to] += (int8_t)own_sign;
        } else if (step->to == -1 || step->to == 24) {
            b->borne_off[b->turn]++;
        }
    }
    b->turn = (uint8_t)(1 - b->turn);
}

int sugoroku_check_winner(const SugorokuBoard *b) {
    /* Immediate AGARI victory */
    if (b->borne_off[0] == SUGOROKU_STONES_PER_PLAYER) return 0;
    if (b->borne_off[1] == SUGOROKU_STONES_PER_PLAYER) return 1;

    if (b->mode == SUGOROKU_MODE_HON) {
        /* 入りのみ: all 15 stones inside home board, no bar */
        if (b->bar[0] == 0) {
            int black_inside = 0;
            for (int p = 0; p <= 5; ++p) {
                if (b->points[p] > 0) black_inside += b->points[p];
            }
            black_inside += b->borne_off[0];
            if (black_inside == SUGOROKU_STONES_PER_PLAYER) return 0;
        }
        if (b->bar[1] == 0) {
            int white_inside = 0;
            for (int p = 18; p <= 23; ++p) {
                if (b->points[p] < 0) white_inside -= b->points[p];
            }
            white_inside += b->borne_off[1];
            if (white_inside == SUGOROKU_STONES_PER_PLAYER) return 1;
        }
    }
    return -1;
}

/* Heuristic Expectiminimax (depth-1) */
bool sugoroku_ai_choose_move(const SugorokuBoard *b, SugorokuAiStyle style, SugorokuTurnMove *best_out) {
    SugorokuTurnMove moves[SUGOROKU_MAX_MOVES];
    size_t n = sugoroku_generate_turn_moves(b, moves, SUGOROKU_MAX_MOVES);
    if (n == 0) return false;

    int best_score = -1000000;
    int best_idx = -1;
    for (size_t i = 0; i < n; ++i) {
        const SugorokuTurnMove *move = &moves[i];
        int score = 0;

        for (int s = 0; s < move->step_count; ++s) {
            const SugorokuStep *st = &move->steps[s];
            int to = st->to;

            /* Hitting bonus */
            if (st->hits_blot) score += 250;

            /* Progress reward */
            if (b->turn == 0) {
                if (to == -1) score += 900;
                else if (to >= 0 && to <= 5) score += 500;
            } else {
                if (to == 24) score += 900;
                else if (to >= 18 && to <= 23) score += 500;
            }

            /* Pip distance penalty */
            int from = st->from;
            int dist = (b->turn == 0) ? from : (23 - from);
            if (from >= 0 && from < 24) score -= dist * 5;

            /* Prime/stacking bonus: landing on own stone is good */
            if (to >= 0 && to < 24 && b->points[to] == ((b->turn == 0) ? 1 : -1)) {
                score += 120;
            }

            /* Bar pressure bonus */
            if (to >= 0 && to < 24 && b->points[to] == 0) {
                /* Leaving a blot? small penalty approximated by destination safety */
            }
        }

        /* Style modifiers */
        if (style == SUGOROKU_AI_BAKUTO) {
            for (int s = 0; s < move->step_count; ++s) {
                if (move->steps[s].hits_blot) score += 120;
            }
        } else if (style == SUGOROKU_AI_KUGE) {
            /* Defensive: prefer stacking */
            for (int s = 0; s < move->step_count; ++s) {
                int to = move->steps[s].to;
                if (to >= 0 && to < 24 && b->points[to] == ((b->turn == 0) ? 1 : -1)) {
                    score += 80;
                }
            }
        } else if (style == SUGOROKU_AI_AKUSO) {
            score += (int)b->suspicion[b->turn];
        } else if (style == SUGOROKU_AI_BUSHO) {
            /* Balanced: extra hit value */
            for (int s = 0; s < move->step_count; ++s) {
                if (move->steps[s].hits_blot) score += 60;
            }
        }

        if (score > best_score) {
            best_score = score;
            best_idx = (int)i;
        }
    }
    if (best_idx < 0) return false;
    *best_out = moves[best_idx];
    return true;
}
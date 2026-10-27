#include "sugoroku.h"

#include <stdbool.h>
#include <stdint.h>
#include <stdio.h>
#include <string.h>

static int tests_run = 0;
static int failures = 0;
static const char *current_test = "";

static void dump_moves(const SugorokuTurnMove *moves, size_t count) {
    fprintf(stderr, "  generated %zu move(s):\n", count);
    for (size_t i = 0; i < count; ++i) {
        if (moves[i].step_count == 0) continue;
        const SugorokuStep *step = &moves[i].steps[0];
        fprintf(stderr, "    from=%d to=%d die=%u hits=%d steps=%u\n",
                (int)step->from,
                (int)step->to,
                (unsigned)step->die_used,
                (int)step->hits_blot,
                (unsigned)moves[i].step_count);
    }
}

#define CHECK(condition) do { \
    if (!(condition)) { \
        fprintf(stderr, "FAIL [%s] %s:%d: %s\n", \
                current_test, __FILE__, __LINE__, #condition); \
        failures++; \
    } \
} while (0)

#define CHECK_EQ_INT(actual, expected) do { \
    int actual_value = (int)(actual); \
    int expected_value = (int)(expected); \
    if (actual_value != expected_value) { \
        fprintf(stderr, "FAIL [%s] %s:%d: expected %d, got %d\n", \
                current_test, __FILE__, __LINE__, expected_value, actual_value); \
        failures++; \
    } \
} while (0)

#define CHECK_EQ_SIZE(actual, expected) do { \
    size_t actual_value = (size_t)(actual); \
    size_t expected_value = (size_t)(expected); \
    if (actual_value != expected_value) { \
        fprintf(stderr, "FAIL [%s] %s:%d: expected %zu, got %zu\n", \
                current_test, __FILE__, __LINE__, expected_value, actual_value); \
        failures++; \
    } \
} while (0)

#define EXPECT_MOVE(moves, count, from, to, die) do { \
    if (find_move((moves), (count), (from), (to), (die)) == NULL) { \
        fprintf(stderr, "FAIL [%s] %s:%d: expected move %d->%d die %d\n", \
                current_test, __FILE__, __LINE__, (from), (to), (die)); \
        dump_moves((moves), (count)); \
        failures++; \
    } \
} while (0)

#define EXPECT_NO_MOVE(moves, count, from, to, die) do { \
    if (find_move((moves), (count), (from), (to), (die)) != NULL) { \
        fprintf(stderr, "FAIL [%s] %s:%d: unexpected move %d->%d die %d\n", \
                current_test, __FILE__, __LINE__, (from), (to), (die)); \
        dump_moves((moves), (count)); \
        failures++; \
    } \
} while (0)

#define RUN_TEST(test_function) do { \
    current_test = #test_function; \
    tests_run++; \
    printf("RUN [%s]\n", current_test); \
    fflush(stdout); \
    test_function(); \
} while (0)

static void board_clear(SugorokuBoard *b, SugorokuMode mode) {
    memset(b, 0, sizeof(*b));
    b->mode = mode;
    b->turn = 0;
    b->dice[0] = 1;
    b->dice[1] = 1;
    b->coins[0] = 1000;
    b->coins[1] = 1000;
    b->stake = 100;
    b->rng_state = 1;
}

static int black_stones(const SugorokuBoard *b) {
    int total = (int)b->bar[0] + (int)b->borne_off[0];
    for (int p = 0; p < SUGOROKU_POINTS; ++p) {
        if (b->points[p] > 0) total += b->points[p];
    }
    return total;
}

static int white_stones(const SugorokuBoard *b) {
    int total = (int)b->bar[1] + (int)b->borne_off[1];
    for (int p = 0; p < SUGOROKU_POINTS; ++p) {
        if (b->points[p] < 0) total -= b->points[p];
    }
    return total;
}

static void check_stone_invariants(const SugorokuBoard *b, const char *label) {
    int black = black_stones(b);
    int white = white_stones(b);
    if (black != SUGOROKU_STONES_PER_PLAYER) {
        fprintf(stderr, "FAIL [%s] %s: Black stones=%d expected=%d\n",
                current_test, label, black, SUGOROKU_STONES_PER_PLAYER);
        failures++;
    }
    if (white != SUGOROKU_STONES_PER_PLAYER) {
        fprintf(stderr, "FAIL [%s] %s: White stones=%d expected=%d\n",
                current_test, label, white, SUGOROKU_STONES_PER_PLAYER);
        failures++;
    }
}

static const SugorokuTurnMove *find_move(const SugorokuTurnMove *moves,
                                         size_t count,
                                         int from,
                                         int to,
                                         int die) {
    for (size_t i = 0; i < count; ++i) {
        if (moves[i].step_count != 1) continue;
        const SugorokuStep *step = &moves[i].steps[0];
        if ((int)step->from == from &&
            (int)step->to == to &&
            (int)step->die_used == die) {
            return &moves[i];
        }
    }
    return NULL;
}

static size_t count_moves_from(const SugorokuTurnMove *moves,
                               size_t count,
                               int from) {
    size_t result = 0;
    for (size_t i = 0; i < count; ++i) {
        if (moves[i].step_count == 1 && (int)moves[i].steps[0].from == from) {
            result++;
        }
    }
    return result;
}

static SugorokuTurnMove make_single_step(int from, int to, int die) {
    SugorokuTurnMove move;
    memset(&move, 0, sizeof(move));
    move.steps[0].from = (int8_t)from;
    move.steps[0].to = (int8_t)to;
    move.steps[0].die_used = (uint8_t)die;
    move.steps[0].hits_blot = false;
    move.step_count = 1;
    return move;
}

static void test_initial_setup_and_stone_counts(void) {
    SugorokuBoard b;
    sugoroku_init(&b, SUGOROKU_MODE_HON, 12345);

    CHECK_EQ_INT(b.mode, SUGOROKU_MODE_HON);
    CHECK_EQ_INT(b.turn, 0);
    CHECK_EQ_INT(b.points[23], 2);
    CHECK_EQ_INT(b.points[12], 5);
    CHECK_EQ_INT(b.points[7], 3);
    CHECK_EQ_INT(b.points[5], 5);
    CHECK_EQ_INT(b.points[0], -2);
    CHECK_EQ_INT(b.points[11], -5);
    CHECK_EQ_INT(b.points[16], -3);
    CHECK_EQ_INT(b.points[18], -5);
    CHECK_EQ_INT(b.bar[0], 0);
    CHECK_EQ_INT(b.bar[1], 0);
    CHECK_EQ_INT(b.borne_off[0], 0);
    CHECK_EQ_INT(b.borne_off[1], 0);
    CHECK_EQ_INT(b.dice[0], 0);
    CHECK_EQ_INT(b.dice[1], 0);
    CHECK_EQ_INT(b.coins[0], 1000);
    CHECK_EQ_INT(b.coins[1], 1000);
    CHECK_EQ_INT(b.stake, 100);
    check_stone_invariants(&b, "initial setup");
}

static void test_initial_black_has_legal_moves(void) {
    SugorokuBoard b;
    SugorokuTurnMove moves[SUGOROKU_MAX_MOVES];
    sugoroku_init(&b, SUGOROKU_MODE_HON, 1);
    b.dice[0] = 1;
    b.dice[1] = 2;

    size_t count = sugoroku_generate_turn_moves(&b, moves, SUGOROKU_MAX_MOVES);
    CHECK(count != 0);
    EXPECT_MOVE(moves, count, 5, 4, 1);
    EXPECT_MOVE(moves, count, 23, 22, 1);
    EXPECT_MOVE(moves, count, 12, 10, 2);
}

static void test_initial_white_has_legal_moves(void) {
    SugorokuBoard b;
    SugorokuTurnMove moves[SUGOROKU_MAX_MOVES];
    sugoroku_init(&b, SUGOROKU_MODE_HON, 1);
    b.turn = 1;
    b.dice[0] = 1;
    b.dice[1] = 2;

    size_t count = sugoroku_generate_turn_moves(&b, moves, SUGOROKU_MAX_MOVES);
    CHECK(count != 0);
    EXPECT_MOVE(moves, count, 0, 1, 1);
    EXPECT_MOVE(moves, count, 16, 17, 1);
    EXPECT_MOVE(moves, count, 18, 19, 1);
    EXPECT_MOVE(moves, count, 11, 13, 2);
}

static void test_black_stack_source_generates_moves(void) {
    SugorokuBoard b;
    SugorokuTurnMove moves[SUGOROKU_MAX_MOVES];
    board_clear(&b, SUGOROKU_MODE_HON);
    b.points[12] = 2;
    b.borne_off[0] = 13;
    b.points[18] = -15;
    b.dice[0] = 1;
    b.dice[1] = 2;

    size_t count = sugoroku_generate_turn_moves(&b, moves, SUGOROKU_MAX_MOVES);
    EXPECT_MOVE(moves, count, 12, 11, 1);
    EXPECT_MOVE(moves, count, 12, 10, 2);
}

static void test_white_stack_source_generates_moves(void) {
    SugorokuBoard b;
    SugorokuTurnMove moves[SUGOROKU_MAX_MOVES];
    board_clear(&b, SUGOROKU_MODE_HON);
    b.turn = 1;
    b.points[11] = -2;
    b.borne_off[1] = 13;
    b.points[0] = 15;
    b.dice[0] = 1;
    b.dice[1] = 2;

    size_t count = sugoroku_generate_turn_moves(&b, moves, SUGOROKU_MAX_MOVES);
    EXPECT_MOVE(moves, count, 11, 12, 1);
    EXPECT_MOVE(moves, count, 11, 13, 2);
}

static void test_empty_and_opponent_sources_rejected(void) {
    SugorokuBoard b;
    SugorokuTurnMove moves[SUGOROKU_MAX_MOVES];
    board_clear(&b, SUGOROKU_MODE_HON);
    b.points[12] = 1;
    b.borne_off[0] = 14;
    b.points[10] = -15;
    b.dice[0] = 1;
    b.dice[1] = 2;

    size_t count = sugoroku_generate_turn_moves(&b, moves, SUGOROKU_MAX_MOVES);
    EXPECT_MOVE(moves, count, 12, 11, 1);
    EXPECT_NO_MOVE(moves, count, 11, 10, 1);
    EXPECT_NO_MOVE(moves, count, 10, 9, 1);
}

static void test_normal_destination_blocking(void) {
    SugorokuBoard b;
    SugorokuTurnMove moves[SUGOROKU_MAX_MOVES];
    board_clear(&b, SUGOROKU_MODE_HON);
    b.points[12] = 1;
    b.points[11] = 2;
    b.borne_off[0] = 12;
    b.points[10] = -2;
    b.points[18] = -13;
    b.dice[0] = 1;
    b.dice[1] = 2;

    size_t count = sugoroku_generate_turn_moves(&b, moves, SUGOROKU_MAX_MOVES);
    EXPECT_NO_MOVE(moves, count, 12, 11, 1);
    EXPECT_NO_MOVE(moves, count, 12, 10, 2);
}

static void test_single_blot_capture_generation(void) {
    SugorokuBoard b;
    SugorokuTurnMove moves[SUGOROKU_MAX_MOVES];
    board_clear(&b, SUGOROKU_MODE_HON);
    b.points[12] = 1;
    b.borne_off[0] = 14;
    b.points[10] = -1;
    b.points[18] = -14;
    b.dice[0] = 2;
    b.dice[1] = 2;

    size_t count = sugoroku_generate_turn_moves(&b, moves, SUGOROKU_MAX_MOVES);
    const SugorokuTurnMove *move = find_move(moves, count, 12, 10, 2);
    CHECK(move != NULL);
    if (move != NULL) {
        CHECK(move->steps[0].hits_blot);
    }
}

static void test_normal_move_apply(void) {
    SugorokuBoard b;
    SugorokuTurnMove moves[SUGOROKU_MAX_MOVES];
    board_clear(&b, SUGOROKU_MODE_HON);
    b.points[12] = 1;
    b.borne_off[0] = 14;
    b.points[18] = -15;
    b.dice[0] = 1;
    b.dice[1] = 1;

    size_t count = sugoroku_generate_turn_moves(&b, moves, SUGOROKU_MAX_MOVES);
    const SugorokuTurnMove *move = find_move(moves, count, 12, 11, 1);
    CHECK(move != NULL);
    if (move != NULL) {
        SugorokuBoard next = b;
        sugoroku_apply_turn_move(&next, move);
        CHECK_EQ_INT(next.points[12], 0);
        CHECK_EQ_INT(next.points[11], 1);
        CHECK_EQ_INT(next.bar[0], 0);
        CHECK_EQ_INT(next.bar[1], 0);
        CHECK_EQ_INT(next.borne_off[0], 14);
        CHECK_EQ_INT(next.turn, 1);
        check_stone_invariants(&next, "normal move apply");
    }
}

static void test_capture_apply_black(void) {
    SugorokuBoard b;
    SugorokuTurnMove moves[SUGOROKU_MAX_MOVES];
    board_clear(&b, SUGOROKU_MODE_HON);
    b.points[12] = 1;
    b.borne_off[0] = 14;
    b.points[10] = -1;
    b.points[18] = -14;
    b.dice[0] = 2;
    b.dice[1] = 2;

    size_t count = sugoroku_generate_turn_moves(&b, moves, SUGOROKU_MAX_MOVES);
    const SugorokuTurnMove *move = find_move(moves, count, 12, 10, 2);
    CHECK(move != NULL);
    if (move != NULL) {
        SugorokuBoard next = b;
        sugoroku_apply_turn_move(&next, move);
        CHECK_EQ_INT(next.points[12], 0);
        CHECK_EQ_INT(next.points[10], 1);
        CHECK_EQ_INT(next.bar[1], 1);
        CHECK_EQ_INT(next.bar[0], 0);
        CHECK_EQ_INT(next.turn, 1);
        check_stone_invariants(&next, "Black capture apply");
    }
}

static void test_capture_apply_white(void) {
    SugorokuBoard b;
    SugorokuTurnMove moves[SUGOROKU_MAX_MOVES];
    board_clear(&b, SUGOROKU_MODE_HON);
    b.turn = 1;
    b.points[11] = -1;
    b.borne_off[1] = 14;
    b.points[13] = 1;
    b.points[0] = 14;
    b.dice[0] = 2;
    b.dice[1] = 2;

    size_t count = sugoroku_generate_turn_moves(&b, moves, SUGOROKU_MAX_MOVES);
    const SugorokuTurnMove *move = find_move(moves, count, 11, 13, 2);
    CHECK(move != NULL);
    if (move != NULL) {
        SugorokuBoard next = b;
        sugoroku_apply_turn_move(&next, move);
        CHECK_EQ_INT(next.points[11], 0);
        CHECK_EQ_INT(next.points[13], -1);
        CHECK_EQ_INT(next.bar[0], 1);
        CHECK_EQ_INT(next.bar[1], 0);
        CHECK_EQ_INT(next.turn, 0);
        check_stone_invariants(&next, "White capture apply");
    }
}

static void test_black_stack_source_apply(void) {
    SugorokuBoard b;
    board_clear(&b, SUGOROKU_MODE_HON);
    b.points[12] = 2;
    b.borne_off[0] = 13;
    b.points[18] = -15;

    SugorokuTurnMove move = make_single_step(12, 11, 1);
    SugorokuBoard next = b;
    sugoroku_apply_turn_move(&next, &move);
    CHECK_EQ_INT(next.points[12], 1);
    CHECK_EQ_INT(next.points[11], 1);
    CHECK_EQ_INT(next.turn, 1);
    check_stone_invariants(&next, "Black stack source apply");
}

static void test_white_stack_source_apply(void) {
    SugorokuBoard b;
    board_clear(&b, SUGOROKU_MODE_HON);
    b.turn = 1;
    b.points[11] = -2;
    b.borne_off[1] = 13;
    b.points[0] = 15;

    SugorokuTurnMove move = make_single_step(11, 12, 1);
    SugorokuBoard next = b;
    sugoroku_apply_turn_move(&next, &move);
    CHECK_EQ_INT(next.points[11], -1);
    CHECK_EQ_INT(next.points[12], -1);
    CHECK_EQ_INT(next.turn, 0);
    check_stone_invariants(&next, "White stack source apply");
}

static void test_bar_entry_priority(void) {
    SugorokuBoard b;
    SugorokuTurnMove moves[SUGOROKU_MAX_MOVES];
    board_clear(&b, SUGOROKU_MODE_HON);
    b.bar[0] = 1;
    b.borne_off[0] = 14;
    b.points[18] = -15;
    b.dice[0] = 3;
    b.dice[1] = 1;

    size_t count = sugoroku_generate_turn_moves(&b, moves, SUGOROKU_MAX_MOVES);
    CHECK_EQ_SIZE(count, 2);
    EXPECT_MOVE(moves, count, 24, 21, 3);
    EXPECT_MOVE(moves, count, 24, 23, 1);
    CHECK_EQ_SIZE(count_moves_from(moves, count, 0), 0);
}

static void test_bar_entry_apply(void) {
    SugorokuBoard b;
    SugorokuTurnMove moves[SUGOROKU_MAX_MOVES];
    board_clear(&b, SUGOROKU_MODE_HON);
    b.bar[0] = 1;
    b.borne_off[0] = 14;
    b.points[18] = -15;
    b.dice[0] = 3;
    b.dice[1] = 1;

    size_t count = sugoroku_generate_turn_moves(&b, moves, SUGOROKU_MAX_MOVES);
    const SugorokuTurnMove *move = find_move(moves, count, 24, 21, 3);
    CHECK(move != NULL);
    if (move != NULL) {
        SugorokuBoard next = b;
        sugoroku_apply_turn_move(&next, move);
        CHECK_EQ_INT(next.bar[0], 0);
        CHECK_EQ_INT(next.points[21], 1);
        CHECK_EQ_INT(next.turn, 1);
        check_stone_invariants(&next, "bar entry apply");
    }
}

static void test_blocked_bar_entry(void) {
    SugorokuBoard b;
    SugorokuTurnMove moves[SUGOROKU_MAX_MOVES];
    board_clear(&b, SUGOROKU_MODE_HON);
    b.bar[0] = 1;
    b.borne_off[0] = 14;
    b.points[21] = -2;
    b.points[18] = -13;
    b.dice[0] = 3;
    b.dice[1] = 3;

    size_t count = sugoroku_generate_turn_moves(&b, moves, SUGOROKU_MAX_MOVES);
    CHECK_EQ_SIZE(count, 0);
    EXPECT_NO_MOVE(moves, count, 24, 21, 3);
}

static void test_bar_entry_capture(void) {
    SugorokuBoard b;
    SugorokuTurnMove moves[SUGOROKU_MAX_MOVES];
    board_clear(&b, SUGOROKU_MODE_HON);
    b.bar[0] = 1;
    b.borne_off[0] = 14;
    b.points[21] = -1;
    b.points[18] = -14;
    b.dice[0] = 3;
    b.dice[1] = 3;

    size_t count = sugoroku_generate_turn_moves(&b, moves, SUGOROKU_MAX_MOVES);
    const SugorokuTurnMove *move = find_move(moves, count, 24, 21, 3);
    CHECK(move != NULL);
    if (move != NULL) {
        CHECK(move->steps[0].hits_blot);
        SugorokuBoard next = b;
        sugoroku_apply_turn_move(&next, move);
        CHECK_EQ_INT(next.bar[0], 0);
        CHECK_EQ_INT(next.points[21], 1);
        CHECK_EQ_INT(next.bar[1], 1);
        CHECK_EQ_INT(next.turn, 1);
        check_stone_invariants(&next, "bar entry capture apply");
    }
}

static void test_black_exact_bearoff_allowed_and_applied(void) {
    SugorokuBoard b;
    SugorokuTurnMove moves[SUGOROKU_MAX_MOVES];
    board_clear(&b, SUGOROKU_MODE_AGARI);
    b.points[5] = 1;
    b.borne_off[0] = 14;
    b.points[18] = -15;
    b.dice[0] = 6;
    b.dice[1] = 6;

    size_t count = sugoroku_generate_turn_moves(&b, moves, SUGOROKU_MAX_MOVES);
    const SugorokuTurnMove *move = find_move(moves, count, 5, -1, 6);
    CHECK(move != NULL);
    if (move != NULL) {
        SugorokuBoard next = b;
        sugoroku_apply_turn_move(&next, move);
        CHECK_EQ_INT(next.points[5], 0);
        CHECK_EQ_INT(next.borne_off[0], 15);
        CHECK_EQ_INT(next.turn, 1);
        check_stone_invariants(&next, "Black exact bear-off apply");
    }
}

static void test_black_oversized_bearoff_allowed_and_applied(void) {
    SugorokuBoard b;
    SugorokuTurnMove moves[SUGOROKU_MAX_MOVES];
    board_clear(&b, SUGOROKU_MODE_AGARI);
    b.points[4] = 1;
    b.borne_off[0] = 14;
    b.points[18] = -15;
    b.dice[0] = 6;
    b.dice[1] = 6;

    size_t count = sugoroku_generate_turn_moves(&b, moves, SUGOROKU_MAX_MOVES);
    const SugorokuTurnMove *move = find_move(moves, count, 4, -1, 6);
    CHECK(move != NULL);
    if (move != NULL) {
        SugorokuBoard next = b;
        sugoroku_apply_turn_move(&next, move);
        CHECK_EQ_INT(next.points[4], 0);
        CHECK_EQ_INT(next.borne_off[0], 15);
        CHECK_EQ_INT(next.turn, 1);
        check_stone_invariants(&next, "Black oversized bear-off apply");
    }
}

static void test_black_exact_bearoff_rejected_with_single_higher_c6(void) {
    SugorokuBoard b;
    SugorokuTurnMove moves[SUGOROKU_MAX_MOVES];
    board_clear(&b, SUGOROKU_MODE_AGARI);
    b.points[4] = 1;
    b.points[5] = 1;
    b.borne_off[0] = 13;
    b.points[18] = -15;
    b.dice[0] = 5;
    b.dice[1] = 5;

    size_t count = sugoroku_generate_turn_moves(&b, moves, SUGOROKU_MAX_MOVES);
    EXPECT_NO_MOVE(moves, count, 4, -1, 5);
    EXPECT_MOVE(moves, count, 5, 0, 5);
}

static void test_black_oversized_bearoff_rejected_with_single_higher(void) {
    SugorokuBoard b;
    SugorokuTurnMove moves[SUGOROKU_MAX_MOVES];
    board_clear(&b, SUGOROKU_MODE_AGARI);
    b.points[4] = 1;
    b.points[5] = 1;
    b.borne_off[0] = 13;
    b.points[18] = -15;
    b.dice[0] = 6;
    b.dice[1] = 6;

    size_t count = sugoroku_generate_turn_moves(&b, moves, SUGOROKU_MAX_MOVES);
    EXPECT_NO_MOVE(moves, count, 4, -1, 6);
    EXPECT_MOVE(moves, count, 5, -1, 6);
}

static void test_black_exact_bearoff_rejected_with_higher_stack(void) {
    SugorokuBoard b;
    SugorokuTurnMove moves[SUGOROKU_MAX_MOVES];
    board_clear(&b, SUGOROKU_MODE_AGARI);
    b.points[4] = 1;
    b.points[5] = 2;
    b.borne_off[0] = 12;
    b.points[18] = -15;
    b.dice[0] = 5;
    b.dice[1] = 5;

    size_t count = sugoroku_generate_turn_moves(&b, moves, SUGOROKU_MAX_MOVES);
    EXPECT_NO_MOVE(moves, count, 4, -1, 5);
}

static void test_black_oversized_bearoff_rejected_with_higher_stack(void) {
    SugorokuBoard b;
    SugorokuTurnMove moves[SUGOROKU_MAX_MOVES];
    board_clear(&b, SUGOROKU_MODE_AGARI);
    b.points[4] = 1;
    b.points[5] = 2;
    b.borne_off[0] = 12;
    b.points[18] = -15;
    b.dice[0] = 6;
    b.dice[1] = 6;

    size_t count = sugoroku_generate_turn_moves(&b, moves, SUGOROKU_MAX_MOVES);
    EXPECT_NO_MOVE(moves, count, 4, -1, 6);
}

static void test_black_all_stones_inside_rejects_single_outside(void) {
    SugorokuBoard b;
    SugorokuTurnMove moves[SUGOROKU_MAX_MOVES];
    board_clear(&b, SUGOROKU_MODE_AGARI);
    b.points[5] = 1;
    b.points[23] = 1;
    b.borne_off[0] = 13;
    b.points[18] = -15;
    b.dice[0] = 6;
    b.dice[1] = 6;

    size_t count = sugoroku_generate_turn_moves(&b, moves, SUGOROKU_MAX_MOVES);
    EXPECT_NO_MOVE(moves, count, 5, -1, 6);
}

static void test_black_all_stones_inside_rejects_outside_stack(void) {
    SugorokuBoard b;
    SugorokuTurnMove moves[SUGOROKU_MAX_MOVES];
    board_clear(&b, SUGOROKU_MODE_AGARI);
    b.points[5] = 1;
    b.points[23] = 2;
    b.borne_off[0] = 12;
    b.points[18] = -15;
    b.dice[0] = 6;
    b.dice[1] = 6;

    size_t count = sugoroku_generate_turn_moves(&b, moves, SUGOROKU_MAX_MOVES);
    EXPECT_NO_MOVE(moves, count, 5, -1, 6);
}

static void test_white_exact_bearoff_allowed_and_applied(void) {
    SugorokuBoard b;
    SugorokuTurnMove moves[SUGOROKU_MAX_MOVES];
    board_clear(&b, SUGOROKU_MODE_AGARI);
    b.turn = 1;
    b.points[18] = -1;
    b.borne_off[1] = 14;
    b.points[0] = 15;
    b.dice[0] = 6;
    b.dice[1] = 6;

    size_t count = sugoroku_generate_turn_moves(&b, moves, SUGOROKU_MAX_MOVES);
    const SugorokuTurnMove *move = find_move(moves, count, 18, 24, 6);
    CHECK(move != NULL);
    if (move != NULL) {
        SugorokuBoard next = b;
        sugoroku_apply_turn_move(&next, move);
        CHECK_EQ_INT(next.points[18], 0);
        CHECK_EQ_INT(next.borne_off[1], 15);
        CHECK_EQ_INT(next.turn, 0);
        check_stone_invariants(&next, "White exact bear-off apply");
    }
}

static void test_white_oversized_bearoff_allowed_and_applied(void) {
    SugorokuBoard b;
    SugorokuTurnMove moves[SUGOROKU_MAX_MOVES];
    board_clear(&b, SUGOROKU_MODE_AGARI);
    b.turn = 1;
    b.points[19] = -1;
    b.borne_off[1] = 14;
    b.points[0] = 15;
    b.dice[0] = 6;
    b.dice[1] = 6;

    size_t count = sugoroku_generate_turn_moves(&b, moves, SUGOROKU_MAX_MOVES);
    const SugorokuTurnMove *move = find_move(moves, count, 19, 24, 6);
    CHECK(move != NULL);
    if (move != NULL) {
        SugorokuBoard next = b;
        sugoroku_apply_turn_move(&next, move);
        CHECK_EQ_INT(next.points[19], 0);
        CHECK_EQ_INT(next.borne_off[1], 15);
        CHECK_EQ_INT(next.turn, 0);
        check_stone_invariants(&next, "White oversized bear-off apply");
    }
}

static void test_white_exact_bearoff_rejected_with_single_lower_c6(void) {
    SugorokuBoard b;
    SugorokuTurnMove moves[SUGOROKU_MAX_MOVES];
    board_clear(&b, SUGOROKU_MODE_AGARI);
    b.turn = 1;
    b.points[18] = -1;
    b.points[19] = -1;
    b.borne_off[1] = 13;
    b.points[0] = 15;
    b.dice[0] = 5;
    b.dice[1] = 5;

    size_t count = sugoroku_generate_turn_moves(&b, moves, SUGOROKU_MAX_MOVES);
    EXPECT_NO_MOVE(moves, count, 19, 24, 5);
    EXPECT_MOVE(moves, count, 18, 23, 5);
}

static void test_white_oversized_bearoff_rejected_with_single_lower(void) {
    SugorokuBoard b;
    SugorokuTurnMove moves[SUGOROKU_MAX_MOVES];
    board_clear(&b, SUGOROKU_MODE_AGARI);
    b.turn = 1;
    b.points[18] = -1;
    b.points[19] = -1;
    b.borne_off[1] = 13;
    b.points[0] = 15;
    b.dice[0] = 6;
    b.dice[1] = 6;

    size_t count = sugoroku_generate_turn_moves(&b, moves, SUGOROKU_MAX_MOVES);
    EXPECT_NO_MOVE(moves, count, 19, 24, 6);
    EXPECT_MOVE(moves, count, 18, 24, 6);
}

static void test_white_exact_bearoff_rejected_with_lower_stack(void) {
    SugorokuBoard b;
    SugorokuTurnMove moves[SUGOROKU_MAX_MOVES];
    board_clear(&b, SUGOROKU_MODE_AGARI);
    b.turn = 1;
    b.points[18] = -2;
    b.points[19] = -1;
    b.borne_off[1] = 12;
    b.points[0] = 15;
    b.dice[0] = 5;
    b.dice[1] = 5;

    size_t count = sugoroku_generate_turn_moves(&b, moves, SUGOROKU_MAX_MOVES);
    EXPECT_NO_MOVE(moves, count, 19, 24, 5);
}

static void test_white_oversized_bearoff_rejected_with_lower_stack(void) {
    SugorokuBoard b;
    SugorokuTurnMove moves[SUGOROKU_MAX_MOVES];
    board_clear(&b, SUGOROKU_MODE_AGARI);
    b.turn = 1;
    b.points[18] = -2;
    b.points[19] = -1;
    b.borne_off[1] = 12;
    b.points[0] = 15;
    b.dice[0] = 6;
    b.dice[1] = 6;

    size_t count = sugoroku_generate_turn_moves(&b, moves, SUGOROKU_MAX_MOVES);
    EXPECT_NO_MOVE(moves, count, 19, 24, 6);
}

static void test_white_all_stones_inside_rejects_single_outside(void) {
    SugorokuBoard b;
    SugorokuTurnMove moves[SUGOROKU_MAX_MOVES];
    board_clear(&b, SUGOROKU_MODE_AGARI);
    b.turn = 1;
    b.points[19] = -1;
    b.points[0] = -1;
    b.borne_off[1] = 13;
    b.points[5] = 15;
    b.dice[0] = 6;
    b.dice[1] = 6;

    size_t count = sugoroku_generate_turn_moves(&b, moves, SUGOROKU_MAX_MOVES);
    EXPECT_NO_MOVE(moves, count, 19, 24, 6);
}

static void test_white_all_stones_inside_rejects_outside_stack(void) {
    SugorokuBoard b;
    SugorokuTurnMove moves[SUGOROKU_MAX_MOVES];
    board_clear(&b, SUGOROKU_MODE_AGARI);
    b.turn = 1;
    b.points[19] = -1;
    b.points[0] = -2;
    b.borne_off[1] = 12;
    b.points[5] = 15;
    b.dice[0] = 6;
    b.dice[1] = 6;

    size_t count = sugoroku_generate_turn_moves(&b, moves, SUGOROKU_MAX_MOVES);
    EXPECT_NO_MOVE(moves, count, 19, 24, 6);
}

static void test_dice_use_counts(void) {
    SugorokuBoard b;
    SugorokuTurnMove moves[SUGOROKU_MAX_MOVES];

    board_clear(&b, SUGOROKU_MODE_HON);
    b.points[12] = 1;
    b.borne_off[0] = 14;
    b.points[18] = -15;
    b.dice[0] = 3;
    b.dice[1] = 3;
    CHECK_EQ_SIZE(sugoroku_generate_turn_moves(&b, moves, SUGOROKU_MAX_MOVES), 2);

    board_clear(&b, SUGOROKU_MODE_AGARI);
    b.points[12] = 1;
    b.borne_off[0] = 14;
    b.points[18] = -15;
    b.dice[0] = 3;
    b.dice[1] = 3;
    CHECK_EQ_SIZE(sugoroku_generate_turn_moves(&b, moves, SUGOROKU_MAX_MOVES), 4);

    board_clear(&b, SUGOROKU_MODE_HON);
    b.points[12] = 1;
    b.borne_off[0] = 14;
    b.points[18] = -15;
    b.dice[0] = 3;
    b.dice[1] = 4;
    CHECK_EQ_SIZE(sugoroku_generate_turn_moves(&b, moves, SUGOROKU_MAX_MOVES), 2);
}

static void test_agari_win_conditions(void) {
    SugorokuBoard b;

    board_clear(&b, SUGOROKU_MODE_AGARI);
    b.borne_off[0] = 15;
    CHECK_EQ_INT(sugoroku_check_winner(&b), 0);

    board_clear(&b, SUGOROKU_MODE_AGARI);
    b.borne_off[1] = 15;
    CHECK_EQ_INT(sugoroku_check_winner(&b), 1);

    board_clear(&b, SUGOROKU_MODE_AGARI);
    b.borne_off[0] = 14;
    b.borne_off[1] = 14;
    b.points[0] = 1;
    b.points[18] = -1;
    CHECK_EQ_INT(sugoroku_check_winner(&b), -1);
}

static void test_hon_win_conditions(void) {
    SugorokuBoard b;

    board_clear(&b, SUGOROKU_MODE_HON);
    b.points[0] = 15;
    b.points[6] = -15;
    CHECK_EQ_INT(sugoroku_check_winner(&b), 0);

    board_clear(&b, SUGOROKU_MODE_HON);
    b.points[18] = -15;
    b.points[6] = 15;
    CHECK_EQ_INT(sugoroku_check_winner(&b), 1);

    board_clear(&b, SUGOROKU_MODE_HON);
    b.points[0] = 14;
    b.bar[0] = 1;
    b.points[18] = -14;
    b.bar[1] = 1;
    CHECK_EQ_INT(sugoroku_check_winner(&b), -1);

    board_clear(&b, SUGOROKU_MODE_HON);
    b.points[0] = 14;
    b.borne_off[0] = 1;
    b.points[6] = -15;
    CHECK_EQ_INT(sugoroku_check_winner(&b), 0);
}

static void test_ai_can_move_from_initial_board(void) {
    SugorokuBoard b;
    SugorokuTurnMove best;
    sugoroku_init(&b, SUGOROKU_MODE_HON, 1);
    b.dice[0] = 1;
    b.dice[1] = 2;
    memset(&best, 0, sizeof(best));

    bool found = sugoroku_ai_choose_move(&b, SUGOROKU_AI_BUSHO, &best);
    CHECK(found);
    if (found) {
        CHECK(best.step_count == 1);
        CHECK(best.steps[0].from >= 0 && best.steps[0].from < SUGOROKU_POINTS);
        CHECK(best.steps[0].to >= -1 && best.steps[0].to <= SUGOROKU_POINTS);
    }
}

int main(void) {
    printf("Running C11 rules regression tests...\n");

    RUN_TEST(test_initial_setup_and_stone_counts);
    RUN_TEST(test_initial_black_has_legal_moves);
    RUN_TEST(test_initial_white_has_legal_moves);
    RUN_TEST(test_black_stack_source_generates_moves);
    RUN_TEST(test_white_stack_source_generates_moves);
    RUN_TEST(test_empty_and_opponent_sources_rejected);
    RUN_TEST(test_normal_destination_blocking);
    RUN_TEST(test_single_blot_capture_generation);
    RUN_TEST(test_normal_move_apply);
    RUN_TEST(test_capture_apply_black);
    RUN_TEST(test_capture_apply_white);
    RUN_TEST(test_black_stack_source_apply);
    RUN_TEST(test_white_stack_source_apply);
    RUN_TEST(test_bar_entry_priority);
    RUN_TEST(test_bar_entry_apply);
    RUN_TEST(test_blocked_bar_entry);
    RUN_TEST(test_bar_entry_capture);
    RUN_TEST(test_black_exact_bearoff_allowed_and_applied);
    RUN_TEST(test_black_oversized_bearoff_allowed_and_applied);
    RUN_TEST(test_black_exact_bearoff_rejected_with_single_higher_c6);
    RUN_TEST(test_black_oversized_bearoff_rejected_with_single_higher);
    RUN_TEST(test_black_exact_bearoff_rejected_with_higher_stack);
    RUN_TEST(test_black_oversized_bearoff_rejected_with_higher_stack);
    RUN_TEST(test_black_all_stones_inside_rejects_single_outside);
    RUN_TEST(test_black_all_stones_inside_rejects_outside_stack);
    RUN_TEST(test_white_exact_bearoff_allowed_and_applied);
    RUN_TEST(test_white_oversized_bearoff_allowed_and_applied);
    RUN_TEST(test_white_exact_bearoff_rejected_with_single_lower_c6);
    RUN_TEST(test_white_oversized_bearoff_rejected_with_single_lower);
    RUN_TEST(test_white_exact_bearoff_rejected_with_lower_stack);
    RUN_TEST(test_white_oversized_bearoff_rejected_with_lower_stack);
    RUN_TEST(test_white_all_stones_inside_rejects_single_outside);
    RUN_TEST(test_white_all_stones_inside_rejects_outside_stack);
    RUN_TEST(test_dice_use_counts);
    RUN_TEST(test_agari_win_conditions);
    RUN_TEST(test_hon_win_conditions);
    RUN_TEST(test_ai_can_move_from_initial_board);

    printf("\n%d C rule test(s) run, %d failure(s).\n", tests_run, failures);
    if (failures != 0) {
        return 1;
    }
    printf("All C rule tests passed.\n");
    return 0;
}

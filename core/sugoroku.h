#ifndef SUGOROKU_H
#define SUGOROKU_H

#include <stdint.h>
#include <stddef.h>
#include <stdbool.h>

#define SUGOROKU_POINTS 24
#define SUGOROKU_STONES_PER_PLAYER 15
#define SUGOROKU_MAX_MOVES 512

typedef enum {
    SUGOROKU_MODE_HON = 0,    /* 古流・本双六: doubles=2 moves, win when all stones inside inner board */
    SUGOROKU_MODE_AGARI = 1   /* 上がり双六: doubles=4 moves, win when all stones bear off */
} SugorokuMode;

typedef enum {
    SUGOROKU_AI_BAKUTO = 0,   /* 宿場博徒: aggressive hitter */
    SUGOROKU_AI_KUGE = 1,     /* 京の公家: defensive prime builder */
    SUGOROKU_AI_AKUSO = 2,    /* 比叡山悪僧: trick dice + high stakes */
    SUGOROKU_AI_BUSHO = 3     /* 鎌倉武将: balanced Expectiminimax tactician */
} SugorokuAiStyle;

typedef enum {
    SUGOROKU_DICE_FAIR = 0,   /* 牛骨賽: fair 1..6 */
    SUGOROKU_DICE_MAKIE = 1,  /* 螺鈿蒔絵筒: 1 free re-roll per game */
    SUGOROKU_DICE_TRICK = 2   /* 仕掛け賽: slight high/double bias, adds suspicion */
} SugorokuDiceType;

typedef struct {
    int8_t from;              /* 0..23 point index, or 24 for Bar (中帯) */
    int8_t to;                /* 0..23 point index, or -1 / 24 for Bear-off (上がり) */
    uint8_t die_used;         /* 1..6 */
    bool hits_blot;           /* true if this step hits an opponent single stone (叩く) */
} SugorokuStep;

typedef struct {
    SugorokuStep steps[4];
    uint8_t step_count;       /* 0..4 */
} SugorokuTurnMove;

typedef struct {
    int8_t points[SUGOROKU_POINTS]; /* >0: Player 0 (Black), <0: Player 1 (White) */
    uint8_t bar[2];                 /* Stones on central bar (中帯) */
    uint8_t borne_off[2];           /* Stones borne off (上がり) */
    uint8_t turn;                   /* 0 = Black, 1 = White */
    uint8_t dice[2];                /* Current roll: 1..6, 1..6 */
    SugorokuMode mode;              /* HON or AGARI */
    int32_t coins[2];               /* Purse in mon (文), default 1000 */
    int32_t stake;                  /* Current wager */
    uint8_t rerolls_left[2];        /* For 螺鈿蒔絵筒 */
    uint8_t suspicion[2];           /* 0..100 for 仕掛け賽 */
    uint32_t rng_state;             /* Deterministic xorshift32 state */
} SugorokuBoard;

void sugoroku_init(SugorokuBoard *b, SugorokuMode mode, uint32_t seed);
void sugoroku_roll_dice(SugorokuBoard *b, SugorokuDiceType dice_type);
const char *sugoroku_dice_callout(uint8_t d1, uint8_t d2);
size_t sugoroku_generate_turn_moves(const SugorokuBoard *b, SugorokuTurnMove *out_moves, size_t max_moves);
void sugoroku_apply_turn_move(SugorokuBoard *b, const SugorokuTurnMove *move);
int sugoroku_check_winner(const SugorokuBoard *b);
bool sugoroku_ai_choose_move(const SugorokuBoard *b, SugorokuAiStyle style, SugorokuTurnMove *best_out);

#endif // SUGOROKU_H
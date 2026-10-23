# Ban-Sugoroku (盤双六 / 本双六)

A medieval Japanese board game mini-game (the historical Japanese counterpart to Backgammon) designed like *The Witcher 3's Gwent* for seamless integration as both a standalone mobile web app and an embeddable C11 library.

## Project Structure

```
Ban-Sugoroku/
├── CMakeLists.txt              # Builds core C11 static lib + CLI game/test runner
├── Makefile                    # Convenience wrapper for C core + web build + tests
├── core/
│   ├── sugoroku.h              # Zero-dependency C11 public API (embeddable in any C/C++ game)
│   ├── sugoroku.c              # Complete rules, move generator, Expectiminimax AI, wager/dice system
│   └── cli_test.c              # Headless CLI self-test & AI-vs-AI 1000-game benchmark
├── mobile/                     # Standalone Mobile App (HTML5/TypeScript/Canvas + PWA manifest)
│   ├── index.html              # Mobile-responsive Japanese lacquerware (螺鈿蒔絵) UI
│   ├── app.js                  # Touch interaction, legal move highlights, bamboo cup shake, WebAudio SFX, AI
│   ├── style.css               # Authentic medieval Japanese Zashiki aesthetic (black/gold maki-e, wood grain)
│   └── manifest.json           # PWA manifest for "Add to Home Screen" on iOS/Android
├── tools/
│   ├── verify_all.py           # Runs C unit tests + headless simulation + verifies mobile assets
│   └── export_warband_ms.py    # Generates Mount & Blade: Warband module_presentations/scripts snippet
└── README.md
```

## Core Library (C11)

### Building

```bash
mkdir build && cd build
cmake ..
make
```

- `make` builds the static library `libsugoroku.a` and the CLI test `cli_test`.
- `make test` runs the unit tests and the AI‑vs‑AI benchmark (1000 games).
- `make clean` removes all generated files.

### API Summary (see `core/sugoroku.h`)

- `SugorokuBoard` – the complete game state (24 points, bar, borne‑off, dice, mode, coins, stake, etc.)
- `sugoroku_init(b, mode, seed)` – initialise board with a deterministic seed.
- `sugoroku_roll_dice(b, dice_type)` – roll dice (FAIR, MAKIE with free re‑roll, or TRICK with bias).
- `sugoroku_dice_callout(d1, d2)` – returns a Japanese dice description (e.g., "畳一", "重六").
- `sugoroku_generate_turn_moves(b, out, max)` – fill an array of legal `SugorokuTurnMove`s for the current player.
- `sugoroku_apply_turn_move(b, move)` – apply a move, switch turn, handle hits and bear‑offs.
- `sugoroku_check_winner(b)` – `-1` = ongoing, `0` = Black wins, `1` = White wins.
- `sugoroku_ai_choose_move(b, style, best_out)` – Expectiminimax AI (depth‑1) with four playing styles (BAKUTO, KUGE, AKUSO, BUSHO).

### CLI Test (`cli_test.c`)

- Runs basic sanity checks on board init, dice, move generation, and move application.
- With `--benchmark` (or `--games N`) it launches an AI‑vs‑AI match of `N` games (default 1000) and prints win statistics.

## Mobile Web/PWA App

Open `mobile/index.html` in a modern browser on a touch device (or use `python3 -m http.server 8080` from the project root and visit `http://localhost:8080/mobile/`).

### Features

- **Responsive Japanese lacquerware UI** – dark wood background with gold accents.
- **Touch‑friendly piece selection** – tap a piece to highlight possible destinations based on the current dice roll.
- **Legal‑move highlighting** – destinations are colour‑coded (empty = gold, blot = red).
- **Procedural Web Audio** – bamboo‑cup shake on dice roll, stone clack on move, victory chord on win.
- **PWA manifest** – can be "Add to Home Screen" on Android and iOS.
- **Simple AI** – after a player move the AI can make its turn automatically (uncomment `autoAIMove` in `app.js`).

### Controls

- **Roll Dice** – click the button or press <kbd>Space</kbd> to roll the dice (plays a bamboo shake sound).
- **Move a piece** – tap a piece owned by the current player to select it, then tap a highlighted destination to move.
- **Pass Turn** – optional button to skip a turn (currently just clears dice).
- **Replay** – after the game ends, click “Play Again” to reset.

## Tools

### `tools/verify_all.py`

Runs a full verification suite:

1. Builds and runs the C core unit tests.
2. Checks that the mobile assets exist and the HTML / manifest are syntactically valid.

Run with:

```bash
python3 tools/verify_all.py
```

### `tools/export_warband_ms.py`

Generates a placeholder snippet for integrating Ban‑Sugoroku into **Mount & Blade: Warband** via its ModuleSystem.

Run with:

```bash
python3 tools/export_warband_ms.py
```

The snippet is also written to `warband_integration.txt` for manual inspection.

## Usage Examples

### From the command line (core)

```bash
# Build everything
cd Ban-Sugoroku
make

# Run unit tests
make test

# Run 1000‑game benchmark
./build/cli_test --benchmark
```

### Running the mobile app locally

```bash
cd Ban-Sugoroku
python3 -m http.server 8080 --bind 0.0.0.0
# Open http://localhost:8080/mobile/ in a mobile browser
```

### Integration into a larger C/C++ project

```c
#include "core/sugoroku.h"

int main() {
    SugorokuBoard board;
    sugoroku_init(&board, SUGOROKU_MODE_HON, 12345);
    // ... game loop
    return 0;
}
```

## License

This repository is part of a research‑prototype series. All source files are provided as‑is without warranty.

---

*Built with ❤️ for historical authenticity and modern cross‑platform playability.*
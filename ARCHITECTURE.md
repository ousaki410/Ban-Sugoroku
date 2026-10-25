# Ban-Sugoroku (盤双六) — Architecture & AI Maintenance Guide

This repository is modularized so every file stays under ~310 lines for optimal AI / LLM context window reading.

## 1. Directory & Module Index

| File Path | Lines | Responsibility | When to Edit |
| :--- | :---: | :--- | :--- |
| `mobile/index.html` | ~20 | Clean HTML5 entry point loading ES6 module `./js/main.js` | Changing page title or font imports |
| `mobile/style.css` | ~18 | Full-screen viewport canvas layout | Adjusting viewport CSS |
| `mobile/js/eras.js` | ~195 | **6 Historical Eras & Rules Config** (`ERA_MODES`): Heian Kuge, Kamakura Jike, Muromachi Buke, Momoyama Yamato, Edo Oriha, Edo Oimawashi | Adding new eras, changing board dimensions (`geom`), stone counts (`15/14/12`), or initial setups |
| `mobile/js/state.js` | ~125 | Shared state `G`, responsive scaling, and 24-lane coordinate math (`getLaneGeom`, `getStoneSlotXY`, `getTargetSealXY`) | Adding new state variables or adjusting stone stacking positions |
| `mobile/js/audio.js` | ~140 | Zero-dependency **WebAudio Modal Synthesizer** (bamboo tube, iron bowl, teacup rattle, stone impact, Ote drum, Gagaku chord, temple bell) | Tuning acoustic frequencies or adding sound effects |
| `mobile/js/core.js` | ~305 | **Pure-Integer Rule Engine & AI (`SugorokuCore`)**: legal step generator, `一荷崩し`, `無地勝ち`, `追廻し` leapfrog, `王手` check, and DFS AI evaluation | Modifying game rules, win conditions, or AI heuristics |
| `mobile/js/ui_screens.js` | ~185 | **UI Screens**: 6-Era selection screen, Black/White stone selection modal, and Win/Loss settlement scrolls | Adjusting menu layouts or settlement screen stats |
| `mobile/js/board_renderer.js` | ~310 | **3D Artifact Renderer**: era-specific mats, maki-e cabinet walls (Kuge fan, Sanskrit lotus, hinge, iron rivets), dimpled stones, and non-interfering target seals | Modifying board visuals, maki-e patterns, or stone appearance |
| `mobile/js/main.js` | ~265 | **Game Loop & Input Controller**: 60FPS physics (dice tumble, hold-to-shake tube, parabolic stone flight) and pointer hit-testing | Changing input controls or animation timings |
| `core/sugoroku.h` / `.c` | ~360 | Standalone **C11 Embeddable Core** for C/C++ games (SDL2/SDL3) | Updating C library API |
| `tools/bake_assets.py` | ~145 | Exports procedural SFX and sprites to `.wav` and `.png` files in `mobile/assets/` | Baking static assets for external engines |
| `tools/export_warband_ms.py` | ~110 | Exports Muromachi Hon-Sugoroku to *Mount & Blade: Warband* `ModuleSystem` scripts | Integrating with Warband mods |

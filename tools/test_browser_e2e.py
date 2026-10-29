#!/usr/bin/env python3
"""Headless browser gameplay E2E regression tests for Ban-Sugoroku.

The tests drive the real canvas UI through Chromium's DevTools mouse input.
They use the application's exported geometry and state modules to locate
controls and observe transitions, so no production test hooks are needed.

Requirements:
  * Python 3
  * Selenium 4.x
  * Chromium and a matching ChromeDriver

No npm packages or browser downloads are used.
"""

import argparse
import functools
import json
import os
import re
import shutil
import subprocess
import sys
import threading
import time
import traceback
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
MOBILE_DIR = PROJECT_ROOT / "mobile"
DEFAULT_ARTIFACT_DIR = Path("/tmp/opencode/bsg-browser-artifacts")

try:
    from selenium import webdriver
    from selenium.webdriver.chrome.options import Options
    from selenium.webdriver.chrome.service import Service
except ImportError:  # Keep --list usable even when Selenium is absent.
    webdriver = None
    Options = None
    Service = None


class QuietRequestHandler(SimpleHTTPRequestHandler):
    """Serve the mobile app without polluting test output with access logs."""

    def log_message(self, fmt, *args):
        pass


PRELOAD_JS = r"""
(() => {
  window.__e2eErrors = [];

  const record = (type, message, stack) => {
    window.__e2eErrors.push({
      type,
      message: String(message),
      stack: stack ? String(stack) : "",
    });
  };

  window.addEventListener("error", (event) => {
    record(
      "error",
      event.message || "unknown window error",
      event.error && event.error.stack
    );
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    record(
      "unhandledrejection",
      reason && reason.message ? reason.message : String(reason),
      reason && reason.stack
    );
  });

  const originalConsoleError = console.error.bind(console);
  console.error = (...args) => {
    const message = args.map((value) => {
      if (typeof value === "string") return value;
      try {
        return JSON.stringify(value);
      } catch (_) {
        return String(value);
      }
    }).join(" ");
    record("console.error", message, "");
    originalConsoleError(...args);
  };

  // Test-only determinism. The game's dice are derived from Math.random().
  // A constant value makes every roll a double-four, which is legal from the
  // initial setup and exercises the four-move zorome path.
  Math.random = () => 0.5;
})();
"""


def start_http_server():
    handler = functools.partial(QuietRequestHandler, directory=str(MOBILE_DIR))
    server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    url = f"http://127.0.0.1:{server.server_address[1]}/"
    return server, thread, url


def stop_http_server(server, thread):
    try:
        server.shutdown()
    finally:
        server.server_close()
    thread.join(timeout=2.0)


def command_version(command):
    try:
        result = subprocess.run(
            [command, "--version"],
            capture_output=True,
            text=True,
            timeout=10,
        )
        return (result.stdout or result.stderr).strip()
    except Exception as exc:
        return f"unavailable ({exc})"


def major_version(text):
    match = re.search(r"(\d+)\.", text or "")
    return match.group(1) if match else None


def find_browser_tools():
    chromium = (
        shutil.which("chromium")
        or shutil.which("chromium-browser")
        or shutil.which("google-chrome")
        or shutil.which("google-chrome-stable")
    )
    chromedriver = shutil.which("chromedriver")
    return chromium, chromedriver


def create_driver(chromium, chromedriver):
    options = Options()
    options.binary_location = chromium
    options.add_argument("--headless=new")
    options.add_argument("--disable-gpu")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--mute-audio")
    options.add_argument("--window-size=1280,900")
    options.add_argument("--force-device-scale-factor=1")
    options.add_argument("--disable-background-timer-throttling")
    options.add_argument("--disable-renderer-backgrounding")
    options.add_argument("--disable-backgrounding-occluded-windows")
    options.add_argument("--no-first-run")
    options.add_argument("--no-default-browser-check")
    options.add_argument("--disable-extensions")
    if os.environ.get("BANSUGOROKU_CHROME_NO_SANDBOX") == "1":
        options.add_argument("--no-sandbox")
    options.set_capability("goog:loggingPrefs", {"browser": "ALL"})

    driver = webdriver.Chrome(service=Service(chromedriver), options=options)
    driver.set_page_load_timeout(20)
    driver.set_script_timeout(20)
    driver.implicitly_wait(0)
    driver.execute_cdp_cmd(
        "Page.addScriptToEvaluateOnNewDocument",
        {"source": PRELOAD_JS},
    )
    return driver


class BrowserSuite:
    def __init__(self, driver, url, timeout, artifact_dir):
        self.driver = driver
        self.url = url
        self.timeout = timeout
        self.artifact_dir = Path(artifact_dir)

    def _js(self, body, *args):
        """Run async JavaScript in the page and return its JSON-safe result."""
        script = (
            "const done = arguments[arguments.length - 1];\n"
            "const args = Array.prototype.slice.call(arguments, 0, arguments.length - 1);\n"
            "(async () => {\n"
            "  try {\n"
            + body
            + "\n  } catch (e) {\n"
            "    done({__error: String(e && e.stack || e)});\n"
            "  }\n"
            "})();\n"
        )
        result = self.driver.execute_async_script(script, *args)
        if isinstance(result, dict) and "__error" in result:
            raise AssertionError(result["__error"])
        if result is None:
            raise AssertionError("page script returned no result")
        return result

    def load_page(self):
        self.driver.get(self.url)
        self.wait_for(
            lambda s: s.get("readyState") == "complete"
            and s.get("screen") == "SELECT_ERA"
            and s.get("canvasWidth", 0) > 0
            and s.get("canvasHeight", 0) > 0,
            "page load and era selection screen",
        )
        self._js(
            "await new Promise((resolve) => "
            "requestAnimationFrame(() => requestAnimationFrame(resolve)));\n"
            "done({ok: true});"
        )

    def get_state(self):
        return self._js(
            r"""
const state = await import('/js/state.js');
const core = await import('/js/core.js');
const { G, canvas, currentEra } = state;
const mode = currentEra();
let legal = [];
if (G.rem && G.rem.length > 0) {
  legal = core.SugorokuCore.getLegalSteps(
    G.pts, G.bar, G.off, G.turn, G.rem, mode, G.rolledPair
  );
}
done({
  readyState: document.readyState,
  screen: G.screen,
  eraIdx: G.eraIdx,
  phase: G.phase,
  turn: G.turn,
  humanSide: G.humanSide,
  dice: G.dice.slice(),
  rem: G.rem.slice(),
  pts: G.pts.slice(),
  bar: G.bar.slice(),
  off: G.off.slice(),
  selectedFrom: G.selectedFrom,
  winner: G.winner,
  shakeTicks: G.shakeTicks,
  rolledPair: Boolean(G.rolledPair),
  stats: G.stats ? { turns: G.stats.turns, hits: G.stats.hits, doubles: G.stats.doubles } : null,
  stoneCount: mode.stoneCount,
  canBearOff: Boolean(mode.canBearOff),
  canvasWidth: canvas.width,
  canvasHeight: canvas.height,
  legalCount: legal.length,
  legal: legal.slice(0, 12),
});
"""
        )

    def wait_for(self, predicate, description):
        deadline = time.monotonic() + self.timeout
        last_state = None
        last_error = None
        while time.monotonic() < deadline:
            try:
                state = self.get_state()
                last_state = state
                if predicate(state):
                    return state
            except Exception as exc:  # Page may still be importing modules.
                last_error = exc
            time.sleep(0.05)
        detail = (
            "last state: " + json.dumps(last_state, ensure_ascii=False)
            if last_state is not None
            else "last error: " + str(last_error)
        )
        raise AssertionError(
            f"Timed out waiting for {description}. {detail}"
        )

    def get_js_errors(self):
        return self.driver.execute_script("return window.__e2eErrors || [];")

    def get_browser_logs(self):
        try:
            return self.driver.get_log("browser")
        except Exception:
            return []

    def assert_no_js_errors(self):
        errors = self.get_js_errors()
        severe_js_logs = [
            entry
            for entry in self.get_browser_logs()
            if entry.get("level") == "SEVERE"
            and entry.get("source") in ("javascript", "console-api")
        ]
        if errors or severe_js_logs:
            raise AssertionError(
                "JavaScript errors detected: "
                + json.dumps(
                    {"window": errors, "browser": severe_js_logs},
                    ensure_ascii=False,
                )
            )

    def capture_failure(self, scenario, exc):
        self.artifact_dir.mkdir(parents=True, exist_ok=True)
        screenshot = self.artifact_dir / f"{scenario}.png"
        dump = self.artifact_dir / f"{scenario}.json"
        data = {
            "scenario": scenario,
            "error": str(exc),
            "traceback": traceback.format_exc(),
        }
        try:
            data["url"] = self.driver.current_url
        except Exception as url_exc:
            data["url_error"] = str(url_exc)
        try:
            self.driver.save_screenshot(str(screenshot))
        except Exception as shot_exc:
            data["screenshot_error"] = str(shot_exc)
        try:
            data["state"] = self.get_state()
        except Exception as state_exc:
            data["state_error"] = str(state_exc)
        try:
            data["js_errors"] = self.get_js_errors()
        except Exception as js_exc:
            data["js_errors_error"] = str(js_exc)
        data["browser_logs"] = self.get_browser_logs()
        dump.write_text(
            json.dumps(data, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        return [str(screenshot), str(dump)]

    def assert_invariants(self, state, context):
        points = state["pts"]
        bar = state["bar"]
        off = state["off"]
        count = state["stoneCount"]

        assert len(points) == 24, f"{context}: expected 24 points"
        for idx, value in enumerate(points):
            assert isinstance(value, int) and not isinstance(value, bool), (
                f"{context}: point {idx} is not an integer: {value!r}"
            )
            assert abs(value) <= count, (
                f"{context}: point {idx} has invalid count {value} "
                f"for {count} stones"
            )
        for name, values in (("bar", bar), ("off", off)):
            assert len(values) == 2, f"{context}: {name} must have two sides"
            for side, value in enumerate(values):
                assert isinstance(value, int) and not isinstance(value, bool), (
                    f"{context}: {name}[{side}] is not an integer: {value!r}"
                )
                assert 0 <= value <= count, (
                    f"{context}: {name}[{side}] has invalid count {value}"
                )

        black_total = (
            sum(value for value in points if value > 0) + bar[0] + off[0]
        )
        white_total = (
            sum(-value for value in points if value < 0) + bar[1] + off[1]
        )
        assert black_total == count, (
            f"{context}: Black stone count {black_total} != {count}"
        )
        assert white_total == count, (
            f"{context}: White stone count {white_total} != {count}"
        )

    def _client_point(self, board_x, board_y):
        return self._js(
            r"""
const state = await import('/js/state.js');
const { canvas, scale, offsetX, offsetY } = state;
const rect = canvas.getBoundingClientRect();
const scaleX = canvas.width / rect.width;
const scaleY = canvas.height / rect.height;
done({
  x: rect.left + (offsetX + args[0] * scale) / scaleX,
  y: rect.top + (offsetY + args[1] * scale) / scaleY,
});
""",
            board_x,
            board_y,
        )

    def _mouse(self, event_type, client_point, pressed=False):
        params = {
            "type": event_type,
            "x": client_point["x"],
            "y": client_point["y"],
        }
        if event_type == "mouseMoved":
            params["buttons"] = 0
        elif event_type == "mousePressed":
            params.update(button="left", buttons=1, clickCount=1)
        elif event_type == "mouseReleased":
            params.update(button="left", buttons=0, clickCount=1)
        self.driver.execute_cdp_cmd("Input.dispatchMouseEvent", params)

    def mouse_down(self, board_x, board_y):
        point = self._client_point(board_x, board_y)
        self._mouse("mouseMoved", point)
        self._mouse("mousePressed", point, pressed=True)
        return point

    def mouse_up(self, client_point):
        self._mouse("mouseReleased", client_point)

    def click_board(self, board_x, board_y):
        point = self.mouse_down(board_x, board_y)
        self.mouse_up(point)

    def click_era(self, era_idx):
        center = self._js(
            r"""
const state = await import('/js/state.js');
const screens = await import('/js/ui_screens.js');
const rect = screens.getEraCardRect(args[0]);
done({ x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 });
""",
            era_idx,
        )
        self.click_board(center["x"], center["y"])

    def click_color(self, side):
        center = self._js(
            r"""
const state = await import('/js/state.js');
const W = state.W;
const H = state.H;
const modalW = 680;
const modalH = 390;
const modalX = (W - modalW) / 2;
const modalY = (H - modalH) / 2;
const boxX = args[0] === 0 ? modalX + 64 : modalX + 366;
const boxY = modalY + 164;
done({ x: boxX + 125, y: boxY + 74 });
""",
            side,
        )
        self.click_board(center["x"], center["y"])

    def wait_frames(self):
        self._js(
            "await new Promise((resolve) => "
            "requestAnimationFrame(() => requestAnimationFrame(resolve)));\n"
            "done({ok: true});"
        )

    def get_board_pixel(self, board_x, board_y):
        """Read one canvas pixel using board coordinates (1280x760 space)."""
        return self._js(
            r"""
const state = await import('/js/state.js');
const { canvas, ctx, scale, offsetX, offsetY } = state;
const px = Math.round(offsetX + args[0] * scale);
const py = Math.round(offsetY + args[1] * scale);
const data = ctx.getImageData(px, py, 1, 1).data;
done({ r: data[0], g: data[1], b: data[2], a: data[3] });
""",
            board_x,
            board_y,
        )

    def lane_center(self, point_idx):
        return self._js(
            r"""
const state = await import('/js/state.js');
const lane = state.getLaneGeom(args[0]);
done({ x: lane.cx, y: lane.y + lane.h / 2 });
""",
            point_idx,
        )

    def bar_center(self, human_side):
        return self._js(
            r"""
const state = await import('/js/state.js');
const board = state.B();
done({
  x: args[0] === 0 ? board.x + 100 : board.x + board.w - 100,
  y: board.y + board.h / 2,
});
""",
            human_side,
        )

    def tube_center(self):
        return self._js(
            r"""
const state = await import('/js/state.js');
done({ x: state.G.tube.baseX, y: state.G.tube.baseY });
"""
        )

    def get_targets(self, source):
        return self._js(
            r"""
const state = await import('/js/state.js');
const core = await import('/js/core.js');
const { G, currentEra, getTargetSealXY } = state;
const mode = currentEra();
const targets = core.SugorokuCore.getExpandedTargetsForSource(
  G.pts, G.bar, G.off, G.humanSide, args[0], G.rem, mode, G.rolledPair
);
done(targets.map((target) => {
  const pos = getTargetSealXY(target);
  return {
    to: target.to,
    die: target.die,
    isCombined: Boolean(target.isCombined),
    steps: target.steps.length,
    sealX: pos.sealX,
    sealY: pos.sealY,
  };
}));
""",
            source,
        )

    @staticmethod
    def find_target(targets, to):
        for target in targets:
            if str(target["to"]) == str(to) and not target["isCombined"]:
                return target
        for target in targets:
            if str(target["to"]) == str(to):
                return target
        return None

    def setup_fixture(
        self,
        era_idx,
        human_side,
        turn,
        pts,
        bar,
        off,
        rem,
        dice,
        selected_from=None,
    ):
        self._js(
            r"""
const state = await import('/js/state.js');
const { G } = state;
G.screen = 'PLAYING';
G.eraIdx = args[0];
G.humanSide = args[1];
G.turn = args[2];
G.pts = args[3].slice();
G.bar = args[4].slice();
G.off = args[5].slice();
G.rem = args[6].slice();
G.dice = args[7].slice();
G.phase = 'PLAYER_MOVE';
G.selectedFrom = args[8];
G.rolledPair = false;
G.winner = -1;
G.winReason = '';
G.flyingStone = null;
G.stamp = null;
G.boardShake = 0;
G.oteAlerted = [false, false];
G.oteActive = [false, false];
G.stats = { turns: 1, hits: 0, doubles: 0 };
G.statusText = '';
G.tube.tipped = false;
G.hoveredFrom = null;
G.hoveredTargetTo = null;
done({ ok: true });
""",
            era_idx,
            human_side,
            turn,
            pts,
            bar,
            off,
            rem,
            dice,
            selected_from,
        )
        return self.wait_for(
            lambda s: s["screen"] == "PLAYING"
            and s["phase"] == "PLAYER_MOVE"
            and s["eraIdx"] == era_idx
            and s["humanSide"] == human_side
            and s["turn"] == turn,
            "deterministic fixture setup",
        )

    def select_source(self, source):
        if source == "bar":
            center = self.bar_center(self.get_state()["humanSide"])
        else:
            center = self.lane_center(source)
        self.click_board(center["x"], center["y"])
        return self.wait_for(
            lambda s: s["selectedFrom"] == source,
            f"selection of source {source}",
        )

    def hold_and_release_tube(self):
        center = self.tube_center()
        point = self.mouse_down(center["x"], center["y"])
        self.wait_for(
            lambda s: s["phase"] == "PLAYER_HOLD_TUBE"
            and s["shakeTicks"] >= 3,
            "dice tube hold",
        )
        self.mouse_up(point)

    def play_one_direct_target(self):
        before = self.get_state()
        source = before["selectedFrom"]
        if source is None:
            legal = before["legal"]
            assert legal, "no legal source is available"
            source = legal[0]["from"]
            self.select_source(source)
            before = self.get_state()

        targets = self.get_targets(source)
        assert targets, f"no targets for source {source}"
        direct = [target for target in targets if not target["isCombined"]]
        target = direct[0] if direct else targets[0]
        before_rem = len(before["rem"])
        self.click_board(target["sealX"], target["sealY"])
        return self.wait_for(
            lambda s: s["phase"] != "STONE_FLY"
            and (
                len(s["rem"]) < before_rem
                or s["phase"] in ("WAIT_ROLL", "AI_WAIT", "SETTLEMENT")
            ),
            "move application",
        )

    def scenario_page_load(self):
        self.load_page()
        state = self.get_state()
        assert state["screen"] == "SELECT_ERA", state
        assert state["canvasWidth"] > 0, state
        assert state["canvasHeight"] > 0, state

    def scenario_new_game_roll_move_turn(self):
        self.load_page()
        self.click_era(2)
        self.wait_for(
            lambda s: s["screen"] == "SELECT_COLOR" and s["eraIdx"] == 2,
            "era selection",
        )
        self.click_color(0)
        state = self.wait_for(
            lambda s: s["screen"] == "PLAYING"
            and s["phase"] == "WAIT_ROLL"
            and s["turn"] == 0
            and s["humanSide"] == 0,
            "new Black game",
        )
        self.assert_invariants(state, "new game")

        self.hold_and_release_tube()
        state = self.wait_for(
            lambda s: s["phase"] == "PLAYER_MOVE"
            and s["legalCount"] > 0
            and s["dice"][0] > 0
            and s["dice"][1] > 0,
            "dice roll and legal move availability",
        )
        assert len(state["rem"]) in (2, 4), state
        self.assert_invariants(state, "after dice roll")

        for _ in range(4):
            state = self.get_state()
            if (
                state["phase"] != "PLAYER_MOVE"
                or state["turn"] != state["humanSide"]
                or not state["rem"]
            ):
                break
            state = self.play_one_direct_target()
            self.assert_invariants(state, "after ordinary move")

        state = self.wait_for(
            lambda s: s["turn"] == 1,
            "turn handoff after consuming dice",
        )
        assert state["winner"] == -1, state
        self.assert_invariants(state, "after turn handoff")

    def scenario_capture_black(self):
        self.load_page()
        pts = [0] * 24
        pts[23] = 14
        pts[12] = 1
        pts[0] = -14
        pts[10] = -1
        state = self.setup_fixture(
            era_idx=2,
            human_side=0,
            turn=0,
            pts=pts,
            bar=[0, 0],
            off=[0, 0],
            rem=[2, 1],
            dice=[2, 1],
        )
        self.assert_invariants(state, "Black capture fixture")

        self.select_source(12)
        targets = self.get_targets(12)
        target = self.find_target(targets, 10)
        assert target is not None, f"capture target 10 missing: {targets}"
        self.click_board(target["sealX"], target["sealY"])
        state = self.wait_for(
            lambda s: s["phase"] == "PLAYER_MOVE"
            and s["pts"][10] == 1
            and s["pts"][12] == 0
            and s["bar"][1] == 1
            and len(s["rem"]) == 1,
            "Black capture result",
        )
        self.assert_invariants(state, "after Black capture")
        assert state["turn"] == 0, state

    def scenario_capture_white(self):
        self.load_page()
        pts = [0] * 24
        pts[23] = 14
        pts[13] = 1
        pts[0] = -14
        pts[11] = -1
        state = self.setup_fixture(
            era_idx=2,
            human_side=1,
            turn=1,
            pts=pts,
            bar=[0, 0],
            off=[0, 0],
            rem=[2, 1],
            dice=[2, 1],
        )
        self.assert_invariants(state, "White capture fixture")

        self.select_source(11)
        targets = self.get_targets(11)
        target = self.find_target(targets, 13)
        assert target is not None, f"capture target 13 missing: {targets}"
        self.click_board(target["sealX"], target["sealY"])
        state = self.wait_for(
            lambda s: s["phase"] == "PLAYER_MOVE"
            and s["pts"][13] == -1
            and s["pts"][11] == 0
            and s["bar"][0] == 1
            and len(s["rem"]) == 1,
            "White capture result",
        )
        self.assert_invariants(state, "after White capture")
        assert state["turn"] == 1, state

    def scenario_bar_entry_black(self):
        self.load_page()
        pts = [0] * 24
        pts[5] = 14
        pts[0] = -12
        pts[20] = -1
        pts[21] = -2
        state = self.setup_fixture(
            era_idx=3,
            human_side=0,
            turn=0,
            pts=pts,
            bar=[1, 0],
            off=[0, 0],
            rem=[2, 1],
            dice=[2, 1],
        )
        self.assert_invariants(state, "Black bar-entry fixture")

        self.select_source("bar")
        targets = self.get_targets("bar")
        assert not any(str(target["to"]) == "21" for target in targets), targets
        target = self.find_target(targets, 20)
        assert target is not None, f"bar-entry capture target 20 missing: {targets}"
        self.click_board(target["sealX"], target["sealY"])
        state = self.wait_for(
            lambda s: s["phase"] == "PLAYER_MOVE"
            and s["bar"][0] == 0
            and s["pts"][20] == 1
            and s["bar"][1] == 1
            and len(s["rem"]) == 1,
            "Black bar-entry capture result",
        )
        self.assert_invariants(state, "after Black bar entry")
        assert state["turn"] == 0, state

    def scenario_bar_entry_white(self):
        self.load_page()
        pts = [0] * 24
        pts[18] = -14
        pts[2] = 2
        pts[3] = 1
        pts[23] = 12
        state = self.setup_fixture(
            era_idx=3,
            human_side=1,
            turn=1,
            pts=pts,
            bar=[0, 1],
            off=[0, 0],
            rem=[2, 1],
            dice=[2, 1],
        )
        self.assert_invariants(state, "White bar-entry fixture")

        self.select_source("bar")
        targets = self.get_targets("bar")
        assert not any(str(target["to"]) == "2" for target in targets), targets
        target = self.find_target(targets, 3)
        assert target is not None, f"bar-entry capture target 3 missing: {targets}"
        self.click_board(target["sealX"], target["sealY"])
        state = self.wait_for(
            lambda s: s["phase"] == "PLAYER_MOVE"
            and s["bar"][1] == 0
            and s["pts"][3] == -1
            and s["bar"][0] == 1
            and len(s["rem"]) == 1,
            "White bar-entry capture result",
        )
        self.assert_invariants(state, "after White bar entry")
        assert state["turn"] == 1, state

    def scenario_bear_off_black(self):
        self.load_page()
        pts = [0] * 24
        pts[5] = 1
        pts[0] = -15
        state = self.setup_fixture(
            era_idx=3,
            human_side=0,
            turn=0,
            pts=pts,
            bar=[0, 0],
            off=[14, 0],
            rem=[6],
            dice=[6, 0],
        )
        assert state["canBearOff"], state
        self.assert_invariants(state, "Black bear-off fixture")

        self.select_source(5)
        targets = self.get_targets(5)
        target = self.find_target(targets, "off")
        assert target is not None, f"Black off target missing: {targets}"
        self.click_board(target["sealX"], target["sealY"])
        state = self.wait_for(
            lambda s: s["phase"] == "SETTLEMENT"
            and s["off"][0] == 15
            and s["winner"] == 0,
            "Black bear-off settlement",
        )
        self.assert_invariants(state, "after Black bear-off")

    def scenario_bear_off_white(self):
        self.load_page()
        pts = [0] * 24
        pts[18] = -1
        pts[23] = 15
        state = self.setup_fixture(
            era_idx=3,
            human_side=1,
            turn=1,
            pts=pts,
            bar=[0, 0],
            off=[0, 14],
            rem=[6],
            dice=[6, 0],
        )
        assert state["canBearOff"], state
        self.assert_invariants(state, "White bear-off fixture")

        self.select_source(18)
        targets = self.get_targets(18)
        target = self.find_target(targets, "off")
        assert target is not None, f"White off target missing: {targets}"
        self.click_board(target["sealX"], target["sealY"])
        state = self.wait_for(
            lambda s: s["phase"] == "SETTLEMENT"
            and s["off"][1] == 15
            and s["winner"] == 1,
            "White bear-off settlement",
        )
        self.assert_invariants(state, "after White bear-off")


    def setup_settlement_fixture(self, era_idx, winner=0, turns=17, hits=3, doubles=6):
        """Force a SETTLEMENT state in the given era without playing out the match."""
        self._js(
            r"""
const state = await import('/js/state.js');
const core = await import('/js/core.js');
const { ERA_MODES } = await import('/js/eras.js');
const { G } = state;
const mode = ERA_MODES[args[0]];
G.screen = 'PLAYING';
G.eraIdx = args[0];
G.humanSide = 0;
G.turn = 1;
G.phase = 'SETTLEMENT';
G.winner = args[1];
G.humanSide = args[1] === 0 ? 0 : 1;
G.winReason = 'test-settlement';
G.pts = new Array(24).fill(0);
G.bar = [0, 0];
G.off = [6, 6];
G.rem = [];
G.dice = [4, 4];
G.rolledPair = true;
G.flyingStone = null;
G.stamp = null;
G.boardShake = 0;
G.oteActive = [false, false];
G.oteAlerted = [false, false];
G.stats = { turns: args[2], hits: args[3], doubles: args[4] };
G.statusText = '';
done({ ok: true });
""",
            era_idx,
            winner,
            turns,
            hits,
            doubles,
        )
        return self.wait_for(
            lambda s: s["screen"] == "PLAYING"
            and s["phase"] == "SETTLEMENT"
            and s["eraIdx"] == era_idx
            and s["winner"] == winner,
            "settlement fixture",
        )

    def scenario_edo_oimawashi_flow(self):
        """Era 6 (江戸閨房・浮世絵 oimawashi) standard 3D board: side select, roll/move,
        bottom-right buttons respond at all states, and settlement rematch/change-era
        resolve without freezing."""
        self.load_page();
        self.click_era(5);
        self.wait_for(
            lambda s: s["screen"] == "SELECT_COLOR" and s["eraIdx"] == 5,
            "era 6 side select",
        );

        # The bottom-right CHANGE_ERA_BTN must fire even from SIDE_SELECT.
        self.click_board(1178, 693);
        self.wait_for(lambda s: s["screen"] == "SELECT_ERA", "era 6 side-select change-era");
        self.click_era(5);
        self.wait_for(
            lambda s: s["screen"] == "SELECT_COLOR" and s["eraIdx"] == 5,
            "era 6 side select after returning to menu",
        );

        # Standard 3D wooden board renders (not the old ukiyoe paper sheet).
        # The chonin board is dark; sample inside the board face itself.
        brightness_before = self.get_board_pixel(420, 320)["r"];

        self.click_color(0);
        state = self.wait_for(
            lambda s: s["screen"] == "PLAYING"
            and s["phase"] == "WAIT_ROLL"
            and s["turn"] == 0
            and s["humanSide"] == 0
            and s["eraIdx"] == 5,
            "era 6 Black game start",
        );
        self.assert_invariants(state, "era 6 new game");
        brightness_after = self.get_board_pixel(420, 320)["r"];
        assert brightness_after <= 80, (
            f"era 6 board should render the dark chonin felt, not bright ukiyoe paper: {brightness_after}"
        );

        # Deterministic double-four roll (Math.random injected = 0.5).
        self.hold_and_release_tube();
        for _ in range(4):
            self.wait_frames();
        rolled = self.wait_for(
            lambda s: s["phase"] == "PLAYER_MOVE" and s["dice"] == [4, 4],
            "era 6 deterministic roll",
        );
        assert rolled["rolledPair"] is True, rolled;
        # Rolling no longer shakes the desk; only stone-landing impacts do.
        self.assert_invariants(rolled, "era 6 after roll");

        # Apply the deterministic double-four move(s). Oimawashi has no combined
        # targets, so each die resolves to one stone hop.
        for _ in range(6):
            st = self.get_state();
            if st["phase"] != "PLAYER_MOVE" or len(st["rem"]) == 0:
                break;
            try:
                self.play_one_direct_target();
            except Exception:
                break;
        moved = self.wait_for(
            lambda s: s["phase"] in ("WAIT_ROLL", "AI_WAIT", "SETTLEMENT")
            and len(s["rem"]) == 0,
            "era 6 all moves applied",
        );
        self.assert_invariants(moved, "era 6 after move");

        # Bottom-right CHANGE_ERA_BTN must respond at PLAYING screen (no freeze).
        self.click_board(1178, 693);
        self.wait_for(lambda s: s["screen"] == "SELECT_ERA" and s["eraIdx"] == 5, "era 6 play change-era");

        # Force a settlement overlay and verify the 四項 / three-button row.
        self.setup_settlement_fixture(5, 0, turns=17, hits=3, doubles=6);
        rendered = self.wait_for(
            lambda s: s["phase"] == "SETTLEMENT" and s["winner"] == 0,
            "era 6 settlement rendered",
        );

        # SETTLEMENT → 時代・遊び方を替える returns to ERA_SELECT immediately.
        self.setup_settlement_fixture(5, 0);
        self.click_board(766, 530);
        self.wait_for(lambda s: s["screen"] == "SELECT_ERA", "era 6 settlement change-era");

        # Re-enter era 6 and verify the single rematch label (再戦する) still works.
        self.click_era(5);
        self.wait_for(
            lambda s: s["screen"] == "SELECT_COLOR" and s["eraIdx"] == 5,
            "era 6 re-enter side select",
        );
        self.click_color(0);
        self.wait_for(
            lambda s: s["screen"] == "PLAYING" and s["phase"] == "WAIT_ROLL",
            "era 6 re-enter play",
        );
        self.setup_settlement_fixture(5, 0);
        self.wait_for(lambda s: s["phase"] == "SETTLEMENT", "era 6 settlement re-rendered");
        self.click_board(514, 530);
        self.wait_for(
            lambda s: s["phase"] == "WAIT_ROLL" and s["turn"] == 0,
            "era 6 settlement rematch restarts the match",
        );



SCENARIOS = [
    (
        "page_load",
        "Load the page and verify the canvas and era screen without JS errors.",
        BrowserSuite.scenario_page_load,
    ),
    (
        "new_game_roll_move_turn",
        "Start a Black game, roll the tube, apply legal moves, and hand off the turn.",
        BrowserSuite.scenario_new_game_roll_move_turn,
    ),
    (
        "capture_black",
        "Black captures a White blot through canvas lane/target clicks.",
        BrowserSuite.scenario_capture_black,
    ),
    (
        "capture_white",
        "White captures a Black blot through canvas lane/target clicks.",
        BrowserSuite.scenario_capture_white,
    ),
    (
        "bar_entry_black",
        "Black bar entry rejects a blocked stack and captures a blot.",
        BrowserSuite.scenario_bar_entry_black,
    ),
    (
        "bar_entry_white",
        "White bar entry rejects a blocked stack and captures a blot.",
        BrowserSuite.scenario_bar_entry_white,
    ),
    (
        "bear_off_black",
        "Black completes bear-off in Sengoku and reaches settlement.",
        BrowserSuite.scenario_bear_off_black,
    ),
    (
        "bear_off_white",
        "White completes bear-off in Sengoku and reaches settlement.",
        BrowserSuite.scenario_bear_off_white,
    ),
    (
        "edo_oimawashi_flow",
        "Era 6 renders the standard chonin oimawashi 3D board (日本橘・测幻細), rolls a deterministic double-four, applies a move, and exits from play and settlement without freezing.",
        BrowserSuite.scenario_edo_oimawashi_flow,
    ),
]

SCENARIO_NAMES = [name for name, _, _ in SCENARIOS]


def parse_args(argv=None):
    parser = argparse.ArgumentParser(
        description="Run headless browser gameplay E2E tests."
    )
    parser.add_argument(
        "--scenario",
        action="append",
        choices=SCENARIO_NAMES,
        metavar="NAME",
        help="Run only the named scenario. May be repeated.",
    )
    parser.add_argument(
        "--list",
        action="store_true",
        help="List scenario names and exit.",
    )
    parser.add_argument(
        "--timeout",
        type=float,
        default=10.0,
        help="Per-state wait timeout in seconds (default: 10).",
    )
    parser.add_argument(
        "--artifact-dir",
        default=os.environ.get(
            "BANSUGOROKU_BROWSER_ARTIFACT_DIR",
            str(DEFAULT_ARTIFACT_DIR),
        ),
        help="Directory for failure screenshots and state dumps.",
    )
    return parser.parse_args(argv)


def main(argv=None):
    args = parse_args(argv)
    if args.list:
        for name, description, _ in SCENARIOS:
            print(f"{name}: {description}")
        return 0

    if webdriver is None:
        print(
            "Browser E2E unavailable: Selenium is not installed. "
            "Install Selenium 4.x and a matching ChromeDriver."
        )
        return 2

    chromium, chromedriver = find_browser_tools()
    if chromium is None or chromedriver is None:
        print(
            "Browser E2E unavailable: Chromium and ChromeDriver are required. "
            f"chromium={chromium!r}, chromedriver={chromedriver!r}"
        )
        return 2

    chromium_version = command_version(chromium)
    chromedriver_version = command_version(chromedriver)
    print(f"Chromium: {chromium_version}")
    print(f"ChromeDriver: {chromedriver_version}")
    chromium_major = major_version(chromium_version)
    chromedriver_major = major_version(chromedriver_version)
    if (
        chromium_major
        and chromedriver_major
        and chromium_major != chromedriver_major
    ):
        print(
            "Browser E2E unavailable: Chromium and ChromeDriver major versions "
            f"differ ({chromium_major} vs {chromedriver_major})."
        )
        return 2

    selected = [
        scenario
        for scenario in SCENARIOS
        if not args.scenario or scenario[0] in args.scenario
    ]

    server, server_thread, url = start_http_server()
    driver = None
    failures = []
    try:
        try:
            driver = create_driver(chromium, chromedriver)
        except Exception as exc:
            print(f"Browser E2E unavailable: failed to start Chromium: {exc}")
            return 2

        suite = BrowserSuite(driver, url, args.timeout, args.artifact_dir)
        for name, _, scenario in selected:
            print(f"RUN {name}")
            try:
                scenario(suite)
                suite.assert_no_js_errors()
            except Exception as exc:
                failures.append((name, exc))
                artifacts = suite.capture_failure(name, exc)
                print(f"FAIL {name}: {exc}")
                print("  Artifacts: " + ", ".join(artifacts))
            else:
                print(f"PASS {name}")

        if failures:
            print(
                f"\n{len(failures)} of {len(selected)} browser scenario(s) failed."
            )
            return 1
        print(f"\nAll {len(selected)} browser scenario(s) passed.")
        return 0
    finally:
        if driver is not None:
            try:
                driver.quit()
            except Exception:
                pass
        stop_http_server(server, server_thread)


if __name__ == "__main__":
    sys.exit(main())

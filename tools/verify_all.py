#!/usr/bin/env python3
"""
Verification script for Ban-Sugoroku project.
Performs the following checks:
1. Runs C core unit tests (cli_test)
2. Runs the forced-winner CLI benchmark
3. Validates mobile asset existence and HTML syntax (basic checks)
4. Syntax-checks each mobile ES module with `node --check`
5. Runs an ES-module import smoke test for eras.js and core.js
6. Reports any failures.

By default, C tests are compiled from current source into a fresh temporary
directory that is removed afterwards; the tracked ./build directory is never
used or modified. Set BANSUGOROKU_BUILD_DIR to compile into an explicit
directory instead (it is left in place, and its existing contents are not
deleted).
"""

import os
import sys
import subprocess
import json
import re
import shlex
import shutil
import tempfile
from pathlib import Path

# Project root directory (where verify_all.py lives)
PROJECT_ROOT = Path(__file__).parent.parent
CORE_DIR = PROJECT_ROOT / "core"
MOBILE_DIR = PROJECT_ROOT / "mobile"
TOOLS_DIR = PROJECT_ROOT / "tools"

# When BANSUGOROKU_BUILD_DIR is set, build there and leave the directory in
# place. Otherwise verify_c_tests() creates and removes an isolated temporary
# directory, so the tracked ./build artifacts are never used or overwritten.
_build_dir_env = os.environ.get("BANSUGOROKU_BUILD_DIR")
if _build_dir_env:
    C_BUILD_DIR = Path(_build_dir_env)
    if not C_BUILD_DIR.is_absolute():
        C_BUILD_DIR = (PROJECT_ROOT / C_BUILD_DIR).resolve()
else:
    C_BUILD_DIR = None


def build_dir_arg(build_dir):
    """Return a shell-safe `make BUILD_DIR=...` argument."""
    return f"BUILD_DIR={shlex.quote(str(build_dir))}"

def run_cmd(cmd, cwd=None):
    """Run shell command and return (success, stdout, stderr)."""
    try:
        result = subprocess.run(cmd, shell=True, cwd=cwd, capture_output=True, text=True)
        return result.returncode == 0, result.stdout, result.stderr
    except Exception as e:
        return False, "", str(e)

def verify_c_tests():
    print("=== Verifying C Core Tests ===")
    if C_BUILD_DIR is not None:
        build_dir = C_BUILD_DIR
        created_temp = False
        print(f"Using explicit build directory: {build_dir}")
        if build_dir.exists():
            existing = sorted(p.name for p in build_dir.iterdir())
            print(f"Existing contents (not deleted): {existing if existing else '(empty)'}")
        else:
            print("Explicit build directory does not exist; it will be created by make.")
    else:
        build_dir = Path(tempfile.mkdtemp(prefix="ban-sugoroku-build-"))
        created_temp = True
        print(f"Using isolated temporary build directory: {build_dir}")

    try:
        # Always compile from current source so a stale binary is never used.
        print(f"Building current C source into {build_dir} ...")
        ok, out, err = run_cmd(f"make {build_dir_arg(build_dir)}", cwd=PROJECT_ROOT)
        if not ok:
            print("Build failed:")
            print((err or out).strip())
            return False
        print("Build succeeded.")

        cli_test_path = build_dir / "cli_test"
        if not cli_test_path.exists():
            print(f"cli_test not found in {build_dir} after build.")
            return False

        # Run basic self-tests against the freshly built binary.
        ok, out, err = run_cmd(str(cli_test_path), cwd=build_dir)
        if not ok:
            print("Basic C core tests failed:", out, err)
            return False
        print("Basic C core tests passed.")

        # Run the benchmark against the same freshly built binary.
        ok, out, err = run_cmd(str(cli_test_path) + " --benchmark", cwd=build_dir)
        if not ok:
            print("C core benchmark failed:", out, err)
            return False

        # Parse benchmark results.
        match = re.search(r"Benchmark results: Black wins=(\d+), White wins=(\d+), draws=(\d+)", out)
        if not match:
            print("Benchmark output format unexpected:", out)
            return False
        black_wins = int(match.group(1))
        white_wins = int(match.group(2))
        draws = int(match.group(3))
        print(f"Benchmark: Black wins {black_wins}, White wins {white_wins}, draws {draws}")
        # NOTE: cli_test forces a winner via a tie-breaker when a game hits the
        # turn limit, so draws == 0 is guaranteed by construction and is NOT by
        # itself evidence that no deadlocks or rule bugs exist. This check only
        # guards the benchmark's output contract.
        if draws > 0:
            print(f"ERROR: draws > 0 ({draws})")
            return False
        # Optional: check win percentages (at least 10% each)
        total = black_wins + white_wins + draws
        if total > 0:
            if black_wins < total * 0.10 or white_wins < total * 0.10:
                print(f"WARNING: one player win rate below 10% (Black {black_wins/total*100:.1f}%, White {white_wins/total*100:.1f}%)")
        return True
    except Exception as e:
        print(f"C verification error: {e}")
        return False
    finally:
        if created_temp:
            shutil.rmtree(build_dir, ignore_errors=True)
            print(f"Removed temporary build directory: {build_dir}")

def verify_mobile_assets():
    print("=== Verifying Mobile Assets ===")
    # The live entry point is mobile/index.html -> ./js/main.js.
    # mobile/app.js is a legacy monolith that is still tracked but unused.
    required_files = [
        MOBILE_DIR / "index.html",
        MOBILE_DIR / "js" / "main.js",
        MOBILE_DIR / "js" / "core.js",
        MOBILE_DIR / "js" / "eras.js",
        MOBILE_DIR / "js" / "state.js",
        MOBILE_DIR / "js" / "audio.js",
        MOBILE_DIR / "js" / "board_renderer.js",
        MOBILE_DIR / "js" / "ui_screens.js",
        MOBILE_DIR / "style.css",
        MOBILE_DIR / "manifest.json",
    ]
    missing = []
    for f in required_files:
        if not f.exists():
            missing.append(str(f.relative_to(PROJECT_ROOT)))
    if missing:
        print(f"Missing mobile assets: {missing}")
        return False
    # Basic HTML syntax check (simple regex for <!DOCTYPE html> and <html> tags)
    html_content = (MOBILE_DIR / "index.html").read_text()
    if not re.search(r"<!DOCTYPE html>", html_content, re.IGNORECASE):
        print("HTML missing DOCTYPE.")
        return False
    if not re.search(r"<html", html_content, re.IGNORECASE):
        print("HTML missing <html> tag.")
        return False
    # Check manifest JSON validity
    manifest_path = MOBILE_DIR / "manifest.json";
    try:
        json.loads(manifest_path.read_text())
    except Exception as e:
        print(f"Manifest JSON invalid: {e}")
        return False
    print("Mobile assets check passed.")
    return True

def verify_mobile_js_syntax():
    """Syntax-check every mobile ES module with `node --check`.

    This is a per-file syntax check only. It does not resolve imports or
    evaluate modules; verify_mobile_js_imports() performs the link check.
    """
    print("=== Verifying Mobile JS Syntax ===")
    node = shutil.which("node")
    if node is None:
        print("node not found; skipping JS syntax checks.")
        return True
    js_files = sorted((MOBILE_DIR / "js").glob("*.js"))
    if not js_files:
        print("No mobile JS modules found.")
        return False
    failed = []
    for f in js_files:
        cmd = f"{shlex.quote(node)} --check {shlex.quote(str(f))}"
        ok, out, err = run_cmd(cmd)
        if ok:
            print(f"  OK: {f.relative_to(PROJECT_ROOT)}")
        else:
            failed.append((f, (err or out).strip()))
    if failed:
        for f, msg in failed:
            print(f"  FAIL: {f.relative_to(PROJECT_ROOT)}: {msg}")
        return False
    print("Mobile JS syntax check passed.")
    return True

def verify_mobile_js_imports():
    """Run the ES-module import smoke test (named-export link check)."""
    print("=== Verifying Mobile JS Imports ===")
    node = shutil.which("node")
    if node is None:
        print("node not found; skipping JS import smoke test.")
        return True
    script = TOOLS_DIR / "verify_js_imports.mjs"
    if not script.exists():
        print(f"Import smoke test script not found: {script.relative_to(PROJECT_ROOT)}")
        return False
    cmd = f"{shlex.quote(node)} {shlex.quote(str(script))}"
    ok, out, err = run_cmd(cmd, cwd=PROJECT_ROOT)
    if not ok:
        print("JS import smoke test failed:")
        if out.strip():
            print(out.strip())
        if err.strip():
            print(err.strip())
        return False
    if out.strip():
        print(out.strip())
    print("Mobile JS import smoke test passed.")
    return True

def main():
    # Ensure we are in project root
    os.chdir(PROJECT_ROOT)
    success = True
    # Run C tests
    if not verify_c_tests():
        success = False
    # Verify mobile assets
    if not verify_mobile_assets():
        success = False
    # Syntax-check mobile ES modules
    if not verify_mobile_js_syntax():
        success = False
    # Verify ES-module named imports resolve
    if not verify_mobile_js_imports():
        success = False
    if success:
        print("\nAll verification checks passed!")
        sys.exit(0)
    else:
        print("\nSome verification checks failed.")
        sys.exit(1)

if __name__ == "__main__":
    main()
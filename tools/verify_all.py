#!/usr/bin/env python3
"""
Verification script for Ban-Sugoroku project.
Performs the following checks:
1. Runs C core unit tests (cli_test)
2. Runs CLI benchmark (if requested)
3. Validates mobile asset existence and HTML syntax (basic checks)
4. Reports any failures.
"""

import os
import sys
import subprocess
import json
import re
from pathlib import Path

# Project root directory (where verify_all.py lives)
PROJECT_ROOT = Path(__file__).parent.parent
C_BUILD_DIR = PROJECT_ROOT / "build"
CORE_DIR = PROJECT_ROOT / "core"
MOBILE_DIR = PROJECT_ROOT / "mobile"
TOOLS_DIR = PROJECT_ROOT / "tools"

def run_cmd(cmd, cwd=None):
    """Run shell command and return (success, stdout, stderr)."""
    try:
        result = subprocess.run(cmd, shell=True, cwd=cwd, capture_output=True, text=True)
        return result.returncode == 0, result.stdout, result.stderr
    except Exception as e:
        return False, "", str(e)

def verify_c_tests():
    print("=== Verifying C Core Tests ===")
    # Ensure CMake build directory exists and contains cli_test
    if not C_BUILD_DIR.exists():
        print("Build directory not found; attempting to run 'make'...")
        ok, out, err = run_cmd("make", cwd=PROJECT_ROOT)
        if not ok:
            print("Failed to run 'make':", err)
            return False
    # Run CLI test (self-test part)
    cli_test_path = C_BUILD_DIR / "cli_test"
    if not cli_test_path.exists():
        # Fallback: run make test (which builds if needed)
        ok, out, err = run_cmd("make test", cwd=PROJECT_ROOT)
        if not ok:
            print("Make test failed:", err)
            return False
        # After make test, check if cli_test exists
        cli_test_path = C_BUILD_DIR / "cli_test"
        if not cli_test_path.exists():
            print("cli_test not found after make test.")
            return False
    # Run basic self-tests
    ok, out, err = run_cmd(str(cli_test_path), cwd=C_BUILD_DIR)
    if not ok:
        print("Basic C core tests failed:", out, err)
        return False
    print("Basic C core tests passed.")
    # Run benchmark
    ok, out, err = run_cmd(str(cli_test_path) + " --benchmark", cwd=C_BUILD_DIR)
    if not ok:
        print("C core benchmark failed:", out, err)
        return False
    # Parse benchmark results
    import re
    match = re.search(r"Benchmark results: Black wins=(\d+), White wins=(\d+), draws=(\d+)", out)
    if not match:
        print("Benchmark output format unexpected:", out)
        return False
    black_wins = int(match.group(1))
    white_wins = int(match.group(2))
    draws = int(match.group(3))
    print(f"Benchmark: Black wins {black_wins}, White wins {white_wins}, draws {draws}")
    if draws > 0:
        print(f"ERROR: draws > 0 ({draws})")
        return False
    # Optional: check win percentages (at least 10% each)
    total = black_wins + white_wins + draws
    if total > 0:
        if black_wins < total * 0.10 or white_wins < total * 0.10:
            print(f"WARNING: one player win rate below 10% (Black {black_wins/total*100:.1f}%, White {white_wins/total*100:.1f}%)")
    return True

def verify_mobile_assets():
    print("=== Verifying Mobile Assets ===")
    required_files = [
        MOBILE_DIR / "index.html",
        MOBILE_DIR / "app.js",
        MOBILE_DIR / "style.css",
        MOBILE_DIR / "manifest.json"
    ];
    missing = []
    for f in required_files:
        if not f.exists():
            missing.append(f.name)
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
    if success:
        print("\nAll verification checks passed!")
        sys.exit(0)
    else:
        print("\nSome verification checks failed.")
        sys.exit(1)

if __name__ == "__main__":
    main()
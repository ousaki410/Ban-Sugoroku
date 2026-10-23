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
    ok, out, err = run_cmd(str(cli_test_path), cwd=C_BUILD_DIR)
    if ok:
        print("C core tests passed.")
        print(out)
        return True
    else:
        print("C core tests failed.")
        print("stdout:", out)
        print("stderr:", err)
        return False

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
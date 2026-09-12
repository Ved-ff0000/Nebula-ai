#!/usr/bin/env python3
"""NEBULA browser doctor.

Answers one question: *why can't the agent start its browser on this machine, and
what exactly do I run to fix it?*

    python backend/scripts/diagnose.py           # environment check (fast)
    python backend/scripts/diagnose.py --launch  # also performs a real launch test

Exit code 0 = ready, 1 = problem found (the fix command is printed either way).
"""
from __future__ import annotations

import argparse
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

OK, BAD, DIM, BOLD, RESET = "\033[92m", "\033[91m", "\033[2m", "\033[1m", "\033[0m"

CHECK = f"{OK}✓{RESET}"
CROSS = f"{BAD}✗{RESET}"


def line(label: str, value, good: bool | None = None) -> None:
    mark = "" if good is None else f" {CHECK if good else CROSS}"
    print(f"  {label:<26} {value}{mark}")


def main() -> int:
    parser = argparse.ArgumentParser(description="NEBULA browser diagnostics")
    parser.add_argument("--launch", action="store_true",
                        help="also launch Chromium and load a page (definitive check)")
    args = parser.parse_args()

    from app.browser.diagnostics import check_browser_environment, run_launch_test

    print(f"\n{BOLD}NEBULA browser doctor{RESET}")
    diag = check_browser_environment()

    print("\nEnvironment")
    line("platform", diag.platform)
    line("python", diag.python)
    line("playwright package", diag.playwright_version or "not installed", diag.playwright_installed)
    line("chromium downloaded", diag.executable_path or "not found", diag.browser_installed)
    line("headless configured", diag.headless_configured)
    if diag.missing_system_libs:
        line("missing system libs", ", ".join(diag.missing_system_libs), False)
    elif diag.browser_installed:
        line("system libraries", "all resolved", True)

    if args.launch:
        print("\nLaunch test (real Chromium)")
        result = asyncio.run(run_launch_test())
        line("launched", result["launched"], result["launched"])
        line("loaded a page", result["loaded_page"], result["loaded_page"])
        line("duration", f"{result['duration_ms']} ms")
        if result.get("error"):
            line("error type", result["error_type"], False)
            print(f"\n  {BAD}{result['error']}{RESET}")

    print()
    if diag.ok and (not args.launch or result["launched"]):
        print(f"{OK}Browser environment looks good — tasks should run.{RESET}\n")
        return 0

    print(f"{BAD}Problem:{RESET} {diag.problem or 'the browser could not be launched'}")
    if diag.remedy:
        print(f"\n{BOLD}Run this to fix it:{RESET}\n\n    {diag.remedy}\n")
    print(f"{DIM}Notes: on Linux, `--with-deps` installs the shared libraries Chromium needs "
          f"(libnss3, libnspr4, …). On Windows/macOS the plain install is enough. If Chromium is "
          f"present but launch still fails, check sandbox/antivirus restrictions and free disk space, "
          f"and try `--launch` again for the raw driver error.{RESET}\n")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())

#!/usr/bin/env python3
"""Write the current US Eastern time (EST or EDT) to src/version.txt, for example "2026-10-13 13:58 EDT".
The build puts it on the Guide page. Run it before a release build:

    python3 tools/stamp_version.py && python3 build.py

The time lives in a file, so every later build of the same source (also the build on GitHub) makes the
same index.html."""
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

now = datetime.now(ZoneInfo("America/New_York"))
stamp = now.strftime("%Y-%m-%d %H:%M ") + now.tzname()   # tzname() gives EST in winter, EDT in summer
(Path(__file__).resolve().parent.parent / "src" / "version.txt").write_text(stamp + "\n", encoding="utf-8")
print(stamp)

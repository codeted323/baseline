#!/bin/bash
# Run the full test suite in the background. Output: tools/out/t-full.txt; done marker: tools/out/t-full.done
cd "$(dirname "$0")/.."
mkdir -p tools/out
rm -f tools/out/t-full.done
date +%s > tools/out/t-full.start
python3 tests/run.py "$@" > tools/out/t-full.txt 2>&1
echo "exit=$? secs=$(( $(date +%s) - $(cat tools/out/t-full.start) ))" > tools/out/t-full.done

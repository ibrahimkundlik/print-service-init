#!/usr/bin/env bash
# Runs the given command and tees its output (stdout+stderr) into a new
# timestamped file under logs/ for every invocation, while still showing
# everything in the terminal as usual.
set -euo pipefail

mkdir -p logs
log_file="logs/$(date +%Y-%m-%d_%H-%M-%S).log"
echo "Logging to $log_file"

"$@" 2>&1 | tee "$log_file"

#!/usr/bin/env bash
set -euo pipefail
while true; do
  pnpm -s worker:once || true
  sleep 3
done

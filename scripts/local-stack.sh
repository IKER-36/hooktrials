#!/usr/bin/env sh
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
if [ "$#" -eq 0 ]; then
  exec "$ROOT/hooktrials" up
fi
exec "$ROOT/hooktrials" "$@"

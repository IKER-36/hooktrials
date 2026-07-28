#!/usr/bin/env sh
set -eu

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$ROOT"

sh -n ./hooktrials
help=$(./hooktrials help)
printf '%s\n' "$help" | grep -Fq 'update [--release vX.Y.Z]'
printf '%s\n' "$help" | grep -Fq 'backup'
printf '%s\n' "CLI syntax: OK"

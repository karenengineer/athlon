#!/usr/bin/env bash
set -euo pipefail
# A bounded real Linux primitive probe, not a real SSH/production deployment.
if [[ "$(uname -s)" != Linux ]]; then
  printf 'SKIP: native Linux flock probe requires Linux.\n'
  exit 0
fi
for tool in flock timeout; do
  command -v "$tool" >/dev/null || { printf 'FAIL: %s required for native lock probe.\n' "$tool" >&2; exit 1; }
done
scratch="$(mktemp -d)"
cleanup() { exec 9>&-; rm -f -- "$scratch/lock"; rmdir -- "$scratch"; }
trap cleanup EXIT
exec 9>"$scratch/lock"
timeout --kill-after=1 3 flock -w 1 9
result=0
# Close inherited FD9 so the contender must take an independent lock.
timeout --kill-after=1 3 flock -w 1 "$scratch/lock" true 9>&- || result=$?
[[ "$result" == 1 ]] || { printf 'FAIL: native contender did not refuse the held lock within its wait bound.\n' >&2; exit 1; }
flock -u 9
exec 9>&-
timeout --kill-after=1 3 flock -w 1 "$scratch/lock" true
printf 'PASS: native Linux flock excludes contender, expires its wait, and permits acquisition after release.\n'

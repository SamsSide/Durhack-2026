#!/usr/bin/env bash
# Stops the table demo (same as scripts/demo.sh stop, or npm run demo:stop).
exec "$(dirname "${BASH_SOURCE[0]}")/demo.sh" stop "$@"

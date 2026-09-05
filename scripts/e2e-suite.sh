#!/usr/bin/env bash
set -euo pipefail

# scripts/e2e-suite.sh — Phase 2 acceptance E2E suite (Ticket 20)
# Usage: ./scripts/e2e-suite.sh [--reduced]

REDUCED_ARG=""
if [[ "${1:-}" == "--reduced" ]] || [[ "${E2E_REDUCED:-}" == "true" ]]; then
  REDUCED_ARG="--reduced"
fi

if command -v bun >/dev/null 2>&1; then
  bun scripts/run-e2e.ts $REDUCED_ARG
else
  pnpm e2e $REDUCED_ARG
fi

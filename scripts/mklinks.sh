#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

FOLDERS=(
  "."
  "adapters"
  "apps/api"
  "apps/web"
  "apps/worker"
  "core"
  "infra"
  "infra/compose"
  "infra/k8s"
  "infra/terraform"
  "packages/config"
  "packages/db"
  "packages/errors"
  "packages/events"
  "packages/ffmpeg"
  "packages/job-contracts"
  "packages/observability"
  "packages/storage"
  "packages/testing"
  "packages/tsconfig"
  "tools"
)

echo "Creating POSIX symlinks for CLAUDE.md -> AGENTS.md..."

for folder in "${FOLDERS[@]}"; do
  target_dir="$REPO_ROOT/$folder"
  if [ -f "$target_dir/AGENTS.md" ]; then
    (cd "$target_dir" && ln -sf "AGENTS.md" "CLAUDE.md")
    echo "  [OK] $folder/CLAUDE.md -> AGENTS.md"
  fi
done

echo "All CLAUDE.md symlinks successfully established."

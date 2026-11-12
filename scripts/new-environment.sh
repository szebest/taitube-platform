#!/usr/bin/env bash
set -euo pipefail

# Scaffolds infra/environments/<name> from the template. Exit codes: 0 ok, 1 failure, 2 usage.

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TEMPLATE="$ROOT/infra/environments/_template"

usage() {
  cat <<USAGE
scripts/new-environment.sh <name> [--dry-run]    (make new-environment NAME=<name>)

Copies infra/environments/_template to infra/environments/<name> and sets name: <name>. <name> is lower case
letters, digits and dashes, 2 to 31 characters, starting with a letter. Edit the three files it leaves, then
run make deploy-plan ENV=<name>.

Exit codes: 0 ok, 1 failure, 2 usage.
USAGE
}

dry_run=0 name=""
for arg in "$@"; do
  case "$arg" in
    -h | --help) usage; exit 0 ;;
    --dry-run) dry_run=1 ;;
    -*) echo "unknown option $arg" >&2; exit 2 ;;
    *) [ -z "$name" ] || { echo "one name at a time: $name, $arg" >&2; exit 2; }; name="$arg" ;;
  esac
done

[ -n "$name" ] || { usage >&2; exit 2; }
if ! printf '%s' "$name" | grep -Eq '^[a-z][a-z0-9-]{1,30}$'; then
  echo "invalid name '$name': lower case letters, digits and dashes, 2 to 31 characters, starting with a letter" >&2
  exit 2
fi
target="$ROOT/infra/environments/$name"
if [ -e "$target" ]; then
  echo "infra/environments/$name already exists" >&2
  exit 1
fi

if [ "$dry_run" = 1 ]; then
  echo "dry run, nothing is written"
  echo "would copy infra/environments/_template to infra/environments/$name"
  echo "would set name: $name in infra/environments/$name/environment.yaml"
  exit 0
fi

cp -R "$TEMPLATE" "$target"
sed -i.bak "s/^name: example$/name: $name/" "$target/environment.yaml"
rm -f "$target/environment.yaml.bak"
echo "created infra/environments/$name"
echo "next: edit environment.yaml, kustomization.yaml and README.md, then: make deploy-plan ENV=$name"

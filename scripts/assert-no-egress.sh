#!/bin/sh
# Fails when the API or the web container can open a connection to the internet. Takes the compose
# files the stack was started with, the offline override among them.
set -u

files=""
for file in "$@"; do files="$files -f $file"; done

for service in api web; do
  # shellcheck disable=SC2086
  if ! docker compose $files exec -T "$service" true; then
    echo "ERROR: $service is not running, so its egress was not checked."
    exit 1
  fi
  # shellcheck disable=SC2086
  if docker compose $files exec -T "$service" curl -s --connect-timeout 2 http://1.1.1.1 >/dev/null 2>&1; then
    echo "ERROR: $service reached the internet."
    exit 1
  fi
  echo "Verified: $service has zero internet egress."
done

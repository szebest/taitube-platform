#!/usr/bin/env bash
# usage: demo/login.sh <viewer|creator|creator2|moderator|admin>
# Prints (and copies) a console snippet that signs this browser in on every demo app; paste it in DevTools on http://localhost:5173.
cd "$(dirname "$0")/.."
case "$1" in
  viewer) sub=2; role=user;; creator) sub=1; role=creator;; creator2) sub=c2; role=creator;;
  moderator) sub=b; role=moderator;; admin) sub=a; role=admin;; *) echo "persona: viewer|creator|creator2|moderator|admin"; exit 1;;
esac
id=$(printf '00000000-0000-7000-8000-%012x' "0x$sub")
token=$(pnpm -s dev-token mint --sub "$id" --role "$role" --ttl 24h --raw 2>/dev/null | tail -1)
snippet="document.cookie='vp.session=$token; path=/; max-age=86400'; location.reload()"
echo "$snippet" | tee >(pbcopy) >/dev/null; echo "$snippet"; echo "(copied to clipboard)"

#!/bin/sh
# Writes one app's production bundle, its dist, production node_modules and the migrations, to a
# directory. The Dockerfiles run it inside the image build; CI runs it on the runner against the
# build it already has, and hands the directory to the image as its `bundle` context.
set -eu

app=$1
out=$2

pnpm deploy --legacy --filter="@vp/$app" --prod "$out"
cp -r packages/server/db/drizzle "$out/drizzle"
mkdir -p "$out/node_modules/@vp/db"
cp -r packages/server/db/drizzle "$out/node_modules/@vp/db/drizzle"

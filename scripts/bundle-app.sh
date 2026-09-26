#!/bin/sh
# Writes one app's image contents to a directory. The Dockerfile runs it inside the image build; CI runs
# it on the runner against the build it already has, and hands the directory to the image as its
# `<app>-bundle` context.
#   api, worker: the esbuild bundle in dist/, and the npm packages it leaves external, hoisted so the
#                bundle resolves them. Workspace packages are inside the bundle, so their copies go.
#   web:         the client assets and the SSR server bundled with every dependency, so the image
#                needs only srvx, which serves them through the `start` script.
set -eu

app=$1
out=$2

case $app in
  web)
    mkdir -p "$out/dist" "$out/node_modules/.bin"
    cp apps/web/package.json "$out/package.json"
    cp -r apps/web/dist/client "$out/dist/client"
    pnpm exec tsx scripts/bundle-entrypoints.ts --inline-npm "$out/dist/server" apps/web/dist/server/server.js
    cp -RL apps/web/node_modules/srvx "$out/node_modules/srvx"
    ln -s ../srvx/bin/srvx.mjs "$out/node_modules/.bin/srvx"
    ;;
  *)
    pnpm deploy --legacy --filter="@vp/$app" --prod --config.node-linker=hoisted "$out"
    find "$out" -mindepth 1 -maxdepth 1 ! -name node_modules ! -name package.json -exec rm -rf {} +
    rm -rf "$out/node_modules/@vp"
    cp -r "apps/$app/dist/bundle" "$out/dist"
    ;;
esac

if [ "$app" = api ]; then
  cp -r packages/server/db/drizzle "$out/drizzle"
fi

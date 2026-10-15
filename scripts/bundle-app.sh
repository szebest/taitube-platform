#!/bin/sh
# Writes one app's image contents to a directory. The Dockerfile runs it inside the image build; CI runs
# it on the runner against the build it already has, and hands the directory to the image as its
# `<app>-bundle` context.
#   api, worker: the esbuild bundle in dist/, and the npm packages it leaves external, every one linked
#                at the top of node_modules so the bundle resolves it. Workspace packages are inside the
#                bundle, so their copies go.
#   web, studio: Vite's client assets and SSR server, which already holds every npm dependency, so
#                the image needs only srvx, which serves them through the `start` script. Every server
#                module is imported once here, so one that cannot link or load fails the build, not the
#                container.
set -eu

app=$1
out=$2

case $app in
  web | studio)
    mkdir -p "$out/node_modules/.bin"
    cp "apps/client/$app/package.json" "$out/package.json"
    cp -r "apps/client/$app/dist" "$out/dist"
    pnpm exec tsx scripts/import-bundle.ts "$out/dist/server"
    cp -RL "apps/client/$app/node_modules/srvx" "$out/node_modules/srvx"
    ln -s ../srvx/bin/srvx.mjs "$out/node_modules/.bin/srvx"
    ;;
  *)
    pnpm deploy --legacy --filter="@vp/$app" --prod --config.public-hoist-pattern='*' "$out"
    find "$out" -mindepth 1 -maxdepth 1 ! -name node_modules ! -name package.json -exec rm -rf {} +
    rm -rf "$out/node_modules/@vp" "$out"/node_modules/.pnpm/@vp+*
    cp -r "apps/server/$app/dist/bundle" "$out/dist"
    ;;
esac

if [ "$app" = api ]; then
  cp -r packages/server/db/drizzle "$out/drizzle"
fi

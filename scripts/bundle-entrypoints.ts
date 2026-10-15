import { rmSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { type BuildOptions, type Plugin, build } from 'esbuild';

const npmStaysExternal: Plugin = {
  name: 'npm-stays-external',
  setup(bundle) {
    bundle.onResolve({ filter: /^[^./]/ }, ({ path }) =>
      path.startsWith('@vp/') ? undefined : { path, external: true }
    );
  },
};

// Declares nothing: the bundled code may bind `createRequire` or `require` itself at the top level.
const REQUIRE_FOR_INLINED_COMMONJS =
  "globalThis.require ??= process.getBuiltinModule('node:module').createRequire(import.meta.url);";

const {
  values: { 'inline-npm': inlineNpm },
  positionals: [outdir, ...entryPoints],
} = parseArgs({
  options: { 'inline-npm': { type: 'boolean', default: false } },
  allowPositionals: true,
});

if (!outdir || entryPoints.length === 0) {
  process.stderr.write('usage: bundle-entrypoints [--inline-npm] <outdir> <entry>...\n');
  process.exit(2);
}

const dependencies: BuildOptions = inlineNpm
  ? { banner: { js: REQUIRE_FOR_INLINED_COMMONJS } }
  : { plugins: [npmStaysExternal] };

rmSync(outdir, { recursive: true, force: true });

await build({
  entryPoints,
  outdir,
  bundle: true,
  splitting: true,
  format: 'esm',
  platform: 'node',
  target: 'node24',
  chunkNames: '[name]-[hash]',
  keepNames: true,
  logLevel: 'error',
  ...dependencies,
});

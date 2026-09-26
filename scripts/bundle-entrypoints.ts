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

const REQUIRE_FOR_INLINED_COMMONJS =
  "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);";

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

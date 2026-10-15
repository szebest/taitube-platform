import { rmSync } from 'node:fs';
import { type Plugin, build } from 'esbuild';

const npmStaysExternal: Plugin = {
  name: 'npm-stays-external',
  setup(bundle) {
    bundle.onResolve({ filter: /^[^./]/ }, ({ path }) =>
      path.startsWith('@vp/') ? undefined : { path, external: true }
    );
  },
};

const [outdir, ...entryPoints] = process.argv.slice(2);

if (!outdir || entryPoints.length === 0) {
  process.stderr.write('usage: bundle-entrypoints <outdir> <entry>...\n');
  process.exit(2);
}

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
  plugins: [npmStaysExternal],
});

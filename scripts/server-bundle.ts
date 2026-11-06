import type { PackUserConfig } from 'vite-plus/pack';

/**
 * The `vp pack` config of a server app: one ESM file per entry in `dist/bundle`, the `@vp/*` packages
 * inlined and every npm dependency left for the image's `node_modules`.
 */
export function serverBundle(entry: string[]): PackUserConfig {
  return {
    entry,
    outDir: 'dist/bundle',
    format: 'esm',
    platform: 'node',
    target: 'node24',
    outExtensions: () => ({ js: '.js' }),
    hash: true,
    dts: false,
    deps: { neverBundle: true, alwaysBundle: [/^@vp\//] },
    outputOptions: { keepNames: true, chunkFileNames: '[name]-[hash].js' },
    logLevel: 'error',
  };
}

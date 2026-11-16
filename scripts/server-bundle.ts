import type { PackUserConfig } from 'vite-plus/pack';
import { load, type Pkg } from './workspace-packages';

/**
 * The `vp pack` config of a server app: one ESM file per entry in `dist/bundle`, every workspace package
 * inlined and every npm dependency left for the image's `node_modules`.
 */
export function serverBundle(entry: string[], packages: Pkg[] = load()): PackUserConfig {
  const names = packages.map(({ name }) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

  return {
    entry,
    outDir: 'dist/bundle',
    format: 'esm',
    platform: 'node',
    target: 'node24',
    outExtensions: () => ({ js: '.js' }),
    hash: true,
    dts: false,
    deps: { neverBundle: true, alwaysBundle: [new RegExp(`^(${names.join('|')})(/|$)`)] },
    outputOptions: { keepNames: true, chunkFileNames: '[name]-[hash].js' },
    logLevel: 'error',
  };
}

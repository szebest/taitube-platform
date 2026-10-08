import type { Plugin } from 'vite';

export interface BundledChunk {
  fileName: string;
  isEntry: boolean;
  moduleIds: readonly string[];
}

const DEV_ONLY = [
  /\/node_modules\/(@tanstack\/(?:react-router-devtools|react-query-devtools|router-devtools-core|query-devtools))\//,
  /\/(src\/features\/design-system)\//,
];
const ROUTE_SPLIT = /\/(src\/routes\/[^?]+)\?tsr-split=/;

function routesIn(chunk: BundledChunk): string[] {
  const routes = chunk.moduleIds.flatMap((id) => ROUTE_SPLIT.exec(id)?.[1] ?? []);
  return [...new Set(routes)].sort();
}

function chunkViolations(chunk: BundledChunk): string[] {
  const devOnly = chunk.moduleIds.flatMap((id) =>
    DEV_ONLY.flatMap((pattern) => pattern.exec(id)?.[1] ?? [])
  );
  const routes = routesIn(chunk);
  return [
    ...[...new Set(devOnly)].map(
      (name) => `${chunk.fileName} carries ${name}, which only the dev server may load`
    ),
    ...(chunk.isEntry
      ? routes.map((route) => `${chunk.fileName} is an entry chunk but carries the route ${route}`)
      : []),
    ...(routes.length > 1 ? [`${chunk.fileName} carries two routes: ${routes.join(', ')}`] : []),
  ];
}

/**
 * What a production client bundle must not do: ship devtools or the design-system showcase, or
 * stop splitting per route.
 */
export function bundleViolations(chunks: readonly BundledChunk[]): string[] {
  const violations = chunks.flatMap(chunkViolations);
  const split = chunks.some((chunk) => !chunk.isEntry && routesIn(chunk).length > 0);
  return split ? violations : [...violations, 'no route was split into a chunk of its own'];
}

export function bundleGuard(): Plugin {
  return {
    name: 'vp-web:bundle-guard',
    apply: 'build',
    applyToEnvironment: (environment) => environment.name === 'client',
    generateBundle(_options, bundle) {
      const chunks = Object.values(bundle).flatMap((output) =>
        output.type === 'chunk'
          ? [{ fileName: output.fileName, isEntry: output.isEntry, moduleIds: output.moduleIds }]
          : []
      );
      const violations = bundleViolations(chunks);
      if (violations.length > 0) this.error(violations.join('\n'));
    },
  };
}

import type { Plugin } from 'vite';

export interface BundledChunk {
  fileName: string;
  isEntry: boolean;
  moduleIds: readonly string[];
  code: string;
}

const DEVTOOLS =
  /\/node_modules\/(@tanstack\/(?:react-router-devtools|react-query-devtools|router-devtools-core|query-devtools))\//;
const ROUTE_SPLIT = /\/(src\/routes\/[^?]+)\?tsr-split=/;

function routesIn(chunk: BundledChunk): string[] {
  const routes = chunk.moduleIds.flatMap((id) => ROUTE_SPLIT.exec(id)?.[1] ?? []);
  return [...new Set(routes)].sort();
}

function chunkViolations(chunk: BundledChunk): string[] {
  const devtools = chunk.moduleIds.flatMap((id) => DEVTOOLS.exec(id)?.[1] ?? []);
  const routes = routesIn(chunk);
  return [
    ...[...new Set(devtools)].map(
      (name) => `${chunk.fileName} carries ${name}, which only the dev server may load`
    ),
    ...(chunk.isEntry
      ? routes.map((route) => `${chunk.fileName} is an entry chunk but carries the route ${route}`)
      : []),
    ...(routes.length > 1 ? [`${chunk.fileName} carries two routes: ${routes.join(', ')}`] : []),
    ...(chunk.code.includes('process.env')
      ? [`${chunk.fileName} reads process.env, which only the SSR server has`]
      : []),
  ];
}

/**
 * What a production client bundle must not do: ship devtools, stop splitting per route, or read the
 * server's environment (`SSR_API_BASE_URL` is read behind `import.meta.env.SSR`, which the build drops).
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
          ? [
              {
                fileName: output.fileName,
                isEntry: output.isEntry,
                moduleIds: output.moduleIds,
                code: output.code,
              },
            ]
          : []
      );
      const violations = bundleViolations(chunks);
      if (violations.length > 0) this.error(violations.join('\n'));
    },
  };
}

export interface RouteIndex {
  has(route: string): boolean;
}

const METHODS = new Set(['get', 'post', 'put', 'patch', 'delete']);

function normalize(route: string): string {
  return route.replace(/\{[^}]*\}|:[A-Za-z]+/g, '{}');
}

/** The operations the committed OpenAPI document lists, as `METHOD /path/{}`; a reader for one YAML shape, not a YAML parser. */
export function parseContractRoutes(document: string): RouteIndex {
  const routes = new Set<string>();
  let path: string | null = null;
  let inPaths = false;

  for (const line of document.split('\n')) {
    if (/^\S/.test(line)) inPaths = line.startsWith('paths:');
    if (!inPaths) continue;
    const pathMatch = /^ {2}(\/\S*):\s*$/.exec(line);
    if (pathMatch) {
      path = pathMatch[1] ?? null;
      continue;
    }
    const methodMatch = /^ {4}([a-z]+):\s*$/.exec(line);
    if (path && methodMatch && METHODS.has(methodMatch[1] ?? '')) {
      routes.add(normalize(`${(methodMatch[1] ?? '').toUpperCase()} ${path}`));
    }
  }

  return { has: (route) => routes.has(normalize(route)) };
}

/** Every route is present: the contract could not be read, and a route that is really missing answers 404 at run time. */
export const ALL_ROUTES: RouteIndex = { has: () => true };

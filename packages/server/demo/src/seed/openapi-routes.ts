import { tryCatch } from '@vp/result';
import { load } from 'js-yaml';
import { z } from 'zod';

export interface RouteIndex {
  has(route: string): boolean;
}

const METHODS = ['get', 'post', 'put', 'patch', 'delete'];

const ContractSchema = z.object({ paths: z.record(z.string(), z.record(z.string(), z.unknown())) });

function normalize(route: string): string {
  return route.replace(/\{[^}]*\}|:[A-Za-z]+/g, '{}');
}

/** The operations the committed OpenAPI document lists, as `METHOD /path/{}`. */
export function parseContractRoutes(document: string): RouteIndex {
  const loaded = tryCatch(
    () => load(document),
    () => undefined
  );
  const contract = ContractSchema.safeParse(loaded.ok ? loaded.value : undefined);
  const routes = contract.success
    ? Object.entries(contract.data.paths).flatMap(([path, operations]) =>
        Object.keys(operations)
          .filter((method) => METHODS.includes(method))
          .map((method) => normalize(`${method.toUpperCase()} ${path}`))
      )
    : [];

  return { has: (route) => routes.includes(normalize(route)) };
}

/** Every route is present: the contract could not be read, and a route that is really missing answers 404 at run time. */
export const ALL_ROUTES: RouteIndex = { has: () => true };

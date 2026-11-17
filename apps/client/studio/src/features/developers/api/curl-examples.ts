import { contracts, type EndpointContract, isEndpoint } from '@vp/api-contracts';
import { API_SCOPES, type ApiScope } from '@vp/domain';
import { z } from 'zod';

type JsonSchema = z.core.JSONSchema.JSONSchema;

export interface CurlExample {
  scope: ApiScope;
  endpoint: EndpointContract;
  command: string;
}

const ENDPOINTS = Object.values(contracts)
  .flatMap((group) => Object.values(group).filter(isEndpoint))
  .toSorted((a, b) => a.path.localeCompare(b.path));

const hasParams = ({ path }: EndpointContract) => path.includes('/:');

/** A read that needs nothing filled in first, so the example runs as pasted wherever it can. */
function representative(scope: ApiScope): EndpointContract | undefined {
  const reachable = ENDPOINTS.filter((endpoint) => endpoint.scope === scope);
  return (
    reachable.find((endpoint) => endpoint.method === 'GET' && !hasParams(endpoint)) ??
    reachable.find((endpoint) => !hasParams(endpoint)) ??
    reachable[0]
  );
}

/** The smallest value the schema accepts: its required fields only, each enum at its first member. */
function sampleOf(schema: JsonSchema | boolean | undefined): unknown {
  if (typeof schema !== 'object') return null;
  if (schema.enum?.[0] !== undefined) return schema.enum[0];
  if (schema.const !== undefined) return schema.const;
  switch (schema.type) {
    case 'object':
      return Object.fromEntries(
        (schema.required ?? []).map((key) => [key, sampleOf(schema.properties?.[key])])
      );
    case 'array':
      return Array.isArray(schema.items) ? [] : [sampleOf(schema.items)];
    case 'string':
      return '';
    case 'number':
    case 'integer':
      return 0;
    case 'boolean':
      return false;
    default:
      return null;
  }
}

const inputSample = (schema: z.ZodType) => sampleOf(z.toJSONSchema(schema, { io: 'input' }));

function requiredQuery(query: z.ZodType | undefined): [string, string][] {
  const sample = query ? inputSample(query) : null;
  if (typeof sample !== 'object' || sample === null) return [];
  return Object.entries(sample).map(([key, value]) => [key, String(value)]);
}

function urlOf({ path, query }: EndpointContract, baseUrl: string): string {
  const filled = path.replace(/:(\w+)/g, '<$1>');
  const search = new URLSearchParams(requiredQuery(query));
  return `${baseUrl}${filled}${search.size > 0 ? `?${search}` : ''}`;
}

function commandOf(endpoint: EndpointContract, baseUrl: string): string {
  const lines = [
    `curl${endpoint.method === 'GET' ? '' : ` -X ${endpoint.method}`} "${urlOf(endpoint, baseUrl)}"`,
    '  -H "Authorization: Bearer $TAITUBE_TOKEN"',
  ];
  if (endpoint.body) lines.push(`  --json '${JSON.stringify(inputSample(endpoint.body))}'`);
  return lines.join(' \\\n');
}

/** One ready-to-run `curl` per scope, read off the contracts, against the API at `baseUrl`. */
export function curlExamples(baseUrl: string): CurlExample[] {
  return API_SCOPES.flatMap((scope) => {
    const endpoint = representative(scope);
    return endpoint ? [{ scope, endpoint, command: commandOf(endpoint, baseUrl) }] : [];
  });
}

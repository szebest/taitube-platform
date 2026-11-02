import { contracts, type EndpointContract } from '@vp/api-contracts';

const isEndpoint = (value: unknown): value is EndpointContract =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as Partial<EndpointContract>).method === 'string' &&
  typeof (value as Partial<EndpointContract>).path === 'string';

const pathPattern = (path: string): RegExp =>
  new RegExp(`^${path.replace(/:[A-Za-z]+/g, '[^/]+')}$`);

/** The name of the contract a request calls, so an unanswered one says which `mockEndpoint` it needs. */
export function endpointFor(method: string, url: string): string | undefined {
  const { pathname } = new URL(url);
  return Object.values(contracts)
    .flatMap((group) => Object.entries(group))
    .find(
      ([, value]) =>
        isEndpoint(value) && value.method === method && pathPattern(value.path).test(pathname)
    )?.[0];
}

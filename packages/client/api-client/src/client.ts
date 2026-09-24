import {
  type ContractBody,
  type ContractParams,
  type ContractQuery,
  type ContractResult,
  type EndpointContract,
  contracts,
  isEndpoint,
} from '@vp/api-contracts';
import type { z } from 'zod';
import { type ApiClientOptions, type RequestOptions, sendRequest } from './request';

type ContractGroups = typeof contracts;

type EndpointNames<G> = {
  [K in keyof G]: G[K] extends EndpointContract ? K : never;
}[keyof G];

type CallArgs<T extends EndpointContract> = (T['params'] extends z.ZodTypeAny
  ? { params: ContractParams<T> }
  : { params?: never }) &
  (T['query'] extends z.ZodTypeAny ? { query?: ContractQuery<T> } : { query?: never }) &
  (T['body'] extends z.ZodTypeAny ? { body: ContractBody<T> } : { body?: never }) & {
    signal?: AbortSignal;
    headers?: Record<string, string>;
  };

type Call<T extends EndpointContract> = Record<string, never> extends CallArgs<T>
  ? (args?: CallArgs<T>) => Promise<ContractResult<T>>
  : (args: CallArgs<T>) => Promise<ContractResult<T>>;

export type ApiClient = {
  [G in keyof ContractGroups]: {
    [E in EndpointNames<ContractGroups[G]>]: ContractGroups[G][E] extends EndpointContract
      ? Call<ContractGroups[G][E]>
      : never;
  };
};

/**
 * Builds one typed fetcher per `@vp/api-contracts` entry. Nothing is generated
 * ahead of time: the shape of the client *is* the contract registry, so an
 * endpoint cannot exist here without existing there.
 */
export function createApiClient(options: ApiClientOptions): ApiClient {
  const groups = Object.entries(contracts).map(([group, endpoints]) => {
    const callers = Object.entries(endpoints)
      .filter(([, contract]) => isEndpoint(contract))
      .map(([name, contract]) => [
        name,
        (args: RequestOptions = {}) => sendRequest(options, contract as EndpointContract, args),
      ]);

    return [group, Object.fromEntries(callers)];
  });

  return Object.fromEntries(groups) as ApiClient;
}

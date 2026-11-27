import { environmentManager } from '@tanstack/react-query';
import { createQueryClient } from '../create-query-client';
import { createRetryPolicy } from '../retry-policy';

const policy = createRetryPolicy({ classify: () => 'transient' });

function pinServer(isServer: boolean): void {
  const original = environmentManager.isServer();
  environmentManager.setIsServer(() => isServer);
  onTestFinished(() => environmentManager.setIsServer(() => original));
}

describe('@kit/query: createQueryClient', () => {
  it('builds a new client for every call, so no two requests share a cache', () => {
    expect(createQueryClient(policy)).not.toBe(createQueryClient(policy));
  });

  it('keeps a hydrated query fresh, so the browser does not refetch what the server loaded', () => {
    const client = createQueryClient(policy);
    client.setQueryData(['video', 'v1'], { title: 'Launch day' });

    const query = client.getQueryCache().find({ queryKey: ['video', 'v1'] });
    const staleTime = client.getDefaultOptions().queries?.staleTime;

    expect(staleTime).toBeGreaterThan(0);
    expect(typeof staleTime === 'number' && query?.isStaleByTime(staleTime)).toBe(false);
  });

  it.each([
    { scenario: 'on the server', server: true, retried: false },
    { scenario: 'in the browser', server: false, retried: true },
  ])('retries $retried $scenario', ({ server, retried }) => {
    pinServer(server);
    const retry = createQueryClient(policy).getDefaultOptions().queries?.retry;

    expect(typeof retry === 'function' ? retry(0, new Error('x')) : retry).toBe(retried);
  });

  it('backs off with the policy it was given', () => {
    const retryDelay = createQueryClient(policy).getDefaultOptions().queries?.retryDelay;

    expect(retryDelay).toBe(policy.retryDelay);
  });

  it('never retries a mutation', () => {
    expect(createQueryClient(policy).getDefaultOptions().mutations?.retry).toBe(false);
  });
});

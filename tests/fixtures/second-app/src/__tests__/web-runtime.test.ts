import { createQueryClient, createRetryPolicy, keysetPaging, parseParam, singleFlightRefresh } from '@kit/query';
import { clientAppRequestMiddlewareFor, requestNonce } from '@kit/security-headers';
import { withStaticAssets } from '@kit/security-headers/static-assets';
import { deviceClassOf } from '@kit/web-telemetry';
import { settle } from '@kit/web-testing';
import { z } from 'zod';

describe('quill shop on the web platform packages', () => {
  it('retries what its own error classes call transient, after its own delay', () => {
    const policy = createRetryPolicy({
      classify: (error) => (error === 'SHELF_FULL' ? 'transient' : 'permanent'),
      retryAfterMs: () => 250,
    });

    expect(policy.shouldRetry(0, 'SHELF_FULL')).toBe(true);
    expect(policy.shouldRetry(0, 'BOOK_NOT_FOUND')).toBe(false);
    expect(policy.retryDelay(0, 'SHELF_FULL', () => 0)).toBeGreaterThanOrEqual(250);
    expect(createQueryClient(policy).getDefaultOptions().queries?.retry).toBeDefined();
  });

  it('pages by cursor and reads its route params through its own schema', () => {
    expect(keysetPaging.getNextPageParam({ nextCursor: 'c-2' })).toBe('c-2');
    expect(parseParam(z.coerce.number().int(), '42')).toBe(42);
  });

  it('refreshes a refused session once for every caller that asked', async () => {
    const refresh = vi.fn(async (refused: string) => `${refused}-fresh`);
    const shared = singleFlightRefresh(refresh);

    expect(await Promise.all([shared('old'), shared('old')])).toEqual(['old-fresh', 'old-fresh']);
    expect(refresh).toHaveBeenCalledOnce();
  });

  it('guards its embeddable pages under its own prefix', () => {
    expect(clientAppRequestMiddlewareFor({ embeddablePrefix: '/quill-embed' }).length).toBeGreaterThan(0);
    expect(requestNonce()).toBeUndefined();
  });

  it('serves its own hashed assets in front of the app', async () => {
    const app = vi.fn(async () => new Response('app'));
    const fetch = withStaticAssets({ dir: '/srv/quill/assets', hashedPrefix: '/quill-assets/' }, app);

    expect(await (await fetch(new Request('http://quill.test/'))).text()).toBe('app');
  });

  it.each([
    { facts: { coarsePointer: false, screenShortSide: 1080 }, expected: 'desktop' },
    { facts: { coarsePointer: true, screenShortSide: 390 }, expected: 'mobile' },
  ])('classifies a $expected from the device facts', ({ facts, expected }) => {
    expect(deviceClassOf(facts)).toBe(expected);
  });

  it('settles without pending work', async () => {
    await expect(settle(50)).resolves.toBeUndefined();
  });
});

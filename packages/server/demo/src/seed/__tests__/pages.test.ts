import { err, ok } from '@vp/result';
import { expectErr, expectOk } from '@vp/testing/result';
import { z } from 'zod';
import type { Api } from '../api';
import { collectPages } from '../pages';

const Schema = z.object({ items: z.array(z.number()), nextCursor: z.string().nullable() });

describe('seed/pages: collectPages', () => {
  it('follows the cursor until the list runs out', async () => {
    const pages: Record<string, unknown> = {
      first: { items: [1, 2], nextCursor: 'second' },
      second: { items: [3], nextCursor: null },
    };
    const seen: (string | null)[] = [];
    const api: Api = {
      send: async (request, schema) => {
        const cursor = request.query?.cursor as string | undefined;
        seen.push(cursor ?? null);
        return ok(schema.parse(pages[cursor ?? 'first']));
      },
    };

    const items = expectOk(
      await collectPages(
        api,
        (cursor) => ({ method: 'GET', path: '/v1/x', query: cursor ? { cursor } : undefined }),
        Schema
      )
    );

    expect(items).toEqual([1, 2, 3]);
    expect(seen).toEqual([null, 'second']);
  });

  it('stops at the first failing page', async () => {
    const api: Api = { send: async () => err({ kind: 'timeout', message: 'slow' }) };

    expect(
      expectErr(await collectPages(api, () => ({ method: 'GET', path: '/v1/x' }), Schema))
    ).toEqual({ kind: 'timeout', message: 'slow' });
  });
});

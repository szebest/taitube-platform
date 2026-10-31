import type { InfiniteData, QueryClient, QueryKey } from '@tanstack/react-query';
import type { EndpointContract } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { createQueryClient } from '@vp/queries';
import { createToaster, ToastProvider } from '@vp/ui';
import { apiServer, mockEndpoint, problemReply } from '@vp/web-testing';
import { heldReply, runMutation } from '@vp/web-testing/dom';
import { HttpResponse } from 'msw/http';
import type { PropsWithChildren } from 'react';

import { AppProviders } from '#app/__tests__/providers';

import type { Page } from '#app/features/library/api/paged-list';

function WithToasts({ children }: PropsWithChildren) {
  return (
    <AppProviders>
      <ToastProvider toaster={createToaster()}>{children}</ToastProvider>
    </AppProviders>
  );
}

interface OptimisticList<TRow, TVariables> {
  key: QueryKey;
  contract: EndpointContract;
  /** What the cache holds before the change, one page per entry. */
  pages: TRow[][];
  hook: () => { mutateAsync: (variables: TVariables) => Promise<unknown> };
  variables: TVariables;
  idOf: (row: TRow) => string;
  /** The ids left once the change is in. */
  remaining: string[];
}

/**
 * The two promises of a change to a keyset list: the cached pages show it before the request is
 * answered, and show the list as it was when the request fails.
 */
export function itChangesTheListOptimistically<TRow, TVariables>({
  key,
  contract,
  pages,
  hook,
  variables,
  idOf,
  remaining,
}: OptimisticList<TRow, TVariables>): void {
  const seeded = (): QueryClient => {
    const client = createQueryClient();
    client.setQueryData<InfiniteData<Page<TRow>>>(key, {
      pages: pages.map((items) => ({ items, nextCursor: null })),
      pageParams: pages.map(() => undefined),
    });
    return client;
  };
  const idsIn = (client: QueryClient) =>
    client
      .getQueryData<InfiniteData<Page<TRow>>>(key)
      ?.pages.flatMap(({ items }) => items.map(idOf));
  const before = pages.flat().map(idOf);

  it('shows the change before the server answers', async () => {
    const held = heldReply(() => new HttpResponse(null, { status: 204 }));
    apiServer.use(mockEndpoint(contract as never, held.answer as never));
    const client = seeded();

    const running = runMutation(client, hook, variables, WithToasts);
    await vi.waitFor(() => expect(idsIn(client)).toEqual(remaining));

    held.release();
    await running;
  });

  it('puts the list back when the server refuses', async () => {
    apiServer.use(
      mockEndpoint(contract as never, (() => problemReply(ErrorCodes.INTERNAL)) as never)
    );
    const client = seeded();

    const settled = await runMutation(client, hook, variables, WithToasts);

    expect(settled.status).toBe('rejected');
    expect(idsIn(client)).toEqual(before);
  });
}

import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';
import type { ApiClient } from '@vp/api-client';
import { type ContractQuery, type ContractResult, listDlq } from '@vp/api-contracts';
import { KEYSET_PAGE_SIZE, keysetPaging } from '@vp/queries';
import { z } from 'zod';

export type DlqEntry = ContractResult<typeof listDlq>['items'][number];
export type DlqStatus = NonNullable<ContractQuery<typeof listDlq>['status']>;

const { status } = listDlq.query.shape;

export const DLQ_STATUS_OPTIONS = status.unwrap().options;

/** The entry's status as the contract's closed set, or absent when the API sent one this build does not know. */
export const knownDlqStatus = ({ status: raw }: DlqEntry) =>
  DLQ_STATUS_OPTIONS.find((option) => option === raw);

/** The queues page's filter, as its URL spells it; a status the contract refuses reads as absent. */
export const DlqSearchSchema = z.object({ status: status.catch(undefined) });

export const adminDlqKeys = {
  all: ['admin', 'dlq'] as const,
  list: (status: DlqStatus | undefined) => [...adminDlqKeys.all, 'list', status] as const,
  parked: () => [...adminDlqKeys.all, 'parked'] as const,
};

/** The dead-letter entries, optionally of one status, keyset-paged. */
export function adminDlqQueryOptions(api: ApiClient, status: DlqStatus | undefined) {
  return infiniteQueryOptions({
    queryKey: adminDlqKeys.list(status),
    queryFn: ({ pageParam }) =>
      api.adminDlq.listDlq({ query: { status, limit: KEYSET_PAGE_SIZE, cursor: pageParam } }),
    ...keysetPaging,
  });
}

/**
 * The endpoint answers pages, not a total, so the parked count is the first page of parked
 * entries: its length, and whether a next page exists.
 */
export function parkedDlqQueryOptions(api: ApiClient) {
  return queryOptions({
    queryKey: adminDlqKeys.parked(),
    queryFn: async () => {
      const { items, nextCursor } = await api.adminDlq.listDlq({
        query: { status: 'PARKED', limit: KEYSET_PAGE_SIZE },
      });
      return { count: items.length, more: Boolean(nextCursor) };
    },
  });
}

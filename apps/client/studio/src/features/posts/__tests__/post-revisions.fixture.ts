import { listPostRevisions, type PostRevisionView, restorePostRevision } from '@vp/api-contracts';
import type { ErrorCode } from '@vp/errors';
import { mockEndpoint, problemReply } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';
import { managedPost } from '#app/components/posts/post-composer/__tests__/managed-post.fixture';

export const REVISION_IDS = [
  '0190c3a0-5e1d-7000-8000-0000000fd003',
  '0190c3a0-5e1d-7000-8000-0000000fd002',
  '0190c3a0-5e1d-7000-8000-0000000fd001',
] as const;

const revision = (index: number, text: string, restoredFromVersion: number | null = null) =>
  ({
    id: REVISION_IDS[3 - index] ?? '',
    version: index,
    payload: { kind: 'text', text },
    authorUserId: index === 1 ? null : '0190c3a0-5e1d-7000-8000-0000000fd0aa',
    restoredFromVersion,
    createdAt: '2026-01-02T00:00:00.000Z',
  }) satisfies PostRevisionView;

export const HISTORY = [
  revision(3, 'Third words'),
  revision(2, 'Second words'),
  revision(1, 'First words'),
];

/** The edit history of a post at version 3, and what it was asked to restore; `failure` refuses a restore. */
export function servePostHistory(failure?: ErrorCode) {
  const restored: { revisionId: string; version: number }[] = [];
  const handlers = [
    mockEndpoint(listPostRevisions, () => HttpResponse.json({ items: HISTORY, nextCursor: null })),
    mockEndpoint(restorePostRevision, async ({ request, params }) => {
      const { version } = (await request.json()) as { version: number };
      restored.push({ revisionId: String(params['revisionId']), version });
      if (failure) return problemReply(failure);
      return HttpResponse.json(managedPost());
    }),
  ];
  return { handlers, restored };
}

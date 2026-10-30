import { deleteCreatorVideo, listCreatorVideos, updateCreatorVideo } from '@vp/api-contracts';
import { apiServer, mockEndpoint, video } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';

import type { CreatorVideo } from '../components/library-video-row';

export interface LibraryPageFixture {
  /** The cursor that asks for this page; `null` for the first. */
  cursor: string | null;
  items: CreatorVideo[];
  next: string | null;
}

interface LibraryRequest {
  sort: string | null;
  cursor: string | null;
}

/** The creator library answering page by page from `pages`; the requests it saw come back for assertions. */
export function serveLibrary(pages: readonly LibraryPageFixture[]) {
  const requests: LibraryRequest[] = [];
  apiServer.use(
    mockEndpoint(listCreatorVideos, ({ request }) => {
      const { searchParams } = new URL(request.url);
      const cursor = searchParams.get('cursor');
      requests.push({ sort: searchParams.get('sort'), cursor });
      const page = pages.find((candidate) => candidate.cursor === cursor);
      return HttpResponse.json({ items: page?.items ?? [], nextCursor: page?.next ?? null });
    })
  );
  return requests;
}

interface ManageRequest {
  method: string;
  id: string;
  body: unknown;
}

/**
 * The creator endpoints a batch fans out to: each delete and visibility PATCH is recorded, and a
 * video in `failing` answers 500 for both.
 */
export function serveManagement(failing: readonly string[] = []) {
  const requests: ManageRequest[] = [];
  const outcome = (id: string, ok: () => Response) =>
    failing.includes(id) ? HttpResponse.json({ status: 500 }, { status: 500 }) : ok();
  apiServer.use(
    mockEndpoint(deleteCreatorVideo, ({ params }) => {
      const id = String(params['id']);
      requests.push({ method: 'DELETE', id, body: null });
      return outcome(id, () =>
        HttpResponse.json({ videoId: id, status: 'DELETED' as const }, { status: 202 })
      );
    }),
    mockEndpoint(updateCreatorVideo, async ({ params, request }) => {
      const id = String(params['id']);
      requests.push({ method: 'PATCH', id, body: await request.json() });
      return outcome(id, () => HttpResponse.json(video({ id })));
    })
  );
  return requests;
}

import { listCreatorVideos } from '@vp/api-contracts';
import { apiServer, mockEndpoint } from '@vp/web-testing';
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

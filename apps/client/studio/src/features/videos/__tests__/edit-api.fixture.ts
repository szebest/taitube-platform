import { getVideo, listCategories, updateCreatorVideo, type Video } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { VIDEO_ID, apiServer, mockEndpoint, problemReply } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';

export const MUSIC = '0190c3a0-5e1d-7000-8000-00000000c001';
export const GAMING = '0190c3a0-5e1d-7000-8000-00000000c002';

const category = (id: string, name: string) => ({
  id,
  name,
  slug: name.toLowerCase(),
  description: null,
  iconUrl: null,
  sortOrder: 0,
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
});

interface EditApi {
  stored: Video;
  conflicts: number;
}

/**
 * The editor's API: the video as `stored` holds it, the active categories, and a PATCH that answers
 * 409 `conflicts` times first; the bodies it received come back for assertions.
 */
export function serveEditor(initial: Video, { conflicts = 0 } = {}) {
  const api: EditApi = { stored: initial, conflicts };
  const edits: Record<string, unknown>[] = [];
  apiServer.use(
    mockEndpoint(getVideo, () => HttpResponse.json(api.stored)),
    mockEndpoint(listCategories, () =>
      HttpResponse.json([category(MUSIC, 'Music'), category(GAMING, 'Gaming')])
    ),
    mockEndpoint(updateCreatorVideo, async ({ request, params }) => {
      const body = (await request.json()) as Record<string, unknown>;
      edits.push(body);
      if (api.conflicts > 0) {
        api.conflicts -= 1;
        return problemReply(ErrorCodes.VERSION_CONFLICT);
      }
      api.stored = { ...api.stored, ...body, id: String(params['id'] ?? VIDEO_ID), version: api.stored.version + 1 } as typeof api.stored;
      return HttpResponse.json(api.stored);
    })
  );
  return { api, edits };
}

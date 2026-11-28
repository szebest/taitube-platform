import {
  cancelChannelPageSchedule,
  type ChannelPageDraftView,
  type ChannelPageRevisionPageView,
  getChannelPageDraft,
  getMyChannel,
  listChannelPageRevisions,
  listChannelPageSchedules,
  listMyPlaylists,
  publishChannelPage,
  restoreChannelPageRevision,
  saveChannelPageDraft,
  scheduleChannelPage,
} from '@vp/api-contracts';
import { type ChannelLayout, standardChannelLayout } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { channel, mockEndpoint, problemReply } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';

export const REVISION_IDS = [
  '0190c3a0-5e1d-7000-8000-0000000fd001',
  '0190c3a0-5e1d-7000-8000-0000000fd002',
] as const;
const PLAYLIST_ID = '0190c3a0-5e1d-7000-8000-0000000fd010';
const SCHEDULE_ID = '0190c3a0-5e1d-7000-8000-0000000fd020';

export interface PageState {
  document: ChannelLayout;
  version: number;
  conflict: boolean;
  revisions: ChannelPageRevisionPageView['items'];
  scheduled: { id: string; publishAt: string }[];
}

const revision = (index: number, version: number) => ({
  id: REVISION_IDS[index] as string,
  version,
  note: null,
  authorUserId: null,
  restoredFromVersion: null,
  createdAt: '2026-03-01T12:00:00.000Z',
});

/** The page API over `initial`, which moves with each write; what it was asked comes back as `requests`. */
export function servePage(initial: Partial<PageState> = {}) {
  const state: PageState = {
    document: standardChannelLayout(),
    version: 0,
    conflict: false,
    revisions: [revision(0, 2), revision(1, 1)],
    scheduled: [],
    ...initial,
  };
  const requests = {
    saved: [] as { document: ChannelLayout; version: number }[],
    published: [] as { version: number }[],
    scheduled: [] as { publishAt: string; source: string }[],
    cancelled: [] as string[],
    restored: [] as string[],
  };
  const view = (): ChannelPageDraftView => ({
    document: state.document,
    version: state.version,
    publishedRevision: state.revisions.length,
    updatedBy: null,
    updatedAt: null,
  });

  const handlers = [
    mockEndpoint(getMyChannel, () => HttpResponse.json(channel({ handle: 'creator' }))),
    mockEndpoint(getChannelPageDraft, () => HttpResponse.json(view())),
    mockEndpoint(saveChannelPageDraft, async ({ request }) => {
      const body = await request.json();
      requests.saved.push(body);
      if (state.conflict) {
        state.conflict = false;
        state.version += 1;
        return problemReply(ErrorCodes.VERSION_CONFLICT);
      }
      state.document = body.document;
      state.version = body.version + 1;
      return HttpResponse.json(view());
    }),
    mockEndpoint(publishChannelPage, async ({ request }) => {
      const body = await request.json();
      requests.published.push(body);
      return HttpResponse.json(revision(0, state.revisions.length + 1));
    }),
    mockEndpoint(listChannelPageRevisions, () =>
      HttpResponse.json({ items: state.revisions, nextCursor: null })
    ),
    mockEndpoint(restoreChannelPageRevision, ({ params }) => {
      requests.restored.push(String(params['id']));
      return HttpResponse.json(revision(0, state.revisions.length + 1));
    }),
    mockEndpoint(listChannelPageSchedules, () =>
      HttpResponse.json({
        items: state.scheduled.map(({ id, publishAt }) => ({
          id,
          publishAt,
          status: 'pending' as const,
          createdAt: '2026-03-01T12:00:00.000Z',
        })),
      })
    ),
    mockEndpoint(scheduleChannelPage, async ({ request }) => {
      const body = await request.json();
      requests.scheduled.push(body);
      state.scheduled = [{ id: SCHEDULE_ID, publishAt: body.publishAt }];
      return HttpResponse.json(
        {
          id: SCHEDULE_ID,
          publishAt: body.publishAt,
          status: 'pending',
          createdAt: body.publishAt,
        },
        { status: 201 }
      );
    }),
    mockEndpoint(cancelChannelPageSchedule, ({ params }) => {
      requests.cancelled.push(String(params['id']));
      state.scheduled = [];
      return HttpResponse.json({
        id: String(params['id']),
        publishAt: '2026-03-01T12:00:00.000Z',
        status: 'cancelled',
        createdAt: '2026-03-01T12:00:00.000Z',
      });
    }),
    mockEndpoint(listMyPlaylists, () =>
      HttpResponse.json({
        items: [
          {
            id: PLAYLIST_ID,
            title: 'Best of',
            visibility: 'public',
            isSystem: false,
            isSmart: false,
            pinnedAt: null,
            videoCount: 3,
            containsVideo: false,
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
      })
    ),
  ];

  return { state, requests, handlers };
}

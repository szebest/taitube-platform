import {
  createVideoCorrection,
  deleteVideoCorrection,
  getChapterSuggestions,
  listVideoCorrections,
  listVideoRevisions,
  replaceVideoChapters,
  restoreVideoRevision,
  type Video,
} from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { VIDEO_ID, apiServer, mockEndpoint, problemReply } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';
import { serveEditor } from './edit-api.fixture';

export const CHAPTERS = [
  { startMs: 0, title: 'Intro' },
  { startMs: 20_000, title: 'Middle' },
  { startMs: 60_000, title: 'End' },
];

const revisionId = (n: number) => `0190c3a0-5e1d-7000-8000-00000000e0${String(n).padStart(2, '0')}`;
const correctionId = (n: number) =>
  `0190c3a0-5e1d-7000-8000-00000000d0${String(n).padStart(2, '0')}`;

const snapshot = (title: string, chapters = CHAPTERS.slice(0, 0)) => ({
  title,
  description: null,
  tags: [],
  categoryId: null,
  visibility: 'public' as const,
  thumbnail: { source: 'poster' as const },
  chapters,
  commentsEnabled: true,
});

interface ToolsOptions {
  suggestions?: { startMs: number; title: string }[];
  conflicts?: number;
}

/**
 * The editor's API plus the video tools: the chapters PUT, the suggestions, a two-version history
 * and the corrections, each answering from state the test can read back.
 */
export function serveVideoTools(
  initial: Video,
  { suggestions = [], conflicts = 0 }: ToolsOptions = {}
) {
  const editor = serveEditor(initial);
  const state = {
    conflicts,
    chapterPuts: [] as unknown[],
    restores: [] as unknown[],
    corrections: [
      {
        id: correctionId(1),
        videoId: VIDEO_ID,
        startMs: 10_000,
        endMs: 15_000,
        text: 'It costs 5 dollars',
        createdAt: '2026-03-01T12:00:00.000Z',
      },
    ],
    created: [] as unknown[],
    removed: [] as string[],
  };

  apiServer.use(
    mockEndpoint(replaceVideoChapters, async ({ request }) => {
      const body = (await request.json()) as { chapters: Video['chapters']; version: number };
      state.chapterPuts.push(body);
      if (state.conflicts > 0) {
        state.conflicts -= 1;
        return problemReply(ErrorCodes.VERSION_CONFLICT);
      }
      editor.api.stored = {
        ...editor.api.stored,
        chapters: body.chapters,
        version: editor.api.stored.version + 1,
      };
      return HttpResponse.json(editor.api.stored);
    }),
    mockEndpoint(getChapterSuggestions, () => HttpResponse.json({ items: suggestions })),
    mockEndpoint(listVideoRevisions, () =>
      HttpResponse.json({
        items: [
          {
            id: revisionId(2),
            version: editor.api.stored.version,
            snapshot: snapshot('Launch day', editor.api.stored.chapters),
            authorUserId: null,
            note: null,
            createdAt: '2026-03-02T12:00:00.000Z',
          },
          {
            id: revisionId(1),
            version: editor.api.stored.version - 1,
            snapshot: snapshot('Before'),
            authorUserId: null,
            note: null,
            createdAt: '2026-03-01T12:00:00.000Z',
          },
        ],
        nextCursor: null,
      })
    ),
    mockEndpoint(restoreVideoRevision, async ({ request, params }) => {
      state.restores.push({ id: params['revisionId'], ...((await request.json()) as object) });
      if (state.conflicts > 0) {
        state.conflicts -= 1;
        return problemReply(ErrorCodes.VERSION_CONFLICT);
      }
      editor.api.stored = {
        ...editor.api.stored,
        title: 'Before',
        version: editor.api.stored.version + 1,
      };
      return HttpResponse.json(editor.api.stored);
    }),
    mockEndpoint(listVideoCorrections, () => HttpResponse.json({ items: state.corrections })),
    mockEndpoint(createVideoCorrection, async ({ request }) => {
      const body = (await request.json()) as { startMs: number; endMs: number; text: string };
      state.created.push(body);
      const created = {
        id: correctionId(2),
        videoId: VIDEO_ID,
        createdAt: '2026-03-03T12:00:00.000Z',
        ...body,
      };
      state.corrections = [...state.corrections, created];
      return HttpResponse.json(created, { status: 201 });
    }),
    mockEndpoint(deleteVideoCorrection, ({ params }) => {
      state.removed.push(String(params['correctionId']));
      state.corrections = state.corrections.filter(({ id }) => id !== params['correctionId']);
      return new HttpResponse(null, { status: 204 });
    })
  );
  return { ...editor, state };
}

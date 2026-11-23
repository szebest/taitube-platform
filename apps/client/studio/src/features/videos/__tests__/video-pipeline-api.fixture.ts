import {
  type ClipSuggestionView,
  type Video,
  type VideoGenerationsView,
  completeVideoReplacement,
  createClip,
  getClipSuggestions,
  listVideoGenerations,
  revertVideoEdits,
  saveVideoEdits,
  startVideoReplacement,
} from '@vp/api-contracts';
import type { VideoEditList } from '@vp/domain';
import { apiServer, clip, mockEndpoint } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';
import { serveEditor } from './edit-api.fixture';

export const UPLOAD_URL = 'http://localhost:9000/raw/replacement';

export function generationsOf(patch: Partial<VideoGenerationsView> = {}): VideoGenerationsView {
  return {
    activeGeneration: 1,
    editBase: { generation: 1, durationMs: 120_000 },
    edit: null,
    items: [],
    ...patch,
  };
}

export const suggestion = (
  startMs: number,
  chapterTitle: string | null = null
): ClipSuggestionView => ({
  startMs,
  endMs: startMs + 30_000,
  lostShare: 0.04,
  chapterTitle,
});

interface PipelineOptions {
  generations?: VideoGenerationsView;
  suggestions?: ClipSuggestionView[];
}

/**
 * The editor's API plus the Edit video tab: the generations and edit list, a replacement's upload and
 * render, saving and reverting an edit, the clip suggestions and the clip a suggestion becomes. What each
 * write received comes back for assertions.
 */
export function servePipeline(
  initial: Video,
  { generations = generationsOf(), suggestions = [] }: PipelineOptions = {}
) {
  const editor = serveEditor(initial);
  const state = {
    generations,
    completed: [] as unknown[],
    saved: [] as unknown[],
    reverted: [] as unknown[],
    clips: [] as unknown[],
  };

  apiServer.use(
    mockEndpoint(listVideoGenerations, () => HttpResponse.json(state.generations)),
    mockEndpoint(getClipSuggestions, () => HttpResponse.json({ items: suggestions })),
    mockEndpoint(startVideoReplacement, () =>
      HttpResponse.json(
        {
          generation: 2,
          uploadUrl: UPLOAD_URL,
          headers: {},
          expiresAt: '2026-03-01T13:00:00.000Z',
        },
        { status: 201 }
      )
    ),
    mockEndpoint(completeVideoReplacement, async ({ request }) => {
      state.completed.push(await request.json());
      return HttpResponse.json({ generation: 2, status: 'rendering' }, { status: 202 });
    }),
    mockEndpoint(saveVideoEdits, async ({ request }) => {
      const body = (await request.json()) as VideoEditList;
      state.saved.push(body);
      return HttpResponse.json(
        {
          ...body,
          baseGeneration: 1,
          generation: 2,
          status: 'rendering',
          updatedAt: '2026-03-01T12:00:00.000Z',
        },
        { status: 202 }
      );
    }),
    mockEndpoint(revertVideoEdits, async ({ request }) => {
      state.reverted.push(await request.json());
      return HttpResponse.json({ generation: 1, version: initial.version + 1 });
    }),
    mockEndpoint(createClip, async ({ request }) => {
      const body = (await request.json()) as { startMs: number; endMs: number; title: string };
      state.clips.push(body);
      return HttpResponse.json(clip(body), { status: 201 });
    })
  );
  return { ...editor, state };
}

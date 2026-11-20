import {
  type ExperimentView,
  type Video,
  applyVideoExperiment,
  createVideoExperiment,
  listVideoExperiments,
  stopVideoExperiment,
} from '@vp/api-contracts';
import { type ErrorCode, ErrorCodes } from '@vp/errors';
import { VIDEO_ID, apiServer, mockEndpoint, problemReply } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';
import { serveEditor } from './edit-api.fixture';

const experimentId = (n: number) =>
  `0190c3a0-5e1d-7000-8000-00000000f1${String(n).padStart(2, '0')}`;

const variantResult = (variantId: 'a' | 'b' | 'c', impressions: number) => ({
  variantId,
  impressions,
  starts: 0,
  watchSeconds: 0,
  watchSecondsPerImpression: null,
  clickThrough: null,
  averageViewSeconds: null,
});

export function experiment(patch: Partial<ExperimentView> = {}): ExperimentView {
  return {
    id: experimentId(1),
    videoId: VIDEO_ID,
    kind: 'title',
    variants: [
      { id: 'a', title: 'Launch day', thumbnail: null },
      { id: 'b', title: 'We launched', thumbnail: null },
    ],
    status: 'running',
    startedAt: '2026-03-01T12:00:00.000Z',
    endedAt: null,
    winnerVariantId: null,
    results: { enoughData: false, variants: [variantResult('a', 420), variantResult('b', 380)] },
    ...patch,
  };
}

interface ExperimentsOptions {
  experiments?: ExperimentView[];
  /** The code the start answers with instead of succeeding. */
  refuseWith?: ErrorCode;
  /** How many applies answer `VERSION_CONFLICT` before one succeeds. */
  conflicts?: number;
}

/**
 * The editor's API plus the Tests tab: the tests of the video, start, stop and apply, each
 * answering from state the test can read back.
 */
export function serveExperiments(
  initial: Video,
  { experiments = [experiment()], refuseWith, conflicts = 0 }: ExperimentsOptions = {}
) {
  const editor = serveEditor(initial);
  const state = {
    experiments,
    conflicts,
    started: [] as unknown[],
    stopped: [] as string[],
    applied: [] as unknown[],
  };
  const end = (id: string, patch: Partial<ExperimentView>) => {
    state.experiments = state.experiments.map((row) =>
      row.id === id ? { ...row, endedAt: '2026-03-04T12:00:00.000Z', ...patch } : row
    );
    return state.experiments.find((row) => row.id === id);
  };

  apiServer.use(
    mockEndpoint(listVideoExperiments, () => HttpResponse.json({ items: state.experiments })),
    mockEndpoint(createVideoExperiment, async ({ request }) => {
      const body = (await request.json()) as { kind: 'title'; variants: { title: string }[] };
      state.started.push(body);
      if (refuseWith) return problemReply(refuseWith);
      const ids = ['a', 'b', 'c'] as const;
      const created = experiment({
        id: experimentId(state.experiments.length + 2),
        variants: body.variants.map(({ title }, index) => ({
          id: ids[index] ?? 'c',
          title,
          thumbnail: null,
        })),
        results: { enoughData: false, variants: [] },
      });
      state.experiments = [created, ...state.experiments];
      return HttpResponse.json(created, { status: 201 });
    }),
    mockEndpoint(stopVideoExperiment, ({ params }) => {
      const id = String(params['experimentId']);
      state.stopped.push(id);
      return HttpResponse.json(end(id, { status: 'stopped' }));
    }),
    mockEndpoint(applyVideoExperiment, async ({ request, params }) => {
      const body = (await request.json()) as { variantId: 'a' | 'b' | 'c'; version: number };
      state.applied.push(body);
      if (state.conflicts > 0) {
        state.conflicts -= 1;
        return problemReply(ErrorCodes.VERSION_CONFLICT);
      }
      const ended = end(String(params['experimentId']), {
        status: 'finished',
        winnerVariantId: body.variantId,
      });
      const winner = ended?.variants.find(({ id }) => id === body.variantId);
      editor.api.stored = {
        ...editor.api.stored,
        title: winner?.title ?? editor.api.stored.title,
        version: editor.api.stored.version + 1,
      };
      return HttpResponse.json(editor.api.stored);
    })
  );
  return { ...editor, state };
}

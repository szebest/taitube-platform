import type { ProcessingStepRecord, VideoEventRecord, VideoScan } from '@vp/core/repositories';
import { newVideoRecord } from '../new-video-record';
import { type VideoScanHistory, selectVideoScan } from '../video-scan-query';

const NOW = Date.parse('2026-11-20T12:00:00.000Z');
const HOUR_MS = 3_600_000;

const video = (id: string, overrides: { generation?: number; updatedAt?: Date } = {}) => ({
  ...newVideoRecord(
    {
      id,
      ownerId: 'owner-1',
      channelId: 'channel-1',
      sourceKey: `raw/${id}.mp4`,
      status: 'PROCESSING',
    },
    new Date(NOW)
  ),
  ...overrides,
});

const step = (videoId: string, name: string): ProcessingStepRecord => ({
  id: `${videoId}-${name}`,
  videoId,
  step: name,
  rendition: '720p',
  status: 'DONE',
  jobId: 'job-1',
  attempt: 1,
  workerId: null,
  lockToken: null,
  heartbeatAt: null,
  startedAt: null,
  errorCode: null,
  errorMessage: null,
  result: null,
});

const event = (videoId: string, type: string, generation: number): VideoEventRecord => ({
  id: 1,
  videoId,
  type,
  payload: { generation },
  createdAt: new Date(NOW),
});

const HISTORY: VideoScanHistory = {
  steps: async (videoId) => (videoId === 'probed' ? [step(videoId, 'probe')] : []),
  events: async (videoId) => (videoId === 'stale' ? [event(videoId, 'video.held', 1)] : []),
};

const VIDEOS = [
  video('probed'),
  video('stale', { generation: 2 }),
  video('idle', { updatedAt: new Date(NOW - 2 * HOUR_MS) }),
];

const scan = async (filter: Partial<VideoScan>) =>
  (await selectVideoScan(VIDEOS, { status: 'PROCESSING', limit: 10, ...filter }, NOW, HISTORY)).map(
    ({ id }) => id
  );

describe('@vp/adapters: selectVideoScan', () => {
  it.each([
    { scenario: 'the status alone', filter: {}, ids: ['probed', 'stale', 'idle'] },
    { scenario: 'another status', filter: { status: 'READY' as const }, ids: [] },
    { scenario: 'the limit', filter: { limit: 2 }, ids: ['probed', 'stale'] },
    {
      scenario: 'an idle clock',
      filter: { idleFor: { since: 'updatedAt' as const, ms: HOUR_MS } },
      ids: ['idle'],
    },
    { scenario: 'a minimum generation', filter: { minGeneration: 2 }, ids: ['stale'] },
    {
      scenario: 'a missing step',
      filter: { without: { type: 'step' as const, step: 'probe' } },
      ids: ['stale', 'idle'],
    },
    {
      scenario: 'a missing event of any generation',
      filter: { without: { type: 'event' as const, event: 'video.held' } },
      ids: ['probed', 'idle'],
    },
    {
      scenario: 'a missing event of the current generation',
      filter: {
        without: { type: 'event' as const, event: 'video.held', forCurrentGeneration: true },
      },
      ids: ['probed', 'stale', 'idle'],
    },
  ])('selects by $scenario', async ({ filter, ids }) => {
    expect(await scan(filter)).toEqual(ids);
  });

  it('answers copies, so a caller cannot change the stored rows', async () => {
    const [first] = await selectVideoScan(VIDEOS, { status: 'PROCESSING', limit: 1 }, NOW, HISTORY);

    expect(first).toEqual(VIDEOS[0]);
    expect(first).not.toBe(VIDEOS[0]);
  });
});

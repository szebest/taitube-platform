import type { Repositories, VideoScan } from '@vp/core/ports';
import { HOUR_MS, VIDEO_IDS, publicVideo } from './fixtures';

const STEP_ID = '00000000-0000-7000-8000-000000000301';
const STEP_LOCK_TOKEN = '00000000-0000-7000-8000-000000000302';
const IDLE_NOW = { since: 'updatedAt', ms: -1 } as const;

function hoursAgo(hours: number): Date {
  return new Date(Date.now() - hours * HOUR_MS);
}

export interface ScanCase {
  scenario: string;
  seed: (repositories: Repositories) => Promise<void>;
  filter: VideoScan;
}

export const SCAN_CASES: ScanCase[] = [
  {
    scenario: 'stale UPLOADING videos, ignoring other statuses',
    seed: async ({ videos }) => {
      await videos.create(publicVideo({ id: VIDEO_IDS.a, status: 'UPLOADING' }));
      await videos.create(publicVideo({ id: VIDEO_IDS.b, status: 'UPLOADED' }));
    },
    filter: { status: 'UPLOADING', idleFor: IDLE_NOW },
  },
  {
    scenario: 'stale PROCESSING videos, ignoring other statuses',
    seed: async ({ videos }) => {
      await videos.create(publicVideo({ id: VIDEO_IDS.a, status: 'PROCESSING' }));
      await videos.create(publicVideo({ id: VIDEO_IDS.b, status: 'READY' }));
    },
    filter: { status: 'PROCESSING', idleFor: IDLE_NOW },
  },
  {
    scenario: 'UPLOADED videos that never got a probe step',
    seed: async ({ videos, steps }) => {
      await videos.create(publicVideo({ id: VIDEO_IDS.a, status: 'UPLOADED' }));
      await videos.create(publicVideo({ id: VIDEO_IDS.b, status: 'UPLOADED' }));
      await steps.claim({
        id: STEP_ID,
        videoId: VIDEO_IDS.b,
        step: 'probe',
        rendition: '-',
        jobId: `${VIDEO_IDS.b}:probe`,
        attempt: 1,
        workerId: 'worker-1',
        lockToken: STEP_LOCK_TOKEN,
      });
    },
    filter: { status: 'UPLOADED', idleFor: IDLE_NOW, without: { step: 'probe' } },
  },
  {
    scenario: 'soft-deleted videos, measured from deletedAt rather than updatedAt',
    seed: async ({ videos }) => {
      await videos.create(
        publicVideo({ id: VIDEO_IDS.a, status: 'DELETED', deletedAt: hoursAgo(2) })
      );
      await videos.create(
        publicVideo({ id: VIDEO_IDS.b, status: 'DELETED', deletedAt: new Date() })
      );
    },
    filter: { status: 'DELETED', idleFor: { since: 'deletedAt', ms: HOUR_MS } },
  },
  {
    scenario: 'READY videos past raw retention that were not expired yet',
    seed: async ({ videos, events }) => {
      await videos.create(publicVideo({ id: VIDEO_IDS.a, readyAt: hoursAgo(2) }));
      await videos.create(publicVideo({ id: VIDEO_IDS.b, readyAt: hoursAgo(2) }));
      await events.create({ videoId: VIDEO_IDS.b, type: 'video.raw_expired' });
    },
    filter: {
      status: 'READY',
      idleFor: { since: 'readyAt', ms: HOUR_MS },
      without: { event: 'video.raw_expired' },
    },
  },
  {
    scenario: 'READY videos whose current generation was never purged',
    seed: async ({ videos, events }) => {
      await videos.create(publicVideo({ id: VIDEO_IDS.a, generation: 2 }));
      await videos.create(publicVideo({ id: VIDEO_IDS.b, generation: 2 }));
      await videos.create(publicVideo({ id: VIDEO_IDS.c, generation: 1 }));
      await events.create({
        videoId: VIDEO_IDS.b,
        type: 'video.generation_purged',
        payload: { generation: 2 },
      });
    },
    filter: {
      status: 'READY',
      minGeneration: 2,
      without: { event: 'video.generation_purged', forCurrentGeneration: true },
    },
  },
];

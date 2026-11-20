import type { Experiment, ShareLink } from '@vp/domain';
import { VIDEO_IDS } from './fixtures';

const BASE = Date.parse('2026-03-01T12:00:00.000Z');

export const ACCESS_DAY = '2026-03-10';
export const ACCESS_NEXT_DAY = '2026-03-11';

const padded = (n: number) => String(n).padStart(2, '0');

export const linkId = (n: number) => `00000000-0000-7000-8000-00000000e1${padded(n)}`;
export const experimentId = (n: number) => `00000000-0000-7000-8000-00000000e2${padded(n)}`;

export function shareLink(n: number, overrides: Partial<ShareLink> = {}): ShareLink {
  return {
    id: linkId(n),
    targetType: 'video',
    targetId: VIDEO_IDS.a,
    token: `token${String(n).padStart(17, '0')}`,
    label: `Link ${n}`,
    expiresAt: null,
    createdBy: null,
    revokedAt: null,
    createdAt: new Date(BASE + n * 1_000),
    ...overrides,
  };
}

export function experiment(n: number, overrides: Partial<Experiment> = {}): Experiment {
  return {
    id: experimentId(n),
    videoId: VIDEO_IDS.a,
    kind: 'title',
    variants: [
      { id: 'a', title: null, thumbnail: null },
      { id: 'b', title: `Variant ${n}`, thumbnail: null },
    ],
    status: 'running',
    startedAt: new Date(BASE + n * 1_000),
    endedAt: null,
    winnerVariantId: null,
    ...overrides,
  };
}

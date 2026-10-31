import {
  getCurrentPick,
  getHome,
  getShorts,
  listRecommendationFeedback,
  putRecommendationFeedback,
  removeRecommendationFeedback,
} from '@vp/api-contracts';
import { channel, mockEndpoint, videoSummary } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';

export const FEEDBACK_ID = '0190c3a0-5e1d-7000-8000-00000000f001';

const NIGHT = '0190c3a0-5e1d-7000-8000-00000000c001';
const TRAM = '0190c3a0-5e1d-7000-8000-00000000c002';
const FOOD = '0190c3a0-5e1d-7000-8000-00000000c003';

export const CHANNELS = {
  lisbon: channel({ id: '0190c3a0-5e1d-7000-8000-00000000d001', displayName: 'Lisbon Films' }),
  porto: channel({ id: '0190c3a0-5e1d-7000-8000-00000000d002', displayName: 'Porto Films' }),
};

const card = (id: string, title: string, owner: keyof typeof CHANNELS) => ({
  ...videoSummary({ id, title, channel: CHANNELS[owner] }),
  reason: { kind: 'trending' as const },
});

export const IDS = { night: NIGHT, tram: TRAM, food: FOOD };

export const HOME = {
  shelves: [
    {
      kind: 'trending' as const,
      items: [
        card(NIGHT, 'Lisbon at night', 'lisbon'),
        card(TRAM, 'Tram ride', 'porto'),
        card(FOOD, 'Street food', 'lisbon'),
      ],
    },
  ],
};

export interface FeedbackCalls {
  put: unknown[];
  removed: string[];
}

/** The home page, and the two writes: a put that answers (or is refused), and an undo. */
export function feedbackApi(
  calls: FeedbackCalls,
  { putFails = false, reasonKind = 'trending' as 'trending' | 'continue' | 'subscription' } = {}
) {
  const home =
    reasonKind === 'trending'
      ? HOME
      : {
          shelves: HOME.shelves.map((shelf) => ({
            ...shelf,
            items: shelf.items.map((item) => ({ ...item, reason: { kind: reasonKind } })),
          })),
        };
  return [
    mockEndpoint(getHome, () => HttpResponse.json(home)),
    mockEndpoint(getCurrentPick, () => new HttpResponse(null, { status: 404 })),
    mockEndpoint(getShorts, () => HttpResponse.json({ items: [], nextCursor: null, total: 0 })),
    mockEndpoint(putRecommendationFeedback, async ({ request }) => {
      calls.put.push(await request.clone().json());
      return putFails
        ? new HttpResponse(null, { status: 500 })
        : HttpResponse.json({
            id: FEEDBACK_ID,
            kind: 'not_interested',
            videoId: NIGHT,
            createdAt: '2026-03-01T12:00:00.000Z',
          });
    }),
    mockEndpoint(removeRecommendationFeedback, ({ params }) => {
      calls.removed.push(String(params.id));
      return new HttpResponse(null, { status: 204 });
    }),
  ];
}

/** The privacy page asks for the hidden list whatever a spec is about; nothing is hidden. */
export const nothingHidden = () =>
  mockEndpoint(listRecommendationFeedback, () =>
    HttpResponse.json({ items: [], nextCursor: null })
  );

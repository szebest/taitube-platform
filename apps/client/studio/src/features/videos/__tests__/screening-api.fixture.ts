import { appealScreening, type CreatorScreeningView, getVideoScreening } from '@vp/api-contracts';
import { VIDEO_ID, apiServer, mockEndpoint } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';

export function creatorScreening(
  overrides: Partial<CreatorScreeningView> = {}
): CreatorScreeningView {
  return {
    videoId: VIDEO_ID,
    status: 'HELD',
    reasons: ['DUPLICATE'],
    decision: null,
    decisionNote: null,
    canAppeal: false,
    appeal: null,
    ...overrides,
  };
}

/** The creator's view of a screening, and an appeal that answers with the video back on hold; the messages sent come back. */
export function serveScreening(initial: CreatorScreeningView) {
  const appeals: unknown[] = [];
  apiServer.use(
    mockEndpoint(getVideoScreening, () => HttpResponse.json(initial)),
    mockEndpoint(appealScreening, async ({ request }) => {
      const body = (await request.json()) as { message: string };
      appeals.push(body);
      return HttpResponse.json(
        creatorScreening({
          status: 'HELD',
          appeal: { message: body.message, createdAt: '2026-10-03T00:00:00.000Z', resolved: false },
        }),
        { status: 201 }
      );
    })
  );
  return { appeals };
}

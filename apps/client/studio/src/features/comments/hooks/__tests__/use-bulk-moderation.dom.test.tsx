import { bulkModerateComments } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { createQueryClient } from '@vp/queries';
import { apiServer, mockEndpoint } from '@vp/web-testing';
import { renderMutation } from '@vp/web-testing/dom';
import { HttpResponse } from 'msw/http';
import { AppProviders } from '#app/__tests__/providers';
import { useBulkModeration } from '../use-bulk-moderation';

const A = '0190c3a0-5e1d-7000-8000-00000000d001';
const B = '0190c3a0-5e1d-7000-8000-00000000d002';

const runWith = async (answer: () => Response) => {
  apiServer.use(mockEndpoint(bulkModerateComments, answer));
  const hook = renderMutation(useBulkModeration, createQueryClient(), AppProviders);
  return hook.current.run([A, B], { action: 'approve' });
};

describe('apps/client/studio: useBulkModeration', () => {
  it.each([
    {
      answer: () =>
        HttpResponse.json({
          results: [
            { id: A, ok: true },
            { id: B, ok: true },
          ],
        }),
      refused: [],
      scenario: 'every id goes through',
    },
    {
      answer: () =>
        HttpResponse.json({
          results: [
            { id: A, ok: true },
            { id: B, ok: false, code: ErrorCodes.FORBIDDEN },
          ],
        }),
      refused: [B],
      scenario: 'one id is refused',
    },
    {
      answer: () => HttpResponse.json({ code: ErrorCodes.INTERNAL }, { status: 500 }),
      refused: [A, B],
      scenario: 'the call fails',
    },
  ])('returns the ids still to deal with when $scenario', async ({ answer, refused }) => {
    expect(await runWith(answer)).toEqual(refused);
  });
});

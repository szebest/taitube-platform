import { revealChannelContact } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { createQueryClient } from '@vp/queries';
import { apiServer, CHANNEL_ID, mockEndpoint, problemReply } from '@vp/web-testing';
import { runMutation } from '@vp/web-testing/dom';
import { HttpResponse } from 'msw/http';
import { AppProviders } from '#app/__tests__/providers';
import { useRevealContact } from '../use-reveal-contact';

const reveal = () =>
  runMutation(createQueryClient(), () => useRevealContact(CHANNEL_ID), undefined, AppProviders);

describe('apps/client/web: useRevealContact', () => {
  it('asks for the address of the channel and hands it back', async () => {
    const asked: string[] = [];
    apiServer.use(
      mockEndpoint(revealChannelContact, ({ params }) => {
        asked.push(String(params.id));
        return HttpResponse.json({ email: 'hello@example.com' });
      })
    );

    expect(await reveal()).toEqual({ status: 'fulfilled', value: { email: 'hello@example.com' } });
    expect(asked).toEqual([CHANNEL_ID]);
  });

  it('rejects with the code the API answered when the caller is rate limited', async () => {
    apiServer.use(mockEndpoint(revealChannelContact, () => problemReply(ErrorCodes.RATE_LIMITED)));

    expect(await reveal()).toMatchObject({
      status: 'rejected',
      reason: { code: ErrorCodes.RATE_LIMITED },
    });
  });
});

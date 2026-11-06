import { screen, within } from '@testing-library/react';
import { setChannelAutoCaptions } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { SESSION_KEY, type Session } from '@vp/queries';
import { mockEndpoint, problemReply } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';
import { renderCustomization } from '#app/features/channel/__tests__/render-customization';

const toggle = () => screen.getByRole('switch', { name: 'Generate captions for new uploads' });
const save = () =>
  within(screen.getByRole('form', { name: 'Captions' })).getByRole('button', { name: 'Save' });

const defaultInSession = (session: Session | undefined) =>
  session?.status === 'signed-in' && session.account.channel.autoCaptionsDefault;

describe('apps/client/studio: useSetChannelAutoCaptions', () => {
  it('writes the saved default into the session the whole app reads', async () => {
    const { user, queryClient } = await renderCustomization({}, [
      mockEndpoint(setChannelAutoCaptions, async ({ request }) =>
        HttpResponse.json({ enabled: (await request.json()).enabled })
      ),
    ]);

    await user.click(toggle());
    await user.click(save());

    await within(screen.getByRole('form', { name: 'Captions' })).findByText('Saved');
    expect(defaultInSession(queryClient.getQueryData<Session>(SESSION_KEY))).toBe(true);
  });

  it('leaves the session as it was when the API refuses', async () => {
    const { user, queryClient } = await renderCustomization({}, [
      mockEndpoint(setChannelAutoCaptions, () => problemReply(ErrorCodes.CHANNEL_NOT_FOUND)),
    ]);

    await user.click(toggle());
    await user.click(save());

    await screen.findByRole('alert');
    expect(defaultInSession(queryClient.getQueryData<Session>(SESSION_KEY))).toBe(false);
  });
});

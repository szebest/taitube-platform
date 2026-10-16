import { screen, within } from '@testing-library/react';
import { type Account, getMyReaction, getVideo, isSubscribedToChannel } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { CHANNEL_ID, OWNER_ID, VIDEO_ID, account, problemReply, video } from '@vp/web-testing';
import { renderRoute } from '@vp/web-testing/dom';
import { HttpResponse } from 'msw/http';

import { mockEndpoint } from '@vp/web-testing';
import { loaderApi } from '#app/__tests__/loader-api';
import { signInBrowser } from '#app/__tests__/providers';
import { getRouter } from '#app/router';

const SOMEONE_ELSE = '0190c3a0-5e1d-7000-8000-00000000b002';

/** A signed-in persona's account: its user, and the role its token carries. */
function persona(id: string, role: Account['role']): Account {
  const signedIn = account();
  return { ...signedIn, id, role, user: { ...signedIn.user, id } };
}

const PERSONAS: { persona: string; viewer?: Account; admin: boolean; edits: boolean }[] = [
  { persona: 'Guest', viewer: undefined, admin: false, edits: false },
  { persona: 'User', viewer: persona(SOMEONE_ELSE, 'USER'), admin: false, edits: false },
  { persona: 'Creator', viewer: persona(OWNER_ID, 'CREATOR'), admin: false, edits: true },
  { persona: 'Admin', viewer: persona(SOMEONE_ELSE, 'ADMIN'), admin: true, edits: true },
];

/** What the watch page asks the API for a signed-in viewer, beyond its loader. */
const viewerApi = [
  mockEndpoint(getMyReaction, () => HttpResponse.json({ videoId: VIDEO_ID, reaction: null })),
  mockEndpoint(isSubscribedToChannel, () =>
    HttpResponse.json({ channelId: CHANNEL_ID, subscribed: false })
  ),
];

describe('apps/client/web: /watch/$videoId in the browser', () => {
  it('renders the video the loader fetched', async () => {
    await renderRoute(getRouter, `/watch/${VIDEO_ID}`, {
      handlers: [mockEndpoint(getVideo, () => HttpResponse.json(video({ title: 'Launch day' })))],
    });

    expect(await screen.findByRole('heading', { name: 'Launch day' })).toBeInTheDocument();
    expect(document.title).toBe('Launch day');
  });

  it("renders the route's error page when the API fails", async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await renderRoute(getRouter, `/watch/${VIDEO_ID}`, {
      handlers: [mockEndpoint(getVideo, () => problemReply(ErrorCodes.INTERNAL))],
    });

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'There was an error while loading the page'
    );
  });

  it.each(PERSONAS)(
    'shows $persona the admin link: $admin, and the edit and delete actions on a video of the creator: $edits',
    async ({ viewer, admin, edits }) => {
      const { user } = await renderRoute(getRouter, `/watch/${VIDEO_ID}`, {
        handlers: [
          ...(viewer ? [signInBrowser(viewer), ...viewerApi] : []),
          mockEndpoint(getVideo, () => HttpResponse.json(video({ ownerId: OWNER_ID }))),
          ...loaderApi(),
        ],
      });

      await screen.findByRole('heading', { name: 'A video' });
      expect(screen.queryByRole('link', { name: 'Admin' }) !== null).toBe(admin);

      const actions = screen.queryByLabelText('video actions');
      expect(actions !== null).toBe(edits);
      if (!actions) return;
      await user.click(actions);
      const menu = within(document.body);
      expect(menu.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
      expect(menu.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
    }
  );
});

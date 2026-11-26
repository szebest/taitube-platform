import { listMyIdentities } from '@vp/api-contracts';
import { account, identities, mockEndpoint } from '@vp/web-testing';
import { serverRender } from '@vp/web-testing/server';
import { HttpResponse } from 'msw/http';
import { SESSION, accountOf } from '#app/__tests__/providers';
import { getRouter } from '#app/router';

const TEAM = {
  id: '0190c3a0-5e1d-7000-8000-0000000000c7',
  handle: 'othershow',
  displayName: 'Other Show',
  avatarUrl: null,
  role: 'editor' as const,
  ownerId: account().user.id,
};

const openFor = (handle: string) =>
  serverRender(getRouter, `/for/${handle}?next=/videos`, {
    handlers: [
      accountOf(),
      mockEndpoint(listMyIdentities, () => HttpResponse.json(identities({ member: [TEAM] }))),
    ],
    headers: { cookie: SESSION },
  });

describe('apps/client/studio: /for/$handle', () => {
  it.each([
    { handle: 'othershow', lands: '/u/0/c/othershow/videos', why: 'a team the account works on' },
    { handle: account().channel.handle, lands: '/videos', why: "the account's own primary" },
    { handle: 'strangers', lands: '/', why: 'a channel no account here acts as' },
  ])('opens the studio for $why as the identity acting on it', async ({ handle, lands }) => {
    const { status, location } = await openFor(handle);

    expect(status).toBe(307);
    expect(location).toBe(lands);
  });
});

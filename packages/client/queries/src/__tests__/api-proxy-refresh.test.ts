import { HttpResponse } from 'msw/http';
import { api, callProxy, cookieNames, refused } from './api-proxy-fixtures';

describe('@vp/queries: the same-origin API proxy, refreshing a refused token', () => {
  it('refreshes a token the API refused once, and retries the call with the fresh one', async () => {
    const sent = api(refused, () => HttpResponse.json({ id: 'v1' }));
    const refresh = vi.fn(async () => 'fresh');

    const answer = await callProxy('/api/v1/videos', {
      init: { method: 'DELETE', headers: { cookie: 'vp.session.0=other; vp.session.1=stale' } },
      refresh,
      slot: 1,
    });

    expect(sent.map(({ method, headers }) => [method, headers.get('authorization')])).toEqual([
      ['DELETE', 'Bearer stale'],
      ['DELETE', 'Bearer fresh'],
    ]);
    expect(refresh).toHaveBeenCalledExactlyOnceWith('stale');
    expect(answer.status).toBe(200);
    expect(cookieNames(answer)).toEqual(['vp.session.1=fresh']);
  });

  it('clears the one slot the API refused when there is no refresh to be had, marks it expired, and passes the 401 on', async () => {
    const sent = api(refused);
    const accounts = {
      defaultSlot: 1,
      slots: [0, 1].map((slot) => ({
        slot,
        userId: `user-${slot}`,
        label: `Account ${slot}`,
        avatarUrl: null,
        channel: null,
        expired: false,
      })),
    };

    const answer = await callProxy('/api/v1/me/account', {
      init: {
        headers: {
          cookie: `vp.session.0=valid; vp.session.1=stale; vp.accounts=${encodeURIComponent(JSON.stringify(accounts))}`,
        },
      },
      slot: 1,
    });

    expect(sent).toHaveLength(1);
    expect(answer.status).toBe(401);
    expect(answer.headers.getSetCookie()).toHaveLength(2);
    const [cleared, marked] = answer.headers.getSetCookie();
    expect(cleared).toMatch(/^vp\.session\.1=; Max-Age=0;/);
    const written = JSON.parse(
      decodeURIComponent(marked?.split(';')[0]?.slice('vp.accounts='.length) ?? '')
    );
    expect(written.slots.map(({ expired }: { expired: boolean }) => expired)).toEqual([
      false,
      true,
    ]);
  });

  it("passes a guest's 401 on and leaves the cookies alone", async () => {
    api(refused);
    const refresh = vi.fn(async () => 'fresh');

    const answer = await callProxy('/api/v1/me/account', { refresh });

    expect(answer.status).toBe(401);
    expect(answer.headers.getSetCookie()).toEqual([]);
    expect(refresh).not.toHaveBeenCalled();
  });
});

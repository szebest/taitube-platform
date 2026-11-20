import { consumeAddNonce, issueAddNonce } from '../add-account-nonce';
import { inRequest } from './in-request';

describe('@vp/queries: add-account nonce', () => {
  it.each([
    {
      scenario: 'the state it issued',
      cookie: 'vp.add-nonce=n0nce',
      state: 'n0nce',
      accepted: true,
    },
    { scenario: 'another state', cookie: 'vp.add-nonce=n0nce', state: 'forged', accepted: false },
  ])(
    'accepts $scenario once, and spends the nonce either way',
    async ({ cookie, state, accepted }) => {
      const { value, setCookies } = await inRequest(() => consumeAddNonce(state, undefined), {
        cookie,
      });

      expect(value).toBe(accepted);
      expect(setCookies).toEqual([expect.stringMatching(/^vp\.add-nonce=; Max-Age=0;.*HttpOnly/)]);
    }
  );

  it('accepts nothing from a browser that started no add', async () => {
    expect((await inRequest(() => consumeAddNonce('n0nce', undefined))).value).toBe(false);
  });

  it('issues a nonce no script reads, for ten minutes', async () => {
    const { value, setCookies } = await inRequest(() => issueAddNonce('taitube.example'), {
      url: 'https://taitube.example/',
    });

    expect(setCookies).toEqual([
      `vp.add-nonce=${value}; Max-Age=600; Domain=taitube.example; Path=/; HttpOnly; Secure; SameSite=Lax`,
    ]);
  });
});

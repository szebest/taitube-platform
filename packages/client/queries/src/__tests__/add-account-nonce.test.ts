import { consumeAddNonce, issueAddNonce } from '../add-account-nonce';
import { inRequest } from './in-request';

function issue(cookie: string, accountsMax = 10, domain?: string) {
  return inRequest(() => issueAddNonce(domain, accountsMax), {
    cookie,
    url: domain ? `https://${domain}/` : undefined,
  });
}

describe('@vp/queries: add-account nonce', () => {
  it.each([
    { scenario: 'the state it issued for a slot', cookie: 'vp.add-nonce.2=n0nce', reserved: 2 },
    {
      scenario: 'the state it issued with no slot',
      cookie: 'vp.add-nonce=n0nce',
      reserved: undefined,
    },
  ])('spends $scenario once, answering the slot it held', async ({ cookie, reserved }) => {
    const { value, setCookies } = await inRequest(() => consumeAddNonce('n0nce', undefined), {
      cookie: `${cookie}; vp.add-nonce.4=another-tab`,
    });

    expect(value).toEqual({ kind: 'spent', reserved });
    expect(setCookies).toEqual([
      expect.stringMatching(new RegExp(`^${cookie.split('=')[0]}=; Max-Age=0;.*HttpOnly`)),
    ]);
  });

  it.each([
    { scenario: 'a state it did not issue', cookie: 'vp.add-nonce.2=n0nce' },
    { scenario: 'a browser that started no add', cookie: '' },
  ])('accepts nothing from $scenario, and spends nothing', async ({ cookie }) => {
    const { value, setCookies } = await inRequest(() => consumeAddNonce('forged', undefined), {
      cookie,
    });

    expect(value).toEqual({ kind: 'unknown' });
    expect(setCookies).toEqual([]);
  });

  it('issues a nonce no script reads, for ten minutes, holding the first free slot', async () => {
    const { value, setCookies } = await issue('vp.session.0=a', 10, 'taitube.example');

    expect(setCookies).toEqual([
      `vp.add-nonce.1=${value}; Max-Age=600; Domain=taitube.example; Path=/; HttpOnly; Secure; SameSite=Lax`,
    ]);
  });

  it.each([
    {
      scenario: 'a slot another add holds',
      cookie: 'vp.session.0=a; vp.add-nonce.1=x',
      max: 10,
      name: 'vp.add-nonce.2',
    },
    {
      scenario: 'every free slot held by an add',
      cookie: 'vp.session.0=a; vp.add-nonce.1=x',
      max: 2,
      name: 'vp.add-nonce.1',
    },
    {
      scenario: 'every slot signed in',
      cookie: 'vp.session.0=a; vp.session.1=b',
      max: 2,
      name: 'vp.add-nonce',
    },
  ])('skips $scenario', async ({ cookie, max, name }) => {
    const { setCookies } = await issue(cookie, max);

    expect(setCookies.map((set) => set.split('=')[0])).toEqual([name]);
  });
});

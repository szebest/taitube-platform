import { createActingChannelStore } from '../acting-channel';
import { inRequest } from './in-request';

const COOKIE = 'vp.channel';
const CHANNEL = '00000000-0000-7000-8000-0000000000c1';

describe('@vp/queries: acting channel store on the server', () => {
  it.each([
    { cookie: `${COOKIE}=${CHANNEL}`, expected: CHANNEL },
    { cookie: '', expected: undefined },
  ])('starts from the cookie "$cookie" of the request', async ({ cookie, expected }) => {
    const { value } = await inRequest(() => createActingChannelStore().read(), { cookie });

    expect(value).toBe(expected);
  });

  it('holds a channel for the request without writing a cookie the browser would keep', async () => {
    const { value, setCookies } = await inRequest(() => {
      const store = createActingChannelStore();
      store.select(CHANNEL);
      return store.read();
    });

    expect(value).toBe(CHANNEL);
    expect(setCookies).toEqual([]);
  });
});

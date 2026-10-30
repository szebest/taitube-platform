import Fastify from 'fastify';
import { acceptBeaconBodies } from '../beacon-body';

describe('acceptBeaconBodies', () => {
  const build = async () => {
    const app = Fastify();
    acceptBeaconBodies(app);
    app.post('/beacon', async (request) => request.body);
    await app.ready();
    return app;
  };

  it.each(['application/json', 'text/plain;charset=UTF-8'])(
    'parses a JSON body sent as %s',
    async (contentType) => {
      const app = await build();

      const res = await app.inject({
        method: 'POST',
        url: '/beacon',
        payload: '{"seconds":5}',
        headers: { 'content-type': contentType },
      });
      await app.close();

      expect(res.json()).toEqual({ seconds: 5 });
    }
  );

  it('refuses a text body that is not JSON with a 400', async () => {
    const app = await build();

    const res = await app.inject({
      method: 'POST',
      url: '/beacon',
      payload: 'seconds=5',
      headers: { 'content-type': 'text/plain' },
    });
    await app.close();

    expect(res.statusCode).toBe(400);
  });
});

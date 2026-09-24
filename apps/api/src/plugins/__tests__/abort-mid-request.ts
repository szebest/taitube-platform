import { get } from 'node:http';
import type { FastifyInstance } from 'fastify';

function deferred() {
  let resolve = () => {};
  const promise = new Promise<void>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
}

/**
 * Serves `GET /hang` on a real socket and drops the connection while its handler runs. Resolves once
 * the API has run its abort hooks; the handler answers afterwards, into a closed socket.
 */
export async function abortMidRequest(app: FastifyInstance): Promise<void> {
  const handlerRunning = deferred();
  const abortSeen = deferred();
  const release = deferred();
  app.get('/hang', async () => {
    handlerRunning.resolve();
    await release.promise;
    return { late: true };
  });
  app.addHook('onRequestAbort', (_request, done) => {
    abortSeen.resolve();
    done();
  });
  const address = await app.listen({ host: '127.0.0.1', port: 0 });

  const client = get(`${address}/hang`);
  client.on('error', () => {});
  await handlerRunning.promise;
  client.destroy();
  await abortSeen.promise;
  release.resolve();
}

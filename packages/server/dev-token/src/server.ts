import * as http from 'node:http';
import type { AddressInfo } from 'node:net';
import { getDevJwks } from './keys';
import { mintPersonaToken } from './personas';

const JWKS_PATHS: ReadonlySet<string> = new Set(['/.well-known/jwks.json', '/jwks.json']);

function sendJson(
  res: http.ServerResponse,
  body: unknown,
  headers: http.OutgoingHttpHeaders = {}
): void {
  res.writeHead(200, { 'Content-Type': 'application/json', ...headers });
  res.end(JSON.stringify(body));
}

const LOOPBACK = '127.0.0.1';

/** The dev key set, and a dev persona's token at `/token?persona=<name>` for the apps' persona switcher. */
function createDevTokenServer(): http.Server {
  const jwks = getDevJwks();

  return http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');

    if (JWKS_PATHS.has(url.pathname)) {
      return sendJson(res, jwks, { 'Access-Control-Allow-Origin': '*' });
    }

    // No CORS header: a page open in the dev's browser must not read an admin token from here.
    if (url.pathname === '/token') {
      const token = mintPersonaToken(url.searchParams.get('persona') ?? '');
      if (token) return sendJson(res, { token });
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('No such persona\n');
    }

    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('dev-token server: the key set at /.well-known/jwks.json, persona tokens at /token\n');
  });
}

/** Listens on this machine only: anyone who reaches the port can mint an admin token for a dev API. */
export async function serveDevTokens(port: number): Promise<{ server: http.Server; url: string }> {
  const server = createDevTokenServer();
  await new Promise<void>((resolve) => server.listen(port, LOOPBACK, resolve));
  const { address, port: bound } = server.address() as AddressInfo;
  return { server, url: `http://${address}:${bound}` };
}

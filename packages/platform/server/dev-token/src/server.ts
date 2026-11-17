import * as http from 'node:http';
import type { AddressInfo } from 'node:net';
import type { DevTokenConfig } from './config';
import { getDevJwks } from './keys';
import { mintPersonaToken } from './personas';

function sendJson(
  res: http.ServerResponse,
  body: unknown,
  headers: http.OutgoingHttpHeaders = {}
): void {
  res.writeHead(200, { 'Content-Type': 'application/json', ...headers });
  res.end(JSON.stringify(body));
}

const LOOPBACK = '127.0.0.1';

function isAddressInfo(address: string | AddressInfo | null): address is AddressInfo {
  return typeof address === 'object' && address !== null;
}

/** The dev key set, and a dev persona's token at `/token?persona=<name>` for the apps' persona switcher. */
function createDevTokenServer(config: DevTokenConfig): http.Server {
  const jwks = getDevJwks(config);
  const jwksPaths: ReadonlySet<string> = new Set(config.routes.jwks);

  return http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');

    if (jwksPaths.has(url.pathname)) {
      return sendJson(res, jwks, { 'Access-Control-Allow-Origin': '*' });
    }

    // No CORS header: a page open in the dev's browser must not read an admin token from here.
    if (url.pathname === config.routes.token) {
      const token = mintPersonaToken(config, url.searchParams.get('persona') ?? '');
      if (token) return sendJson(res, { token });
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('No such persona\n');
    }

    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end(
      `dev-token server: the key set at ${config.routes.jwks.join(' or ')}, persona tokens at ${config.routes.token}\n`
    );
  });
}

/** Listens on this machine only: anyone who reaches the port can mint an admin token for a dev API. */
export async function serveDevTokens(
  config: DevTokenConfig,
  port: number
): Promise<{ server: http.Server; url: string }> {
  const server = createDevTokenServer(config);
  await new Promise<void>((resolve) => server.listen(port, LOOPBACK, resolve));
  const bound = server.address();
  if (!isAddressInfo(bound)) {
    throw new TypeError('the dev-token server listens on a TCP port');
  }
  const { address, port: boundPort } = bound;
  return { server, url: `http://${address}:${boundPort}` };
}

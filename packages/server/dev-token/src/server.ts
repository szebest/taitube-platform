import * as http from 'node:http';
import { getDevJwks } from './keys';
import { mintPersonaToken } from './personas';

const JWKS_PATHS = new Set(['/.well-known/jwks.json', '/jwks.json']);

function sendJson(res: http.ServerResponse, body: unknown): void {
  res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(body));
}

/** The dev key set, and a dev persona's token at `/token?persona=<name>` for the apps' persona switcher. */
export function createDevTokenServer(): http.Server {
  const jwks = getDevJwks();

  return http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');

    if (JWKS_PATHS.has(url.pathname)) return sendJson(res, jwks);

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

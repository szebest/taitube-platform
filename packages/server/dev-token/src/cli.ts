import * as fs from 'node:fs';
import * as http from 'node:http';
import * as path from 'node:path';
import { parseArgs } from 'node:util';
import type { Logger } from '@vp/logger';
import { mintToken, verifyToken } from './jwt';
import { getDevJwks } from './keys';

function readArgs(argv: readonly string[]) {
  const { positionals, values } = parseArgs({
    args: [...argv],
    allowPositionals: true,
    options: {
      sub: { type: 'string', default: '00000000-0000-7000-8000-000000000001' },
      role: { type: 'string', default: 'user' },
      ttl: { type: 'string', default: '8h' },
      out: { type: 'string' },
      raw: { type: 'boolean', default: false },
      port: { type: 'string', default: '3001' },
    },
  });
  const [command = 'help', token] = positionals;
  return { command, token, flags: values };
}

function printHelp(host: CliHost): void {
  host.print(`
dev-token: EdDSA JWT issuer and JWKS provider for video-pipeline

Usage:
  pnpm dev-token mint [options]     Mint a signed dev JWT (EdDSA)
  pnpm dev-token verify <token>     Verify an EdDSA dev token
  pnpm dev-token jwks [options]     Output JWKS json
  pnpm dev-token serve [options]    Start lightweight HTTP server serving JWKS

Mint Options:
  --sub <uuid>       Subject/user ID (default: 00000000-0000-7000-8000-000000000001)
  --role <role>      User role (default: user, e.g. admin)
  --ttl <duration>   Token time-to-live (default: 8h, e.g. 1h, 30m, 3600s)
  --out <file>       Write JWT to file instead of printing
  --raw              Print only the raw token string (no formatting)

JWKS Options:
  --out <file>       Write JWKS to file (e.g. .well-known/jwks.json)

Serve Options:
  --port <port>      HTTP port (default: 3001)
`);
}

export interface CliHost {
  argv: readonly string[];
  print: (text: string) => void;
  log: Logger;
}

export async function run(host: CliHost): Promise<void> {
  const { command, token, flags } = readArgs(host.argv);

  switch (command) {
    case 'mint': {
      const { sub, role, ttl } = flags;
      const minted = mintToken({ sub, role, ttl });

      if (flags.out) {
        const outPath = path.resolve(process.cwd(), flags.out);
        fs.mkdirSync(path.dirname(outPath), { recursive: true });
        fs.writeFileSync(outPath, minted, 'utf-8');
        host.log.info({ path: outPath }, 'token written');
      } else if (flags.raw) {
        process.stdout.write(minted);
      } else {
        host.print(
          [
            'Minted dev JWT (iss=vp-dev, aud=vp-api)',
            `Subject: ${sub}`,
            `Role:    ${role}`,
            `TTL:     ${ttl}`,
            '',
            `Authorization: Bearer ${minted}`,
          ].join('\n')
        );
      }
      break;
    }

    case 'verify': {
      if (!token) throw new Error('verify needs a token argument');
      const payload = verifyToken(token);
      host.print(JSON.stringify(payload, null, 2));
      break;
    }

    case 'jwks': {
      const jwks = getDevJwks();
      const json = JSON.stringify(jwks, null, 2);

      if (flags.out) {
        const outPath = path.resolve(process.cwd(), flags.out);
        fs.mkdirSync(path.dirname(outPath), { recursive: true });
        fs.writeFileSync(outPath, json, 'utf-8');
        host.log.info({ path: outPath }, 'jwks written');
      } else {
        host.print(json);
      }
      break;
    }

    case 'serve': {
      const port = Number.parseInt(flags.port, 10);
      const jwks = getDevJwks();
      const jwksJson = JSON.stringify(jwks, null, 2);

      const server = http.createServer((req, res) => {
        if (req.url === '/.well-known/jwks.json' || req.url === '/jwks.json') {
          res.writeHead(200, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          });
          res.end(jwksJson);
        } else {
          res.writeHead(200, { 'Content-Type': 'text/plain' });
          res.end('dev-token JWKS server. JWKS available at /.well-known/jwks.json\n');
        }
      });

      server.listen(port, () => {
        host.log.info(
          { url: `http://localhost:${port}/.well-known/jwks.json` },
          'jwks server listening'
        );
      });
      break;
    }

    default:
      printHelp(host);
  }
}

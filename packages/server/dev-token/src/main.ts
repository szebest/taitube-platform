import * as fs from 'node:fs';
import * as http from 'node:http';
import * as path from 'node:path';
import { type Logger, createLogger } from '@vp/logger';
import { mintToken, verifyToken } from './jwt';
import { getDevJwks } from './keys';

function parseArgs(args: string[]) {
  const command = args[0] ?? 'help';
  const rest = args.slice(1);
  const flags: Record<string, string> = {};

  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i];
    if (arg?.startsWith('--')) {
      const key = arg.slice(2);
      const next = rest[i + 1];
      if (next && !next.startsWith('--')) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = 'true';
      }
    }
  }

  return { command, flags };
}

/** What the CLI prints, and where its progress and failures go. */
export interface Cli {
  print: (text: string) => void;
  log: Logger;
}

function printHelp(cli: Cli): void {
  cli.print(`
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

export async function main(args: readonly string[], cli: Cli): Promise<void> {
  const { command, flags } = parseArgs([...args]);

  switch (command) {
    case 'mint': {
      const sub = flags['sub'] ?? '00000000-0000-7000-8000-000000000001';
      const role = flags['role'] ?? 'user';
      const ttl = flags['ttl'] ?? '8h';
      const token = mintToken({ sub, role, ttl });

      if (flags['out']) {
        const outPath = path.resolve(process.cwd(), flags['out']);
        fs.mkdirSync(path.dirname(outPath), { recursive: true });
        fs.writeFileSync(outPath, token, 'utf-8');
        cli.log.info({ path: outPath }, 'token written');
      } else if (flags['raw'] === 'true') {
        process.stdout.write(token);
      } else {
        cli.print(
          [
            'Minted dev JWT (iss=vp-dev, aud=vp-api)',
            `Subject: ${sub}`,
            `Role:    ${role}`,
            `TTL:     ${ttl}`,
            '',
            `Authorization: Bearer ${token}`,
          ].join('\n')
        );
      }
      break;
    }

    case 'verify': {
      const token = args[1];
      if (!token) {
        cli.log.error('verify needs a token argument');
        process.exit(1);
      }
      let verified: ReturnType<typeof verifyToken>;
      try {
        verified = verifyToken(token);
      } catch (err) {
        cli.log.error({ err }, 'token is invalid');
        process.exit(1);
      }
      cli.print(JSON.stringify(verified, null, 2));
      break;
    }

    case 'jwks': {
      const jwks = getDevJwks();
      const json = JSON.stringify(jwks, null, 2);

      if (flags['out']) {
        const outPath = path.resolve(process.cwd(), flags['out']);
        fs.mkdirSync(path.dirname(outPath), { recursive: true });
        fs.writeFileSync(outPath, json, 'utf-8');
        cli.log.info({ path: outPath }, 'jwks written');
      } else {
        cli.print(json);
      }
      break;
    }

    case 'serve': {
      const port = Number.parseInt(flags['port'] ?? '3001', 10);
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
        cli.log.info(
          { url: `http://localhost:${port}/.well-known/jwks.json` },
          'jwks server listening'
        );
      });
      break;
    }

    default:
      printHelp(cli);
  }
}

if (process.env['NODE_ENV'] !== 'test') {
  const cli: Cli = {
    print: (text) => process.stdout.write(`${text}\n`),
    log: createLogger({ service: 'dev-token', level: 'info', format: 'pretty' }),
  };
  main(process.argv.slice(2), cli).catch((err) => {
    cli.log.fatal({ err }, 'dev-token failed');
    process.exit(1);
  });
}

import * as fs from 'node:fs';
import * as http from 'node:http';
import * as path from 'node:path';
import { parseArgs } from 'node:util';
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

function printHelp(): void {
  console.log(`
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
}

export async function run({ argv }: CliHost): Promise<void> {
  const { command, token, flags } = readArgs(argv);

  switch (command) {
    case 'mint': {
      const { sub, role, ttl } = flags;
      const minted = mintToken({ sub, role, ttl });

      if (flags.out) {
        const outPath = path.resolve(process.cwd(), flags.out);
        fs.mkdirSync(path.dirname(outPath), { recursive: true });
        fs.writeFileSync(outPath, minted, 'utf-8');
        console.log(`[dev-token] Minted token written to ${outPath}`);
      } else if (flags.raw) {
        process.stdout.write(minted);
      } else {
        console.log('\n--- MINTED DEV JWT (iss=vp-dev, aud=vp-api) ---');
        console.log(`Subject: ${sub}`);
        console.log(`Role:    ${role}`);
        console.log(`TTL:     ${ttl}`);
        console.log('\nToken:');
        console.log(minted);
        console.log(`\nHeader: Authorization: Bearer ${minted}\n`);
      }
      break;
    }

    case 'verify': {
      if (!token) throw new Error('verify needs a token argument');
      const payload = verifyToken(token);
      console.log('✓ Token valid:');
      console.log(JSON.stringify(payload, null, 2));
      break;
    }

    case 'jwks': {
      const jwks = getDevJwks();
      const json = JSON.stringify(jwks, null, 2);

      if (flags.out) {
        const outPath = path.resolve(process.cwd(), flags.out);
        fs.mkdirSync(path.dirname(outPath), { recursive: true });
        fs.writeFileSync(outPath, json, 'utf-8');
        console.log(`[dev-token] JWKS written to ${outPath}`);
      } else {
        console.log(json);
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
        console.log(
          `[dev-token] JWKS server listening on http://localhost:${port}/.well-known/jwks.json`
        );
      });
      break;
    }

    default:
      printHelp();
  }
}

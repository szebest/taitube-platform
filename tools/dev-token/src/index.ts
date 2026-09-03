import * as fs from 'node:fs';
import * as http from 'node:http';
import * as path from 'node:path';
import { mintToken, verifyToken } from './jwt.js';
import { getDevJwks } from './keys.js';

export * from './jwt.js';
export * from './keys.js';

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

export async function main(): Promise<void> {
  const { command, flags } = parseArgs(process.argv.slice(2));

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
        console.log(`[dev-token] Minted token written to ${outPath}`);
      } else if (flags['raw'] === 'true') {
        process.stdout.write(token);
      } else {
        console.log('\n--- MINTED DEV JWT (iss=vp-dev, aud=vp-api) ---');
        console.log(`Subject: ${sub}`);
        console.log(`Role:    ${role}`);
        console.log(`TTL:     ${ttl}`);
        console.log('\nToken:');
        console.log(token);
        console.log(`\nHeader: Authorization: Bearer ${token}\n`);
      }
      break;
    }

    case 'verify': {
      const token = process.argv[3];
      if (!token) {
        console.error('Error: token argument required for verify');
        process.exit(1);
      }
      try {
        const payload = verifyToken(token);
        console.log('✓ Token valid:');
        console.log(JSON.stringify(payload, null, 2));
      } catch (err) {
        console.error('✗ Token invalid:', err instanceof Error ? err.message : err);
        process.exit(1);
      }
      break;
    }

    case 'jwks': {
      const jwks = getDevJwks();
      const json = JSON.stringify(jwks, null, 2);

      if (flags['out']) {
        const outPath = path.resolve(process.cwd(), flags['out']);
        fs.mkdirSync(path.dirname(outPath), { recursive: true });
        fs.writeFileSync(outPath, json, 'utf-8');
        console.log(`[dev-token] JWKS written to ${outPath}`);
      } else {
        console.log(json);
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

if (process.env['NODE_ENV'] !== 'test') {
  main().catch((err) => {
    console.error('Fatal dev-token error:', err);
    process.exit(1);
  });
}

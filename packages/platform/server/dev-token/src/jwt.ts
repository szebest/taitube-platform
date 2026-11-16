import * as crypto from 'node:crypto';
import { DEV_KEY_ID, getDevKeyPair } from './keys';

export interface MintTokenOptions {
  sub?: string;
  role?: string;
  ttl?: string | number;
  iss?: string;
  aud?: string;
  seed?: string;
}

export interface TokenPayload {
  sub: string;
  role: string;
  iss: string;
  aud: string;
  iat: number;
  exp: number;
}

export interface VerifyTokenOptions {
  iss?: string;
  aud?: string;
  seed?: string;
}

function parseTtlSeconds(ttl: string | number | undefined): number {
  if (typeof ttl === 'number') {
    return ttl;
  }
  if (!ttl) {
    return 8 * 3600;
  }

  const trimmed = ttl.trim().toLowerCase();
  const match = trimmed.match(/^(\d+)([smhd])?$/);
  if (!match) {
    throw new Error(
      `Invalid TTL format: "${ttl}". Expected format like "8h", "30m", "3600s", "1d".`
    );
  }

  const val = Number.parseInt(match[1] ?? '0', 10);
  const unit = match[2];

  switch (unit) {
    case 's':
      return val;
    case 'm':
      return val * 60;
    case 'h':
      return val * 3600;
    case 'd':
      return val * 86400;
    default:
      return val;
  }
}

export function mintToken(options: MintTokenOptions = {}): string {
  const {
    sub = '00000000-0000-7000-8000-000000000001',
    role = 'user',
    ttl = '8h',
    iss = 'vp-dev',
    aud = 'vp-api',
    seed,
  } = options;

  const ttlSeconds = parseTtlSeconds(ttl);
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + ttlSeconds;

  const header = {
    alg: 'EdDSA',
    typ: 'JWT',
    kid: DEV_KEY_ID,
  };

  const payload: TokenPayload = {
    sub,
    role,
    iss,
    aud,
    iat,
    exp,
  };

  const encHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const data = `${encHeader}.${encPayload}`;

  const { privateKey } = getDevKeyPair(seed);
  const sig = crypto.sign(null, Buffer.from(data), privateKey).toString('base64url');

  return `${data}.${sig}`;
}

export function verifyToken(token: string, options: VerifyTokenOptions = {}): TokenPayload {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid JWT format: expected 3 dot-separated segments');
  }

  const [encHeader, encPayload, encSig] = parts as [string, string, string];
  const headerJson = Buffer.from(encHeader, 'base64url').toString('utf-8');
  const header = JSON.parse(headerJson) as { alg?: string; typ?: string; kid?: string };

  if (header.alg !== 'EdDSA') {
    throw new Error(`Unsupported JWT algorithm: expected EdDSA, got "${header.alg}"`);
  }

  const { publicKey } = getDevKeyPair(options.seed);
  const data = `${encHeader}.${encPayload}`;
  const sigBytes = Buffer.from(encSig, 'base64url');

  const isValid = crypto.verify(null, Buffer.from(data), publicKey, sigBytes);
  if (!isValid) {
    throw new Error('JWT signature verification failed');
  }

  const payloadJson = Buffer.from(encPayload, 'base64url').toString('utf-8');
  const payload = JSON.parse(payloadJson) as TokenPayload;

  const expectedIss = options.iss ?? 'vp-dev';
  if (payload.iss !== expectedIss) {
    throw new Error(`Invalid token issuer: expected "${expectedIss}", got "${payload.iss}"`);
  }

  const expectedAud = options.aud ?? 'vp-api';
  if (payload.aud !== expectedAud) {
    throw new Error(`Invalid token audience: expected "${expectedAud}", got "${payload.aud}"`);
  }

  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp <= now) {
    throw new Error(`Token has expired (exp=${payload.exp}, now=${now})`);
  }

  return payload;
}

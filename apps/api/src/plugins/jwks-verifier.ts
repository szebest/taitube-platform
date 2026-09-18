import * as crypto from 'node:crypto';
import { verifyDevToken } from '@vp/dev-token';
import { ErrorCodes, PermanentError } from '@vp/errors';

export interface DecodedTokenPayload {
  sub: string;
  email?: string;
  role?: string;
  iss?: string;
  aud?: string;
  exp?: number;
  nbf?: number;
  [key: string]: unknown;
}

export interface JwksKey {
  kty: string;
  alg?: string;
  use?: string;
  kid?: string;
  [key: string]: unknown;
}

export interface JwksResponse {
  keys: JwksKey[];
}

interface CacheEntry {
  jwks: JwksResponse;
  expiresAt: number;
}

let jwksCache: CacheEntry | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export function setCachedJwks(jwks: JwksResponse, ttlMs = CACHE_TTL_MS): void {
  jwksCache = { jwks, expiresAt: Date.now() + ttlMs };
}

export function clearJwksCache(): void {
  jwksCache = null;
}

async function fetchJwks(jwksUrl: string): Promise<JwksResponse> {
  if (jwksCache && Date.now() < jwksCache.expiresAt) {
    return jwksCache.jwks;
  }
  const response = await fetch(jwksUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch JWKS from ${jwksUrl}: HTTP ${response.status}`);
  }
  const jwks = (await response.json()) as JwksResponse;
  jwksCache = { jwks, expiresAt: Date.now() + CACHE_TTL_MS };
  return jwks;
}

function getHashAlgorithm(alg?: string): string | null {
  switch (alg) {
    case 'RS256':
      return 'RSA-SHA256';
    case 'RS384':
      return 'RSA-SHA384';
    case 'RS512':
      return 'RSA-SHA512';
    case 'ES256':
      return 'SHA256';
    case 'ES384':
      return 'SHA384';
    case 'ES512':
      return 'SHA512';
    case 'EdDSA':
      return null;
    default:
      return 'RSA-SHA256';
  }
}

export async function verifyUniversalToken(
  token: string,
  jwksUrl?: string
): Promise<DecodedTokenPayload> {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new PermanentError(
      ErrorCodes.UNAUTHORIZED,
      'Invalid JWT format: expected 3 dot-separated segments'
    );
  }

  const [part0, part1, part2] = parts as [string, string, string];

  let header: { alg?: string; kid?: string; typ?: string };
  try {
    const headerJson = Buffer.from(part0, 'base64url').toString('utf-8');
    header = JSON.parse(headerJson);
  } catch {
    throw new PermanentError(ErrorCodes.UNAUTHORIZED, 'Invalid JWT header format');
  }

  // 1. Dev token check (EdDSA local issuer)
  if (header.alg === 'EdDSA') {
    try {
      const payload = verifyDevToken(token);
      const emailVal = (payload as unknown as Record<string, unknown>).email;
      return {
        sub: payload.sub,
        email: typeof emailVal === 'string' ? emailVal : undefined,
        role: payload.role || 'user',
        iss: payload.iss,
        aud: payload.aud,
        exp: payload.exp,
      };
    } catch (devErr) {
      // If dev token verification failed and no custom jwksUrl was provided, fail
      if (!jwksUrl) {
        throw new PermanentError(
          ErrorCodes.UNAUTHORIZED,
          `Token verification failed: ${(devErr as Error).message}`
        );
      }
    }
  }

  // 2. Universal JWKS verification (Clerk, Supabase, Auth0, Keycloak, etc.)
  const targetJwksUrl =
    jwksUrl || process.env.AUTH_JWKS_URL || 'http://localhost:3000/.well-known/jwks.json';

  let jwks: JwksResponse;
  try {
    jwks = await fetchJwks(targetJwksUrl);
  } catch (err) {
    throw new PermanentError(
      ErrorCodes.UNAUTHORIZED,
      `JWKS retrieval error: ${(err as Error).message}`
    );
  }

  const matchingKey = header.kid
    ? jwks.keys.find((k) => k.kid === header.kid)
    : jwks.keys.find((k) => !k.alg || k.alg === header.alg) || jwks.keys[0];

  if (!matchingKey) {
    throw new PermanentError(
      ErrorCodes.UNAUTHORIZED,
      `No matching JWK found for kid: ${header.kid ?? 'default'}`
    );
  }

  try {
    const pubKey = crypto.createPublicKey({
      key: matchingKey as unknown as crypto.JsonWebKey,
      format: 'jwk',
    });
    const data = Buffer.from(`${part0}.${part1}`);
    const sig = Buffer.from(part2, 'base64url');
    const hashAlg = getHashAlgorithm(header.alg);

    const isValid = crypto.verify(hashAlg, data, pubKey, sig);
    if (!isValid) {
      throw new PermanentError(ErrorCodes.UNAUTHORIZED, 'JWT signature verification failed');
    }
  } catch (err) {
    if (err instanceof PermanentError) throw err;
    throw new PermanentError(
      ErrorCodes.UNAUTHORIZED,
      `Token verification failed: ${(err as Error).message}`
    );
  }

  let payload: DecodedTokenPayload;
  try {
    const payloadJson = Buffer.from(part1, 'base64url').toString('utf-8');
    payload = JSON.parse(payloadJson);
  } catch {
    throw new PermanentError(ErrorCodes.UNAUTHORIZED, 'Invalid JWT payload format');
  }

  const nowSec = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp <= nowSec) {
    throw new PermanentError(
      ErrorCodes.UNAUTHORIZED,
      `Token has expired (exp=${payload.exp}, now=${nowSec})`
    );
  }
  if (payload.nbf && payload.nbf > nowSec) {
    throw new PermanentError(ErrorCodes.UNAUTHORIZED, 'Token is not active yet');
  }

  if (!payload.sub) {
    throw new PermanentError(ErrorCodes.UNAUTHORIZED, 'Token missing required subject (sub) claim');
  }

  return payload;
}

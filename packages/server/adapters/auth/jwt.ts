import * as crypto from 'node:crypto';
import type { AuthFailure, Principal } from '@vp/core/ports';
import { MS_PER_SECOND } from '@vp/domain/time';
import { ErrorCodes } from '@vp/errors';
import { type Result, err, isErr, ok, tryCatch } from '@vp/result';

interface Jwk extends crypto.JsonWebKey {
  kid?: string;
  alg?: string;
  use?: string;
}

export interface Jwks {
  keys: readonly Jwk[];
}

export interface ClaimPolicy {
  issuer: string;
  audience: string;
  algorithms: readonly string[];
  now: () => number;
}

interface Signer {
  kty: string;
  crv?: string;
  digest: string | null;
  dsaEncoding?: 'ieee-p1363';
}

/** JWS carries ECDSA signatures as raw r||s, not the DER node:crypto expects by default. */
const SIGNERS: ReadonlyMap<string, Signer> = new Map([
  ['RS256', { kty: 'RSA', digest: 'sha256' }],
  ['RS384', { kty: 'RSA', digest: 'sha384' }],
  ['RS512', { kty: 'RSA', digest: 'sha512' }],
  ['ES256', { kty: 'EC', crv: 'P-256', digest: 'sha256', dsaEncoding: 'ieee-p1363' }],
  ['ES384', { kty: 'EC', crv: 'P-384', digest: 'sha384', dsaEncoding: 'ieee-p1363' }],
  ['ES512', { kty: 'EC', crv: 'P-521', digest: 'sha512', dsaEncoding: 'ieee-p1363' }],
  ['EdDSA', { kty: 'OKP', digest: null }],
]);

export interface DecodedJwt {
  header: { alg: string; kid: string | undefined };
  claims: Record<string, unknown>;
  signingInput: string;
  signature: Buffer;
}

export function unauthorized(reason: string): AuthFailure {
  return { code: ErrorCodes.UNAUTHORIZED, message: 'Token verification failed', reason };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function decodeSegment(segment: string): Result<Record<string, unknown>, AuthFailure> {
  const parsed = tryCatch(
    () => JSON.parse(Buffer.from(segment, 'base64url').toString('utf8')) as unknown,
    () => unauthorized('a segment is not base64url JSON')
  );
  if (isErr(parsed)) return parsed;
  return isRecord(parsed.value)
    ? ok(parsed.value)
    : err(unauthorized('a segment is not an object'));
}

export function decodeJwt(token: string): Result<DecodedJwt, AuthFailure> {
  const [header, payload, signature, ...rest] = token.split('.');
  if (header === undefined || payload === undefined || signature === undefined || rest.length > 0) {
    return err(unauthorized('expected three dot-separated segments'));
  }

  const decodedHeader = decodeSegment(header);
  if (isErr(decodedHeader)) return decodedHeader;
  const claims = decodeSegment(payload);
  if (isErr(claims)) return claims;

  const { alg, kid } = decodedHeader.value;
  if (typeof alg !== 'string') return err(unauthorized('the header names no alg'));

  return ok({
    header: { alg, kid: typeof kid === 'string' ? kid : undefined },
    claims: claims.value,
    signingInput: `${header}.${payload}`,
    signature: Buffer.from(signature, 'base64url'),
  });
}

/** A kid-less token is only unambiguous against a JWKS holding one key. */
function selectKey(jwks: Jwks, kid: string | undefined): Result<Jwk, AuthFailure> {
  if (kid !== undefined) {
    const key = jwks.keys.find((candidate) => candidate.kid === kid);
    return key ? ok(key) : err(unauthorized(`no key with kid ${kid}`));
  }
  const [only, ...others] = jwks.keys;
  if (only === undefined) return err(unauthorized('the JWKS holds no key'));
  return others.length === 0 ? ok(only) : err(unauthorized('a kid is required'));
}

function verifySignature(
  decoded: DecodedJwt,
  key: Jwk,
  algorithms: readonly string[]
): Result<void, AuthFailure> {
  const { alg } = decoded.header;
  const signer = SIGNERS.get(alg);
  if (!(signer && algorithms.includes(alg))) return err(unauthorized(`alg ${alg} is not accepted`));
  if (key.alg !== undefined && key.alg !== alg) {
    return err(unauthorized(`the key declares ${key.alg}, the token ${alg}`));
  }
  if (key.kty !== signer.kty) return err(unauthorized(`alg ${alg} cannot use a ${key.kty} key`));
  if (signer.crv !== undefined && key.crv !== signer.crv) {
    return err(unauthorized(`alg ${alg} cannot use a ${key.crv} curve`));
  }

  const verified = tryCatch(
    () =>
      crypto.verify(
        signer.digest,
        Buffer.from(decoded.signingInput),
        { key: crypto.createPublicKey({ key, format: 'jwk' }), dsaEncoding: signer.dsaEncoding },
        decoded.signature
      ),
    () => unauthorized('the key cannot verify this signature')
  );
  if (isErr(verified)) return verified;
  return verified.value ? ok() : err(unauthorized('the signature does not match'));
}

function audienceMatches(aud: unknown, audience: string): boolean {
  return Array.isArray(aud) ? aud.includes(audience) : aud === audience;
}

function checkClaims(
  claims: Record<string, unknown>,
  policy: ClaimPolicy
): Result<Principal, AuthFailure> {
  const nowSeconds = Math.floor(policy.now() / MS_PER_SECOND);
  const { sub, iss, aud, exp, nbf, role, email } = claims;

  if (iss !== policy.issuer) return err(unauthorized('the issuer is not trusted'));
  if (!audienceMatches(aud, policy.audience)) return err(unauthorized('the audience is not ours'));
  if (typeof exp !== 'number' || exp <= nowSeconds) return err(unauthorized('the token expired'));
  if (typeof nbf === 'number' && nbf > nowSeconds) return err(unauthorized('not active yet'));
  if (typeof sub !== 'string' || sub === '') return err(unauthorized('the token names no sub'));

  return ok({
    sub,
    role: typeof role === 'string' ? role : undefined,
    email: typeof email === 'string' ? email : undefined,
  });
}

export function verifyJwt(
  decoded: DecodedJwt,
  jwks: Jwks,
  policy: ClaimPolicy
): Result<Principal, AuthFailure> {
  const key = selectKey(jwks, decoded.header.kid);
  if (isErr(key)) return key;

  const signed = verifySignature(decoded, key.value, policy.algorithms);
  if (isErr(signed)) return signed;

  return checkClaims(decoded.claims, policy);
}

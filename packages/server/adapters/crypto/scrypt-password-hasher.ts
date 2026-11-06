import { randomBytes, type ScryptOptions, scrypt, timingSafeEqual } from 'node:crypto';
import type { HashingFailed, PasswordHasherPort } from '@vp/core/ports';
import { ErrorCodes } from '@vp/errors';
import { fromPromise, ok, type Result } from '@vp/result';

export interface ScryptCost {
  readonly N: number;
  readonly r: number;
  readonly p: number;
  readonly keyLength: number;
  readonly saltLength: number;
}

const SCHEME = 'scrypt';
const SEPARATOR = '$';

/** What a stored hash may ask a verifier to spend: a corrupted row cannot demand gigabytes. */
const MAX_COST = { N: 2 ** 20, r: 32, p: 16 } as const;

const hashingFailed =
  (operation: string) =>
  (cause: unknown): HashingFailed => ({
    code: ErrorCodes.INTERNAL,
    message: 'Password hashing failed',
    operation,
    cause,
  });

function derive(
  password: string,
  salt: Buffer,
  keyLength: number,
  { N, r, p }: Pick<ScryptCost, 'N' | 'r' | 'p'>
): Promise<Buffer> {
  const options: ScryptOptions = { N, r, p, maxmem: 256 * N * r };
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keyLength, options, (error, key) =>
      error ? reject(error) : resolve(key)
    );
  });
}

function positiveInteger(text: string | undefined, max: number): number | null {
  const value = Number(text);
  return Number.isInteger(value) && value > 0 && value <= max ? value : null;
}

interface Stored {
  N: number;
  r: number;
  p: number;
  salt: Buffer;
  hash: Buffer;
}

function parse(encoded: string): Stored | null {
  const [scheme, rawN, rawR, rawP, rawSalt, rawHash, ...rest] = encoded.split(SEPARATOR);
  const N = positiveInteger(rawN, MAX_COST.N);
  const r = positiveInteger(rawR, MAX_COST.r);
  const p = positiveInteger(rawP, MAX_COST.p);
  const salt = Buffer.from(rawSalt ?? '', 'base64url');
  const hash = Buffer.from(rawHash ?? '', 'base64url');

  const wellFormed =
    scheme === SCHEME &&
    rest.length === 0 &&
    N !== null &&
    r !== null &&
    p !== null &&
    (N & (N - 1)) === 0 &&
    N > 1 &&
    salt.length > 0 &&
    hash.length > 0;
  return wellFormed ? { N, r, p, salt, hash } : null;
}

/** Hashes carry their own cost, so raising it later still verifies the hashes already stored. */
export class ScryptPasswordHasher implements PasswordHasherPort {
  constructor(private readonly cost: ScryptCost) {}

  async hash(password: string): Promise<Result<string, HashingFailed>> {
    const { N, r, p, keyLength, saltLength } = this.cost;
    return fromPromise(async () => {
      const salt = randomBytes(saltLength);
      const key = await derive(password, salt, keyLength, this.cost);
      return [SCHEME, N, r, p, salt.toString('base64url'), key.toString('base64url')].join(
        SEPARATOR
      );
    }, hashingFailed('hashPassword'));
  }

  async verify(password: string, encoded: string): Promise<Result<boolean, HashingFailed>> {
    const stored = parse(encoded);
    if (stored === null) return ok(false);

    return fromPromise(async () => {
      const key = await derive(password, stored.salt, stored.hash.length, stored);
      return timingSafeEqual(key, stored.hash);
    }, hashingFailed('verifyPassword'));
  }
}

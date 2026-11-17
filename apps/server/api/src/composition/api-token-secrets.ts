import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { ApiTokenSecrets } from '../services/api-token-service';

const hash = (secret: string) => createHash('sha256').update(Buffer.from(secret, 'hex')).digest();

/** The prefix is 4 random bytes and the secret 32, both hex; only the secret's SHA-256 is kept. */
export const nodeApiTokenSecrets: ApiTokenSecrets = {
  mint: () => ({ prefix: randomBytes(4).toString('hex'), secret: randomBytes(32).toString('hex') }),
  hash: (secret) => hash(secret).toString('hex'),
  matches: (secret, secretHash) => {
    const stored = Buffer.from(secretHash, 'hex');
    const presented = hash(secret);
    return stored.length === presented.length && timingSafeEqual(stored, presented);
  },
};

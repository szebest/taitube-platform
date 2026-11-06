import { ErrorCodes } from '@vp/errors';
import { expectErr, expectOk } from '@vp/testing/result';
import { ScryptPasswordHasher, type ScryptCost } from '../scrypt-password-hasher';

const CHEAP: ScryptCost = { N: 16, r: 8, p: 1, keyLength: 32, saltLength: 16 };

const makeHasher = (cost: Partial<ScryptCost> = {}) =>
  new ScryptPasswordHasher({ ...CHEAP, ...cost });

describe('ScryptPasswordHasher', () => {
  it('encodes the cost, a random salt and the key, and verifies only the password it hashed', async () => {
    const hasher = makeHasher();
    const first = expectOk(await hasher.hash('correct horse'));
    const second = expectOk(await hasher.hash('correct horse'));

    expect(first).toMatch(/^scrypt\$16\$8\$1\$[\w-]{22}\$[\w-]{43}$/);
    expect(first).not.toBe(second);
    expect(expectOk(await hasher.verify('correct horse', first))).toBe(true);
    expect(expectOk(await hasher.verify('correct horse', second))).toBe(true);
    expect(expectOk(await hasher.verify('wrong horse', first))).toBe(false);
  });

  it('verifies a hash made at another cost by reading the cost from the hash', async () => {
    const encoded = expectOk(await makeHasher({ N: 32, keyLength: 24 }).hash('old password'));

    expect(expectOk(await makeHasher().verify('old password', encoded))).toBe(true);
  });

  it.each([
    { reading: 'an empty string', encoded: '' },
    { reading: 'another scheme', encoded: 'bcrypt$16$8$1$c2FsdHNhbHQ$aGFzaGhhc2g' },
    { reading: 'too few parts', encoded: 'scrypt$16$8$1$c2FsdHNhbHQ' },
    { reading: 'too many parts', encoded: 'scrypt$16$8$1$c2FsdHNhbHQ$aGFzaGhhc2g$extra' },
    { reading: 'a cost that is no number', encoded: 'scrypt$x$8$1$c2FsdHNhbHQ$aGFzaGhhc2g' },
    { reading: 'a cost that is no power of two', encoded: 'scrypt$15$8$1$c2FsdHNhbHQ$aGFzaGhhc2g' },
    {
      reading: 'a cost past what a verifier will spend',
      encoded: 'scrypt$1073741824$8$1$c2FsdHNhbHQ$aGFzaGhhc2g',
    },
    { reading: 'an empty salt', encoded: 'scrypt$16$8$1$$aGFzaGhhc2g' },
    { reading: 'an empty key', encoded: 'scrypt$16$8$1$c2FsdHNhbHQ$' },
  ])('answers false for $reading', async ({ encoded }) => {
    expect(expectOk(await makeHasher().verify('anything', encoded))).toBe(false);
  });

  it('fails with INTERNAL when scrypt refuses the cost', async () => {
    const failure = expectErr(await makeHasher({ N: 3 }).hash('password'));

    expect(failure).toMatchObject({ code: ErrorCodes.INTERNAL, operation: 'hashPassword' });
  });
});

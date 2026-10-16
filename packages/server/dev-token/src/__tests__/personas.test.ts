import { verifyToken } from '../jwt';
import { mintPersonaToken } from '../personas';

describe('packages/dev-token: personas', () => {
  it.each([
    { persona: 'user', role: 'user' },
    { persona: 'creator', role: 'creator' },
    { persona: 'admin', role: 'admin' },
  ])('mints a $role token for the $persona persona', ({ persona, role }) => {
    const token = mintPersonaToken(persona);

    expect(token && verifyToken(token).role).toBe(role);
  });

  it('gives every persona a user of its own', () => {
    const subjects = ['user', 'creator', 'admin'].map(
      (persona) => verifyToken(mintPersonaToken(persona) ?? '').sub
    );

    expect(new Set(subjects).size).toBe(3);
  });

  it.each(['root', 'guest', 'constructor'])(
    'mints nothing for %s, which is no persona',
    (persona) => {
      expect(mintPersonaToken(persona)).toBeUndefined();
    }
  );
});

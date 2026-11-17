import { verifyToken as verify } from '../jwt';
import { mintPersonaToken as mintPersona } from '../personas';
import { TEST_CONFIG } from './test-config';

const verifyToken = (token: string) => verify(TEST_CONFIG, token);
const mintPersonaToken = (persona: string) => mintPersona(TEST_CONFIG, persona);

describe('packages/dev-token: personas', () => {
  it.each([
    { persona: 'user', role: 'user' },
    { persona: 'creator', role: 'creator' },
    { persona: 'creator2', role: 'creator' },
    { persona: 'moderator', role: 'moderator' },
    { persona: 'admin', role: 'admin' },
  ])('mints a $role token for the $persona persona', ({ persona, role }) => {
    const token = mintPersonaToken(persona);

    expect(token && verifyToken(token).role).toBe(role);
  });

  it('gives every persona a user of its own', () => {
    const personas = ['user', 'creator', 'creator2', 'moderator', 'admin'];
    const subjects = personas.map((persona) => verifyToken(mintPersonaToken(persona) ?? '').sub);

    expect(new Set(subjects).size).toBe(personas.length);
  });

  it.each(['root', 'guest', 'constructor'])(
    'mints nothing for %s, which is no persona',
    (persona) => {
      expect(mintPersonaToken(persona)).toBeUndefined();
    }
  );
});

import { mintToken } from './jwt';

export const DEV_PERSONAS: ReadonlyMap<string, { sub: string; role: string }> = new Map([
  ['user', { sub: '00000000-0000-7000-8000-000000000002', role: 'user' }],
  ['creator', { sub: '00000000-0000-7000-8000-000000000001', role: 'creator' }],
  ['creator2', { sub: '00000000-0000-7000-8000-0000000000c2', role: 'creator' }],
  ['moderator', { sub: '00000000-0000-7000-8000-00000000000b', role: 'moderator' }],
  ['admin', { sub: '00000000-0000-7000-8000-00000000000a', role: 'admin' }],
]);

/** A token for one of the client apps' dev personas, or nothing for a name that is none. */
export function mintPersonaToken(persona: string): string | undefined {
  const claims = DEV_PERSONAS.get(persona);
  return claims && mintToken(claims);
}

import { type Role, VALID_ROLES, parseRole } from '../user';

describe('types/user: parseRole', () => {
  it.each<{ input: unknown }>([
    { input: null },
    { input: undefined },
    { input: '' },
    { input: 'unknown' },
    { input: 42 },
  ])('falls back to GUEST for $input', ({ input }) => {
    expect(parseRole(input)).toBe('GUEST');
  });

  it.each<{ role: Role }>(VALID_ROLES.map((role) => ({ role })))(
    'accepts $role in either case',
    ({ role }) => {
      expect(parseRole(role)).toBe(role);
      expect(parseRole(role.toLowerCase())).toBe(role);
    }
  );
});

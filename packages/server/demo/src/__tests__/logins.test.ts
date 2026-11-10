import {
  PERSONAS,
  SESSION_COOKIE,
  cookieOneLiner,
  curlLine,
  findPersona,
  mintArgs,
  renderLogin,
} from '../logins';

describe('demo: logins', () => {
  it('names the four personas with distinct ids', () => {
    expect(PERSONAS.map((p) => p.name)).toEqual(['viewer', 'creator', 'moderator', 'admin']);
    expect(new Set(PERSONAS.map((p) => p.id)).size).toBe(4);
  });

  it.each([
    { name: 'viewer', sub: '00000000-0000-7000-8000-000000000002', role: 'user' },
    { name: 'creator', sub: '00000000-0000-7000-8000-000000000001', role: 'creator' },
    { name: 'moderator', sub: '00000000-0000-7000-8000-00000000000b', role: 'moderator' },
    { name: 'admin', sub: '00000000-0000-7000-8000-00000000000a', role: 'admin' },
  ])('mints $name as $role', ({ name, sub, role }) => {
    const persona = findPersona(name);
    expect(persona && mintArgs(persona)).toEqual([
      '--silent',
      'dev-token',
      'mint',
      '--raw',
      '--sub',
      sub,
      '--role',
      role,
    ]);
  });

  it('knows no other persona', () => {
    expect(findPersona('root')).toBeUndefined();
  });

  it('renders the token, a curl line and the cookie one-liner', () => {
    const persona = findPersona('admin');
    const text = persona ? renderLogin(persona, 'T0K', 'http://localhost:3000') : '';
    expect(text).toContain(curlLine('T0K', 'http://localhost:3000'));
    expect(text).toContain(cookieOneLiner('T0K'));
    expect(cookieOneLiner('T0K')).toContain(`${SESSION_COOKIE}=T0K`);
  });
});

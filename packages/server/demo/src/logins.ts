/** @internal Exported for its spec. */
export const SESSION_COOKIE = 'vp.session';

export interface Persona {
  readonly name: string;
  readonly id: string;
  readonly role: string;
  readonly about: string;
}

export const PERSONAS: readonly Persona[] = [
  {
    name: 'viewer',
    id: '00000000-0000-7000-8000-000000000002',
    role: 'user',
    about: 'watches, likes and comments',
  },
  {
    name: 'creator',
    id: '00000000-0000-7000-8000-000000000001',
    role: 'creator',
    about: 'owns channels, uploads and edits in Studio',
  },
  {
    name: 'moderator',
    id: '00000000-0000-7000-8000-00000000000b',
    role: 'moderator',
    about: 'works the review and comment queues',
  },
  {
    name: 'admin',
    id: '00000000-0000-7000-8000-00000000000a',
    role: 'admin',
    about: 'everything, Bull Board included',
  },
];

export function findPersona(name: string): Persona | undefined {
  return PERSONAS.find((persona) => persona.name === name);
}

export function mintArgs(persona: Persona): string[] {
  return ['--silent', 'dev-token', 'mint', '--raw', '--sub', persona.id, '--role', persona.role];
}

/** @internal Exported for its spec. */
export function cookieOneLiner(token: string): string {
  return `document.cookie = "${SESSION_COOKIE}=${token}; path=/; max-age=28800"; location.reload()`;
}

/** @internal Exported for its spec. */
export function curlLine(token: string, apiUrl: string): string {
  return `curl -H 'Authorization: Bearer ${token}' ${apiUrl}/v1/videos`;
}

export function renderLogin(persona: Persona, token: string, apiUrl: string): string {
  return [
    `${persona.name} (${persona.role}, ${persona.id}): ${persona.about}`,
    '',
    'Token:',
    token,
    '',
    'API:',
    curlLine(token, apiUrl),
    '',
    'Browser, in DevTools on http://localhost:5173 or :5174 (one cookie, both apps):',
    cookieOneLiner(token),
  ].join('\n');
}

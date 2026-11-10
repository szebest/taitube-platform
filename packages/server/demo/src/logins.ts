import { DEV_PERSONAS } from '@vp/dev-token';

/** @internal Exported for its spec. */
export const SESSION_COOKIE = 'vp.session';

export interface Persona {
  readonly name: string;
  readonly id: string;
  readonly role: string;
  readonly about: string;
}

const DEMO_PERSONAS = [
  { name: 'viewer', devPersona: 'user', about: 'watches, likes and comments' },
  { name: 'creator', devPersona: 'creator', about: 'owns channels, uploads and edits in Studio' },
  { name: 'moderator', devPersona: 'moderator', about: 'works the review and comment queues' },
  { name: 'admin', devPersona: 'admin', about: 'everything, Bull Board included' },
] as const;

function personaOf({ name, devPersona, about }: (typeof DEMO_PERSONAS)[number]): Persona {
  const claims = DEV_PERSONAS.get(devPersona);
  if (!claims) throw new Error(`@vp/dev-token has no "${devPersona}" persona`);
  return { name, id: claims.sub, role: claims.role, about };
}

export const PERSONAS: readonly Persona[] = DEMO_PERSONAS.map(personaOf);

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

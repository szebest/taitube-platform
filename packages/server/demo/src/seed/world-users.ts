import {
  BIO_TEMPLATES,
  CATEGORIES,
  CHANNEL_ADJECTIVES,
  CHANNEL_NOUNS,
  FAN_FIRST_NAMES,
} from './catalog';
import type { Rng } from './rng';
import type { UserKind, UserSpec } from './world-types';

const ID_PREFIX = '00000000-0000-7000-8000-';

interface Persona {
  kind: UserKind;
  id: string;
  email: string;
  role: UserSpec['role'];
  tier: UserSpec['tier'];
  tokenRole: string;
  handle: string;
  displayName: string;
}

/** The ids and token roles are the ones `@vp/dev-token` signs in as. */
const PERSONAS: readonly Persona[] = [
  {
    kind: 'creator',
    id: `${ID_PREFIX}000000000001`,
    email: 'dev@video-pipeline.local',
    role: 'CREATOR',
    tier: 'pro',
    tokenRole: 'creator',
    handle: 'demo-creator',
    displayName: 'Demo Creator',
  },
  {
    kind: 'viewer',
    id: `${ID_PREFIX}000000000002`,
    email: 'other@video-pipeline.local',
    role: 'USER',
    tier: 'free',
    tokenRole: 'user',
    handle: 'demo-viewer',
    displayName: 'Demo Viewer',
  },
  {
    kind: 'admin',
    id: `${ID_PREFIX}00000000000a`,
    email: 'admin@video-pipeline.local',
    role: 'ADMIN',
    tier: 'pro',
    tokenRole: 'admin',
    handle: 'demo-admin',
    displayName: 'Demo Admin',
  },
  {
    kind: 'moderator',
    id: `${ID_PREFIX}00000000000b`,
    email: 'moderator@video-pipeline.local',
    role: 'MODERATOR',
    tier: 'free',
    tokenRole: 'moderator',
    handle: 'demo-moderator',
    displayName: 'Demo Moderator',
  },
];

/** @internal Exported for its spec. */
export function extraUserId(position: number): string {
  return `${ID_PREFIX}${(0x1000 + position).toString(16).padStart(12, '0')}`;
}

function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function brandColor(hue: number): string {
  const channel = (offset: number) =>
    Math.round(128 + 100 * Math.sin((hue / 180) * Math.PI + offset))
      .toString(16)
      .padStart(2, '0');
  return `#${channel(0)}${channel(2.1)}${channel(4.2)}`;
}

function bioFor(rng: Rng, hue: number): string {
  const category = CATEGORIES[Math.floor(hue) % CATEGORIES.length] ?? CATEGORIES[0];
  return rng.pick(BIO_TEMPLATES).replace('{topic}', category.name.toLowerCase());
}

/** Personas first, then extra creators, then fans, up to `userCount` (never fewer than the personas and creators). */
export function buildUsers(rng: Rng, userCount: number, channelCount: number): UserSpec[] {
  const creatorCount = Math.max(channelCount, 1);
  const total = Math.max(userCount, PERSONAS.length + creatorCount - 1);
  const names = rng.shuffle(
    CHANNEL_ADJECTIVES.flatMap((adjective) => CHANNEL_NOUNS.map((noun) => `${adjective} ${noun}`))
  );
  const fans = rng.shuffle(FAN_FIRST_NAMES);
  const taken = new Set(PERSONAS.map((persona) => persona.handle));

  const unique = (base: string): string => {
    let handle = base.slice(0, 26);
    for (let attempt = 2; taken.has(handle); attempt++) handle = `${base.slice(0, 24)}-${attempt}`;
    taken.add(handle);
    return handle;
  };

  const personaSpecs = PERSONAS.map((persona, index): UserSpec => {
    const ownsChannel = persona.kind === 'creator';
    const hue = (index * 83) % 360;
    return {
      ...persona,
      ownsChannel,
      bio: ownsChannel ? bioFor(rng, hue) : null,
      brandColor: brandColor(hue),
      hue,
    };
  });

  const extras = Array.from({ length: total - PERSONAS.length }, (_, position): UserSpec => {
    const isCreator = position < creatorCount - 1;
    const fanName = fans[position % fans.length] ?? 'guest';
    const displayName = isCreator
      ? (names[position] ?? `Channel ${position}`)
      : `${fanName.charAt(0).toUpperCase()}${fanName.slice(1)}`;
    const handle = unique(isCreator ? slug(displayName) : `${fanName}-${position}`);
    const hue = rng.int(0, 359);
    return {
      kind: isCreator ? 'extra-creator' : 'fan',
      id: extraUserId(position + 1),
      email: `${handle}@video-pipeline.local`,
      role: isCreator ? 'CREATOR' : 'USER',
      tier: isCreator ? 'pro' : 'free',
      tokenRole: isCreator ? 'creator' : 'user',
      handle,
      displayName,
      ownsChannel: isCreator,
      bio: isCreator ? bioFor(rng, hue) : null,
      brandColor: brandColor(hue),
      hue,
    };
  });

  return [...personaSpecs, ...extras];
}

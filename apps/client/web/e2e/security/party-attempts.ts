import { ORGANIZER_PERMISSIONS, type PartyRequest, type PartyWorld, STALE } from './party-world';

type Build = (world: PartyWorld) => PartyRequest;

const base = ({ roomId }: PartyWorld) => `/v1/watch-parties/${roomId}`;

export interface PartyRow {
  readonly name: string;
  readonly request: Build;
}

/** Section 15's first table: a signed-in non-member or a plain member is 403, signed out is 401. */
export const PARTY_ROUTE_ROWS: readonly PartyRow[] = [
  {
    name: "edit another owner's room",
    request: (w) => ['PATCH', base(w), { name: 'Hijacked', version: 1 }],
  },
  { name: 'close it', request: (w) => ['POST', `${base(w)}/close`, {}] },
  {
    name: 'assign a role',
    request: (w) => ['PUT', `${base(w)}/members/${w.key.member}/roles/${w.role.vip}`, {}],
  },
  {
    name: 'create a role',
    request: (w) => ['POST', `${base(w)}/roles`, { name: 'Sneaky', permissions: [] }],
  },
  { name: 'kick', request: (w) => ['POST', `${base(w)}/members/${w.key.dj}/kick`, {}] },
  { name: 'ban', request: (w) => ['PUT', `${base(w)}/bans/${w.key.dj}`, {}] },
  {
    name: 'transfer ownership',
    request: (w) => ['POST', `${base(w)}/owner`, { memberKey: w.key.member }],
  },
  { name: 'create an invite link', request: (w) => ['POST', `${base(w)}/invite-links`, {}] },
  { name: 'list the invite links', request: (w) => ['GET', `${base(w)}/invite-links`] },
  {
    name: "remove someone else's queue item without queue.remove",
    request: (w) => ['DELETE', `${base(w)}/queue/${w.queueItemId}`],
  },
];

export interface EscalationRow extends PartyRow {
  readonly code:
    | 'WATCH_PARTY_ROLE_ESCALATION'
    | 'WATCH_PARTY_ROLE_PROTECTED'
    | 'WATCH_PARTY_PERMISSION_MISSING';
}

const ESCALATION = 'WATCH_PARTY_ROLE_ESCALATION';
const PROTECTED = 'WATCH_PARTY_ROLE_PROTECTED';
const MISSING = 'WATCH_PARTY_PERMISSION_MISSING';

/** The second table: Organizer at 450 with roles.manage, roles.assign and chat.moderate. */
export const ORGANIZER_ROWS: readonly EscalationRow[] = [
  {
    name: 'creating a role that holds room.close',
    request: (w) => ['POST', `${base(w)}/roles`, { name: 'Sneaky', permissions: ['room.close'] }],
    code: ESCALATION,
  },
  {
    name: 'editing a role to hold room.close',
    request: (w) => [
      'PATCH',
      `${base(w)}/roles/${w.lowerRoleId}`,
      { permissions: ['room.close'], updatedAt: STALE },
    ],
    code: ESCALATION,
  },
  {
    name: 'editing Moderator',
    request: (w) => [
      'PATCH',
      `${base(w)}/roles/${w.role.moderator}`,
      { name: 'Boss', updatedAt: STALE },
    ],
    code: ESCALATION,
  },
  {
    name: 'moving Moderator',
    request: (w) => [
      'PATCH',
      `${base(w)}/roles/${w.role.moderator}`,
      { position: 300, updatedAt: STALE },
    ],
    code: ESCALATION,
  },
  {
    name: 'deleting Moderator',
    request: (w) => ['DELETE', `${base(w)}/roles/${w.role.moderator}`],
    code: PROTECTED,
  },
  {
    name: 'deleting a built-in role',
    request: (w) => ['DELETE', `${base(w)}/roles/${w.role.dj}`],
    code: PROTECTED,
  },
  {
    name: 'assigning Moderator',
    request: (w) => ['PUT', `${base(w)}/members/${w.key.member}/roles/${w.role.moderator}`, {}],
    code: ESCALATION,
  },
  {
    name: 'revoking Moderator',
    request: (w) => ['DELETE', `${base(w)}/members/${w.key.moderator}/roles/${w.role.moderator}`],
    code: ESCALATION,
  },
  {
    name: 'moving Organizer to 650',
    request: (w) => [
      'PATCH',
      `${base(w)}/roles/${w.organizerRoleId}`,
      { position: 650, updatedAt: STALE },
    ],
    code: ESCALATION,
  },
  {
    name: 'assigning Moderator to themselves',
    request: (w) => ['PUT', `${base(w)}/members/${w.key.organizer}/roles/${w.role.moderator}`, {}],
    code: ESCALATION,
  },
  {
    name: 'muting a Moderator in chat',
    request: (w) => ['PUT', `${base(w)}/members/${w.key.moderator}/roles/${w.role.chat_muted}`, {}],
    code: ESCALATION,
  },
  {
    name: 'assigning Chat muted despite chat.moderate',
    request: (w) => ['PUT', `${base(w)}/members/${w.key.member}/roles/${w.role.chat_muted}`, {}],
    code: ESCALATION,
  },
  {
    name: 'kicking a Moderator',
    request: (w) => ['POST', `${base(w)}/members/${w.key.moderator}/kick`, {}],
    code: MISSING,
  },
  {
    name: 'banning a Moderator',
    request: (w) => ['PUT', `${base(w)}/bans/${w.key.moderator}`, {}],
    code: MISSING,
  },
  {
    name: 'assigning Owner',
    request: (w) => ['PUT', `${base(w)}/members/${w.key.member}/roles/${w.role.owner}`, {}],
    code: ESCALATION,
  },
  {
    name: 'revoking Owner',
    request: (w) => ['DELETE', `${base(w)}/members/${w.key.creator}/roles/${w.role.owner}`],
    code: ESCALATION,
  },
  {
    name: 'editing Owner',
    request: (w) => [
      'PATCH',
      `${base(w)}/roles/${w.role.owner}`,
      { name: 'Mine', updatedAt: STALE },
    ],
    code: ESCALATION,
  },
  {
    name: 'demoting the owner',
    request: (w) => [
      'PATCH',
      `${base(w)}/roles/${w.role.owner}`,
      { permissions: [], updatedAt: STALE },
    ],
    code: ESCALATION,
  },
  {
    name: 'transferring ownership',
    request: (w) => ['POST', `${base(w)}/owner`, { memberKey: w.key.organizer }],
    code: ESCALATION,
  },
];

export interface LadderRow extends EscalationRow {
  readonly seat: 'moderator' | 'cohost' | 'dj';
}

/** The third table: the built-in ladder. */
export const LADDER_ROWS: readonly LadderRow[] = [
  {
    seat: 'moderator',
    name: 'a Moderator assigning Co-host',
    request: (w) => ['PUT', `${base(w)}/members/${w.key.member}/roles/${w.role.cohost}`, {}],
    code: ESCALATION,
  },
  {
    seat: 'moderator',
    name: 'a Moderator muting a Co-host',
    request: (w) => ['PUT', `${base(w)}/members/${w.key.cohost}/roles/${w.role.chat_muted}`, {}],
    code: ESCALATION,
  },
  {
    seat: 'moderator',
    name: 'a Moderator editing a role',
    request: (w) => [
      'PATCH',
      `${base(w)}/roles/${w.role.dj}`,
      { name: 'Selector', updatedAt: STALE },
    ],
    code: MISSING,
  },
  {
    seat: 'cohost',
    name: 'a Co-host closing the room',
    request: (w) => ['POST', `${base(w)}/close`, {}],
    code: MISSING,
  },
  {
    seat: 'cohost',
    name: 'a Co-host editing a role',
    request: (w) => [
      'PATCH',
      `${base(w)}/roles/${w.role.dj}`,
      { name: 'Selector', updatedAt: STALE },
    ],
    code: MISSING,
  },
  {
    seat: 'dj',
    name: 'a DJ assigning any role',
    request: (w) => ['PUT', `${base(w)}/members/${w.key.member}/roles/${w.role.vip}`, {}],
    code: MISSING,
  },
];

/** What a platform MODERATOR with no seat may and may not do. */
export const STAFF_ALLOWED: readonly PartyRow[] = [
  {
    name: 'mute in chat',
    request: (w) => ['PUT', `${base(w)}/members/${w.key.member}/roles/${w.role.chat_muted}`, {}],
  },
  { name: 'kick', request: (w) => ['POST', `${base(w)}/members/${w.key.member}/kick`, {}] },
  { name: 'ban', request: (w) => ['PUT', `${base(w)}/bans/${w.key.member}`, {}] },
  { name: 'close', request: (w) => ['POST', `${base(w)}/close`, {}] },
];

export const STAFF_REFUSED: readonly PartyRow[] = [
  {
    name: 'assign a role',
    request: (w) => ['PUT', `${base(w)}/members/${w.key.member}/roles/${w.role.vip}`, {}],
  },
  {
    name: 'create a role',
    request: (w) => [
      'POST',
      `${base(w)}/roles`,
      { name: 'Staff', permissions: ORGANIZER_PERMISSIONS },
    ],
  },
  {
    name: 'edit a role',
    request: (w) => ['PATCH', `${base(w)}/roles/${w.role.dj}`, { name: 'Staff', updatedAt: STALE }],
  },
  {
    name: 'transfer ownership',
    request: (w) => ['POST', `${base(w)}/owner`, { memberKey: w.key.member }],
  },
];

/** The fourth table's REST rows: what a guest credential may not reach. */
export const GUEST_REST_ROWS: readonly (PartyRow & { readonly status: 401 | 403 })[] = [
  {
    name: 'add to the queue',
    request: (w) => ['POST', `${base(w)}/queue`, { videoId: w.videoId }],
    status: 403,
  },
  {
    name: 'invite',
    request: (w) => [
      'POST',
      `${base(w)}/invites`,
      { userIds: [w.key.member.slice('user:'.length)] },
    ],
    status: 401,
  },
  { name: 'read the account', request: () => ['GET', '/v1/me/account'], status: 401 },
  { name: 'read the notifications', request: () => ['GET', '/v1/me/notifications'], status: 401 },
  { name: 'read the subscriptions', request: () => ['GET', '/v1/me/subscriptions'], status: 401 },
];

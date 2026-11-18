import { type RawRuleOf, createMongoAbility } from '@casl/ability';
import type { ApiScope } from '@vp/domain';
import type { AppAbility, AppAction, AppSubjects, TokenGrant, UserContext } from './types/index';

type SubjectName = Extract<AppSubjects, string>;

type ScopeGrant = readonly [AppAction, SubjectName];

/**
 * What each scope lets a token do, as the actions the services already check. A route's scope is the
 * one whose actions its service checks: the studio library checks `update Video`, so it needs
 * `videos:write`, and the comment inbox checks `moderate Comment`, so it needs `comments:moderate`.
 */
const SCOPE_ABILITIES: Readonly<Record<ApiScope, readonly ScopeGrant[]>> = {
  'videos:read': [['read', 'Video']],
  'videos:write': [
    ['read', 'Video'],
    ['update', 'Video'],
  ],
  'analytics:read': [['read', 'Analytics']],
  'comments:read': [['read', 'Comment']],
  'comments:moderate': [
    ['read', 'Comment'],
    ['moderate', 'Comment'],
    ['hold', 'Comment'],
    ['approve', 'Comment'],
    ['hide', 'Comment'],
    ['unhide', 'Comment'],
    ['remove', 'Comment'],
    ['delete', 'Comment'],
    ['restrict', 'ChannelUser'],
  ],
  'exports:read': [['read', 'ChannelExport']],
  'exports:create': [
    ['read', 'ChannelExport'],
    ['create', 'ChannelExport'],
    ['delete', 'ChannelExport'],
  ],
  'webhooks:manage': [['create', 'Webhook']],
};

function covers<T extends string>(granted: T | T[] | undefined, wanted: T, wildcard: T): boolean {
  if (granted === undefined) return false;
  const list: T[] = Array.isArray(granted) ? granted : [granted];
  return list.includes(wanted) || list.includes(wildcard);
}

/**
 * A token acts on its own channel only: the user's roles on every other team are left out, and a
 * platform role above the signed-in base (admin, moderator) is not carried into the token.
 */
export function onTokenChannel(user: UserContext, { channelId }: TokenGrant): UserContext {
  const grant = user.memberships?.[channelId];
  const role = user.role === 'ADMIN' || user.role === 'MODERATOR' ? 'USER' : user.role;
  return { ...user, role, memberships: grant ? { [channelId]: grant } : {} };
}

const CHANNEL_FIELD: Readonly<Partial<Record<SubjectName, string>>> = {
  Video: 'channelId',
  Comment: 'videoChannelId',
  Analytics: 'channelId',
  ChannelExport: 'channelId',
  ChannelUser: 'channelId',
};

/**
 * Takes back what a scope grant would reach outside the token's channel: rules keyed on the user's
 * own id would otherwise let a token act on every channel its owner has. Pinned on the channel,
 * not its owner, because one owner holds several. Public reads stay open.
 */
function pinnedToChannel(
  [action, subject]: ScopeGrant,
  channelId: string
): RawRuleOf<AppAbility> | null {
  const field = CHANNEL_FIELD[subject];
  if (!field || (action === 'read' && subject === 'Comment')) return null;
  const outside = { [field]: { $ne: channelId } };
  const conditions =
    action === 'read' && subject === 'Video'
      ? { ...outside, visibility: { $nin: ['public', 'unlisted'] } }
      : outside;
  return { inverted: true, action, subject, conditions };
}

/**
 * The intersection of the user's ability and the token's scopes. A `can` rule survives once per
 * scope action it covers, narrowed to that action and subject with its conditions intact; a
 * `cannot` rule survives whole, because it only ever takes away. Last, each grant is pinned to the
 * token's channel. A demoted user's ability shrinks first, so their token's does too on the
 * next call.
 */
export function withinScopes(ability: AppAbility, { channelId, scopes }: TokenGrant): AppAbility {
  const grants = [...new Set(scopes)].flatMap((scope) => SCOPE_ABILITIES[scope]);
  const rules = ability.rules.flatMap((rule): RawRuleOf<AppAbility>[] => {
    if (rule.inverted) return [rule];
    return grants
      .filter(
        ([action, subject]) =>
          covers<string>(rule.action, action, 'manage') &&
          covers<string>(rule.subject, subject, 'all')
      )
      .map(([action, subject]) => ({ ...rule, action, subject }));
  });
  const pins = grants.flatMap((grant) => pinnedToChannel(grant, channelId) ?? []);
  return createMongoAbility<AppAbility>([...rules, ...pins]);
}

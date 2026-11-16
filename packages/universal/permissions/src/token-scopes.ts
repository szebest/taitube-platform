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

/** A token acts on its own channel only: the user's roles on every other team are left out. */
export function onTokenChannel(user: UserContext, { channelId }: TokenGrant): UserContext {
  const grant = user.memberships?.[channelId];
  return { ...user, memberships: grant ? { [channelId]: grant } : {} };
}

/**
 * The intersection of the user's ability and the token's scopes. A `can` rule survives once per
 * scope action it covers, narrowed to that action and subject with its conditions intact; a
 * `cannot` rule survives whole, because it only ever takes away. A demoted user's ability shrinks
 * first, so their token's does too on the next call.
 */
export function withinScopes(ability: AppAbility, scopes: readonly ApiScope[]): AppAbility {
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
  return createMongoAbility<AppAbility>(rules);
}

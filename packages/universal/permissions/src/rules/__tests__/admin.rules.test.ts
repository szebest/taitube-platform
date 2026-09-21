import { AbilityBuilder, createMongoAbility } from '@casl/ability';
import { describe, expect, it } from 'vitest';
import { adminUser, guestUser, standardUser } from '../../__mocks__/fixtures';
import type { AppAbility, UserContext } from '../../types';
import { defineAdminRules } from '../admin.rules';

function buildAdminAbility(user: UserContext | null): AppAbility {
  const builder = new AbilityBuilder<AppAbility>(createMongoAbility);
  defineAdminRules(user, builder);
  return builder.build();
}

describe('rules/admin.rules: Declarative Admin Ability Rules', () => {
  it('gives manage all to admin users', () => {
    const ability = buildAdminAbility(adminUser);
    expect(ability.can('manage', 'all')).toBe(true);
    expect(ability.can('read', 'Video')).toBe(true);
    expect(ability.can('delete', 'Comment')).toBe(true);
  });

  it('does not give superuser bypass to non-admin users', () => {
    const ability = buildAdminAbility(standardUser);
    expect(ability.can('manage', 'all')).toBe(false);

    const guestAbility = buildAdminAbility(guestUser);
    expect(guestAbility.can('manage', 'all')).toBe(false);
  });
});

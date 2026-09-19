import { AbilityBuilder, createMongoAbility, subject } from '@casl/ability';
import { describe, expect, it } from 'vitest';
import { creatorUser, guestUser, sampleChannel, standardUser } from '../../__mocks__/fixtures';
import type { AppAbility, UserContext } from '../../types';
import { defineChannelRules } from '../channel.rules';

function buildChannelAbility(user: UserContext | null): AppAbility {
  const builder = new AbilityBuilder<AppAbility>(createMongoAbility);
  defineChannelRules(user, builder);
  return builder.build();
}

describe('rules/channel.rules: Declarative Channel Ability Rules', () => {
  it('allows reading channels for anyone', () => {
    const ability = buildChannelAbility(guestUser);
    expect(ability.can('read', 'Channel')).toBe(true);
  });

  it('allows channel owner to update their channel', () => {
    const ability = buildChannelAbility(standardUser);
    expect(ability.can('update', subject('Channel', sampleChannel))).toBe(true);
  });

  it('forbids non-owner from updating channel', () => {
    const ability = buildChannelAbility(creatorUser);
    expect(ability.can('update', subject('Channel', sampleChannel))).toBe(false);
  });
});

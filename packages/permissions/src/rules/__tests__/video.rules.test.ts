import { AbilityBuilder, createMongoAbility, subject } from '@casl/ability';
import { describe, expect, it } from 'vitest';
import {
  creatorUser,
  guestUser,
  moderatorUser,
  privateVideo,
  publicVideo,
  standardUser,
  unlistedVideo,
} from '../../__mocks__/fixtures';
import type { AppAbility, UserContext } from '../../types';
import { defineVideoRules } from '../video.rules';

function buildVideoAbility(user: UserContext | null): AppAbility {
  const builder = new AbilityBuilder<AppAbility>(createMongoAbility);
  defineVideoRules(user, builder);
  return builder.build();
}

describe('rules/video.rules: Declarative Video Ability Rules', () => {
  it('allows public and unlisted video read for guest', () => {
    const ability = buildVideoAbility(guestUser);
    expect(ability.can('read', subject('Video', publicVideo))).toBe(true);
    expect(ability.can('read', subject('Video', unlistedVideo))).toBe(true);
    expect(ability.can('read', subject('Video', privateVideo))).toBe(false);
  });

  it('allows owner to read, update, delete own video', () => {
    const ability = buildVideoAbility(creatorUser);
    expect(ability.can('read', subject('Video', privateVideo))).toBe(true);
    expect(ability.can('update', subject('Video', privateVideo))).toBe(true);
    expect(ability.can('delete', subject('Video', privateVideo))).toBe(true);
  });

  it('forbids non-owner from updating or deleting video', () => {
    const ability = buildVideoAbility(standardUser);
    expect(ability.can('update', subject('Video', privateVideo))).toBe(false);
    expect(ability.can('delete', subject('Video', privateVideo))).toBe(false);
  });

  it('allows moderator to read any video', () => {
    const ability = buildVideoAbility(moderatorUser);
    expect(ability.can('read', subject('Video', privateVideo))).toBe(true);
  });

  it('allows creator to publish own video', () => {
    const ability = buildVideoAbility(creatorUser);
    expect(ability.can('publish', subject('Video', privateVideo))).toBe(true);
  });
});

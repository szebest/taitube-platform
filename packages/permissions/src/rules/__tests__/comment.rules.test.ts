import { AbilityBuilder, createMongoAbility, subject } from '@casl/ability';
import { describe, expect, it } from 'vitest';
import {
  creatorUser,
  guestUser,
  moderatorUser,
  sampleComment,
  standardUser,
} from '../../__mocks__/fixtures';
import type { AppAbility, UserContext } from '../../types';
import { defineCommentRules } from '../comment.rules';

function buildCommentAbility(user: UserContext | null): AppAbility {
  const builder = new AbilityBuilder<AppAbility>(createMongoAbility);
  defineCommentRules(user, builder);
  return builder.build();
}

describe('rules/comment.rules: Declarative Comment Ability Rules', () => {
  it('allows reading comments for anyone', () => {
    const ability = buildCommentAbility(guestUser);
    expect(ability.can('read', 'Comment')).toBe(true);
  });

  it('allows author to delete their own comment', () => {
    const ability = buildCommentAbility(standardUser);
    expect(ability.can('delete', subject('Comment', sampleComment))).toBe(true);
  });

  it('allows video owner to delete or pin comments on their video', () => {
    const ability = buildCommentAbility(creatorUser);
    expect(ability.can('delete', subject('Comment', sampleComment))).toBe(true);
    expect(ability.can('pin', subject('Comment', sampleComment))).toBe(true);
  });

  it('allows moderator to delete any comment', () => {
    const ability = buildCommentAbility(moderatorUser);
    expect(ability.can('delete', subject('Comment', sampleComment))).toBe(true);
  });
});

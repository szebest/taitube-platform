import { subject } from '@casl/ability';
import {
  creatorUser,
  guestUser,
  moderatorUser,
  sampleComment,
  standardUser,
} from '../../__mocks__/fixtures';
import type { AppAction, AppSubjects, UserContext } from '../../types/index';
import { defineCommentRules } from '../comment.rules';
import { buildAbility } from './build-ability';

const comment = subject('Comment', sampleComment);

describe('rules/comment.rules: Declarative Comment Ability Rules', () => {
  it.each<{
    scenario: string;
    user: UserContext | null;
    action: AppAction;
    target: AppSubjects;
    expected: boolean;
  }>([
    {
      scenario: 'a guest reads the comment collection',
      user: guestUser,
      action: 'read',
      target: 'Comment',
      expected: true,
    },
    {
      scenario: 'the author deletes their own comment',
      user: standardUser,
      action: 'delete',
      target: comment,
      expected: true,
    },
    {
      scenario: 'the video owner deletes a comment under their video',
      user: creatorUser,
      action: 'delete',
      target: comment,
      expected: true,
    },
    {
      scenario: 'the video owner pins a comment under their video',
      user: creatorUser,
      action: 'pin',
      target: comment,
      expected: true,
    },
    {
      scenario: 'a moderator deletes any comment',
      user: moderatorUser,
      action: 'delete',
      target: comment,
      expected: true,
    },
  ])('$scenario: $expected', ({ user, action, target, expected }) => {
    expect(buildAbility(defineCommentRules, user).can(action, target)).toBe(expected);
  });
});

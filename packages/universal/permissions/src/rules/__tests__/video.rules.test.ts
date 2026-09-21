import { subject } from '@casl/ability';
import {
  creatorUser,
  guestUser,
  moderatorUser,
  privateVideo,
  publicVideo,
  standardUser,
  unlistedVideo,
} from '../../__mocks__/fixtures.js';
import type { AppAction, AppSubjects, UserContext } from '../../types/index.js';
import { defineVideoRules } from '../video.rules';
import { buildAbility } from './build-ability.js';

const ownPrivate = subject('Video', privateVideo);

describe('rules/video.rules: Declarative Video Ability Rules', () => {
  it.each<{
    scenario: string;
    user: UserContext | null;
    action: AppAction;
    target: AppSubjects;
    expected: boolean;
  }>([
    {
      scenario: 'a guest reads a public video',
      user: guestUser,
      action: 'read',
      target: subject('Video', publicVideo),
      expected: true,
    },
    {
      scenario: 'a guest reads an unlisted video',
      user: guestUser,
      action: 'read',
      target: subject('Video', unlistedVideo),
      expected: true,
    },
    {
      scenario: 'a guest reads a private video',
      user: guestUser,
      action: 'read',
      target: ownPrivate,
      expected: false,
    },
    {
      scenario: 'the owner reads their private video',
      user: creatorUser,
      action: 'read',
      target: ownPrivate,
      expected: true,
    },
    {
      scenario: 'the owner updates their private video',
      user: creatorUser,
      action: 'update',
      target: ownPrivate,
      expected: true,
    },
    {
      scenario: 'the owner deletes their private video',
      user: creatorUser,
      action: 'delete',
      target: ownPrivate,
      expected: true,
    },
    {
      scenario: 'the owner publishes their private video',
      user: creatorUser,
      action: 'publish',
      target: ownPrivate,
      expected: true,
    },
    {
      scenario: 'another user updates it',
      user: standardUser,
      action: 'update',
      target: ownPrivate,
      expected: false,
    },
    {
      scenario: 'another user deletes it',
      user: standardUser,
      action: 'delete',
      target: ownPrivate,
      expected: false,
    },
    {
      scenario: 'a moderator reads any video',
      user: moderatorUser,
      action: 'read',
      target: ownPrivate,
      expected: true,
    },
  ])('$scenario: $expected', ({ user, action, target, expected }) => {
    expect(buildAbility(defineVideoRules, user).can(action, target)).toBe(expected);
  });
});

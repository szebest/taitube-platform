import { subject } from '@casl/ability';
import { creatorUser, foreignUpload, guestUser, sampleUpload } from '../../__mocks__/fixtures.js';
import type { AppAction, AppSubjects, UserContext } from '../../types/index.js';
import { defineUploadRules } from '../upload.rules';
import { buildAbility } from './build-ability.js';

describe('rules/upload.rules: Declarative Upload Ability Rules', () => {
  it.each<{
    scenario: string;
    user: UserContext | null;
    action: AppAction;
    target: AppSubjects;
    expected: boolean;
  }>([
    {
      scenario: 'a guest creates an upload',
      user: guestUser,
      action: 'create',
      target: 'Upload',
      expected: false,
    },
    {
      scenario: 'a guest accesses an upload',
      user: guestUser,
      action: 'access',
      target: subject('Upload', sampleUpload),
      expected: false,
    },
    {
      scenario: 'a creator creates an upload',
      user: creatorUser,
      action: 'create',
      target: 'Upload',
      expected: true,
    },
    {
      scenario: 'the owner accesses their upload',
      user: creatorUser,
      action: 'access',
      target: subject('Upload', sampleUpload),
      expected: true,
    },
    {
      scenario: 'the owner accesses a foreign upload',
      user: creatorUser,
      action: 'access',
      target: subject('Upload', foreignUpload),
      expected: false,
    },
  ])('$scenario: $expected', ({ user, action, target, expected }) => {
    expect(buildAbility(defineUploadRules, user).can(action, target)).toBe(expected);
  });
});

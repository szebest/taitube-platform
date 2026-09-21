import { AbilityBuilder, createMongoAbility, subject } from '@casl/ability';
import { describe, expect, it } from 'vitest';
import { creatorUser, foreignUpload, guestUser, sampleUpload } from '../../__mocks__/fixtures';
import type { AppAbility, UserContext } from '../../types';
import { defineUploadRules } from '../upload.rules';

function buildUploadAbility(user: UserContext | null): AppAbility {
  const builder = new AbilityBuilder<AppAbility>(createMongoAbility);
  defineUploadRules(user, builder);
  return builder.build();
}

describe('rules/upload.rules: Declarative Upload Ability Rules', () => {
  it('forbids unauthenticated guest from creating or accessing uploads', () => {
    const ability = buildUploadAbility(guestUser);
    expect(ability.can('create', 'Upload')).toBe(false);
    expect(ability.can('access', subject('Upload', sampleUpload))).toBe(false);
  });

  it('allows owner to access their upload', () => {
    const ability = buildUploadAbility(creatorUser);
    expect(ability.can('create', 'Upload')).toBe(true);
    expect(ability.can('access', subject('Upload', sampleUpload))).toBe(true);
    expect(ability.can('access', subject('Upload', foreignUpload))).toBe(false);
  });
});

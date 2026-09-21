import { describe, expect, it } from 'vitest';
import {
  adminUser,
  creatorUser,
  foreignUpload,
  foreignVideo,
  guestUser,
  publicVideo,
  sampleUpload,
  standardUser,
} from '../../__mocks__/fixtures';
import { canAccessUpload } from '../uploads';

describe('helpers/uploads: Upload Action Helpers', () => {
  it('forbids unauthenticated guest', () => {
    expect(canAccessUpload({ user: guestUser, upload: sampleUpload })).toBe(false);
  });

  it('allows owner to access upload', () => {
    expect(canAccessUpload({ user: creatorUser, upload: sampleUpload })).toBe(true);
    expect(canAccessUpload({ user: creatorUser, video: publicVideo })).toBe(true);
  });

  it('forbids non-owner from accessing upload', () => {
    expect(canAccessUpload({ user: standardUser, upload: foreignUpload })).toBe(false);
    expect(canAccessUpload({ user: standardUser, video: foreignVideo })).toBe(false);
  });

  it('allows admin to access any upload', () => {
    expect(canAccessUpload({ user: adminUser, upload: foreignUpload })).toBe(true);
  });
});

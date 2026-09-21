import { describe, expect, it } from 'vitest';
import {
  adminUser,
  creatorUser,
  guestUser,
  sampleChannel,
  standardUser,
} from '../../__mocks__/fixtures';
import { canManageChannel, canUpdateChannel } from '../channels';

describe('helpers/channels: Channel Action Helpers', () => {
  describe('canUpdateChannel', () => {
    it('forbids unauthenticated guest', () => {
      expect(canUpdateChannel({ user: guestUser, channel: sampleChannel })).toBe(false);
    });

    it('allows channel owner to update their channel', () => {
      expect(canUpdateChannel({ user: standardUser, channel: sampleChannel })).toBe(true);
    });

    it('forbids other users from updating channel', () => {
      expect(canUpdateChannel({ user: creatorUser, channel: sampleChannel })).toBe(false);
    });

    it('allows admin to update any channel', () => {
      expect(canUpdateChannel({ user: adminUser, channel: sampleChannel })).toBe(true);
    });
  });

  describe('canManageChannel', () => {
    it('forbids standard USER role from manage actions', () => {
      expect(canManageChannel({ user: standardUser, channel: sampleChannel })).toBe(false);
    });

    it('allows channel owner with CREATOR role to manage channel', () => {
      const creatorChannel = { id: 'chan-c', ownerId: 'creator-1' };
      expect(canManageChannel({ user: creatorUser, channel: creatorChannel })).toBe(true);
    });

    it('allows admin to manage any channel', () => {
      expect(canManageChannel({ user: adminUser, channel: sampleChannel })).toBe(true);
    });
  });
});

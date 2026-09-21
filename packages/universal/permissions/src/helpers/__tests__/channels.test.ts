import { adminUser, creatorUser, guestUser, sampleChannel, standardUser } from '../../__mocks__/fixtures';
import type { ChannelResource, UserContext } from '../../types';
import { canManageChannel, canUpdateChannel } from '../channels';

type ChannelCase = {
  scenario: string;
  user: UserContext | null;
  channel: ChannelResource;
  expected: boolean;
};

const creatorChannel: ChannelResource = { id: 'chan-c', ownerId: 'creator-1' };

describe('helpers/channels: Channel Action Helpers', () => {
  describe('canUpdateChannel', () => {
    it.each<ChannelCase>([
      { scenario: 'a guest', user: guestUser, channel: sampleChannel, expected: false },
      { scenario: 'the channel owner', user: standardUser, channel: sampleChannel, expected: true },
      { scenario: 'another user', user: creatorUser, channel: sampleChannel, expected: false },
      { scenario: 'an admin on a foreign channel', user: adminUser, channel: sampleChannel, expected: true },
    ])('$scenario: $expected', ({ user, channel, expected }) => {
      expect(canUpdateChannel({ user, channel })).toBe(expected);
    });
  });

  describe('canManageChannel', () => {
    it.each<ChannelCase>([
      { scenario: 'a standard user on their own channel', user: standardUser, channel: sampleChannel, expected: false },
      { scenario: 'a creator on their own channel', user: creatorUser, channel: creatorChannel, expected: true },
      { scenario: 'an admin on a foreign channel', user: adminUser, channel: sampleChannel, expected: true },
    ])('$scenario: $expected', ({ user, channel, expected }) => {
      expect(canManageChannel({ user, channel })).toBe(expected);
    });
  });
});

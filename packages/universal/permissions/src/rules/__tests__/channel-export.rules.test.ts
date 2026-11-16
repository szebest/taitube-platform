import { subject } from '@casl/ability';
import type { UserContext } from '../../types/index';
import { defineChannelExportRules } from '../channel-export.rules';
import { buildAbility } from './build-ability';
import { matrixCells } from './channel-matrix';

const analyticsViewer: UserContext = {
  id: 'analytics-1',
  role: 'USER',
  memberships: { 'chan-1': { role: 'analytics', ownerId: 'owner-1' } },
};

describe('rules/channel-export.rules: who exports channel data', () => {
  it.each<{ scenario: string; user: UserContext | null; kind: 'comments' | 'channel_analytics' }>([
    { scenario: 'a guest exports the analytics', user: null, kind: 'channel_analytics' },
    {
      scenario: 'a guest-role caller exports their own comments',
      user: { id: 'owner-1', role: 'GUEST' },
      kind: 'comments',
    },
    {
      scenario: 'an analytics viewer exports the comments',
      user: analyticsViewer,
      kind: 'comments',
    },
  ])('$scenario: refused', ({ user, kind }) => {
    const target = subject('ChannelExport', { channelId: 'chan-1', ownerId: 'owner-1', kind });

    expect(buildAbility(defineChannelExportRules, user).can('create', target)).toBe(false);
  });

  it.each(matrixCells('ChannelExport'))(
    'the channel matrix: $persona holding $capability may $action: $expected',
    ({ user, action, target, expected }) => {
      expect(buildAbility(defineChannelExportRules, user).can(action, target)).toBe(expected);
    }
  );
});

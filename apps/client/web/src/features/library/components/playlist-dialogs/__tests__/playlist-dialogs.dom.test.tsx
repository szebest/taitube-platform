import { screen } from '@testing-library/react';
import {
  getPlaylistStats,
  listPlaylistActivity,
  listPlaylistCollaborators,
  listPlaylistInvites,
  listPlaylistShareLinks,
  type PlaylistView,
} from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { mockEndpoint, problemReply } from '@vp/web-testing';
import { playlistDetail } from '#app/__tests__/library-fixtures';
import { LAZY, LIST, renderPart } from '#app/features/library/__tests__/render-playlist';
import { LazyActivityDrawer } from '#app/features/library/components/activity-drawer/activity-drawer.lazy';
import { LazyCollaboratorsDialog } from '#app/features/library/components/collaborators-dialog/collaborators-dialog.lazy';
import { LazyRulesDialog } from '#app/features/library/components/rules-dialog/rules-dialog.lazy';
import { LazySettingsDialog } from '#app/features/library/components/settings-dialog/settings-dialog.lazy';
import { LazyShareLinksDialog } from '#app/features/library/components/share-links-dialog/share-links-dialog.lazy';
import { LazyStatsSheet } from '#app/features/library/components/stats-sheet/stats-sheet.lazy';
import type { PlaylistAbilities } from '#app/features/library/hooks/use-playlist-abilities';
import { PlaylistDialogs } from '../playlist-dialogs';

const NOBODY: PlaylistAbilities = {
  follow: false,
  pin: false,
  seeCollaborators: false,
  manageCollaborators: false,
  leave: false,
  readActivity: false,
  restore: false,
  readStats: false,
  share: false,
  configure: false,
  editRules: false,
  delete: false,
};

const SMART_RULES: NonNullable<PlaylistView['rules']> = {
  match: 'all',
  conditions: [],
  sort: 'newest',
  limit: 50,
};

const DIALOGS = [
  { modal: 'playlist-collaborators', dialog: 'Collaborators', ability: 'seeCollaborators' },
  { modal: 'playlist-activity', dialog: 'Activity', ability: 'readActivity' },
  { modal: 'playlist-share-links', dialog: 'Share links', ability: 'share' },
  { modal: 'playlist-stats', dialog: 'Playlist stats', ability: 'readStats' },
  { modal: 'playlist-settings', dialog: 'Playlist settings', ability: 'configure' },
  { modal: 'playlist-rules', dialog: 'Edit rules', ability: 'editRules' },
] as const;

const REFUSED = () => problemReply(ErrorCodes.INTERNAL);

function renderDialogs(modal: string, granted: Partial<PlaylistAbilities>, smart = true) {
  const playlist = playlistDetail(LIST, [], { rules: smart ? SMART_RULES : null });
  return renderPart(<PlaylistDialogs playlist={playlist} abilities={{ ...NOBODY, ...granted }} />, {
    url: `/?modal=${modal}`,
    handlers: [
      mockEndpoint(listPlaylistCollaborators, REFUSED),
      mockEndpoint(listPlaylistInvites, REFUSED),
      mockEndpoint(listPlaylistActivity, REFUSED),
      mockEndpoint(listPlaylistShareLinks, REFUSED),
      mockEndpoint(getPlaylistStats, REFUSED),
    ],
  });
}

beforeAll(() =>
  Promise.all([
    LazyCollaboratorsDialog.preload(),
    LazyActivityDrawer.preload(),
    LazyShareLinksDialog.preload(),
    LazyStatsSheet.preload(),
    LazySettingsDialog.preload(),
    LazyRulesDialog.preload(),
  ])
);

describe('apps/client/web: the playlist dialogs', () => {
  it.each(DIALOGS)(
    'opens $dialog from its URL for a viewer who may',
    async ({ modal, dialog, ability }) => {
      await renderDialogs(modal, { [ability]: true });

      expect(await screen.findByRole('dialog', { name: dialog }, LAZY)).toBeInTheDocument();
    }
  );

  it.each(DIALOGS)('keeps $dialog shut for a viewer who may not', async ({ modal, dialog }) => {
    await renderDialogs(modal, {});

    await expect(screen.findByRole('dialog', { name: dialog }, { timeout: 300 })).rejects.toThrow();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('keeps the rules shut on a playlist that is not smart', async () => {
    await renderDialogs('playlist-rules', { editRules: true }, false);

    await expect(
      screen.findByRole('dialog', { name: 'Edit rules' }, { timeout: 300 })
    ).rejects.toThrow();
  });
});

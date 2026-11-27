import type { PlaylistView } from '@vp/api-contracts';
import type { PlaylistAbilities } from '#app/features/library/hooks/use-playlist-abilities';
import { urlModals } from '#app/lib/url-modal/registry';
import { LazyActivityDrawer } from '../activity-drawer/activity-drawer.lazy';
import { LazyCollaboratorsDialog } from '../collaborators-dialog/collaborators-dialog.lazy';
import { LazyRulesDialog } from '../rules-dialog/rules-dialog.lazy';
import { LazySettingsDialog } from '../settings-dialog/settings-dialog.lazy';
import { LazyShareLinksDialog } from '../share-links-dialog/share-links-dialog.lazy';
import { LazyStatsSheet } from '../stats-sheet/stats-sheet.lazy';

const { UrlModal } = urlModals;

export interface PlaylistDialogsProps {
  playlist: PlaylistView;
  abilities: PlaylistAbilities;
}

/** The playlist page's dialogs and sheets, each loaded the first time its URL opens it. */
export function PlaylistDialogs({ playlist, abilities }: PlaylistDialogsProps) {
  return (
    <>
      {abilities.seeCollaborators && (
        <UrlModal.WhenOpened id="playlist-collaborators">
          <LazyCollaboratorsDialog playlist={playlist} abilities={abilities} />
        </UrlModal.WhenOpened>
      )}
      {abilities.readActivity && (
        <UrlModal.WhenOpened id="playlist-activity">
          <LazyActivityDrawer playlist={playlist} abilities={abilities} />
        </UrlModal.WhenOpened>
      )}
      {abilities.share && (
        <UrlModal.WhenOpened id="playlist-share-links">
          <LazyShareLinksDialog playlist={playlist} />
        </UrlModal.WhenOpened>
      )}
      {abilities.readStats && (
        <UrlModal.WhenOpened id="playlist-stats">
          <LazyStatsSheet playlist={playlist} />
        </UrlModal.WhenOpened>
      )}
      {abilities.configure && (
        <UrlModal.WhenOpened id="playlist-settings">
          <LazySettingsDialog playlist={playlist} />
        </UrlModal.WhenOpened>
      )}
      {abilities.editRules && playlist.rules !== null && (
        <UrlModal.WhenOpened id="playlist-rules">
          <LazyRulesDialog playlist={playlist} />
        </UrlModal.WhenOpened>
      )}
    </>
  );
}

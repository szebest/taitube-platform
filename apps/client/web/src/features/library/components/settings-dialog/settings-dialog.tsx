import { Field, Select, Switch, useToast } from '@kit/ui';
import { useQuery } from '@tanstack/react-query';
import type { PlaylistView } from '@vp/api-contracts';
import { PLAYLIST_COVER_MODES, type PlaylistCoverMode } from '@vp/domain';
import { failureCode, present, useApi } from '@vp/queries';
import { playlistCollaboratorsQueryOptions } from '#app/features/library/api/playlist-queries';
import {
  type PlaylistSettings,
  useSavePlaylistSettings,
} from '#app/features/library/hooks/use-save-playlist-settings';
import { useT } from '#app/lib/messages';
import { urlModals } from '#app/lib/url-modal/registry';

const { UrlModal } = urlModals;

export interface SettingsDialogProps {
  playlist: PlaylistView;
}

/**
 * `?modal=playlist-settings`: removing watched videos and the cover, each saved as it changes. A
 * custom cover is offered only while the playlist already has one: it is uploaded elsewhere.
 */
export function SettingsDialog({ playlist }: SettingsDialogProps) {
  const { tOr } = useT();
  const showToast = useToast();
  const collaborators = useQuery(playlistCollaboratorsQueryOptions(useApi(), playlist.id));
  const save = useSavePlaylistSettings(playlist.id);

  const { id, cover, rules, autoRemoveWatched, items } = playlist;
  const shared = (collaborators.data?.items.length ?? 0) > 0;
  const blocked = rules !== null ? 'smart' : shared ? 'collaborators' : null;
  const modes = PLAYLIST_COVER_MODES.filter((mode) => mode !== 'custom' || cover.mode === 'custom');
  const problem = save.isError
    ? tOr(present({ code: failureCode(save.error) }).copy, {}, '')
    : null;

  const apply = (settings: PlaylistSettings) =>
    save.mutate(settings, {
      onSuccess: () => showToast({ tone: 'success', title: tOr('playlistTools.saved', {}, '') }),
    });

  const pickMode = (next: string) => {
    const mode = modes.find((option): option is PlaylistCoverMode => option === next);
    if (mode === undefined || mode === cover.mode) {
      return;
    }

    apply(
      mode === 'item'
        ? { coverMode: 'item', coverVideoId: cover.videoId ?? items[0]?.videoId ?? null }
        : { coverMode: mode }
    );
  };

  return (
    <UrlModal.Root id="playlist-settings">
      <UrlModal.Content>
        <UrlModal.Title>{tOr('playlistTools.settingsTitle', {}, '')}</UrlModal.Title>
        <UrlModal.Body className="flex flex-col gap-section">
          <Field.Root orientation="horizontal" className="justify-between">
            <div className="flex min-w-0 flex-col gap-1">
              <Field.Label htmlFor={`${id}-auto-remove`}>
                {tOr('playlistTools.autoRemove', {}, '')}
              </Field.Label>
              <Field.Hint>
                {blocked === null
                  ? tOr('playlistTools.autoRemoveHint', {}, '')
                  : tOr('playlistTools.autoRemoveBlocked', { reason: blocked }, '')}
              </Field.Hint>
            </div>
            <Switch
              id={`${id}-auto-remove`}
              checked={autoRemoveWatched}
              disabled={blocked !== null || save.isPending}
              onCheckedChange={(checked) => apply({ autoRemoveWatched: checked })}
            />
          </Field.Root>
          <Field.Root>
            <Field.Label>{tOr('playlistTools.coverLabel', {}, '')}</Field.Label>
            <Select.Root value={cover.mode} onValueChange={pickMode} disabled={save.isPending}>
              <Select.Trigger aria-label={tOr('playlistTools.coverLabel', {}, '')}>
                <Select.Value />
              </Select.Trigger>
              <Select.Content>
                {modes.map((mode) => (
                  <Select.Item
                    key={mode}
                    value={mode}
                    disabled={mode === 'item' && items.length === 0}
                  >
                    {tOr('playlistTools.coverMode', { mode }, '')}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select.Root>
          </Field.Root>
          {cover.mode === 'item' && (
            <Field.Root>
              <Field.Label>{tOr('playlistTools.coverVideo', {}, '')}</Field.Label>
              <Select.Root
                value={cover.videoId ?? undefined}
                onValueChange={(videoId) => apply({ coverMode: 'item', coverVideoId: videoId })}
                disabled={save.isPending}
              >
                <Select.Trigger aria-label={tOr('playlistTools.coverVideo', {}, '')}>
                  <Select.Value />
                </Select.Trigger>
                <Select.Content>
                  {items.map(({ id: itemId, videoId, video }) => (
                    <Select.Item key={itemId} value={videoId}>
                      {video.title}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select.Root>
            </Field.Root>
          )}
          {problem && (
            <p role="alert" className="m-0 text-caption text-danger-ink">
              {problem}
            </p>
          )}
        </UrlModal.Body>
      </UrlModal.Content>
    </UrlModal.Root>
  );
}

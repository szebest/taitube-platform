import type { PlaylistView } from '@vp/api-contracts';
import { PLAYLIST_VISIBILITIES } from '@vp/domain';
import { useAppForm } from '@vp/forms';
import { useT } from '@vp/intl-react';
import { Button, useUiCopy } from '@vp/ui';
import { useUpdatePlaylist } from '#app/features/library/hooks/use-update-playlist';
import {
  useValidatePlaylistDescription,
  useValidatePlaylistTitle,
} from '#app/features/library/hooks/use-validate-playlist-title';

export interface PlaylistDetailsFormProps {
  playlist: Pick<PlaylistView, 'id' | 'title' | 'description' | 'visibility'>;
  onDone: () => void;
}

/** The owner's edit of a playlist's title, description and privacy, in place of the hero's text. */
export function PlaylistDetailsForm({ playlist, onDone }: PlaylistDetailsFormProps) {
  const { tOr } = useT();
  const { cancel } = useUiCopy();
  const update = useUpdatePlaylist(playlist.id);
  const validateTitle = useValidatePlaylistTitle();
  const validateDescription = useValidatePlaylistDescription();

  const form = useAppForm({
    defaultValues: {
      title: playlist.title,
      description: playlist.description,
      visibility: playlist.visibility,
    },
    onSubmit: ({ value }) => {
      update.mutate(value);
      onDone();
    },
  });

  return (
    <form
      className="flex flex-col gap-stack"
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void form.handleSubmit();
      }}
    >
      <form.AppField name="title" validators={{ onChange: validateTitle }}>
        {(field) => <field.TextField label={tOr('library.playlistTitleLabel', {}, '')} />}
      </form.AppField>
      <form.AppField name="description" validators={{ onChange: validateDescription }}>
        {(field) => (
          <field.TextField multiline label={tOr('library.playlistDescriptionLabel', {}, '')} />
        )}
      </form.AppField>
      <form.AppField name="visibility">
        {(field) => (
          <field.SelectField
            label={tOr('library.playlistPrivacyLabel', {}, '')}
            options={PLAYLIST_VISIBILITIES}
            labelOf={(visibility) => tOr('videos.visibility', { visibility }, '')}
          />
        )}
      </form.AppField>
      <div className="flex gap-inline">
        <form.Subscribe selector={(state) => state.canSubmit}>
          {(canSubmit) => (
            <Button type="submit" variant="solid" tone="accent" disabled={!canSubmit}>
              {tOr('library.savePlaylist', {}, '')}
            </Button>
          )}
        </form.Subscribe>
        <Button type="button" variant="ghost" onClick={onDone}>
          {cancel}
        </Button>
      </div>
    </form>
  );
}

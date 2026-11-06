import { DEFAULT_PLAYLIST_VISIBILITY, PLAYLIST_VISIBILITIES } from '@vp/domain';
import { useAppForm } from '@vp/forms';
import { useT } from '@vp/intl-react';
import { Button, useUiCopy } from '@vp/ui';
import { useCreatePlaylist } from '#app/features/library/hooks/use-create-playlist';
import { useValidatePlaylistTitle } from '#app/features/library/hooks/use-validate-playlist-title';

export interface NewPlaylistFormProps {
  /** A video the new playlist starts with. */
  videoId?: string;
  onCreated: () => void;
  onCancel: () => void;
}

/** A title and who can see it; submitting creates the playlist, with the video in it when there is one. */
export function NewPlaylistForm({ videoId, onCreated, onCancel }: NewPlaylistFormProps) {
  const { tOr } = useT();
  const { cancel } = useUiCopy();
  const create = useCreatePlaylist();

  const form = useAppForm({
    defaultValues: { title: '', visibility: DEFAULT_PLAYLIST_VISIBILITY },
    onSubmit: ({ value }) => create.mutate({ ...value, videoId }, { onSuccess: onCreated }),
  });
  const validateTitle = useValidatePlaylistTitle();

  return (
    <form
      className="flex flex-col gap-stack"
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void form.handleSubmit();
      }}
    >
      <form.AppField name="title" validators={{ onMount: validateTitle, onChange: validateTitle }}>
        {(field) => <field.TextField label={tOr('library.playlistTitleLabel', {}, '')} />}
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
      <div className="flex justify-end gap-inline">
        <Button type="button" variant="ghost" onClick={onCancel}>
          {cancel}
        </Button>
        <form.Subscribe selector={(state) => state.canSubmit}>
          {(canSubmit) => (
            <Button
              type="submit"
              variant="solid"
              tone="accent"
              loading={create.isPending}
              disabled={!canSubmit}
            >
              {tOr('library.createPlaylist', {}, '')}
            </Button>
          )}
        </form.Subscribe>
      </div>
    </form>
  );
}

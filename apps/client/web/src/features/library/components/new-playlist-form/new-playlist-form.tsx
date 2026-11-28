import { useAppForm } from '@kit/forms';
import { Button, Field, SegmentedControl } from '@kit/ui';
import { DEFAULT_PLAYLIST_VISIBILITY, PLAYLIST_VISIBILITIES } from '@vp/domain';
import { useCreatePlaylist } from '#app/features/library/hooks/use-create-playlist';
import { useValidatePlaylistTitle } from '#app/features/library/hooks/use-validate-playlist-title';
import {
  draftToRules,
  EMPTY_RULES,
  validateRulesDraft,
} from '#app/features/library/utils/rules-form';
import { useT } from '#app/lib/messages';
import { SmartRulesEditor } from '../smart-rules-editor/smart-rules-editor';

const KINDS = ['playlist', 'smart'] as const;

type Kind = (typeof KINDS)[number];

export interface NewPlaylistFormProps {
  /** A video the new playlist starts with; a smart one takes none, so it is not offered then. */
  videoId?: string;
  onCreated: () => void;
  onCancel: () => void;
}

/**
 * A title and who can see it, and for a smart playlist the rules it picks its videos by; submitting
 * creates it, with the video in it when there is one.
 */
export function NewPlaylistForm({ videoId, onCreated, onCancel }: NewPlaylistFormProps) {
  const { tOr } = useT();
  const cancel = tOr('ui.cancel', {}, '');
  const create = useCreatePlaylist();

  const form = useAppForm({
    defaultValues: {
      title: '',
      visibility: DEFAULT_PLAYLIST_VISIBILITY,
      kind: 'playlist' as Kind,
      rules: EMPTY_RULES,
    },
    onSubmit: ({ value: { title, visibility, kind, rules } }) =>
      create.mutate(
        { title, visibility, videoId, rules: kind === 'smart' ? draftToRules(rules) : undefined },
        { onSuccess: onCreated }
      ),
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
      {videoId === undefined && (
        <form.Field name="kind">
          {(field) => (
            <Field.Root>
              <Field.Label id="new-playlist-kind">
                {tOr('playlistTools.kindLabel', {}, '')}
              </Field.Label>
              <SegmentedControl.Root
                aria-labelledby="new-playlist-kind"
                value={field.state.value}
                onValueChange={(next) => {
                  const kind = KINDS.find((option) => option === next);
                  if (kind) field.handleChange(kind);
                }}
              >
                {KINDS.map((kind) => (
                  <SegmentedControl.Item key={kind} value={kind}>
                    {tOr('playlistTools.kind', { kind }, '')}
                  </SegmentedControl.Item>
                ))}
              </SegmentedControl.Root>
            </Field.Root>
          )}
        </form.Field>
      )}
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
      <form.Field
        name="rules"
        validators={{
          onChangeListenTo: ['kind'],
          onChange: ({ value, fieldApi }) =>
            fieldApi.form.getFieldValue('kind') === 'smart'
              ? validateRulesDraft({ value })
              : undefined,
        }}
      >
        {(field) => (
          <form.Subscribe selector={(state) => state.values.kind}>
            {(kind) =>
              kind === 'smart' && (
                <SmartRulesEditor value={field.state.value} onChange={field.handleChange} />
              )
            }
          </form.Subscribe>
        )}
      </form.Field>
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

import { TimelineRangeEditor } from '@kit/components';
import { useAppForm } from '@kit/forms';
import { isErr, unwrapOr } from '@kit/result';
import { Button, useToast } from '@kit/ui';
import type { PlaylistView } from '@vp/api-contracts';
import { PLAYLIST_SEGMENT_MIN_MS } from '@vp/domain';
import { checkPlaylistSegment } from '@vp/domain-rules';
import { PLAYLIST_NOTE_MAX_LENGTH, validatePlaylistNote } from '@vp/validation';
import { useEditPlaylistItem } from '#app/features/library/hooks/use-edit-playlist-item';
import { useSegmentText } from '#app/features/library/hooks/use-segment-text';
import { parseClock } from '#app/features/library/utils/parse-clock';
import type { PlaylistItemView } from '#app/features/library/utils/playlist-rows';
import { useT } from '#app/lib/messages';
import { urlModals } from '#app/lib/url-modal/registry';

const { UrlModal, useUrlModal } = urlModals;

export interface PlaylistItemDialogProps {
  playlist: PlaylistView;
}

interface ItemValues {
  note: string;
  segment: boolean;
  start: string;
  end: string;
}

function ItemForm({ playlistId, item }: { playlistId: string; item: PlaylistItemView }) {
  const { tOr } = useT();
  const showToast = useToast();
  const { clock, segment: segmentText } = useSegmentText();
  const { close } = useUrlModal('playlist-item');
  const edit = useEditPlaylistItem(playlistId);
  const durationMs = item.video.durationMs ?? null;

  const validateNote = ({ value }: { value: string }) =>
    isErr(validatePlaylistNote(value))
      ? tOr('playlistEdit.noteInvalid', { max: PLAYLIST_NOTE_MAX_LENGTH }, '')
      : undefined;

  const validateTime = ({ value }: { value: string }) =>
    parseClock(value) === null ? tOr('playlistEdit.timeInvalid', {}, '') : undefined;

  const validateSegment = ({ value }: { value: ItemValues }) => {
    const startMs = parseClock(value.start);
    const endMs = parseClock(value.end);
    if (!value.segment || startMs === null || endMs === null) return undefined;

    return isErr(checkPlaylistSegment({ startMs, endMs }, durationMs))
      ? tOr('playlistEdit.segmentInvalid', {}, '')
      : undefined;
  };

  const form = useAppForm({
    defaultValues: {
      note: item.note ?? '',
      segment: item.startMs !== null || item.endMs !== null,
      start: clock(item.startMs ?? 0),
      end: clock(item.endMs ?? durationMs ?? 0),
    } satisfies ItemValues,
    validators: { onChange: validateSegment },
    onSubmit: ({ value }) => {
      edit.mutate(
        {
          kind: 'video',
          itemId: item.id,
          note: unwrapOr(validatePlaylistNote(value.note), null),
          startMs: value.segment ? parseClock(value.start) : null,
          endMs: value.segment ? parseClock(value.end) : null,
        },
        {
          onSuccess: () => {
            showToast({ tone: 'success', title: tOr('playlistEdit.itemSaved', {}, '') });
            close();
          },
        }
      );
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
      <form.AppField name="note" validators={{ onChange: validateNote }}>
        {(field) => (
          <div className="flex flex-col gap-1">
            <field.TextField label={tOr('playlistEdit.noteLabel', {}, '')} multiline />
            <p className="m-0 self-end text-caption text-fg-muted" aria-live="polite">
              {tOr(
                'playlistEdit.noteCount',
                { count: field.state.value.length, max: PLAYLIST_NOTE_MAX_LENGTH },
                ''
              )}
            </p>
          </div>
        )}
      </form.AppField>
      <form.Subscribe selector={({ values }) => values}>
        {({ segment, start, end }) => {
          const startMs = parseClock(start);
          const endMs = parseClock(end);
          const summary =
            segmentText(startMs ?? 0, endMs) ?? tOr('playlistEdit.segmentWhole', {}, '');
          return (
            <fieldset className="m-0 flex flex-col gap-stack border-0 p-0">
              <legend className="mb-2 text-label">
                {tOr('playlistEdit.segmentLabel', {}, '')}
              </legend>
              {!segment && (
                <div className="flex flex-wrap items-center gap-inline">
                  <p className="m-0 text-fg-muted">{tOr('playlistEdit.segmentWhole', {}, '')}</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => form.setFieldValue('segment', true)}
                  >
                    {tOr('playlistEdit.addSegment', {}, '')}
                  </Button>
                </div>
              )}
              {segment && durationMs !== null && durationMs >= PLAYLIST_SEGMENT_MIN_MS && (
                <TimelineRangeEditor
                  aria-label={tOr('playlistEdit.segmentLabel', {}, '')}
                  durationMs={durationMs}
                  sprite={item.video.sprite}
                  summary={summary}
                  control={{
                    mode: 'range',
                    range: {
                      startMs: Math.min(startMs ?? 0, durationMs),
                      endMs: Math.min(endMs ?? durationMs, durationMs),
                    },
                    onRangeChange: (range) => {
                      form.setFieldValue('start', clock(range.startMs));
                      form.setFieldValue('end', clock(range.endMs));
                    },
                    minSpanMs: PLAYLIST_SEGMENT_MIN_MS,
                    maxSpanMs: durationMs,
                    startLabel: tOr('playlistEdit.startLabel', {}, ''),
                    endLabel: tOr('playlistEdit.endLabel', {}, ''),
                  }}
                />
              )}
              {segment && (
                <div className="flex flex-wrap items-end gap-inline">
                  <form.AppField name="start" validators={{ onChange: validateTime }}>
                    {(field) => (
                      <field.TextField
                        label={tOr('playlistEdit.startLabel', {}, '')}
                        className="w-28"
                      />
                    )}
                  </form.AppField>
                  <form.AppField name="end" validators={{ onChange: validateTime }}>
                    {(field) => (
                      <field.TextField
                        label={tOr('playlistEdit.endLabel', {}, '')}
                        className="w-28"
                      />
                    )}
                  </form.AppField>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => form.setFieldValue('segment', false)}
                  >
                    {tOr('playlistEdit.clearSegment', {}, '')}
                  </Button>
                </div>
              )}
            </fieldset>
          );
        }}
      </form.Subscribe>
      <form.Subscribe selector={({ errors }) => errors}>
        {(errors) =>
          errors.length > 0 && (
            <p role="alert" className="m-0 text-body-sm text-danger-ink">
              {errors.join(' ')}
            </p>
          )
        }
      </form.Subscribe>
      <UrlModal.Footer>
        <UrlModal.Close asChild>
          <Button type="button" variant="ghost">
            {tOr('ui.cancel', {}, '')}
          </Button>
        </UrlModal.Close>
        <form.Subscribe selector={(state) => state.canSubmit}>
          {(canSubmit) => (
            <Button
              type="submit"
              variant="solid"
              tone="accent"
              loading={edit.isPending}
              disabled={!canSubmit}
            >
              {tOr('playlistEdit.save', {}, '')}
            </Button>
          )}
        </form.Subscribe>
      </UrlModal.Footer>
    </form>
  );
}

/** `?modal=playlist-item&itemId=`: an item's note, and the part of its video that plays. */
export function PlaylistItemDialog({ playlist }: PlaylistItemDialogProps) {
  const { tOr } = useT();
  const { params } = useUrlModal('playlist-item');
  const item = playlist.items.find(({ id }) => id === params?.itemId);

  return (
    <UrlModal.Root id="playlist-item">
      <UrlModal.Content>
        <UrlModal.Title>{tOr('playlistEdit.itemDialogTitle', {}, '')}</UrlModal.Title>
        <UrlModal.Description>
          {item
            ? (item.video.title ?? tOr('browse.untitled', {}, ''))
            : tOr('playlistEdit.itemMissing', {}, '')}
        </UrlModal.Description>
        <UrlModal.Body>
          {item && <ItemForm key={item.id} playlistId={playlist.id} item={item} />}
        </UrlModal.Body>
      </UrlModal.Content>
    </UrlModal.Root>
  );
}

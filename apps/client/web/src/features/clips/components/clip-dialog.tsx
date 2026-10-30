import { useRouter } from '@tanstack/react-router';
import type { Video } from '@vp/api-contracts';
import { CLIP_MAX_MS, CLIP_MIN_MS } from '@vp/domain';
import { useAppForm } from '@vp/forms';
import { videoDuration } from '@vp/intl';
import { useFormat, useT } from '@vp/intl-react';
import { fromPromise, isOk, unwrapOr } from '@vp/result';
import { Button, Field, Input, ResponsiveModal, useToast, useUiCopy } from '@vp/ui';
import { lazy, Suspense, useState } from 'react';
import { ClipEditor } from '#app/components/watch/clip-editor';
import { PlayerChannelProvider } from '#app/features/player';

import { initialClipRange } from '../clip-defaults';
import { useClipValidators } from '../forms/use-clip-validators';
import { useCreateClip } from '../hooks/use-create-clip';

const MS_PER_SECOND = 1000;

const TaitubePreview = lazy(() =>
  import('#app/features/player').then((player) => ({ default: player.TaitubePreview }))
);

type ClippableVideo = Pick<
  Video,
  'id' | 'title' | 'playbackUrl' | 'posterUrl' | 'sprite'
> & { durationMs: number };

interface ClipDialogBodyProps {
  video: ClippableVideo;
  startAt: number;
  onSaved: () => void;
}

function ClipDialogBody({ video, startAt, onSaved }: ClipDialogBodyProps) {
  const router = useRouter();
  const showToast = useToast();
  const { tOr } = useT();
  const { format } = useFormat();
  const { cancel } = useUiCopy();
  const { validateTitle, findRangeError } = useClipValidators();
  const createClip = useCreateClip(video.id);
  const [range, setRange] = useState(() => initialClipRange(startAt, video.durationMs));

  const rangeError = findRangeError(range, video.durationMs);
  const clock = (ms: number) => unwrapOr(format(videoDuration(ms / MS_PER_SECOND)), '');

  const copyLink = async (clipId: string) => {
    const { href } = router.buildLocation({ to: '/clip/$clipId', params: { clipId } });
    const copied = await fromPromise(
      () => navigator.clipboard.writeText(new URL(href, window.location.origin).toString()),
      (cause) => cause
    );

    showToast(
      isOk(copied)
        ? { tone: 'success', title: tOr('clips.saved', {}, '') }
        : { tone: 'danger', title: tOr('clips.savedCopyFailed', {}, '') }
    );
  };

  const form = useAppForm({
    defaultValues: { title: video.title ?? '' },
    onSubmit: ({ value }) =>
      createClip.mutate(
        { ...range, title: value.title },
        {
          onSuccess: async ({ id }) => {
            await copyLink(id);
            onSaved();
          },
          onError: () => showToast({ tone: 'danger', title: tOr('clips.saveFailed', {}, '') }),
        }
      ),
  });

  return (
    <form
      className="tw:flex tw:flex-col tw:gap-stack"
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <ResponsiveModal.Body>
        <ClipEditor.Root durationMs={video.durationMs} range={range} onRangeChange={setRange}>
          {video.playbackUrl && (
            <ClipEditor.Preview aria-label={tOr('clips.previewLabel', {}, '')}>
              <PlayerChannelProvider>
                <Suspense>
                  <TaitubePreview
                    playbackUrl={video.playbackUrl}
                    posterUrl={video.posterUrl}
                    title={video.title}
                    range={range}
                  />
                </Suspense>
              </PlayerChannelProvider>
            </ClipEditor.Preview>
          )}
          <ClipEditor.Range
            aria-label={tOr('clips.rangeLabel', {}, '')}
            sprite={video.sprite}
            startLabel={tOr('clips.startThumb', {}, '')}
            endLabel={tOr('clips.endThumb', {}, '')}
            summary={
              rangeError ??
              tOr(
                'clips.rangeSummary',
                {
                  start: clock(range.startMs),
                  end: clock(range.endMs),
                  length: clock(range.endMs - range.startMs),
                },
                ''
              )
            }
          />
        </ClipEditor.Root>
        <form.AppField
          name="title"
          validators={{ onMount: validateTitle, onChange: validateTitle }}
        >
          {(field) => {
            const error = field.state.meta.isTouched ? field.state.meta.errors[0] : undefined;

            return (
              <Field.Root invalid={error !== undefined} className="tw:mt-stack">
                <Field.Label>{tOr('clips.titleLabel', {}, '')}</Field.Label>
                <Input
                  name={field.name}
                  value={field.state.value}
                  onChange={(event) => field.handleChange(event.target.value)}
                  onBlur={field.handleBlur}
                />
                {typeof error === 'string' && <Field.Error>{error}</Field.Error>}
              </Field.Root>
            );
          }}
        </form.AppField>
      </ResponsiveModal.Body>
      <ResponsiveModal.Footer>
        <ResponsiveModal.Close asChild>
          <Button variant="ghost">{cancel}</Button>
        </ResponsiveModal.Close>
        <form.Subscribe selector={(state) => state.canSubmit}>
          {(canSubmit) => (
            <Button
              type="submit"
              variant="solid"
              tone="accent"
              loading={createClip.isPending}
              disabled={!canSubmit || rangeError !== undefined}
            >
              {tOr('clips.save', {}, '')}
            </Button>
          )}
        </form.Subscribe>
      </ResponsiveModal.Footer>
    </form>
  );
}

export interface ClipDialogProps {
  video: ClippableVideo;
  /** The playhead when the dialog opened, in seconds: where the range starts. */
  startAt: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** The dialog that clips a stretch of a video: its range over the video's frames, a preview, a title. */
export function ClipDialog({ video, startAt, open, onOpenChange }: ClipDialogProps) {
  const { tOr } = useT();

  return (
    <ResponsiveModal.Root open={open} onOpenChange={onOpenChange}>
      <ResponsiveModal.Content size="lg">
        <ResponsiveModal.Title>{tOr('clips.dialogTitle', {}, '')}</ResponsiveModal.Title>
        <ResponsiveModal.Description>
          {tOr(
            'clips.dialogDescription',
            { min: CLIP_MIN_MS / MS_PER_SECOND, max: CLIP_MAX_MS / MS_PER_SECOND },
            ''
          )}
        </ResponsiveModal.Description>
        <ClipDialogBody video={video} startAt={startAt} onSaved={() => onOpenChange(false)} />
      </ResponsiveModal.Content>
    </ResponsiveModal.Root>
  );
}

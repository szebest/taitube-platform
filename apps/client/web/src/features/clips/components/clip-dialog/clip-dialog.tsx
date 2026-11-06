import { useRouter } from '@tanstack/react-router';
import type { Video } from '@vp/api-contracts';
import { CLIP_MAX_MS, CLIP_MIN_MS } from '@vp/domain';
import { useAppForm } from '@vp/forms';
import { videoDuration } from '@vp/intl';
import { useFormat, useT } from '@vp/intl-react';
import { fromPromise, isOk, unwrapOr } from '@vp/result';
import { ResponsiveModal, useToast } from '@vp/ui';
import { Suspense, useState } from 'react';
import {
  ClipDialogView,
  type ClipDialogViewRootProps,
} from '#app/components/watch/clip-dialog-view';
import { ClipEditor } from '#app/components/watch/clip-editor';
import { PlayerChannelProvider } from '#app/features/player';
import { LazyTaitubePreview } from '#app/features/player/taitube-preview.lazy';
import { initialClipRange } from '../clip-defaults';
import { useClipValidators } from '../forms/use-clip-validators';
import { useCreateClip } from '../hooks/use-create-clip';

const MS_PER_SECOND = 1000;

type ClippableVideo = Pick<Video, 'id' | 'title' | 'playbackUrl' | 'posterUrl' | 'sprite'> & {
  durationMs: number;
};

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
    <ClipDialogView.Form onSubmit={() => void form.handleSubmit()}>
      <ResponsiveModal.Body>
        <ClipEditor.Root durationMs={video.durationMs} range={range} onRangeChange={setRange}>
          {video.playbackUrl && (
            <ClipEditor.Preview>
              <PlayerChannelProvider>
                <Suspense>
                  <LazyTaitubePreview
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
              <ClipDialogView.TitleField
                label={tOr('clips.titleLabel', {}, '')}
                name={field.name}
                value={field.state.value}
                onValueChange={field.handleChange}
                onBlur={field.handleBlur}
                error={typeof error === 'string' ? error : undefined}
              />
            );
          }}
        </form.AppField>
      </ResponsiveModal.Body>
      <form.Subscribe selector={(state) => state.canSubmit}>
        {(canSubmit) => (
          <ClipDialogView.Footer
            saveLabel={tOr('clips.save', {}, '')}
            saving={createClip.isPending}
            canSave={canSubmit && rangeError === undefined}
          />
        )}
      </form.Subscribe>
    </ClipDialogView.Form>
  );
}

export interface ClipDialogProps {
  video: ClippableVideo;
  /** The playhead when the dialog opened, in seconds: where the range starts. */
  startAt: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Where focus goes when the dialog closes: the control that opened it. */
  onCloseAutoFocus?: ClipDialogViewRootProps['onCloseAutoFocus'];
}

/** The dialog that clips a stretch of a video: its range over the video's frames, a preview, a title. */
export function ClipDialog({
  video,
  startAt,
  open,
  onOpenChange,
  onCloseAutoFocus,
}: ClipDialogProps) {
  const { tOr } = useT();

  return (
    <ClipDialogView.Root
      open={open}
      onOpenChange={onOpenChange}
      onCloseAutoFocus={onCloseAutoFocus}
      title={tOr('clips.dialogTitle', {}, '')}
      description={tOr(
        'clips.dialogDescription',
        { min: CLIP_MIN_MS / MS_PER_SECOND, max: CLIP_MAX_MS / MS_PER_SECOND },
        ''
      )}
    >
      <ClipDialogBody video={video} startAt={startAt} onSaved={() => onOpenChange(false)} />
    </ClipDialogView.Root>
  );
}

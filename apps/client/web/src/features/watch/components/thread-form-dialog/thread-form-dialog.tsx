import { useAppForm } from '@kit/forms';
import { isErr } from '@kit/result';
import { Button, Field, Input, ResponsiveModal, Textarea } from '@kit/ui';
import type { ThreadView } from '@vp/api-contracts';
import { useCreateThread, useFailureToast } from '@vp/queries';
import { THREAD_BODY_BOUNDS, THREAD_TITLE_BOUNDS, validateThreadContent } from '@vp/validation';
import { useTimeLabel } from '#app/features/watch/hooks/use-time-label';
import { useT } from '#app/lib/messages';

export interface ThreadFormDialogProps {
  videoId: string;
  /** The moment the thread is about, taken from the playhead when the form opened. */
  anchorMs: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStarted: (thread: ThreadView) => void;
}

function ThreadForm({ videoId, anchorMs, onOpenChange, onStarted }: ThreadFormDialogProps) {
  const { tOr } = useT();
  const showFailure = useFailureToast();
  const createThread = useCreateThread(videoId);

  const form = useAppForm({
    defaultValues: { title: '', body: '' },
    onSubmit: ({ value }) => {
      const content = validateThreadContent(value);
      if (isErr(content)) return;

      createThread.mutate(
        { anchorMs, ...content.value },
        {
          onSuccess: (thread) => {
            onOpenChange(false);
            onStarted(thread);
          },
          onError: (error) => showFailure(tOr('threads.createFailed', {}, ''), error),
        }
      );
    },
  });

  return (
    <form
      className="flex flex-col gap-stack"
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <ResponsiveModal.Body className="flex flex-col gap-stack">
        <form.Field name="title">
          {(field) => (
            <Field.Root>
              <Field.Label>{tOr('threads.titleLabel', {}, '')}</Field.Label>
              <Input
                name={field.name}
                value={field.state.value}
                maxLength={THREAD_TITLE_BOUNDS.maxLength}
                onChange={(event) => field.handleChange(event.target.value)}
                onBlur={field.handleBlur}
              />
              <Field.Hint>
                {tOr(
                  'threads.counter',
                  { count: field.state.value.length, max: THREAD_TITLE_BOUNDS.maxLength },
                  ''
                )}
              </Field.Hint>
            </Field.Root>
          )}
        </form.Field>
        <form.Field name="body">
          {(field) => (
            <Field.Root>
              <Field.Label>{tOr('threads.bodyLabel', {}, '')}</Field.Label>
              <Textarea
                name={field.name}
                value={field.state.value}
                maxLength={THREAD_BODY_BOUNDS.maxLength}
                onChange={(event) => field.handleChange(event.target.value)}
                onBlur={field.handleBlur}
              />
              <Field.Hint>
                {tOr(
                  'threads.counter',
                  { count: field.state.value.length, max: THREAD_BODY_BOUNDS.maxLength },
                  ''
                )}
              </Field.Hint>
            </Field.Root>
          )}
        </form.Field>
      </ResponsiveModal.Body>
      <ResponsiveModal.Footer>
        <ResponsiveModal.Close asChild>
          <Button variant="ghost">{tOr('ui.cancel', {}, '')}</Button>
        </ResponsiveModal.Close>
        <form.Subscribe selector={(state) => isErr(validateThreadContent(state.values))}>
          {(invalid) => (
            <Button
              type="submit"
              variant="solid"
              loading={createThread.isPending}
              disabled={invalid}
            >
              {tOr('threads.submit', {}, '')}
            </Button>
          )}
        </form.Subscribe>
      </ResponsiveModal.Footer>
    </form>
  );
}

/** The form that starts a thread at a moment of the video: a title of 1 to 100 characters and up to 1000 of text. */
export function ThreadFormDialog(props: ThreadFormDialogProps) {
  const { tOr } = useT();
  const timeLabel = useTimeLabel();

  return (
    <ResponsiveModal.Root open={props.open} onOpenChange={props.onOpenChange}>
      <ResponsiveModal.Content>
        <ResponsiveModal.Title>{tOr('threads.formTitle', {}, '')}</ResponsiveModal.Title>
        <ResponsiveModal.Description>
          {tOr('threads.formDescription', { time: timeLabel(props.anchorMs) }, '')}
        </ResponsiveModal.Description>
        <ThreadForm {...props} />
      </ResponsiveModal.Content>
    </ResponsiveModal.Root>
  );
}

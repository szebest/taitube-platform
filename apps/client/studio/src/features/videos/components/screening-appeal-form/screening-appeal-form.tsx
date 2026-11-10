import { useT } from '@vp/intl-react';
import { Button, Field, Textarea, useToast } from '@vp/ui';
import { useState } from 'react';
import { useAppealScreening } from '#app/features/videos/hooks/use-appeal-screening';

const MESSAGE_MAX_LENGTH = 1000;

export interface ScreeningAppealFormProps {
  videoId: string;
}

/** The owner's appeal of a screening rejection: one message, required, and a toast when it was not sent. */
export function ScreeningAppealForm({ videoId }: ScreeningAppealFormProps) {
  const { tOr } = useT();
  const toast = useToast();
  const appeal = useAppealScreening(videoId);
  const [message, setMessage] = useState('');

  const submit = () =>
    appeal.mutate(message.trim(), {
      onError: () =>
        toast({ tone: 'danger', title: tOr('studio.creatorScreeningAppealFailed', {}, '') }),
    });

  return (
    <form
      className="flex flex-col gap-stack"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <Field.Root>
        <Field.Label>{tOr('studio.creatorScreeningAppealLabel', {}, '')}</Field.Label>
        <Textarea
          value={message}
          maxLength={MESSAGE_MAX_LENGTH}
          onChange={(event) => setMessage(event.target.value)}
        />
        <Field.Hint>{tOr('studio.creatorScreeningAppealHint', {}, '')}</Field.Hint>
      </Field.Root>
      <div>
        <Button
          type="submit"
          variant="solid"
          tone="accent"
          disabled={message.trim() === ''}
          loading={appeal.isPending}
        >
          {tOr('studio.creatorScreeningAppealSubmit', {}, '')}
        </Button>
      </div>
    </form>
  );
}

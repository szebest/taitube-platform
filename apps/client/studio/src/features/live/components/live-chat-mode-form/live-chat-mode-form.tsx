import type { LiveStreamView } from '@vp/api-contracts';
import { useT } from '@vp/intl-react';
import { useFailureToast } from '@vp/queries';
import { Button, Card, Field, Select, Switch, useToast } from '@vp/ui';
import { type FormEvent, useState } from 'react';
import { useUpdateLiveStream } from '#app/features/live/hooks/use-update-live-stream';

const SLOW_MODE_SECONDS = [0, 5, 10, 30, 60, 120, 300] as const;

export interface LiveChatModeFormProps {
  stream: LiveStreamView;
}

/** Slow mode and subscribers-only, saved on their own. Key it by the saved mode, so a save leaves it clean. */
export function LiveChatModeForm({ stream }: LiveChatModeFormProps) {
  const { tOr } = useT();
  const toast = useToast();
  const failureToast = useFailureToast();
  const update = useUpdateLiveStream(stream.id);
  const [slowModeSeconds, setSlowModeSeconds] = useState(stream.chat.slowModeSeconds);
  const [subscribersOnly, setSubscribersOnly] = useState(stream.chat.subscribersOnly);

  const dirty =
    slowModeSeconds !== stream.chat.slowModeSeconds ||
    subscribersOnly !== stream.chat.subscribersOnly;

  const save = (event: FormEvent) => {
    event.preventDefault();
    update.mutate(
      { chatSlowModeSeconds: slowModeSeconds, chatSubscribersOnly: subscribersOnly },
      {
        onSuccess: () => toast({ tone: 'success', title: tOr('studio.liveChatModeSaved', {}, '') }),
        onError: (error) => failureToast(tOr('studio.liveChatModeNotSaved', {}, ''), error),
      }
    );
  };

  return (
    <Card.Root asChild>
      <form aria-label={tOr('studio.liveChatModeTitle', {}, '')} noValidate onSubmit={save}>
        <Card.Header>
          <Card.Title asChild>
            <h2>{tOr('studio.liveChatModeTitle', {}, '')}</h2>
          </Card.Title>
          <Card.Description>{tOr('studio.liveChatModeDescription', {}, '')}</Card.Description>
        </Card.Header>
        <Card.Body className="flex flex-col gap-stack">
          <Field.Root>
            <Field.Label>{tOr('studio.liveSlowModeLabel', {}, '')}</Field.Label>
            <Select.Root
              value={String(slowModeSeconds)}
              onValueChange={(next) => setSlowModeSeconds(Number(next))}
            >
              <Select.Trigger>
                <Select.Value />
              </Select.Trigger>
              <Select.Content>
                {SLOW_MODE_SECONDS.map((seconds) => (
                  <Select.Item key={seconds} value={String(seconds)}>
                    {seconds === 0
                      ? tOr('studio.liveSlowModeOff', {}, '')
                      : tOr('studio.liveSlowModeSeconds', { seconds }, '')}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select.Root>
          </Field.Root>
          <Field.Root orientation="horizontal">
            <Field.Label>{tOr('studio.liveSubscribersOnly', {}, '')}</Field.Label>
            <Switch checked={subscribersOnly} onCheckedChange={setSubscribersOnly} />
          </Field.Root>
        </Card.Body>
        <Card.Footer>
          <Button type="submit" loading={update.isPending} disabled={!dirty}>
            {tOr('studio.liveChatModeSave', {}, '')}
          </Button>
        </Card.Footer>
      </form>
    </Card.Root>
  );
}

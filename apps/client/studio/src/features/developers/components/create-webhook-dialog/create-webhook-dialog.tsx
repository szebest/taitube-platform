import type { CreatedWebhookView } from '@vp/api-contracts';
import { WEBHOOK_EVENTS, type WebhookEvent } from '@vp/domain';
import { useT } from '@vp/intl-react';
import { useFailureToast } from '@vp/queries';
import { fromPromise, isOk } from '@vp/result';
import { Button, Checkbox, Field, Input, ResponsiveModal, useUiCopy } from '@vp/ui';
import { type FormEvent, useId, useState } from 'react';
import { useCreateWebhook } from '#app/features/developers/hooks/use-developer-mutations';
import { SecretStep } from '../secret-step/secret-step';

function EventChoice({
  event,
  chosen,
  onChange,
}: {
  event: WebhookEvent;
  chosen: boolean;
  onChange: (chosen: boolean) => void;
}) {
  const { tOr } = useT();
  const id = useId();

  return (
    <div className="flex items-start gap-inline">
      <Checkbox
        id={id}
        checked={chosen}
        aria-describedby={`${id}-hint`}
        onCheckedChange={(checked) => onChange(checked === true)}
        className="mt-0.5"
      />
      <span className="flex min-w-0 flex-col">
        <label htmlFor={id} className="text-body-sm text-fg">
          {tOr('studio.webhookEvent', { event }, event)}
        </label>
        <span id={`${id}-hint`} className="text-caption text-fg-muted">
          {tOr('studio.webhookEventHint', { event }, '')}
        </span>
      </span>
    </div>
  );
}

export interface CreateWebhookDialogProps {
  onClose: () => void;
}

/** An address and the events it hears about, then the signing secret shown once. */
export function CreateWebhookDialog({ onClose }: CreateWebhookDialogProps) {
  const { tOr } = useT();
  const { cancel } = useUiCopy();
  const showFailure = useFailureToast();
  const create = useCreateWebhook();
  const [url, setUrl] = useState('');
  const [events, setEvents] = useState<WebhookEvent[]>([]);
  const [tried, setTried] = useState(false);
  const [created, setCreated] = useState<CreatedWebhookView>();

  const urlMissing = url.trim().length === 0;
  const eventsMissing = events.length === 0;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setTried(true);
    if (urlMissing || eventsMissing) return;

    const made = await fromPromise(
      () => create.mutateAsync({ url: url.trim(), events }),
      (cause) => cause
    );
    if (isOk(made)) setCreated(made.value);
    else showFailure(tOr('studio.webhookCreateFailed', {}, ''), made.error);
  };

  return (
    <ResponsiveModal.Root open onOpenChange={(open) => !open && !created && onClose()}>
      <ResponsiveModal.Content size="md">
        {created ? (
          <SecretStep
            title={tOr('studio.webhookCreatedTitle', {}, '')}
            notice={tOr('studio.webhookSecretNotice', {}, '')}
            label={tOr('studio.webhookSecretLabel', {}, '')}
            saved={tOr('studio.webhookSecretSaved', {}, '')}
            secret={created.secret}
            onDone={onClose}
          />
        ) : (
          <form onSubmit={submit} noValidate>
            <ResponsiveModal.Header>
              <ResponsiveModal.Title>
                {tOr('studio.webhookDialogTitle', {}, '')}
              </ResponsiveModal.Title>
              <ResponsiveModal.Description>
                {tOr('studio.webhookDialogDescription', {}, '')}
              </ResponsiveModal.Description>
            </ResponsiveModal.Header>
            <ResponsiveModal.Body className="flex flex-col gap-stack">
              <Field.Root invalid={tried && urlMissing} required>
                <Field.Label>{tOr('studio.webhookUrl', {}, '')}</Field.Label>
                <Input
                  type="url"
                  inputMode="url"
                  value={url}
                  placeholder="https://"
                  onChange={(event) => setUrl(event.target.value)}
                />
                <Field.Hint>{tOr('studio.webhookUrlHint', {}, '')}</Field.Hint>
                {tried && urlMissing && (
                  <Field.Error>{tOr('studio.webhookUrlRequired', {}, '')}</Field.Error>
                )}
              </Field.Root>
              <fieldset className="m-0 flex min-w-0 flex-col gap-inline border-0 p-0">
                <legend className="mb-1 p-0 text-label text-fg">
                  {tOr('studio.webhookEvents', {}, '')}
                </legend>
                {WEBHOOK_EVENTS.map((event) => (
                  <EventChoice
                    key={event}
                    event={event}
                    chosen={events.includes(event)}
                    onChange={(chosen) =>
                      setEvents((held) =>
                        chosen ? [...held, event] : held.filter((other) => other !== event)
                      )
                    }
                  />
                ))}
              </fieldset>
              {tried && eventsMissing && (
                <p role="alert" className="m-0 text-caption text-danger-ink">
                  {tOr('studio.webhookEventsRequired', {}, '')}
                </p>
              )}
            </ResponsiveModal.Body>
            <ResponsiveModal.Footer>
              <Button variant="outline" type="button" onClick={onClose}>
                {cancel}
              </Button>
              <Button variant="solid" tone="accent" type="submit" loading={create.isPending}>
                {tOr('studio.webhookCreateSubmit', {}, '')}
              </Button>
            </ResponsiveModal.Footer>
          </form>
        )}
      </ResponsiveModal.Content>
    </ResponsiveModal.Root>
  );
}

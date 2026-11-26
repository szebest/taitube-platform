import { useT } from '@kit/intl-react';
import { assertNever, isErr } from '@kit/result';
import { Button, Field, Input, Select, useToast } from '@kit/ui';
import { useMutation } from '@tanstack/react-query';
import { SHARE_LINK_EXPIRIES, SHARE_LINK_LABEL_MAX_LENGTH, type ShareLinkExpiry } from '@vp/domain';
import { decideShareLink } from '@vp/domain-rules';
import { ErrorCodes } from '@vp/errors';
import { present, useApi, useFailureToast } from '@vp/queries';
import { type FormEvent, useState } from 'react';
import { createShareLinkMutationOptions } from '#app/features/videos/api/video-tool-mutations';

const DEFAULT_EXPIRY: ShareLinkExpiry = '7d';

export interface CreateShareLinkFormProps {
  videoId: string;
  /** The links still working, which the limit counts. */
  active: number;
}

/** A label and an expiry, checked against the share-link rule before the link is asked for. */
export function CreateShareLinkForm({ videoId, active }: CreateShareLinkFormProps) {
  const { tOr } = useT();
  const toast = useToast();
  const showFailure = useFailureToast();
  const create = useMutation(createShareLinkMutationOptions(useApi(), videoId));
  const [label, setLabel] = useState('');
  const [expiry, setExpiry] = useState<ShareLinkExpiry>(DEFAULT_EXPIRY);
  const [problem, setProblem] = useState<string | null>(null);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const decided = decideShareLink(
      { label, expiresIn: expiry },
      { videoId, active, now: new Date() }
    );
    if (isErr(decided)) {
      switch (decided.error.code) {
        case ErrorCodes.VALIDATION_FAILED:
          setProblem(tOr('studio.shareLinkLabelTooLong', { max: SHARE_LINK_LABEL_MAX_LENGTH }, ''));
          return;
        case ErrorCodes.SHARE_LINK_LIMIT:
          setProblem(tOr(present(decided.error).copy, {}, ''));
          return;
        default:
          return assertNever(decided.error, 'CreateShareLinkForm');
      }
    }
    setProblem(null);
    create.mutate(
      { label: decided.value.label ?? undefined, expiresIn: expiry },
      {
        onSuccess: () => {
          setLabel('');
          toast({ tone: 'success', title: tOr('studio.shareLinkCreated', {}, '') });
        },
        onError: (error) => showFailure(tOr('studio.shareLinkCreateFailed', {}, ''), error),
      }
    );
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-wrap items-end gap-stack">
      <Field.Root invalid={problem !== null} className="min-w-0 flex-1 basis-60">
        <Field.Label>{tOr('studio.shareLinkLabel', {}, '')}</Field.Label>
        <Input value={label} onChange={(event) => setLabel(event.target.value)} />
        <Field.Hint>
          {tOr('studio.shareLinkLabelHint', { max: SHARE_LINK_LABEL_MAX_LENGTH }, '')}
        </Field.Hint>
        {problem && <Field.Error>{problem}</Field.Error>}
      </Field.Root>
      <Field.Root className="basis-40">
        <Field.Label>{tOr('studio.shareLinkExpiry', {}, '')}</Field.Label>
        <Select.Root
          value={expiry}
          onValueChange={(next) => {
            const known = SHARE_LINK_EXPIRIES.find((option) => option === next);
            if (known) setExpiry(known);
          }}
        >
          <Select.Trigger>
            <Select.Value />
          </Select.Trigger>
          <Select.Content>
            {SHARE_LINK_EXPIRIES.map((option) => (
              <Select.Item key={option} value={option}>
                {tOr('studio.shareLinkExpiryOption', { expiry: option }, option)}
              </Select.Item>
            ))}
          </Select.Content>
        </Select.Root>
      </Field.Root>
      <Button type="submit" variant="solid" tone="accent" loading={create.isPending}>
        {tOr('studio.shareLinkCreate', {}, '')}
      </Button>
    </form>
  );
}

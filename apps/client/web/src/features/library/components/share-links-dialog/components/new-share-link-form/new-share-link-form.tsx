import { assertNever, isErr } from '@kit/result';
import { Button, Field, Input, Select } from '@kit/ui';
import { SHARE_LINK_EXPIRIES, SHARE_LINK_LABEL_MAX_LENGTH, type ShareLinkExpiry } from '@vp/domain';
import { decideShareLink } from '@vp/domain-rules';
import { ErrorCodes } from '@vp/errors';
import { present } from '@vp/queries';
import { type FormEvent, useState } from 'react';
import { useShareLinkChanges } from '#app/features/library/hooks/use-share-link-changes';
import { useT } from '#app/lib/messages';

const DEFAULT_EXPIRY: ShareLinkExpiry = '7d';

export interface NewShareLinkFormProps {
  playlistId: string;
  /** The links still working, which the limit counts. */
  active: number;
}

/** A label and one of the expiry presets a video's links offer, checked by the share-link rule first. */
export function NewShareLinkForm({ playlistId, active }: NewShareLinkFormProps) {
  const [label, setLabel] = useState('');
  const [expiry, setExpiry] = useState<ShareLinkExpiry>(DEFAULT_EXPIRY);
  const [problem, setProblem] = useState<string | null>(null);
  const { tOr } = useT();
  const { create } = useShareLinkChanges(playlistId);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const decided = decideShareLink(
      { label, expiresIn: expiry },
      { target: { targetType: 'playlist', targetId: playlistId }, active, now: new Date() }
    );
    if (isErr(decided)) {
      switch (decided.error.code) {
        case ErrorCodes.VALIDATION_FAILED:
          setProblem(tOr('playlistTools.labelTooLong', { max: SHARE_LINK_LABEL_MAX_LENGTH }, ''));
          return;
        case ErrorCodes.SHARE_LINK_LIMIT:
          setProblem(tOr(present(decided.error).copy, {}, ''));
          return;
        default:
          return assertNever(decided.error, 'NewShareLinkForm');
      }
    }

    setProblem(null);
    create.mutate(
      { label: decided.value.label ?? undefined, expiresIn: expiry },
      { onSuccess: () => setLabel('') }
    );
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-wrap items-end gap-stack">
      <Field.Root invalid={problem !== null} className="min-w-0 flex-1 basis-60">
        <Field.Label>{tOr('playlistTools.label', {}, '')}</Field.Label>
        <Input value={label} onChange={(event) => setLabel(event.target.value)} />
        <Field.Hint>
          {tOr('playlistTools.labelHint', { max: SHARE_LINK_LABEL_MAX_LENGTH }, '')}
        </Field.Hint>
        {problem && <Field.Error>{problem}</Field.Error>}
      </Field.Root>
      <Field.Root className="basis-40">
        <Field.Label>{tOr('playlistTools.expiresAfter', {}, '')}</Field.Label>
        <Select.Root
          value={expiry}
          onValueChange={(next) => {
            const known = SHARE_LINK_EXPIRIES.find((option) => option === next);
            if (known) setExpiry(known);
          }}
        >
          <Select.Trigger aria-label={tOr('playlistTools.expiresAfter', {}, '')}>
            <Select.Value />
          </Select.Trigger>
          <Select.Content>
            {SHARE_LINK_EXPIRIES.map((option) => (
              <Select.Item key={option} value={option}>
                {tOr('playlistTools.expiry', { expiry: option }, option)}
              </Select.Item>
            ))}
          </Select.Content>
        </Select.Root>
      </Field.Root>
      <Button type="submit" variant="solid" tone="accent" loading={create.isPending}>
        {tOr('playlistTools.createLink', {}, '')}
      </Button>
    </form>
  );
}

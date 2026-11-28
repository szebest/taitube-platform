import { Button, Field, Select, useToast } from '@kit/ui';
import {
  PLAYLIST_INVITE_DEFAULT_DAYS,
  PLAYLIST_INVITE_MAX_DAYS,
  PLAYLIST_INVITE_MAX_USES,
  type PlaylistCollaboratorRole,
} from '@vp/domain';
import { failureCode, present } from '@vp/queries';
import { type FormEvent, useId, useState } from 'react';
import { useCollaboratorChanges } from '#app/features/library/hooks/use-collaborator-changes';
import { useT } from '#app/lib/messages';
import { RoleSelect } from '../role-select/role-select';

const EXPIRY_DAYS = [1, 3, PLAYLIST_INVITE_DEFAULT_DAYS, 14, PLAYLIST_INVITE_MAX_DAYS] as const;
const USES = [1, 5, 10, PLAYLIST_INVITE_MAX_USES] as const;
const UNLIMITED = 'unlimited';

export interface InviteLinkFormProps {
  playlistId: string;
}

/** A link anyone signed in can join with, in a role, until it expires or is used up. */
export function InviteLinkForm({ playlistId }: InviteLinkFormProps) {
  const [role, setRole] = useState<PlaylistCollaboratorRole>('contributor');
  const [days, setDays] = useState<number>(PLAYLIST_INVITE_DEFAULT_DAYS);
  const [uses, setUses] = useState<number | null>(null);
  const titleId = useId();
  const { tOr } = useT();
  const showToast = useToast();
  const { createLink } = useCollaboratorChanges(playlistId);

  const problem = createLink.isError
    ? tOr(present({ code: failureCode(createLink.error) }).copy, {}, '')
    : null;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    createLink.mutate(
      { role, expiresInDays: days, maxUses: uses },
      {
        onSuccess: () =>
          showToast({ tone: 'success', title: tOr('playlistPeople.linkCreated', {}, '') }),
      }
    );
  };

  return (
    <form
      onSubmit={submit}
      noValidate
      aria-labelledby={titleId}
      className="flex flex-col gap-stack"
    >
      <h3 id={titleId} className="m-0 text-title">
        {tOr('playlistPeople.inviteLinkTitle', {}, '')}
      </h3>
      <div className="flex flex-wrap items-end gap-stack">
        <RoleSelect value={role} onChange={setRole} />
        <Field.Root className="basis-32">
          <Field.Label>{tOr('playlistPeople.expiresAfter', {}, '')}</Field.Label>
          <Select.Root value={String(days)} onValueChange={(next) => setDays(Number(next))}>
            <Select.Trigger aria-label={tOr('playlistPeople.expiresAfter', {}, '')}>
              <Select.Value />
            </Select.Trigger>
            <Select.Content>
              {EXPIRY_DAYS.map((count) => (
                <Select.Item key={count} value={String(count)}>
                  {tOr('playlistPeople.days', { count }, '')}
                </Select.Item>
              ))}
            </Select.Content>
          </Select.Root>
        </Field.Root>
        <Field.Root className="basis-32">
          <Field.Label>{tOr('playlistPeople.maxUses', {}, '')}</Field.Label>
          <Select.Root
            value={uses === null ? UNLIMITED : String(uses)}
            onValueChange={(next) => setUses(next === UNLIMITED ? null : Number(next))}
          >
            <Select.Trigger aria-label={tOr('playlistPeople.maxUses', {}, '')}>
              <Select.Value />
            </Select.Trigger>
            <Select.Content>
              <Select.Item value={UNLIMITED}>{tOr('playlistPeople.unlimited', {}, '')}</Select.Item>
              {USES.map((count) => (
                <Select.Item key={count} value={String(count)}>
                  {tOr('playlistPeople.uses', { count }, '')}
                </Select.Item>
              ))}
            </Select.Content>
          </Select.Root>
        </Field.Root>
        <Button type="submit" variant="solid" tone="accent" loading={createLink.isPending}>
          {tOr('playlistPeople.createLink', {}, '')}
        </Button>
      </div>
      {problem && (
        <p role="alert" className="m-0 text-caption text-danger-ink">
          {problem}
        </p>
      )}
    </form>
  );
}

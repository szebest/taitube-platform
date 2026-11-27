import { isErr } from '@kit/result';
import { Button, Callout, Field, Input, Switch, useToast } from '@kit/ui';
import { useMutation } from '@tanstack/react-query';
import type { Video } from '@vp/api-contracts';
import { VIDEO_PASSWORD_MAX_LENGTH, VIDEO_PASSWORD_MIN_LENGTH } from '@vp/domain';
import { decideVideoPassword } from '@vp/domain-rules';
import { useApi, useFailureToast } from '@vp/queries';
import { type FormEvent, useState } from 'react';
import {
  clearPasswordMutationOptions,
  setPasswordMutationOptions,
} from '#app/features/videos/api/video-tool-mutations';
import { useT } from '#app/lib/messages';

const LENGTHS = { min: VIDEO_PASSWORD_MIN_LENGTH, max: VIDEO_PASSWORD_MAX_LENGTH };

/**
 * The password gate of an unlisted video. What is typed is sent once and never shown again; the
 * video only says whether one is set.
 */
export function VideoPasswordSection({ video }: { video: Video }) {
  const api = useApi();
  const { tOr } = useT();
  const toast = useToast();
  const showFailure = useFailureToast();
  const save = useMutation(setPasswordMutationOptions(api, video.id));
  const clear = useMutation(clearPasswordMutationOptions(api, video.id));
  const [drafting, setDrafting] = useState(false);
  const [password, setPassword] = useState('');
  const [problem, setProblem] = useState<string | null>(null);

  const unlisted = video.visibility === 'unlisted';
  const on = video.passwordProtected || drafting;
  const pending = save.isPending || clear.isPending;

  const close = () => {
    setDrafting(false);
    setPassword('');
    setProblem(null);
  };

  const remove = () =>
    clear.mutate(undefined, {
      onSuccess: () => {
        close();
        toast({ tone: 'success', title: tOr('studio.passwordRemoved', {}, '') });
      },
      onError: (error) => showFailure(tOr('studio.passwordRemoveFailed', {}, ''), error),
    });

  const toggle = (checked: boolean) => {
    if (checked) setDrafting(true);
    else if (video.passwordProtected) remove();
    else close();
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const decided = decideVideoPassword(password, video);
    if (isErr(decided)) {
      setProblem(
        decided.error.field === 'visibility'
          ? tOr('studio.passwordUnlistedOnly', {}, '')
          : tOr('studio.passwordInvalid', LENGTHS, '')
      );
      return;
    }
    save.mutate(decided.value, {
      onSuccess: () => {
        close();
        toast({ tone: 'success', title: tOr('studio.passwordSaved', {}, '') });
      },
      onError: (error) => showFailure(tOr('studio.passwordSaveFailed', {}, ''), error),
    });
  };

  return (
    <section className="flex flex-col gap-stack" aria-labelledby="video-password-title">
      <header className="flex flex-col gap-inline">
        <h2 id="video-password-title">{tOr('studio.passwordTitle', {}, '')}</h2>
        <p className="m-0 text-fg-muted">{tOr('studio.passwordDescription', {}, '')}</p>
      </header>
      <Field.Root orientation="horizontal">
        <Field.Label>{tOr('studio.passwordSwitch', {}, '')}</Field.Label>
        <Switch
          checked={on}
          disabled={pending || (!unlisted && !video.passwordProtected)}
          onCheckedChange={toggle}
        />
      </Field.Root>
      {!unlisted && (
        <p className="m-0 text-caption text-fg-muted">
          {tOr('studio.passwordUnlistedOnly', {}, '')}
        </p>
      )}
      {video.passwordProtected && (
        <p className="m-0 text-caption text-fg-muted">{tOr('studio.passwordOn', {}, '')}</p>
      )}
      {on && (
        <form onSubmit={submit} noValidate className="flex flex-wrap items-end gap-stack">
          <Field.Root invalid={problem !== null} className="min-w-0 flex-1 basis-60">
            <Field.Label>{tOr('studio.passwordField', {}, '')}</Field.Label>
            <Input
              type="password"
              autoComplete="new-password"
              value={password}
              disabled={!unlisted}
              onChange={(event) => setPassword(event.target.value)}
            />
            <Field.Hint>{tOr('studio.passwordHint', LENGTHS, '')}</Field.Hint>
            {problem && <Field.Error>{problem}</Field.Error>}
          </Field.Root>
          <Button
            type="submit"
            variant="solid"
            tone="accent"
            disabled={!unlisted || clear.isPending}
            loading={save.isPending}
          >
            {tOr('studio.passwordSave', {}, '')}
          </Button>
          {video.passwordProtected && (
            <Button
              type="button"
              variant="outline"
              tone="danger"
              disabled={save.isPending}
              loading={clear.isPending}
              onClick={remove}
            >
              {tOr('studio.passwordRemove', {}, '')}
            </Button>
          )}
        </form>
      )}
      <Callout.Root tone="info">
        <Callout.Icon />
        <Callout.Title>{tOr('studio.accessGateTitle', {}, '')}</Callout.Title>
        <Callout.Body>{tOr('studio.accessGateBody', {}, '')}</Callout.Body>
      </Callout.Root>
    </section>
  );
}

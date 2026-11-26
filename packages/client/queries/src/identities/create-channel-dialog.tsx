import { useT } from '@kit/intl-react';
import { fromPromise, isOk } from '@kit/result';
import { Button, Dialog, Field, Input, useToast, useUiCopy } from '@kit/ui';
import { useMutation } from '@tanstack/react-query';
import type { CreateChannelBody } from '@vp/api-contracts';
import { useActionState } from 'react';
import { useApi } from '../api-provider';
import { failureCode } from '../failure-code';
import { present } from '../present-failure';
import { identityKeys } from './identity-queries';

/** Creates a channel the viewer owns (`POST /v1/me/channels`) and lists it at once in the switcher. */
function useCreateChannel() {
  const api = useApi();

  return useMutation({
    mutationFn: (body: CreateChannelBody) => api.myChannels.createMyChannel({ body }),
    onSuccess: (_created, _body, _context, { client }) =>
      client.invalidateQueries({ queryKey: identityKeys.all }),
  });
}

/**
 * The new channel form: a handle and a name. The API holds the rules (the handle's format, one
 * already taken, the cap of owned channels), and a refusal is said under the form in its words.
 */
export function CreateChannelDialog({ onClose }: { onClose: () => void }) {
  const { tOr } = useT();
  const { cancel } = useUiCopy();
  const toast = useToast();
  const create = useCreateChannel();

  const [refusal, submit, isPending] = useActionState(
    async (_last: string | undefined, form: FormData): Promise<string | undefined> => {
      const body = {
        handle: String(form.get('handle') ?? '').trim(),
        displayName: String(form.get('displayName') ?? '').trim(),
      };
      const created = await fromPromise(
        () => create.mutateAsync(body),
        (cause) => cause
      );
      if (!isOk(created)) return tOr(present({ code: failureCode(created.error) }).copy, {}, '');
      const name = created.value.displayName;
      toast({ tone: 'success', title: tOr('accounts.channelCreated', { name }, '') });
      onClose();
      return undefined;
    },
    undefined
  );

  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Content size="sm">
        <Dialog.Header>
          <Dialog.Title>{tOr('accounts.createChannelTitle', {}, '')}</Dialog.Title>
          <Dialog.Description>{tOr('accounts.createChannelBody', {}, '')}</Dialog.Description>
        </Dialog.Header>
        <form action={submit} className="flex flex-col gap-stack">
          <Dialog.Body className="flex flex-col gap-stack">
            <Field.Root required invalid={refusal !== undefined}>
              <Field.Label>{tOr('accounts.channelHandle', {}, '')}</Field.Label>
              <Field.Control>
                <Input name="handle" required autoComplete="off" spellCheck={false} />
              </Field.Control>
              {refusal && <Field.Error>{refusal}</Field.Error>}
            </Field.Root>
            <Field.Root required>
              <Field.Label>{tOr('accounts.channelName', {}, '')}</Field.Label>
              <Field.Control>
                <Input name="displayName" required maxLength={100} />
              </Field.Control>
            </Field.Root>
          </Dialog.Body>
          <Dialog.Footer>
            <Dialog.Close asChild>
              <Button variant="outline">{cancel}</Button>
            </Dialog.Close>
            <Button type="submit" variant="solid" loading={isPending}>
              {tOr('accounts.create', {}, '')}
            </Button>
          </Dialog.Footer>
        </form>
      </Dialog.Content>
    </Dialog.Root>
  );
}

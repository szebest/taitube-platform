import type { CreatedApiTokenView } from '@vp/api-contracts';
import {
  API_TOKEN_EXPIRIES,
  API_TOKEN_LIMITS,
  type ApiScope,
  type ApiTokenExpiry,
  DEFAULT_API_TOKEN_EXPIRY,
} from '@vp/domain';
import { useT } from '@vp/intl-react';
import { useFailureToast } from '@vp/queries';
import { fromPromise, isOk } from '@vp/result';
import { Button, Field, Input, ResponsiveModal, Select, useUiCopy } from '@vp/ui';
import { type FormEvent, useState } from 'react';
import { useCreateToken } from '#app/features/developers/hooks/use-developer-mutations';
import { SecretStep } from '../secret-step/secret-step';
import { TokenScopePicker } from '../token-scope-picker/token-scope-picker';

const EXPIRIES = Object.keys(API_TOKEN_EXPIRIES).filter((expiry): expiry is ApiTokenExpiry =>
  Object.hasOwn(API_TOKEN_EXPIRIES, expiry)
);

export interface CreateTokenDialogProps {
  onClose: () => void;
}

/** Names a token, picks how long it lives and what it may touch, then shows its secret once. */
export function CreateTokenDialog({ onClose }: CreateTokenDialogProps) {
  const { tOr } = useT();
  const { cancel } = useUiCopy();
  const showFailure = useFailureToast();
  const create = useCreateToken();
  const [name, setName] = useState('');
  const [expiry, setExpiry] = useState<ApiTokenExpiry>(DEFAULT_API_TOKEN_EXPIRY);
  const [scopes, setScopes] = useState<ApiScope[]>([]);
  const [tried, setTried] = useState(false);
  const [created, setCreated] = useState<CreatedApiTokenView>();

  const nameMissing = name.trim().length === 0;
  const scopesMissing = scopes.length === 0;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setTried(true);
    if (nameMissing || scopesMissing) return;

    const made = await fromPromise(
      () => create.mutateAsync({ name: name.trim(), expiry, scopes }),
      (cause) => cause
    );
    if (isOk(made)) setCreated(made.value);
    else showFailure(tOr('studio.tokenCreateFailed', {}, ''), made.error);
  };

  return (
    <ResponsiveModal.Root open onOpenChange={(open) => !open && !created && onClose()}>
      <ResponsiveModal.Content size="md">
        {created ? (
          <SecretStep
            title={tOr('studio.tokenCreatedTitle', {}, '')}
            notice={tOr('studio.tokenSecretNotice', {}, '')}
            label={tOr('studio.tokenSecretLabel', { name: created.name }, '')}
            saved={tOr('studio.tokenSecretSaved', {}, '')}
            secret={created.token}
            onDone={onClose}
          />
        ) : (
          <form onSubmit={submit} noValidate>
            <ResponsiveModal.Header>
              <ResponsiveModal.Title>
                {tOr('studio.tokenDialogTitle', {}, '')}
              </ResponsiveModal.Title>
              <ResponsiveModal.Description>
                {tOr('studio.tokenDialogDescription', {}, '')}
              </ResponsiveModal.Description>
            </ResponsiveModal.Header>
            <ResponsiveModal.Body className="flex flex-col gap-stack">
              <Field.Root invalid={tried && nameMissing} required>
                <Field.Label>{tOr('studio.tokenName', {}, '')}</Field.Label>
                <Input
                  value={name}
                  maxLength={API_TOKEN_LIMITS.nameMaxLength}
                  onChange={(event) => setName(event.target.value)}
                />
                <Field.Hint>
                  {tOr('studio.tokenNameHint', { max: API_TOKEN_LIMITS.nameMaxLength }, '')}
                </Field.Hint>
                {tried && nameMissing && (
                  <Field.Error>{tOr('studio.tokenNameRequired', {}, '')}</Field.Error>
                )}
              </Field.Root>
              <Field.Root>
                <Field.Label>{tOr('studio.tokenExpiry', {}, '')}</Field.Label>
                <Select.Root
                  value={expiry}
                  onValueChange={(next) => {
                    const known = EXPIRIES.find((option) => option === next);
                    if (known) setExpiry(known);
                  }}
                >
                  <Select.Trigger>
                    <Select.Value />
                  </Select.Trigger>
                  <Select.Content>
                    {EXPIRIES.map((option) => (
                      <Select.Item key={option} value={option}>
                        {tOr('studio.tokenExpiryOption', { expiry: option }, option)}
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select.Root>
              </Field.Root>
              <TokenScopePicker value={scopes} onValueChange={setScopes} />
              {tried && scopesMissing && (
                <p role="alert" className="m-0 text-caption text-danger-ink">
                  {tOr('studio.tokenScopesRequired', {}, '')}
                </p>
              )}
            </ResponsiveModal.Body>
            <ResponsiveModal.Footer>
              <Button variant="outline" type="button" onClick={onClose}>
                {cancel}
              </Button>
              <Button variant="solid" tone="accent" type="submit" loading={create.isPending}>
                {tOr('studio.tokenCreateSubmit', {}, '')}
              </Button>
            </ResponsiveModal.Footer>
          </form>
        )}
      </ResponsiveModal.Content>
    </ResponsiveModal.Root>
  );
}

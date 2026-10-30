import type { Channel } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { useAppForm } from '@vp/forms';
import { useT } from '@vp/intl-react';

import { useChannelValidators, validateHandleField } from '../forms/channel-field-validators';
import { failureCodeOf, useUpdateChannel } from '../hooks/use-update-channel';
import { ChannelTextField } from './channel-text-field';
import { CustomizationSection } from './customization-section';

/** The channel's name and handle, saved on their own. */
export function IdentitySection({ channel }: { channel: Channel }) {
  const { tOr } = useT();
  const validators = useChannelValidators();
  const update = useUpdateChannel();
  const form = useAppForm({
    defaultValues: { displayName: channel.displayName, handle: channel.handle },
    listeners: { onChange: () => update.reset() },
    onSubmit: ({ value, formApi }) =>
      update.mutate(
        { displayName: value.displayName.trim(), handle: value.handle.trim() },
        {
          onSuccess: ({ displayName, handle }) => formApi.reset({ displayName, handle }),
        }
      ),
  });

  const code = failureCodeOf(update.error);
  const handleRefusal =
    code === ErrorCodes.HANDLE_ALREADY_TAKEN
      ? tOr('errors.handleAlreadyTaken', {}, '')
      : code === ErrorCodes.INVALID_HANDLE_FORMAT
        ? tOr('errors.invalidHandleFormat', {}, '')
        : undefined;

  return (
    <CustomizationSection.Root
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <CustomizationSection.Header>
        <CustomizationSection.Title>
          {tOr('studio.identityTitle', {}, '')}
        </CustomizationSection.Title>
        <CustomizationSection.Description>
          {tOr('studio.identityDescription', {}, '')}
        </CustomizationSection.Description>
      </CustomizationSection.Header>
      <CustomizationSection.Body>
        <form.AppField name="displayName" validators={{ onChange: validators.displayName }}>
          {(field) => (
            <ChannelTextField field={field} label={tOr('studio.displayNameLabel', {}, '')} />
          )}
        </form.AppField>
        <form.AppField name="handle" validators={{ onChange: validateHandleField }}>
          {(field) => (
            <ChannelTextField
              field={field}
              label={tOr('studio.handleLabel', {}, '')}
              hint={tOr('studio.handleHint', {}, '')}
              refusal={handleRefusal}
            />
          )}
        </form.AppField>
      </CustomizationSection.Body>
      <form.Subscribe selector={({ canSubmit, isDirty }) => ({ canSubmit, isDirty })}>
        {({ canSubmit, isDirty }) => (
          <CustomizationSection.Footer
            saving={update.isPending}
            saved={update.isSuccess && !isDirty}
            failure={
              update.isError && handleRefusal === undefined
                ? tOr('studio.sectionNotSaved', {}, '')
                : undefined
            }
            disabled={!(canSubmit && isDirty)}
          />
        )}
      </form.Subscribe>
    </CustomizationSection.Root>
  );
}

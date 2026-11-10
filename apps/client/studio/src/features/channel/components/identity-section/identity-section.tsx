import type { ContractBody, OwnerChannel, updateMyChannel } from '@vp/api-contracts';
import { COUNTRIES, isCountryCode } from '@vp/domain';
import { type ErrorCode, ErrorCodes } from '@vp/errors';
import { useAppForm } from '@vp/forms';
import { Format, useFormat, useT } from '@vp/intl-react';
import { unwrapOr } from '@vp/result';
import { Callout, Field, Select } from '@vp/ui';
import { CustomizationSection } from '#app/components/section/customization-section';
import {
  useChannelValidators,
  validateContactEmailField,
  validateHandleField,
} from '#app/features/channel/forms/channel-field-validators';
import { failureCodeOf, useUpdateChannel } from '#app/features/channel/hooks/use-update-channel';
import { ChannelTextField } from '../channel-text-field/channel-text-field';

const NO_COUNTRY = 'none';

function valuesOf(channel: OwnerChannel) {
  return {
    displayName: channel.displayName,
    handle: channel.handle,
    bio: channel.bio ?? '',
    country: channel.country ?? NO_COUNTRY,
    contactEmail: channel.contactEmail ?? '',
  };
}

type Values = ReturnType<typeof valuesOf>;

function changesOf(value: Values, saved: Values): ContractBody<typeof updateMyChannel> {
  return {
    ...(value.displayName !== saved.displayName && { displayName: value.displayName.trim() }),
    ...(value.handle !== saved.handle && { handle: value.handle.trim() }),
    ...(value.bio !== saved.bio && { bio: orNull(value.bio) }),
    ...(value.country !== saved.country && {
      country: isCountryCode(value.country) ? value.country : null,
    }),
    ...(value.contactEmail !== saved.contactEmail && { contactEmail: orNull(value.contactEmail) }),
  };
}

const orNull = (value: string) => (value.trim() === '' ? null : value.trim());

/** Who the channel is: name, handle, description, country and the address viewers may ask for. */
export function IdentitySection({ channel }: { channel: OwnerChannel }) {
  const { tOr } = useT();
  const validators = useChannelValidators();
  const { format } = useFormat();
  const until =
    channel.handleChangeAvailableAt === null
      ? undefined
      : unwrapOr(format({ type: 'date', value: channel.handleChangeAvailableAt }), undefined);
  const update = useUpdateChannel();
  const form = useAppForm({
    defaultValues: valuesOf(channel),
    listeners: { onChange: () => update.reset() },
    onSubmit: ({ value, formApi }) =>
      update.mutate(changesOf(value, valuesOf(channel)), {
        onSuccess: (saved) => formApi.reset(valuesOf(saved)),
      }),
  });

  const code = failureCodeOf(update.error);
  const refusals: Partial<Record<ErrorCode, string>> = {
    [ErrorCodes.HANDLE_ALREADY_TAKEN]: tOr('errors.handleAlreadyTaken', {}, ''),
    [ErrorCodes.INVALID_HANDLE_FORMAT]: tOr('errors.invalidHandleFormat', {}, ''),
    [ErrorCodes.HANDLE_CHANGE_TOO_SOON]: tOr('errors.handleChangeTooSoon', {}, ''),
    [ErrorCodes.HANDLE_RESERVED]: tOr('errors.handleReserved', {}, ''),
  };
  const handleRefusal = code === undefined ? undefined : refusals[code];

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
        <Callout.Root tone="neutral">
          <Callout.Icon />
          <Callout.Body>
            {tOr('studio.handleCooldownNotice', {}, '')}
            {until !== undefined && ` ${tOr('studio.handleCooldownUntil', { date: until }, '')}`}
          </Callout.Body>
        </Callout.Root>
        <form.AppField name="bio" validators={{ onChange: validators.bio }}>
          {(field) => (
            <ChannelTextField field={field} label={tOr('studio.bioLabel', {}, '')} multiline />
          )}
        </form.AppField>
        <form.AppField name="country">
          {(field) => (
            <Field.Root>
              <Field.Label>{tOr('studio.countryLabel', {}, '')}</Field.Label>
              <Select.Root value={field.state.value} onValueChange={field.handleChange}>
                <Select.Trigger>
                  <Select.Value />
                </Select.Trigger>
                <Select.Content>
                  <Select.Item value={NO_COUNTRY}>{tOr('studio.countryNone', {}, '')}</Select.Item>
                  {COUNTRIES.map((country) => (
                    <Select.Item key={country} value={country}>
                      <Format
                        value={{ type: 'displayName', value: country, of: 'region' }}
                        fallback={country}
                      />
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select.Root>
            </Field.Root>
          )}
        </form.AppField>
        <form.AppField name="contactEmail" validators={{ onChange: validateContactEmailField }}>
          {(field) => (
            <ChannelTextField
              field={field}
              label={tOr('studio.contactEmailLabel', {}, '')}
              hint={tOr('studio.contactEmailHint', {}, '')}
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

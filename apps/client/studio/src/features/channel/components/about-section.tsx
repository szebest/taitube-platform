import type { Channel } from '@vp/api-contracts';
import { fieldError, useAppForm } from '@vp/forms';
import { useT } from '@vp/intl-react';
import { Button, Field, Input } from '@vp/ui';

import {
  useChannelValidators,
  validateLinksField,
  withoutBlankLinks,
} from '../forms/channel-field-validators';
import { useUpdateChannel } from '../hooks/use-update-channel';
import { ChannelTextField } from './channel-text-field';
import { CustomizationSection } from './customization-section';

const MAX_LINKS = 5;
const LINKS_LABEL_ID = 'channel-links-label';

function valuesOf({ bio, links }: Pick<Channel, 'bio' | 'links'>) {
  return { bio: bio ?? '', links };
}

/** The channel's description and the links it lists, saved on their own. */
export function AboutSection({ channel }: { channel: Channel }) {
  const { tOr } = useT();
  const validators = useChannelValidators();
  const update = useUpdateChannel();
  const form = useAppForm({
    defaultValues: valuesOf(channel),
    listeners: { onChange: () => update.reset() },
    onSubmit: ({ value, formApi }) =>
      update.mutate(
        {
          bio: value.bio.trim() === '' ? null : value.bio.trim(),
          links: withoutBlankLinks(value.links),
        },
        { onSuccess: (saved) => formApi.reset(valuesOf(saved)) }
      ),
  });

  return (
    <CustomizationSection.Root
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <CustomizationSection.Header>
        <CustomizationSection.Title>{tOr('studio.aboutTitle', {}, '')}</CustomizationSection.Title>
        <CustomizationSection.Description>
          {tOr('studio.aboutDescription', {}, '')}
        </CustomizationSection.Description>
      </CustomizationSection.Header>
      <CustomizationSection.Body>
        <form.AppField name="bio" validators={{ onChange: validators.bio }}>
          {(field) => (
            <ChannelTextField field={field} label={tOr('studio.bioLabel', {}, '')} multiline />
          )}
        </form.AppField>
        <form.AppField name="links" validators={{ onChange: validateLinksField }}>
          {(field) => {
            const links = field.state.value;
            const error = fieldError(field.state.meta);
            const change = (index: number, part: Partial<(typeof links)[number]>) =>
              field.handleChange(
                links.map((link, at) => (at === index ? { ...link, ...part } : link))
              );

            return (
              <Field.Root
                role="group"
                aria-labelledby={LINKS_LABEL_ID}
                invalid={error !== undefined}
              >
                <span id={LINKS_LABEL_ID} className="tw:text-label">
                  {tOr('studio.linksLabel', {}, '')}
                </span>
                {links.map((link, index) => (
                  <div
                    // biome-ignore lint/suspicious/noArrayIndexKey: rows have no identity beyond their place and are controlled by it.
                    key={index}
                    className="tw:flex tw:items-center tw:gap-inline"
                  >
                    <Input
                      aria-label={tOr('studio.linkTitleLabel', { position: index + 1 }, '')}
                      value={link.label}
                      onChange={(event) => change(index, { label: event.target.value })}
                    />
                    <Input
                      aria-label={tOr('studio.linkUrlLabel', { position: index + 1 }, '')}
                      value={link.url}
                      onChange={(event) => change(index, { url: event.target.value })}
                    />
                    <Button
                      variant="ghost"
                      onClick={() => field.handleChange(links.filter((_, at) => at !== index))}
                    >
                      {tOr('studio.removeLink', { position: index + 1 }, '')}
                    </Button>
                  </div>
                ))}
                {error !== undefined && <Field.Error>{error}</Field.Error>}
                <Button
                  variant="outline"
                  disabled={links.length >= MAX_LINKS}
                  onClick={() => field.handleChange([...links, { label: '', url: '' }])}
                >
                  {tOr('studio.addLink', {}, '')}
                </Button>
              </Field.Root>
            );
          }}
        </form.AppField>
      </CustomizationSection.Body>
      <form.Subscribe selector={({ canSubmit, isDirty }) => ({ canSubmit, isDirty })}>
        {({ canSubmit, isDirty }) => (
          <CustomizationSection.Footer
            saving={update.isPending}
            saved={update.isSuccess && !isDirty}
            failure={update.isError ? tOr('studio.sectionNotSaved', {}, '') : undefined}
            disabled={!(canSubmit && isDirty)}
          />
        )}
      </form.Subscribe>
    </CustomizationSection.Root>
  );
}

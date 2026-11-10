import type { OwnerChannel } from '@vp/api-contracts';
import { platformOfUrl } from '@vp/domain';
import { fieldError, useAppForm } from '@vp/forms';
import { useT } from '@vp/intl-react';
import { Button, Field, Input, PlatformIcon } from '@vp/ui';
import { CustomizationSection } from '#app/components/section/customization-section';
import {
  validateBannerLinkField,
  validateLinksField,
  withoutBlankLinks,
} from '#app/features/channel/forms/channel-field-validators';
import { useUpdateChannel } from '#app/features/channel/hooks/use-update-channel';

const MAX_LINKS = 8;
const LINKS_LABEL_ID = 'channel-links-label';

function valuesOf({ links, bannerLink }: Pick<OwnerChannel, 'links' | 'bannerLink'>) {
  return {
    links: links.map(({ label, url }) => ({ label, url })),
    bannerLink: bannerLink ?? { label: '', url: '' },
  };
}

function moved<T>(items: readonly T[], from: number, to: number): T[] {
  const next = [...items];
  const [item] = next.splice(from, 1);
  if (item !== undefined) next.splice(to, 0, item);
  return next;
}

/** The links on the About tab, in the order set, and the one button on the banner. */
export function LinksSection({ channel }: { channel: OwnerChannel }) {
  const { tOr } = useT();
  const update = useUpdateChannel();
  const form = useAppForm({
    defaultValues: valuesOf(channel),
    listeners: { onChange: () => update.reset() },
    onSubmit: ({ value, formApi }) => {
      const label = value.bannerLink.label.trim();
      const url = value.bannerLink.url.trim();
      update.mutate(
        {
          links: withoutBlankLinks(value.links),
          bannerLink: label === '' && url === '' ? null : { label, url },
        },
        { onSuccess: (saved) => formApi.reset(valuesOf(saved)) }
      );
    },
  });

  return (
    <CustomizationSection.Root
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <CustomizationSection.Header>
        <CustomizationSection.Title>{tOr('studio.linksTitle', {}, '')}</CustomizationSection.Title>
        <CustomizationSection.Description>
          {tOr('studio.linksDescription', {}, '')}
        </CustomizationSection.Description>
      </CustomizationSection.Header>
      <CustomizationSection.Body>
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
                <span id={LINKS_LABEL_ID} className="text-label">
                  {tOr('studio.linksLabel', {}, '')}
                </span>
                {links.map((link, index) => (
                  <div
                    // oxlint-disable-next-line react/no-array-index-key -- rows have no identity beyond their place and are controlled by it.
                    key={index}
                    className="flex items-center gap-inline"
                  >
                    <PlatformIcon
                      platform={platformOfUrl(link.url.trim())}
                      aria-label={tOr(
                        'studio.linkPlatform',
                        { platform: platformOfUrl(link.url.trim()) },
                        ''
                      )}
                    />
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
                      disabled={index === 0}
                      onClick={() => field.handleChange(moved(links, index, index - 1))}
                    >
                      {tOr('studio.moveLinkUp', { position: index + 1 }, '')}
                    </Button>
                    <Button
                      variant="ghost"
                      disabled={index === links.length - 1}
                      onClick={() => field.handleChange(moved(links, index, index + 1))}
                    >
                      {tOr('studio.moveLinkDown', { position: index + 1 }, '')}
                    </Button>
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
        <form.AppField name="bannerLink" validators={{ onChange: validateBannerLinkField }}>
          {(field) => {
            const error = fieldError(field.state.meta);
            const { label, url } = field.state.value;

            return (
              <Field.Root invalid={error !== undefined}>
                <span className="text-label">{tOr('studio.bannerLinkTitle', {}, '')}</span>
                <div className="flex items-center gap-inline">
                  <Input
                    aria-label={tOr('studio.bannerLinkLabel', {}, '')}
                    value={label}
                    onChange={(event) => field.handleChange({ label: event.target.value, url })}
                  />
                  <Input
                    aria-label={tOr('studio.bannerLinkUrl', {}, '')}
                    value={url}
                    onChange={(event) => field.handleChange({ label, url: event.target.value })}
                  />
                </div>
                <Field.Hint>{tOr('studio.bannerLinkHint', {}, '')}</Field.Hint>
                {error !== undefined && <Field.Error>{error}</Field.Error>}
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

import { useQuery } from '@tanstack/react-query';
import type { ChannelSpotlightSettings } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { FALLBACK_LOCALE, SUPPORTED_LOCALES } from '@vp/intl';
import { Format, useFormat, useT } from '@vp/intl-react';
import { useApi } from '@vp/queries';
import { unwrapOr } from '@vp/result';
import { Field, Tabs, Textarea } from '@vp/ui';
import { useState } from 'react';
import { spotlightQueryOptions } from '#app/features/channel/api/channel-spotlight';
import { useSaveSpotlight } from '#app/features/channel/hooks/use-save-spotlight';
import { failureCodeOf } from '#app/features/channel/hooks/use-update-channel';
import { useActiveChannel } from '#app/hooks/use-active-channel';
import { CustomizationSection } from '../customization-section/customization-section';
import { SpotlightVideoPicker } from '../spotlight-video-picker/spotlight-video-picker';

const OTHER_LOCALES = SUPPORTED_LOCALES.filter((locale) => locale !== FALLBACK_LOCALE);

type Localization = ChannelSpotlightSettings['localizations'][number];

const emptyLocalization = (locale: string): Localization => ({
  locale,
  description: null,
  trailerVideoId: null,
});

function SpotlightEditor({ saved }: { saved: ChannelSpotlightSettings }) {
  const { tOr } = useT();
  const { format } = useFormat();
  const languageName = (locale: string) =>
    unwrapOr(format({ type: 'displayName', value: locale, of: 'language' }), locale);
  const save = useSaveSpotlight();
  const [draft, setDraft] = useState(saved);
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const edit = (next: ChannelSpotlightSettings) => {
    save.reset();
    setDraft(next);
  };
  const localization = (locale: string) =>
    draft.localizations.find((row) => row.locale === locale) ?? emptyLocalization(locale);
  const editLocalization = (locale: string, part: Partial<Localization>) => {
    const next = { ...localization(locale), ...part };
    const empty = next.description === null && next.trailerVideoId === null;
    edit({
      ...draft,
      localizations: [
        ...draft.localizations.filter((row) => row.locale !== locale),
        ...(empty ? [] : [next]),
      ],
    });
  };
  const refused = failureCodeOf(save.error) === ErrorCodes.INVALID_SPOTLIGHT_VIDEO;

  return (
    <CustomizationSection.Root
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate(draft);
      }}
    >
      <CustomizationSection.Header>
        <CustomizationSection.Title>
          {tOr('studio.spotlightTitle', {}, '')}
        </CustomizationSection.Title>
        <CustomizationSection.Description>
          {tOr('studio.spotlightDescription', {}, '')}
        </CustomizationSection.Description>
      </CustomizationSection.Header>
      <CustomizationSection.Body>
        <Tabs.Root defaultValue="default">
          <Tabs.List aria-label={tOr('studio.spotlightLanguages', {}, '')}>
            <Tabs.Tab value="default">{tOr('studio.spotlightDefault', {}, '')}</Tabs.Tab>
            {OTHER_LOCALES.map((locale) => (
              <Tabs.Tab key={locale} value={locale}>
                <Format
                  value={{ type: 'displayName', value: locale, of: 'language' }}
                  fallback={locale}
                />
              </Tabs.Tab>
            ))}
          </Tabs.List>
          <Tabs.Panel value="default" className="flex flex-col gap-stack">
            <SpotlightVideoPicker
              label={tOr('studio.spotlightTrailer', {}, '')}
              videoId={draft.trailerVideoId}
              onChange={(trailerVideoId) => edit({ ...draft, trailerVideoId })}
            />
            <SpotlightVideoPicker
              label={tOr('studio.spotlightReturning', {}, '')}
              videoId={draft.returningVideoId}
              onChange={(returningVideoId) => edit({ ...draft, returningVideoId })}
            />
          </Tabs.Panel>
          {OTHER_LOCALES.map((locale) => {
            const language = languageName(locale);
            const row = localization(locale);

            return (
              <Tabs.Panel key={locale} value={locale} className="flex flex-col gap-stack">
                <Field.Root>
                  <Field.Label>
                    {tOr('studio.spotlightLocaleDescription', { language }, '')}
                  </Field.Label>
                  <Textarea
                    value={row.description ?? ''}
                    onChange={(event) =>
                      editLocalization(locale, {
                        description: event.target.value === '' ? null : event.target.value,
                      })
                    }
                  />
                  <Field.Hint>{tOr('studio.spotlightLocaleHint', {}, '')}</Field.Hint>
                </Field.Root>
                <SpotlightVideoPicker
                  label={tOr('studio.spotlightLocaleTrailer', { language }, '')}
                  videoId={row.trailerVideoId}
                  onChange={(trailerVideoId) => editLocalization(locale, { trailerVideoId })}
                />
              </Tabs.Panel>
            );
          })}
        </Tabs.Root>
      </CustomizationSection.Body>
      <CustomizationSection.Footer
        saving={save.isPending}
        saved={save.isSuccess && !dirty}
        failure={
          save.isError
            ? tOr(refused ? 'studio.spotlightInvalid' : 'studio.sectionNotSaved', {}, '')
            : undefined
        }
        disabled={!dirty}
      />
    </CustomizationSection.Root>
  );
}

/** The trailer visitors see, the video subscribers see, and each language's own description and trailer. */
export function SpotlightSection() {
  const { channelId } = useActiveChannel();
  const { data } = useQuery(spotlightQueryOptions(useApi(), channelId));

  return data === undefined ? null : <SpotlightEditor key={channelId} saved={data} />;
}

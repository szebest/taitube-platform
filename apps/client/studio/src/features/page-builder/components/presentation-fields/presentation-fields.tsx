import { Field, Input, Switch } from '@kit/ui';
import { type LayoutSection, SECTION_DENSITIES } from '@vp/domain';
import { useT } from '#app/lib/messages';
import { LabelledSelect } from '../labelled-select/labelled-select';

export interface PresentationFieldsProps {
  section: LayoutSection;
  onChange: (section: LayoutSection) => void;
}

const SHOWN = ['duration', 'views', 'date'] as const;

const textOf = (text: { default: string } | null): string => text?.default ?? '';

const localized = (text: string) => (text === '' ? null : { default: text });

/** What the section is called, how dense it is and what each card shows. */
export function PresentationFields({ section, onChange }: PresentationFieldsProps) {
  const { tOr } = useT();
  const { presentation } = section;
  const change = (changes: Partial<typeof presentation>) =>
    onChange({ ...section, presentation: { ...presentation, ...changes } });

  return (
    <>
      <Field.Root>
        <Field.Label>{tOr('studio.pageTitleLabel', {}, '')}</Field.Label>
        <Input
          maxLength={120}
          value={textOf(presentation.title)}
          onChange={({ target }) => change({ title: localized(target.value) })}
        />
      </Field.Root>
      <Field.Root>
        <Field.Label>{tOr('studio.pageSubtitleLabel', {}, '')}</Field.Label>
        <Input
          maxLength={120}
          value={textOf(presentation.subtitle)}
          onChange={({ target }) => change({ subtitle: localized(target.value) })}
        />
      </Field.Root>
      <LabelledSelect
        label={tOr('studio.pageDensityLabel', {}, '')}
        value={presentation.density}
        options={SECTION_DENSITIES.map((density) => ({
          value: density,
          label: tOr('studio.pageDensityOption', { density }, ''),
        }))}
        onValueChange={(value) => {
          const density = SECTION_DENSITIES.find((known) => known === value);
          if (density) {
            change({ density });
          }
        }}
      />
      {section.kind === 'content' &&
        SHOWN.map((flag) => (
          <Field.Root key={flag} orientation="horizontal">
            <Field.Label>{tOr('studio.pageShowFlag', { field: flag }, '')}</Field.Label>
            <Switch
              checked={presentation.show[flag]}
              onCheckedChange={(checked) =>
                change({ show: { ...presentation.show, [flag]: checked } })
              }
            />
          </Field.Root>
        ))}
    </>
  );
}

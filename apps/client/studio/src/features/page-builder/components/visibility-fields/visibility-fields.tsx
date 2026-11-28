import { Field, Switch } from '@kit/ui';
import { LAYOUT_AUDIENCES, type LayoutSection } from '@vp/domain';
import { useT } from '#app/lib/messages';
import { LabelledSelect } from '../labelled-select/labelled-select';

export interface VisibilityFieldsProps {
  section: LayoutSection;
  onChange: (section: LayoutSection) => void;
}

/** Who sees the section, and whether it disappears when it has nothing to show. */
export function VisibilityFields({ section, onChange }: VisibilityFieldsProps) {
  const { tOr } = useT();

  return (
    <>
      <LabelledSelect
        label={tOr('studio.pageAudienceLabel', {}, '')}
        value={section.visibility.audience}
        options={LAYOUT_AUDIENCES.map((audience) => ({
          value: audience,
          label: tOr('studio.pageAudienceOption', { audience }, ''),
        }))}
        onValueChange={(value) => {
          const audience = LAYOUT_AUDIENCES.find((known) => known === value);
          if (audience) {
            onChange({ ...section, visibility: { ...section.visibility, audience } });
          }
        }}
      />
      {section.kind === 'content' && (
        <Field.Root orientation="horizontal">
          <Field.Label>{tOr('studio.pageHideWhenEmpty', {}, '')}</Field.Label>
          <Switch
            checked={section.hideWhenEmpty}
            onCheckedChange={(hideWhenEmpty) => onChange({ ...section, hideWhenEmpty })}
          />
        </Field.Root>
      )}
    </>
  );
}

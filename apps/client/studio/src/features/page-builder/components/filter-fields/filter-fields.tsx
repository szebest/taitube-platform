import { Field, Input, Switch, TagInput } from '@kit/ui';
import { type ContentSection, LAYOUT_LIMITS } from '@vp/domain';
import {
  withDurationMinutes,
  withFilters,
  withLastDays,
} from '#app/features/page-builder/utils/content-edits';
import { useT } from '#app/lib/messages';

export interface FilterFieldsProps {
  section: ContentSection;
  onChange: (section: ContentSection) => void;
}

const SECONDS_PER_MINUTE = 60;

const minutesText = (seconds: number | null | undefined): string =>
  seconds === null || seconds === undefined ? '' : String(seconds / SECONDS_PER_MINUTE);

export function FilterFields({ section, onChange }: FilterFieldsProps) {
  const { tOr } = useT();
  const { filters } = section;

  return (
    <>
      <Field.Root>
        <Field.Label>{tOr('studio.pageFilterTags', {}, '')}</Field.Label>
        <TagInput
          value={filters.tags}
          max={LAYOUT_LIMITS.tags}
          placeholder={tOr('studio.pageFilterTagsPlaceholder', {}, '')}
          onValueChange={(tags) => onChange(withFilters(section, { tags }))}
        />
      </Field.Root>
      <Field.Root>
        <Field.Label>{tOr('studio.pageFilterLastDays', {}, '')}</Field.Label>
        <Input
          inputMode="numeric"
          value={filters.dateRange?.type === 'last_days' ? String(filters.dateRange.days) : ''}
          onChange={({ target }) => onChange(withLastDays(section, target.value))}
        />
      </Field.Root>
      <div className="flex gap-stack">
        <Field.Root className="flex-1">
          <Field.Label>{tOr('studio.pageFilterMinMinutes', {}, '')}</Field.Label>
          <Input
            inputMode="numeric"
            value={minutesText(filters.duration?.minSeconds)}
            onChange={({ target }) =>
              onChange(withDurationMinutes(section, 'minSeconds', target.value))
            }
          />
        </Field.Root>
        <Field.Root className="flex-1">
          <Field.Label>{tOr('studio.pageFilterMaxMinutes', {}, '')}</Field.Label>
          <Input
            inputMode="numeric"
            value={minutesText(filters.duration?.maxSeconds)}
            onChange={({ target }) =>
              onChange(withDurationMinutes(section, 'maxSeconds', target.value))
            }
          />
        </Field.Root>
      </div>
      <Field.Root orientation="horizontal">
        <Field.Label>{tOr('studio.pageFilterHideWatched', {}, '')}</Field.Label>
        <Switch
          checked={filters.hideWatched}
          onCheckedChange={(hideWatched) => onChange(withFilters(section, { hideWatched }))}
        />
      </Field.Root>
    </>
  );
}

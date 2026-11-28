import { Field, Slider } from '@kit/ui';
import { type ContentSection, GRID_COLUMNS, LAYOUT_LIMITS, SECTION_SORTS } from '@vp/domain';
import {
  isManualSource,
  isMasonryAllowed,
  LAYOUT_CHOICES,
  withColumns,
  withLayout,
} from '#app/features/page-builder/utils/content-edits';
import { useT } from '#app/lib/messages';
import { LabelledSelect } from '../labelled-select/labelled-select';

export interface LayoutFieldsProps {
  section: ContentSection;
  tabs: readonly { id: string; title: string }[];
  onChange: (section: ContentSection) => void;
}

const NO_SEE_ALL = 'none';

/** How the items are ordered and laid out, how many show and where "See all" leads. */
export function LayoutFields({ section, tabs, onChange }: LayoutFieldsProps) {
  const { tOr } = useT();
  const isHero = section.layout.type === 'hero';

  return (
    <>
      <LabelledSelect
        label={tOr('studio.pageSortLabel', {}, '')}
        value={section.sort}
        options={SECTION_SORTS.map((sort) => ({
          value: sort,
          label: tOr('studio.pageSortOption', { sort }, ''),
          disabled: sort === 'manual' && !isManualSource(section),
        }))}
        onValueChange={(sort) => {
          const next = SECTION_SORTS.find((known) => known === sort);
          if (next) {
            onChange({ ...section, sort: next });
          }
        }}
      />
      <LabelledSelect
        label={tOr('studio.pageLayoutLabel', {}, '')}
        value={section.layout.type}
        options={LAYOUT_CHOICES.map((layout) => ({
          value: layout,
          label: tOr('studio.pageLayoutOption', { type: layout }, ''),
          disabled: layout === 'masonry' && !isMasonryAllowed(section),
        }))}
        onValueChange={(value) => {
          const choice = LAYOUT_CHOICES.find((known) => known === value);
          if (choice) {
            onChange(withLayout(section, choice));
          }
        }}
      />
      {section.layout.type === 'grid' && (
        <Field.Root>
          <Field.Label>
            {tOr('studio.pageColumns', { count: section.layout.columns }, '')}
          </Field.Label>
          <Slider.Root
            min={GRID_COLUMNS.min}
            max={GRID_COLUMNS.max}
            step={1}
            value={[section.layout.columns]}
            onValueChange={([columns]) =>
              columns !== undefined && onChange(withColumns(section, columns))
            }
          >
            <Slider.Thumb aria-label={tOr('studio.pageColumnsLabel', {}, '')} />
          </Slider.Root>
        </Field.Root>
      )}
      <Field.Root>
        <Field.Label>{tOr('studio.pageItemCount', { count: section.itemCount }, '')}</Field.Label>
        <Slider.Root
          min={1}
          max={isHero ? 1 : LAYOUT_LIMITS.itemCount}
          step={1}
          disabled={isHero}
          value={[section.itemCount]}
          onValueChange={([itemCount]) =>
            itemCount !== undefined && onChange({ ...section, itemCount })
          }
        >
          <Slider.Thumb aria-label={tOr('studio.pageItemCountLabel', {}, '')} />
        </Slider.Root>
      </Field.Root>
      <LabelledSelect
        label={tOr('studio.pageSeeAll', {}, '')}
        value={section.seeAll ?? NO_SEE_ALL}
        options={[
          { value: NO_SEE_ALL, label: tOr('studio.pageSeeAllNone', {}, '') },
          ...tabs.map(({ id, title }) => ({ value: id, label: title })),
        ]}
        onValueChange={(value) =>
          onChange({ ...section, seeAll: value === NO_SEE_ALL ? null : value })
        }
      />
    </>
  );
}

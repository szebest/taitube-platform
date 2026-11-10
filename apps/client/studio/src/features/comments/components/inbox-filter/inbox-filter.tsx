import { CREATOR_INBOX_FILTERS, type CreatorInboxFilter } from '@vp/domain';
import { useT } from '@vp/intl-react';
import { FilterSelect } from '#app/components/table/filter-select';

export interface InboxFilterProps {
  value: CreatorInboxFilter;
  onChange: (filter: CreatorInboxFilter) => void;
}

const NARROWED = CREATOR_INBOX_FILTERS.filter((filter) => filter !== 'all');

/** Seven filters are too wide for a segmented control in the header, so the inbox picks one from a select; no choice is `all`. */
export function InboxFilter({ value, onChange }: InboxFilterProps) {
  const { tOr } = useT();

  return (
    <FilterSelect
      label={tOr('studio.commentsFilter', {}, '')}
      value={NARROWED.find((filter) => filter === value)}
      options={NARROWED.map((filter) => ({
        value: filter,
        label: tOr('studio.commentsFilterOption', { filter }, ''),
      }))}
      onChange={(next) => onChange(next ?? 'all')}
    />
  );
}

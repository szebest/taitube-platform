import { CREATOR_INBOX_FILTERS, type CreatorInboxFilter } from '@vp/domain';
import { useT } from '@vp/intl-react';
import { SegmentedControl } from '@vp/ui';

export interface InboxFilterProps {
  value: CreatorInboxFilter;
  onChange: (filter: CreatorInboxFilter) => void;
}

export function InboxFilter({ value, onChange }: InboxFilterProps) {
  const { tOr } = useT();

  return (
    <SegmentedControl.Root
      aria-label={tOr('studio.commentsFilter', {}, '')}
      value={value}
      onValueChange={(next) => {
        const filter = CREATOR_INBOX_FILTERS.find((known) => known === next);
        if (filter !== undefined) {
          onChange(filter);
        }
      }}
    >
      {CREATOR_INBOX_FILTERS.map((filter) => (
        <SegmentedControl.Item key={filter} value={filter}>
          {tOr('studio.commentsFilterOption', { filter }, '')}
        </SegmentedControl.Item>
      ))}
    </SegmentedControl.Root>
  );
}

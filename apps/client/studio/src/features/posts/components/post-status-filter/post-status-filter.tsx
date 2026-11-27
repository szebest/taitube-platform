import { SegmentedControl } from '@kit/ui';
import { POST_STATUSES, type PostStatus } from '@vp/domain';
import { useT } from '#app/lib/messages';

export interface PostStatusFilterProps {
  value: PostStatus | undefined;
  onChange: (status: PostStatus | undefined) => void;
}

const FILTERS = ['all', ...POST_STATUSES] as const;

/** Every post, or the drafts, the scheduled or the published ones. */
export function PostStatusFilter({ value, onChange }: PostStatusFilterProps) {
  const { tOr } = useT();

  return (
    <SegmentedControl.Root
      aria-label={tOr('studio.postsFilter', {}, '')}
      value={value ?? 'all'}
      onValueChange={(next) => onChange(POST_STATUSES.find((status) => status === next))}
    >
      {FILTERS.map((filter) => (
        <SegmentedControl.Item key={filter} value={filter}>
          {tOr('studio.postsFilterOption', { filter }, '')}
        </SegmentedControl.Item>
      ))}
    </SegmentedControl.Root>
  );
}

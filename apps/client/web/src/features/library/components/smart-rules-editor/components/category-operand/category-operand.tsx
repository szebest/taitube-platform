import { Select } from '@kit/ui';
import { useQuery } from '@tanstack/react-query';
import { useApi } from '@vp/queries';
import { categoriesQueryOptions } from '#app/features/library/api/playlist-picker-queries';
import { useT } from '#app/lib/messages';

export interface CategoryOperandProps {
  categoryId: string | null;
  onPick: (categoryId: string) => void;
}

/** The category a condition matches, picked from the active ones. */
export function CategoryOperand({ categoryId, onPick }: CategoryOperandProps) {
  const { tOr } = useT();
  const categories = useQuery(categoriesQueryOptions(useApi()));

  return (
    <Select.Root value={categoryId ?? undefined} onValueChange={onPick}>
      <Select.Trigger aria-label={tOr('playlistTools.categoryLabel', {}, '')} className="min-w-40">
        <Select.Value placeholder={tOr('playlistTools.categoryLabel', {}, '')} />
      </Select.Trigger>
      <Select.Content>
        {(categories.data ?? []).map(({ id, name }) => (
          <Select.Item key={id} value={id}>
            {name}
          </Select.Item>
        ))}
      </Select.Content>
    </Select.Root>
  );
}

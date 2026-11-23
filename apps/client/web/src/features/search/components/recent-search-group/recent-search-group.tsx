import { Icon, IconButton } from '@kit/ui';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useApi } from '@vp/queries';
import { CommandPalette, keepEnterFromTheList } from '#app/components/shell/command-palette';
import { recentSearchesQueryOptions } from '#app/features/search/api/search-history-queries';
import { useRemoveRecentSearch } from '#app/features/search/hooks/use-remove-recent-search';
import { useCommandPaletteStore } from '#app/lib/command-palette/command-palette-store';
import { useT } from '#app/lib/messages';

/** The viewer's newest searches, each runnable and removable; nothing renders when there are none. */
export function RecentSearchGroup() {
  const api = useApi();
  const { data } = useQuery(recentSearchesQueryOptions(api));
  const { mutate: remove } = useRemoveRecentSearch();
  const { setOpen } = useCommandPaletteStore();
  const navigate = useNavigate();
  const { tOr } = useT();

  const entries = data?.items ?? [];
  if (entries.length === 0) {
    return null;
  }

  return (
    <CommandPalette.Group heading={tOr('search.group', { kind: 'recent' }, '')}>
      {entries.map((entry) => (
        <CommandPalette.Item
          key={entry.id}
          asChild
          value={`recent:${entry.id}`}
          leading={<Icon name="history" />}
          onSelect={() => {
            setOpen(false);
            navigate({ to: '/search', search: { q: entry.query } });
          }}
        >
          <div>
            <span className="min-w-0 flex-1 truncate">{entry.query}</span>
            <IconButton
              size="sm"
              aria-label={tOr('search.removeRecent', { query: entry.query }, '')}
              onKeyDown={keepEnterFromTheList}
              onClick={(event) => {
                event.stopPropagation();
                remove(entry.id);
              }}
            >
              <Icon name="close" />
            </IconButton>
          </div>
        </CommandPalette.Item>
      ))}
    </CommandPalette.Group>
  );
}

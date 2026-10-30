import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useT } from '@vp/intl-react';
import { useApi } from '@vp/queries';
import { Icon, IconButton } from '@vp/ui';

import { CommandPalette } from '#app/components/shell/command-palette';
import { recentSearchesQueryOptions } from '../api/search-history-queries';
import { useCommandPaletteStore } from '../command-palette-store';
import { useRemoveRecentSearch } from '../hooks/use-remove-recent-search';

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
            <span className="tw:min-w-0 tw:flex-1 tw:truncate">{entry.query}</span>
            <IconButton
              size="sm"
              aria-label={tOr('search.removeRecent', { query: entry.query }, '')}
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

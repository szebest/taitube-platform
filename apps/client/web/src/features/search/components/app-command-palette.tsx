import { useNavigate, useSearch } from '@tanstack/react-router';
import { SectionError } from '@vp/components';
import { useT } from '@vp/intl-react';
import { useAccount } from '@vp/queries';
import { Icon, useMediaQuery } from '@vp/ui';
import { useState } from 'react';

import { CommandPalette } from '#app/components/shell/command-palette';
import { useOpenDestination, useShellDestinations } from '#app/features/shell/shell-destinations';
import { useCommandPaletteStore } from '../command-palette-store';
import { useCommandActions } from '../hooks/use-command-actions';
import { useSearchSuggestions } from '../hooks/use-search-suggestions';
import { matchedTerms } from '../matched-terms';
import { type PaletteResult, paletteResultKey } from '../palette-results';
import { PaletteActionItem } from './palette-action-item';
import { PaletteResultItem } from './palette-result-item';
import { RecentSearchGroup } from './recent-search-group';

const DIALOG_FITS = '(min-width: 600px)';

/** The header's command palette: results as you type, the shell's places and actions, and the words go to the search page. */
export function AppCommandPalette() {
  const { open } = useCommandPaletteStore();
  const { q = '' } = useSearch({ strict: false });

  return <Palette key={open ? 'open' : 'closed'} initialQuery={q} />;
}

function Palette({ initialQuery }: { initialQuery: string }) {
  const { open, setOpen } = useCommandPaletteStore();
  const [query, setQuery] = useState(initialQuery);
  const dialogFits = useMediaQuery(DIALOG_FITS);
  const { main, you } = useShellDestinations();
  const openDestination = useOpenDestination();
  const account = useAccount();
  const actions = useCommandActions();
  const { groups, loading, failed, retry, searched } = useSearchSuggestions(query, open);
  const navigate = useNavigate();
  const { tOr } = useT();

  const words = query.trim();
  const named = words.toLowerCase();
  const terms = matchedTerms(words);
  const places = [...main, ...you].filter((place) => place.label.toLowerCase().includes(named));
  const matching = actions.filter((action) => action.label.toLowerCase().includes(named));

  const search = (text: string) => {
    setOpen(false);
    navigate({ to: '/search', search: { q: text } });
  };

  const results = (heading: 'video' | 'channel' | 'playlist' | 'query', hits: PaletteResult[]) =>
    hits.length > 0 && (
      <CommandPalette.Group heading={tOr('search.group', { kind: heading }, '')}>
        {hits.map((hit) => (
          <PaletteResultItem key={paletteResultKey(hit)} result={hit} terms={terms} />
        ))}
      </CommandPalette.Group>
    );

  const count =
    groups.videos.length + groups.channels.length + groups.playlists.length + groups.queries.length;

  return (
    <CommandPalette.Root
      open={open}
      onOpenChange={setOpen}
      query={query}
      onQueryChange={setQuery}
      onSubmitQuery={search}
      variant={dialogFits ? 'dialog' : 'sheet'}
    >
      <CommandPalette.Input />
      {loading && <CommandPalette.Loading />}
      {failed && (
        <CommandPalette.Notice>
          <SectionError.Root layout="bar" onRetry={retry} className="tw:flex-1">
            <SectionError.Message>{tOr('search.suggestionsFailed', {}, '')}</SectionError.Message>
          </SectionError.Root>
        </CommandPalette.Notice>
      )}
      <CommandPalette.List>
        {!words && account && <RecentSearchGroup />}
        {words && (
          <CommandPalette.Group heading={tOr('shell.search', {}, '')}>
            <CommandPalette.Item
              value="search"
              onSelect={() => search(words)}
              leading={<Icon name="search" />}
            >
              {tOr('search.searchFor', { query: words }, words)}
            </CommandPalette.Item>
          </CommandPalette.Group>
        )}
        {results('query', groups.queries)}
        {results('video', groups.videos)}
        {results('channel', groups.channels)}
        {results('playlist', groups.playlists)}
        {places.length > 0 && (
          <CommandPalette.Group heading={tOr('shell.goTo', {}, '')}>
            {places.map((place) => (
              <CommandPalette.Item
                key={place.id}
                value={`go:${place.id}`}
                onSelect={() => {
                  setOpen(false);
                  openDestination(place.target);
                }}
                leading={<Icon name={place.icon} />}
              >
                {place.label}
              </CommandPalette.Item>
            ))}
          </CommandPalette.Group>
        )}
        {searched && !loading && (
          <CommandPalette.Empty>
            {tOr('search.noResults', { query: words }, '')}
          </CommandPalette.Empty>
        )}
        {matching.length > 0 && (
          <CommandPalette.Group heading={tOr('search.group', { kind: 'action' }, '')}>
            {matching.map((action) => (
              <PaletteActionItem key={action.label} action={action} />
            ))}
          </CommandPalette.Group>
        )}
      </CommandPalette.List>
      {searched && !loading && (
        <CommandPalette.Status>{tOr('search.resultCount', { count }, '')}</CommandPalette.Status>
      )}
      <CommandPalette.Footer />
    </CommandPalette.Root>
  );
}

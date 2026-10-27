import { useNavigate, useSearch } from '@tanstack/react-router';
import { useT } from '@vp/intl-react';
import { Icon, useMediaQuery } from '@vp/ui';
import { useState } from 'react';

import { CommandPalette } from '#app/components/shell/command-palette';
import { useCommandPaletteStore } from '#app/features/search/command-palette-store';
import { useOpenDestination, useShellDestinations } from '#app/features/shell/shell-destinations';

const DIALOG_FITS = '(min-width: 600px)';

/** The header's command palette: the words go to the search page, and the shell's places match by name. */
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
  const navigate = useNavigate();
  const { tOr } = useT();

  const words = query.trim();
  const named = words.toLowerCase();
  const places = [...main, ...you].filter((place) => place.label.toLowerCase().includes(named));

  const search = (terms: string) => {
    setOpen(false);
    navigate({ to: '/search', search: { q: terms } });
  };

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
      <CommandPalette.List>
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
      </CommandPalette.List>
      <CommandPalette.Footer />
    </CommandPalette.Root>
  );
}

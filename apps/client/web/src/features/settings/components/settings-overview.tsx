import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { useT } from '@vp/intl-react';
import { Card, Icon, Input, InputGroup } from '@vp/ui';
import { useState } from 'react';

import { useSettingsIndex } from '../hooks/use-settings-index';
import { SETTINGS_SECTION_IDS, SETTINGS_SECTIONS } from '../settings-index';
import { searchSettings } from '../settings-search';

/** The `/settings` page: a search over every setting, and a card for each section when there is no search. */
export function SettingsOverview() {
  const { find = '' } = useSearch({ from: '/settings/' });
  const [query, setQuery] = useState(find);
  const navigate = useNavigate();
  const index = useSettingsIndex();
  const { tOr } = useT();

  const found = searchSettings(index, query);
  const searching = query.trim() !== '';

  const search = (text: string) => {
    setQuery(text);
    navigate({ to: '/settings', search: { find: text.trim() || undefined }, replace: true });
  };

  return (
    <>
      <h1 className="m-0 text-headline">{tOr('settings.title', {}, '')}</h1>
      <InputGroup.Root variant="soft" shape="pill">
        <InputGroup.Start>
          <Icon name="search" />
        </InputGroup.Start>
        <Input
          type="search"
          aria-label={tOr('settings.searchLabel', {}, '')}
          placeholder={tOr('settings.searchPlaceholder', {}, '')}
          value={query}
          onChange={(event) => search(event.target.value)}
        />
      </InputGroup.Root>
      {searching ? (
        <section aria-label={tOr('settings.searchLabel', {}, '')}>
          <p role="status" className="m-0 text-body-sm text-fg-muted">
            {found.length > 0
              ? tOr('settings.resultCount', { count: found.length }, '')
              : tOr('settings.noMatches', { query: query.trim() }, '')}
          </p>
          <ul className="m-0 flex list-none flex-col p-0">
            {found.map((entry) => (
              <li key={`${entry.section}.${entry.id}`}>
                <Link
                  to={entry.to}
                  hash={entry.id}
                  className="flex flex-col rounded-control p-inset-control text-fg no-underline focus-ring hover:bg-tint"
                >
                  <span className="text-label">{entry.label}</span>
                  <span className="text-body-sm text-fg-muted">{entry.sectionTitle}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <ul className="m-0 grid list-none gap-grid-y p-0 medium:grid-cols-2">
          {SETTINGS_SECTION_IDS.filter((id) => SETTINGS_SECTIONS[id].inNav).map((id) => {
            const { to, icon } = SETTINGS_SECTIONS[id];

            return (
              <li key={id}>
                <Card.Root asChild variant="outline" className="h-full">
                  <Link to={to}>
                    <Card.Header>
                      <Icon name={icon} size="md" />
                      <Card.Title>{tOr('settings.sectionTitle', { section: id }, '')}</Card.Title>
                    </Card.Header>
                    <Card.Description>
                      {tOr('settings.sectionSummary', { section: id }, '')}
                    </Card.Description>
                  </Link>
                </Card.Root>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

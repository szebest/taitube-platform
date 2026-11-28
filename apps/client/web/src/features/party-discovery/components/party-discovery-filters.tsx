import { Button, DropdownMenu, Field, Icon, Input, ResponsiveModal, Select, Switch } from '@kit/ui';
import { useQuery } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import {
  WATCH_PARTY_DISCOVERY_ACCESS,
  WATCH_PARTY_DISCOVERY_KINDS,
  WATCH_PARTY_DISCOVERY_SIZES,
  WATCH_PARTY_DISCOVERY_SORTS,
  WATCH_PARTY_DISCOVERY_STATUSES,
} from '@vp/domain';
import { type PartyDiscoveryFilters, useAccount, useApi } from '@vp/queries';
import { LOCALES } from '@vp/shared-messages/locales';
import { type SubmitEvent, useState } from 'react';
import { ChipBar } from '#app/components/discovery/chip-bar';
import { useT } from '#app/lib/messages';
import { partyCategoriesQueryOptions } from '../api/party-discovery-queries';
import type { DiscoverySearch } from '../utils/discovery-search';
import { isNarrowed } from '../utils/discovery-search';

const route = getRouteApi('/parties/');

const ANY = '__any__';

function pick<Option extends string>(
  options: readonly Option[],
  value: string
): Option | undefined {
  return options.find((option) => option === value);
}

export interface PartyDiscoveryFiltersProps {
  filters: PartyDiscoveryFilters;
}

/** Every filter is a search param, changed in place: the URL is the view, so a copied link opens the same one. */
export function PartyDiscoveryFilters({ filters }: PartyDiscoveryFiltersProps) {
  const navigate = route.useNavigate();
  const { tOr } = useT();
  const [text, setText] = useState(filters.q ?? '');

  const change = (patch: Partial<DiscoverySearch>) =>
    navigate({ search: (previous) => ({ ...previous, ...patch }), replace: true });

  const search = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    change({ q: text.trim() || undefined });
  };

  return (
    <div className="flex min-w-0 flex-col gap-stack">
      <form role="search" onSubmit={search} className="flex gap-inline">
        <Input
          type="search"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={tOr('party.discoverySearch', {}, '')}
          aria-label={tOr('party.discoverySearchLabel', {}, '')}
          className="min-w-0 flex-1"
        />
      </form>
      <div className="flex min-w-0 items-center gap-stack">
        <ChipBar.Root
          className="min-w-0 flex-1"
          aria-label={tOr('party.discoveryStatusLabel', {}, '')}
          value={filters.status}
          onValueChange={(next) => {
            const status = pick(WATCH_PARTY_DISCOVERY_STATUSES, String(next));
            if (status) change({ status: status === 'all' ? undefined : status });
          }}
        >
          {WATCH_PARTY_DISCOVERY_STATUSES.map((status) => (
            <ChipBar.Item key={status} value={status}>
              {tOr('party.discoveryStatus', { status }, '')}
            </ChipBar.Item>
          ))}
        </ChipBar.Root>
        <PartySortMenu sort={filters.sort} onChange={(sort) => change({ sort })} />
        <PartyFilterPanel filters={filters} onChange={change} />
      </div>
    </div>
  );
}

function PartySortMenu({
  sort,
  onChange,
}: {
  sort: PartyDiscoveryFilters['sort'];
  onChange: (sort: PartyDiscoveryFilters['sort'] | undefined) => void;
}) {
  const { tOr } = useT();

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button variant="soft" tone="neutral" size="sm" className="shrink-0">
          <Icon name="sort" />
          {tOr('party.discoverySort', { sort }, '')}
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="end">
        <DropdownMenu.Label>{tOr('party.discoverySortLabel', {}, '')}</DropdownMenu.Label>
        <DropdownMenu.RadioGroup
          value={sort}
          onValueChange={(next) => {
            const picked = pick(WATCH_PARTY_DISCOVERY_SORTS, next);
            if (picked) onChange(picked === 'members' ? undefined : picked);
          }}
        >
          {WATCH_PARTY_DISCOVERY_SORTS.map((option) => (
            <DropdownMenu.RadioItem key={option} value={option}>
              {tOr('party.discoverySort', { sort: option }, '')}
            </DropdownMenu.RadioItem>
          ))}
        </DropdownMenu.RadioGroup>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
}

interface PartyFilterPanelProps extends PartyDiscoveryFiltersProps {
  onChange: (patch: Partial<DiscoverySearch>) => void;
}

/** The filters beyond the status: a dialog on a wide screen, a sheet on a compact one. */
function PartyFilterPanel({ filters, onChange }: PartyFilterPanelProps) {
  const api = useApi();
  const account = useAccount();
  const { tOr } = useT();
  const { data: categories = [] } = useQuery(partyCategoriesQueryOptions(api));
  const [open, setOpen] = useState(false);

  const selectOf = <Option extends string>(
    label: string,
    value: Option | undefined,
    options: readonly Option[],
    labelOf: (option: Option) => string,
    anyLabel: string,
    set: (next: Option | undefined) => void,
    isAny: (option: Option) => boolean = () => false
  ) => (
    <Field.Root>
      <Field.Label>{label}</Field.Label>
      <Select.Root
        value={value ?? ANY}
        onValueChange={(next) => set(options.find((option) => option === next))}
      >
        <Select.Trigger>
          <Select.Value />
        </Select.Trigger>
        <Select.Content>
          <Select.Item value={ANY}>{anyLabel}</Select.Item>
          {options
            .filter((option) => !isAny(option))
            .map((option) => (
              <Select.Item key={option} value={option}>
                {labelOf(option)}
              </Select.Item>
            ))}
        </Select.Content>
      </Select.Root>
    </Field.Root>
  );

  const switchOf = (label: string, checked: boolean, set: (next: true | undefined) => void) => (
    <label className="flex items-center justify-between gap-stack text-body">
      {label}
      <Switch checked={checked} onCheckedChange={(next) => set(next ? true : undefined)} />
    </label>
  );

  return (
    <ResponsiveModal.Root open={open} onOpenChange={setOpen}>
      <Button
        variant={isNarrowed({ ...filters, status: 'all', q: undefined }) ? 'solid' : 'soft'}
        tone={isNarrowed({ ...filters, status: 'all', q: undefined }) ? 'accent' : 'neutral'}
        size="sm"
        className="shrink-0"
        onClick={() => setOpen(true)}
      >
        <Icon name="filter" />
        {tOr('party.discoveryFilters', {}, '')}
      </Button>
      <ResponsiveModal.Content>
        <ResponsiveModal.Title>{tOr('party.discoveryFiltersTitle', {}, '')}</ResponsiveModal.Title>
        <ResponsiveModal.Body className="flex flex-col gap-stack">
          {selectOf(
            tOr('party.discoveryCategory', {}, ''),
            filters.category,
            categories.map(({ id }) => id),
            (id) => categories.find((category) => category.id === id)?.name ?? '',
            tOr('party.discoveryAnyCategory', {}, ''),
            (category) => onChange({ category })
          )}
          {selectOf(
            tOr('party.discoveryLanguage', {}, ''),
            LOCALES.tags.find((tag) => tag === filters.language),
            LOCALES.tags,
            (language) => tOr('party.discoveryLanguageName', { language }, ''),
            tOr('party.discoveryAnyLanguage', {}, ''),
            (language) => onChange({ language })
          )}
          {selectOf(
            tOr('party.discoveryAccess', {}, ''),
            filters.access === 'any' ? undefined : filters.access,
            WATCH_PARTY_DISCOVERY_ACCESS,
            (access) => tOr('party.discoveryAccessOption', { kind: access }, ''),
            tOr('party.discoveryAccessOption', { kind: 'any' }, ''),
            (access) => onChange({ access }),
            (access) => access === 'any'
          )}
          {selectOf(
            tOr('party.discoverySize', {}, ''),
            filters.size === 'any' ? undefined : filters.size,
            WATCH_PARTY_DISCOVERY_SIZES,
            (size) => tOr('party.discoverySizeOption', { size }, ''),
            tOr('party.discoverySizeOption', { size: 'any' }, ''),
            (size) => onChange({ size }),
            (size) => size === 'any'
          )}
          {selectOf(
            tOr('party.discoveryKind', {}, ''),
            filters.kind === 'any' ? undefined : filters.kind,
            WATCH_PARTY_DISCOVERY_KINDS,
            (kind) => tOr('party.discoveryKindOption', { kind }, ''),
            tOr('party.discoveryKindOption', { kind: 'any' }, ''),
            (kind) => onChange({ kind }),
            (kind) => kind === 'any'
          )}
          {switchOf(tOr('party.discoverySpace', {}, ''), filters.space, (space) =>
            onChange({ space })
          )}
          {account &&
            switchOf(tOr('party.discoveryFollowed', {}, ''), filters.followed, (followed) =>
              onChange({ followed })
            )}
          {switchOf(tOr('party.discoveryCreator', {}, ''), filters.creator, (creator) =>
            onChange({ creator })
          )}
        </ResponsiveModal.Body>
        <ResponsiveModal.Footer>
          <ResponsiveModal.Close asChild>
            <Button>{tOr('party.discoveryApply', {}, '')}</Button>
          </ResponsiveModal.Close>
        </ResponsiveModal.Footer>
      </ResponsiveModal.Content>
    </ResponsiveModal.Root>
  );
}

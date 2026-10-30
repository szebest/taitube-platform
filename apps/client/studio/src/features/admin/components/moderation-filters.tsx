import { getRouteApi } from '@tanstack/react-router';
import { useT } from '@vp/intl-react';
import { Button, Field, Input } from '@vp/ui';
import type { FormEvent } from 'react';
import { STATUS_OPTIONS, VISIBILITY_OPTIONS } from '#app/features/admin/api/moderation-search';
import { useAdminCategories } from '#app/features/admin/hooks/use-admin-categories';
import { FilterSelect } from './filter-select';

const route = getRouteApi('/_authed/admin/moderation');

/** The moderation table's filters; each one is a search param, so a link or a reload keeps them. */
export function ModerationFilters() {
  const { tOr } = useT();
  const search = route.useSearch();
  const navigate = route.useNavigate();
  const categories = useAdminCategories();

  const filter = (changes: Partial<typeof search>) =>
    navigate({ search: (previous) => ({ ...previous, ...changes }) });

  const searchTitles = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const typed = new FormData(event.currentTarget).get('q');
    filter({ q: typeof typed === 'string' ? typed.trim() || undefined : undefined });
  };

  return (
    <div className="tw:flex tw:flex-wrap tw:items-end tw:gap-stack">
      <search>
        <form onSubmit={searchTitles} className="tw:flex tw:items-end tw:gap-inline">
          <Field.Root>
            <Field.Label>{tOr('studio.adminVideosSearch', {}, '')}</Field.Label>
            <Input key={search.q ?? ''} name="q" defaultValue={search.q} maxLength={100} />
          </Field.Root>
          <Button type="submit" variant="outline">
            {tOr('studio.adminVideosSearchAction', {}, '')}
          </Button>
        </form>
      </search>
      <FilterSelect
        label={tOr('studio.adminFilterStatus', {}, '')}
        value={search.status}
        options={STATUS_OPTIONS.map((value) => ({
          value,
          label: tOr('studio.videoStatus', { status: value }, ''),
        }))}
        onChange={(status) => filter({ status })}
      />
      <FilterSelect
        label={tOr('studio.adminFilterVisibility', {}, '')}
        value={search.visibility}
        options={VISIBILITY_OPTIONS.map((value) => ({
          value,
          label: tOr('videos.visibility', { visibility: value }, ''),
        }))}
        onChange={(visibility) => filter({ visibility })}
      />
      <FilterSelect
        label={tOr('studio.adminFilterCategory', {}, '')}
        value={search.categoryId}
        options={(categories.data ?? []).map(({ id, name }) => ({ value: id, label: name }))}
        onChange={(categoryId) => filter({ categoryId })}
      />
    </div>
  );
}

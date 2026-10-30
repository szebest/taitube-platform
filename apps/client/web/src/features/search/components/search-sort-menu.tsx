import { getRouteApi } from '@tanstack/react-router';
import { SEARCH_SORTS } from '@vp/domain';
import { useT } from '@vp/intl-react';
import { Button, DropdownMenu, Icon } from '@vp/ui';

const route = getRouteApi('/search');

/** The sort menu: its choice is the `sort` search param, replaced rather than stacked. */
export function SearchSortMenu() {
  const { sort } = route.useLoaderDeps();
  const navigate = route.useNavigate();
  const { tOr } = useT();

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button variant="soft" tone="neutral" size="sm">
          <Icon name="sort" />
          {tOr('search.sort', { sort }, '')}
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="end">
        <DropdownMenu.Label>{tOr('search.sortLabel', {}, '')}</DropdownMenu.Label>
        <DropdownMenu.RadioGroup
          value={sort}
          onValueChange={(next) => {
            const picked = SEARCH_SORTS.find((option) => option === next);
            if (picked) {
              navigate({ search: (previous) => ({ ...previous, sort: picked }), replace: true });
            }
          }}
        >
          {SEARCH_SORTS.map((option) => (
            <DropdownMenu.RadioItem key={option} value={option}>
              {tOr('search.sort', { sort: option }, '')}
            </DropdownMenu.RadioItem>
          ))}
        </DropdownMenu.RadioGroup>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
}

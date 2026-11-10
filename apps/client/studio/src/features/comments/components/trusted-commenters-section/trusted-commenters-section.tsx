import { useInfiniteQuery } from '@tanstack/react-query';
import { useT } from '@vp/intl-react';
import {
  trustedCommentersQueryOptions,
  useApi,
  useFailureToast,
  useTrustCommenter,
} from '@vp/queries';
import { Button } from '@vp/ui';
import { LoadMore } from '#app/components/table/load-more';
import { pagedRows } from '#app/utils/paged-rows';
import { SettingsListSection } from '../settings-section/settings-section';

/** The commenters the automatic holds and limits skip, each with a way to stop trusting them. */
export function TrustedCommentersSection() {
  const { tOr } = useT();
  const showFailure = useFailureToast();
  const trust = useTrustCommenter();
  const trusted = useInfiniteQuery({
    ...trustedCommentersQueryOptions(useApi()),
    select: pagedRows,
  });
  const rows = trusted.data ?? [];

  return (
    <SettingsListSection
      title={tOr('studio.settingsTrustedTitle', {}, '')}
      description={tOr('studio.settingsTrustedDescription', {}, '')}
    >
      {trusted.isError && (
        <p role="alert" className="m-0 text-body-sm text-fg-muted">
          {tOr('studio.settingsTrustedFailed', {}, '')}
        </p>
      )}
      {trusted.isSuccess && rows.length === 0 && (
        <p className="m-0 text-body-sm text-fg-muted">
          {tOr('studio.settingsTrustedEmpty', {}, '')}
        </p>
      )}
      <ul className="m-0 flex list-none flex-col gap-inline p-0">
        {rows.map(({ userId, user }) => {
          const name = user?.displayName ?? user?.handle ?? userId;
          return (
            <li key={userId} className="flex items-center justify-between gap-inline">
              <span>{name}</span>
              <Button
                variant="ghost"
                size="sm"
                aria-label={tOr('studio.settingsTrustedRemove', { name }, '')}
                onClick={() =>
                  trust.mutate(
                    { userId, trusted: false },
                    {
                      onError: (error) =>
                        showFailure(tOr('studio.settingsTrustAuthorFailed', {}, ''), error),
                    }
                  )
                }
              >
                {tOr('studio.settingsRemove', {}, '')}
              </Button>
            </li>
          );
        })}
      </ul>
      <LoadMore
        hasNextPage={trusted.hasNextPage}
        fetching={trusted.isFetchingNextPage}
        onLoadMore={() => trusted.fetchNextPage()}
      />
    </SettingsListSection>
  );
}

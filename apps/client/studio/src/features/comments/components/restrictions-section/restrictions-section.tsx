import { useInfiniteQuery } from '@tanstack/react-query';
import { useFormat, useT } from '@vp/intl-react';
import { restrictionsQueryOptions, useApi, useFailureToast, useLiftRestriction } from '@vp/queries';
import { unwrapOr } from '@vp/result';
import { Badge, Button, useToast } from '@vp/ui';
import { LoadMore } from '#app/components/table/load-more';
import { useModerationChannel } from '#app/features/comments/hooks/use-moderation-channel';
import { pagedRows } from '#app/utils/paged-rows';
import { SettingsListSection } from '../settings-section/settings-section';

/** The shadow bans and bans in force, each with when it ends and a way to lift it. */
export function RestrictionsSection() {
  const { tOr } = useT();
  const { format } = useFormat();
  const showToast = useToast();
  const showFailure = useFailureToast();
  const { channelId } = useModerationChannel();
  const lift = useLiftRestriction();
  const restrictions = useInfiniteQuery({
    ...restrictionsQueryOptions(useApi()),
    select: pagedRows,
  });
  const rows = restrictions.data ?? [];

  const until = (expiresAt: string | null) =>
    expiresAt === null
      ? tOr('studio.settingsRestrictionForever', {}, '')
      : tOr(
          'studio.settingsRestrictionUntil',
          {
            date: unwrapOr(
              format({
                type: 'date',
                value: expiresAt,
                options: { year: 'numeric', month: 'short', day: 'numeric' },
              }),
              expiresAt
            ),
          },
          ''
        );

  return (
    <SettingsListSection
      title={tOr('studio.settingsRestrictionsTitle', {}, '')}
      description={tOr('studio.settingsRestrictionsDescription', {}, '')}
    >
      {restrictions.isError && (
        <p role="alert" className="m-0 text-body-sm text-fg-muted">
          {tOr('studio.settingsRestrictionsFailed', {}, '')}
        </p>
      )}
      {restrictions.isSuccess && rows.length === 0 && (
        <p className="m-0 text-body-sm text-fg-muted">
          {tOr('studio.settingsRestrictionsEmpty', {}, '')}
        </p>
      )}
      <ul className="m-0 flex list-none flex-col gap-stack p-0">
        {rows.map(({ userId, kind, reason, expiresAt, user }) => {
          const name = user?.displayName ?? user?.handle ?? userId;
          return (
            <li key={userId} className="flex flex-wrap items-center justify-between gap-inline">
              <span className="flex flex-col gap-inline">
                <span className="flex items-center gap-inline">
                  <span className="text-label">{name}</span>
                  <Badge size="sm" tone={kind === 'ban' ? 'danger' : 'warning'}>
                    {tOr('studio.settingsRestrictionKind', { kind }, '')}
                  </Badge>
                </span>
                <span className="text-caption text-fg-muted">
                  {kind === 'ban'
                    ? until(expiresAt)
                    : tOr('studio.settingsRestrictionForever', {}, '')}
                  {reason !== null && ` · ${reason}`}
                </span>
              </span>
              <Button
                variant="outline"
                size="sm"
                loading={lift.isPending && lift.variables.userId === userId}
                aria-label={tOr('studio.settingsRestrictionLiftLabel', { name }, '')}
                onClick={() =>
                  lift.mutate(
                    { channelId, userId },
                    {
                      onSuccess: () =>
                        showToast({
                          tone: 'success',
                          title: tOr('studio.settingsRestrictionLifted', {}, ''),
                        }),
                      onError: (error) =>
                        showFailure(tOr('studio.settingsRestrictionLiftFailed', {}, ''), error),
                    }
                  )
                }
              >
                {tOr('studio.settingsRestrictionLift', {}, '')}
              </Button>
            </li>
          );
        })}
      </ul>
      <LoadMore
        hasNextPage={restrictions.hasNextPage}
        fetching={restrictions.isFetchingNextPage}
        onLoadMore={() => restrictions.fetchNextPage()}
      />
    </SettingsListSection>
  );
}

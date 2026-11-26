import { Format, useT } from '@kit/intl-react';
import { Button } from '@kit/ui';
import { useInfiniteQuery } from '@tanstack/react-query';
import { publishedAt } from '@vp/intl-formats';
import { useApi } from '@vp/queries';
import { signInHistoryQueryOptions } from '#app/features/account/api/sign-in-history-queries';
import { SettingItem } from '../setting-item/setting-item';

/** Each time this account signed in, newest first: when, into which slot, and on what device. */
export function SignInHistoryRow() {
  const { tOr } = useT();
  const { data, hasNextPage, isFetchingNextPage, fetchNextPage } = useInfiniteQuery(
    signInHistoryQueryOptions(useApi())
  );
  const items = data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <SettingItem
      row="sign-in-history"
      stacked
      description={tOr('settings.rowDescription', { row: 'sign-in-history' }, '')}
    >
      {data && items.length === 0 && (
        <p className="m-0 text-body-sm text-fg-muted">{tOr('accounts.noSignIns', {}, '')}</p>
      )}
      <ul className="m-0 flex list-none flex-col gap-stack p-0">
        {items.map((signIn) => (
          <li key={signIn.id} className="flex flex-col">
            <time dateTime={signIn.createdAt} className="text-body-sm">
              <Format value={publishedAt(signIn.createdAt).relative} />
            </time>
            <span className="text-caption text-fg-muted">
              {signIn.slot === null
                ? ''
                : tOr('accounts.signInSlot', { slot: signIn.slot + 1 }, '')}{' '}
              {signIn.userAgent
                ? tOr('accounts.signInDevice', { device: signIn.userAgent }, '')
                : tOr('accounts.signInUnknownDevice', {}, '')}
            </span>
          </li>
        ))}
      </ul>
      {hasNextPage && (
        <Button
          variant="outline"
          size="sm"
          className="self-start"
          loading={isFetchingNextPage}
          onClick={() => void fetchNextPage()}
        >
          {tOr('accounts.loadMore', {}, '')}
        </Button>
      )}
    </SettingItem>
  );
}

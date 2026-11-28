import { useFormat } from '@kit/intl-react';
import { unwrapOr } from '@kit/result';
import type { Notification } from '@vp/api-contracts';
import { useT } from '#app/lib/messages';

type Watching = NonNullable<Notification['payload']['party']>['watching'];

/** "Ana, Tom and 3 others are watching", from who was watching when the invite was sent; `null` for an empty room. */
export function usePartyWatchingLine(): (watching: Watching) => string | null {
  const { format } = useFormat();
  const { tOr } = useT();

  return ({ names, count }) => {
    if (count === 0 || names.length === 0) {
      return null;
    }

    const others = count - names.length;
    const people =
      others > 0 ? [...names, tOr('party.inviteOthers', { count: others }, '')] : names;
    const listed = unwrapOr(format({ type: 'list', value: people }), people.join(', '));

    return tOr(
      count === 1 ? 'party.inviteWatchingOne' : 'party.inviteWatching',
      { names: listed },
      ''
    );
  };
}

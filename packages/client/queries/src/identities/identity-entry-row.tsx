import { IdentityRow } from '@kit/components';
import { useFormat } from '@kit/intl-react';
import { unwrapOr } from '@kit/result';
import { useT } from '../intl/shared-words';
import type { IdentityEntry } from './identity-entries';

function useDetail(entry: IdentityEntry): string {
  const { tOr } = useT();
  if (entry.expired) return tOr('accounts.expired', {}, '');
  if (entry.role) {
    const role = tOr('accounts.teamRole', { role: entry.role }, '');
    return entry.handle ? `${role} · @${entry.handle}` : role;
  }
  if (entry.glance?.kind === 'counted') {
    const { unread, newComments = 0 } = entry.glance;
    const said = [
      unread > 0 ? tOr('accounts.unread', { count: unread }, '') : '',
      newComments > 0 ? tOr('accounts.newComments', { count: newComments }, '') : '',
    ].filter(Boolean);
    return said.length > 0 ? said.join(' · ') : tOr('accounts.glanceNothing', {}, '');
  }
  return entry.handle ? `@${entry.handle}` : '';
}

/**
 * One identity drawn as a switcher row: its ring, name, a detail line (the handle, the team role,
 * what waits on another account, or that its session expired), the unread count and the check.
 */
export function IdentityEntryRow({
  entry,
  check = true,
}: {
  entry: IdentityEntry;
  /** Whether the row draws its own check; a menu's radio item draws one. */
  check?: boolean;
}) {
  const detail = useDetail(entry);
  const { format } = useFormat();
  const unread = entry.glance?.kind === 'counted' ? entry.glance.unread : 0;

  return (
    <IdentityRow.Root current={entry.current} expired={entry.expired}>
      <IdentityRow.Avatar name={entry.name} imageUrl={entry.avatarUrl} accent={entry.accent} />
      <IdentityRow.Text>
        <IdentityRow.Name>{entry.name}</IdentityRow.Name>
        {detail && <IdentityRow.Detail>{detail}</IdentityRow.Detail>}
      </IdentityRow.Text>
      {unread > 0 && (
        <IdentityRow.Unread aria-hidden="true">
          {unwrapOr(format({ type: 'count', value: unread }), '')}
        </IdentityRow.Unread>
      )}
      {check && <IdentityRow.Check />}
    </IdentityRow.Root>
  );
}

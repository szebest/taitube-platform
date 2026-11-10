import type { BulkActionBody } from '@vp/api-contracts';
import { banExpiry, type Disclosure } from '@vp/domain';
import { useT } from '@vp/intl-react';
import { useState } from 'react';
import { BulkActionBar } from '#app/components/comments/bulk-action-bar';
import { useBulkModeration } from '#app/features/comments/hooks/use-bulk-moderation';
import { useModerationAbilities } from '#app/features/comments/hooks/use-moderation-abilities';
import {
  ModerationReasonDialog,
  type ModerationReason,
  type ReasonedAction,
} from '../moderation-reason-dialog/moderation-reason-dialog';

export interface InboxBulkActionsProps {
  ids: string[];
  onSettled: (refused: string[]) => void;
}

/** Approve, hide, remove, shadow ban or ban every selected comment; a visible action asks for the reason first. */
export function InboxBulkActions({ ids, onSettled }: InboxBulkActionsProps) {
  const { tOr } = useT();
  const can = useModerationAbilities();
  const { run, pending } = useBulkModeration();
  const [disclosure, setDisclosure] = useState<Disclosure>('silent');
  const [asking, setAsking] = useState<ReasonedAction | null>(null);

  const apply = async (action: BulkActionBody) => onSettled(await run(ids, action));

  const choose = (action: 'hide' | 'remove') =>
    disclosure === 'visible' ? setAsking(action) : apply({ action, disclosure });

  const confirm = async ({ reason, note, duration }: ModerationReason) => {
    const action = asking;
    setAsking(null);
    if (action === 'ban') {
      await apply({
        action,
        reason: note ?? tOr('studio.moderationReasonOption', { reason }, ''),
        expiresAt: banExpiry(duration, new Date()),
      });
    } else if (action !== null) {
      await apply({ action, disclosure, reason, note });
    }
  };

  const label = (action: 'approve' | 'hide' | 'remove' | 'shadow_ban' | 'ban') =>
    tOr('studio.moderationAction', { action }, '');

  return (
    <>
      <BulkActionBar.Root aria-label={tOr('studio.moderationBulkLabel', {}, '')} pending={pending}>
        {can.approve && (
          <BulkActionBar.Action onClick={() => apply({ action: 'approve' })}>
            {label('approve')}
          </BulkActionBar.Action>
        )}
        {can.hide && (
          <BulkActionBar.Action onClick={() => choose('hide')}>
            {label('hide')}
          </BulkActionBar.Action>
        )}
        {can.remove && (
          <BulkActionBar.Action tone="danger" onClick={() => choose('remove')}>
            {label('remove')}
          </BulkActionBar.Action>
        )}
        {can.restrict && (
          <>
            <BulkActionBar.Action tone="danger" onClick={() => apply({ action: 'shadow_ban' })}>
              {label('shadow_ban')}
            </BulkActionBar.Action>
            <BulkActionBar.Action tone="danger" onClick={() => setAsking('ban')}>
              {label('ban')}
            </BulkActionBar.Action>
          </>
        )}
        <BulkActionBar.Disclosure value={disclosure} onValueChange={setDisclosure} />
      </BulkActionBar.Root>
      <ModerationReasonDialog
        action={asking}
        onConfirm={confirm}
        onCancel={() => setAsking(null)}
      />
    </>
  );
}

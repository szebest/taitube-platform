import type { Disclosure } from '@vp/domain';
import { useT } from '@vp/intl-react';
import { Button, Kbd } from '@vp/ui';
import type { ReactNode } from 'react';
import type { ModerationAbilities } from '#app/features/comments/hooks/use-moderation-abilities';
import type { QueueKey } from '#app/features/comments/hooks/use-queue-shortcuts';

export interface QueueActionsProps {
  abilities: ModerationAbilities;
  /** What the next hide or remove tells the author: the channel's default unless `v` flipped it. */
  hide: Disclosure;
  remove: Disclosure;
  flipped: Disclosure;
  selected: boolean;
  pending: boolean;
  canMovePrevious: boolean;
  canMoveNext: boolean;
  onKey: (key: QueueKey) => void;
}

function KeyButton({
  shortcut,
  onKey,
  children,
  ...props
}: {
  shortcut: QueueKey;
  onKey: (key: QueueKey) => void;
  children: ReactNode;
  tone?: 'danger';
  disabled?: boolean;
  'aria-pressed'?: boolean;
}) {
  return (
    <Button
      variant="outline"
      size="sm"
      aria-keyshortcuts={shortcut}
      onClick={() => onKey(shortcut)}
      {...props}
    >
      {children}
      <Kbd size="sm" aria-hidden="true">
        {shortcut}
      </Kbd>
    </Button>
  );
}

/** Every shortcut of the queue as a button that says which key runs it and, for a hide or remove, who is told. */
export function QueueActions({
  abilities,
  hide,
  remove,
  flipped,
  selected,
  pending,
  canMovePrevious,
  canMoveNext,
  onKey,
}: QueueActionsProps) {
  const { tOr } = useT();
  const label = (action: 'approve' | 'hide' | 'remove' | 'ban') =>
    tOr('studio.moderationAction', { action }, '');
  const withDisclosure = (action: 'hide' | 'remove', disclosure: Disclosure) =>
    `${label(action)} · ${tOr('studio.queueDisclosure', { disclosure }, '')}`;

  return (
    <div
      role="toolbar"
      aria-label={tOr('studio.queueActionsLabel', {}, '')}
      className="flex flex-wrap items-center gap-inline"
    >
      {abilities.approve && (
        <KeyButton shortcut="a" onKey={onKey} disabled={pending}>
          {label('approve')}
        </KeyButton>
      )}
      {abilities.remove && (
        <KeyButton shortcut="r" onKey={onKey} tone="danger" disabled={pending}>
          {withDisclosure('remove', remove)}
        </KeyButton>
      )}
      {abilities.hide && (
        <KeyButton shortcut="h" onKey={onKey} disabled={pending}>
          {withDisclosure('hide', hide)}
        </KeyButton>
      )}
      {abilities.restrict && (
        <KeyButton shortcut="b" onKey={onKey} tone="danger" disabled={pending}>
          {label('ban')}
        </KeyButton>
      )}
      <KeyButton shortcut="v" onKey={onKey}>
        {tOr('studio.queueFlip', { disclosure: flipped }, '')}
      </KeyButton>
      <KeyButton shortcut="x" onKey={onKey} aria-pressed={selected}>
        {selected ? tOr('studio.queueUnselect', {}, '') : tOr('studio.queueSelect', {}, '')}
      </KeyButton>
      <KeyButton shortcut="k" onKey={onKey} disabled={!canMovePrevious}>
        {tOr('studio.queuePrevious', {}, '')}
      </KeyButton>
      <KeyButton shortcut="j" onKey={onKey} disabled={!canMoveNext}>
        {tOr('studio.queueNext', {}, '')}
      </KeyButton>
      <KeyButton shortcut="?" onKey={onKey}>
        {tOr('studio.queueHelp', {}, '')}
      </KeyButton>
    </div>
  );
}

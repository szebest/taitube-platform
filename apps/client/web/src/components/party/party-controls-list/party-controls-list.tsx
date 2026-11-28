import { Button } from '@kit/ui';
import type { ComponentPropsWithRef } from 'react';
import { useT } from '#app/lib/messages';

/** The everywhere controls a viewer set about other members, one row each with its remove. */
export function PartyControlsListRoot({ className, ...props }: ComponentPropsWithRef<'ul'>) {
  return (
    <ul
      data-slot="party-controls-list"
      className={`m-0 flex list-none flex-col gap-stack p-0 ${className ?? ''}`}
      {...props}
    />
  );
}

export interface PartyControlsListItemProps extends ComponentPropsWithRef<'li'> {
  /** Who the controls are about. */
  name: string;
  disabled?: boolean;
  onRemove: () => void;
}

export function PartyControlsListItem({
  name,
  disabled = false,
  onRemove,
  className,
  ...props
}: PartyControlsListItemProps) {
  const { tOr } = useT();

  return (
    <li
      data-slot="party-controls-list-item"
      className={`flex items-center justify-between gap-stack ${className ?? ''}`}
      {...props}
    >
      <span>{tOr('party.controlsMember', { key: name }, '')}</span>
      <Button
        variant="outline"
        size="sm"
        disabled={disabled}
        aria-label={tOr('party.controlsRemove', { key: name }, '')}
        onClick={onRemove}
      >
        {tOr('settings.hiddenUndo', {}, '')}
      </Button>
    </li>
  );
}

export function PartyControlsListEmpty() {
  const { tOr } = useT();

  return (
    <p data-slot="party-controls-list-empty" className="m-0">
      {tOr('party.controlsEmpty', {}, '')}
    </p>
  );
}

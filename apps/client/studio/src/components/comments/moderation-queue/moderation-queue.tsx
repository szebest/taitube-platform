import { cn } from '@vp/ui';
import { type ComponentPropsWithRef, type KeyboardEvent, useEffect, useRef } from 'react';
import { ModerationQueueContext, useModerationQueue } from './moderation-queue.context';

export interface ModerationQueueRootProps extends Omit<ComponentPropsWithRef<'div'>, 'onChange'> {
  /** The comment being looked at: the one option in the tab order. */
  active: string | undefined;
  onActiveChange: (id: string) => void;
  /** The comments marked with the select key, for a bulk action. */
  selected: ReadonlySet<string>;
}

const OPTIONS = '[role="option"]';

const optionsOf = (list: HTMLElement) => [...list.querySelectorAll<HTMLElement>(OPTIONS)];

/** The held comments as a listbox: one option in the tab order, the arrows, Home and End move between them. */
export function ModerationQueueRoot({
  active,
  onActiveChange,
  selected,
  className,
  onKeyDown,
  ...props
}: ModerationQueueRootProps) {
  const move = (event: KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(event);
    const options = optionsOf(event.currentTarget);
    const focused = options.find((option) => option === document.activeElement);
    const at = focused ? options.indexOf(focused) : -1;
    const target = {
      ArrowDown: options[at + 1],
      ArrowUp: options[Math.max(at - 1, 0)],
      Home: options[0],
      End: options.at(-1),
    }[event.key];
    if (at === -1 || target === undefined) {
      return;
    }
    event.preventDefault();
    target.focus();
  };

  return (
    <ModerationQueueContext value={{ active, selected, onActiveChange }}>
      <div
        role="listbox"
        aria-multiselectable="true"
        aria-orientation="vertical"
        data-slot="moderation-queue"
        className={cn('flex flex-col gap-inline', className)}
        onKeyDown={move}
        {...props}
      />
    </ModerationQueueContext>
  );
}

export interface ModerationQueueItemProps extends Omit<ComponentPropsWithRef<'div'>, 'role'> {
  value: string;
}

export function ModerationQueueItem({
  value,
  className,
  onFocus,
  ...props
}: ModerationQueueItemProps) {
  const { active, selected, onActiveChange } = useModerationQueue('Item');
  const ref = useRef<HTMLDivElement>(null);
  const current = active === value;

  useEffect(() => {
    const item = ref.current;
    if (!(current && item)) {
      return;
    }
    if (item.parentElement?.contains(document.activeElement)) {
      item.focus();
    }
    item.scrollIntoView?.({ block: 'nearest' });
  }, [current]);

  return (
    <div
      ref={ref}
      role="option"
      tabIndex={current ? 0 : -1}
      aria-selected={selected.has(value)}
      aria-current={current ? 'true' : undefined}
      data-slot="moderation-queue-item"
      data-active={current ? '' : undefined}
      className={cn(
        'flex flex-col gap-inline rounded-card border-control border-border bg-surface p-inset-card text-start focus-ring data-[active]:border-accent data-[active]:bg-accent-soft aria-selected:ring-2 aria-selected:ring-accent',
        className
      )}
      onFocus={(event) => {
        onFocus?.(event);
        onActiveChange(value);
      }}
      {...props}
    />
  );
}

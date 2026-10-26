import { Command as CommandPrimitive } from 'cmdk';
import { type ComponentPropsWithRef, useMemo } from 'react';
import { useUiCopy } from '../../copy/ui-copy';
import { Icon } from '../icon';
import { CommandContext, useCommand } from './command.context';
import { commandStyles } from './command.variants';
import type { CommandSize, CommandVariant } from './types';

export interface CommandRootProps extends ComponentPropsWithRef<typeof CommandPrimitive> {
  variant?: CommandVariant;
  size?: CommandSize;
}

/** Needs a name: pass `aria-label` or `label`. Set `shouldFilter={false}` when the server ranks the results. */
export function CommandRoot({
  variant = 'inline',
  size = 'md',
  className,
  ...props
}: CommandRootProps) {
  const shared = useMemo(() => ({ variant, size }), [variant, size]);

  return (
    <CommandContext value={shared}>
      <CommandPrimitive
        data-slot="command"
        className={commandStyles(shared).root({ className })}
        {...props}
      />
    </CommandContext>
  );
}

export function CommandInput({
  className,
  ...props
}: ComponentPropsWithRef<typeof CommandPrimitive.Input>) {
  const shared = useCommand('Input');
  const styles = commandStyles(shared);

  return (
    <div className={styles.inputRow()}>
      <Icon name="search" size="sm" className="tw:text-fg-muted" />
      <CommandPrimitive.Input
        data-slot="command-input"
        className={styles.input({ className })}
        {...props}
      />
    </div>
  );
}

export function CommandList({
  className,
  ...props
}: ComponentPropsWithRef<typeof CommandPrimitive.List>) {
  const shared = useCommand('List');

  return (
    <CommandPrimitive.List
      data-slot="command-list"
      className={commandStyles(shared).list({ className })}
      {...props}
    />
  );
}

/** Says `noResults` itself when it has no children. */
export function CommandEmpty({
  className,
  children,
  ...props
}: ComponentPropsWithRef<typeof CommandPrimitive.Empty>) {
  const shared = useCommand('Empty');
  const { noResults } = useUiCopy();

  return (
    <CommandPrimitive.Empty
      data-slot="command-empty"
      className={commandStyles(shared).empty({ className })}
      {...props}
    >
      {children ?? noResults}
    </CommandPrimitive.Empty>
  );
}

export function CommandGroup({
  className,
  ...props
}: ComponentPropsWithRef<typeof CommandPrimitive.Group>) {
  const shared = useCommand('Group');

  return (
    <CommandPrimitive.Group
      data-slot="command-group"
      className={commandStyles(shared).group({ className })}
      {...props}
    />
  );
}

export function CommandItem({
  className,
  ...props
}: ComponentPropsWithRef<typeof CommandPrimitive.Item>) {
  const shared = useCommand('Item');

  return (
    <CommandPrimitive.Item
      data-slot="command-item"
      className={commandStyles(shared).item({ className })}
      {...props}
    />
  );
}

export function CommandShortcut({ className, ...props }: ComponentPropsWithRef<'span'>) {
  const shared = useCommand('Shortcut');

  return (
    <span
      data-slot="command-shortcut"
      className={commandStyles(shared).shortcut({ className })}
      {...props}
    />
  );
}

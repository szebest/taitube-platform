import {
  Button,
  Command,
  Dialog,
  Icon,
  IconButton,
  Kbd,
  Progress,
  Skeleton,
  Slot,
  useUiCopy,
} from '@vp/ui';
import { type ComponentPropsWithRef, type KeyboardEvent, type ReactNode, useRef } from 'react';
import { CommandPaletteContext, useCommandPalette } from './command-palette.context';
import { commandPaletteStyles } from './command-palette.variants';
import type { CommandPaletteVariant } from './types';

const SKELETON_ROWS = ['first', 'second', 'third'];

export interface CommandPaletteRootProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  query: string;
  onQueryChange: (query: string) => void;
  /** The raw words, trimmed: Enter with no item active, or the "all results" action. */
  onSubmitQuery: (query: string) => void;
  /** `dialog` from medium up, `sheet` on compact; the wrapper picks it by breakpoint. */
  variant?: CommandPaletteVariant;
  className?: string;
  children?: ReactNode;
}

/** Search that also runs actions, in a modal dialog. The query is the caller's: the kit filters nothing. */
export function CommandPaletteRoot({
  open,
  onOpenChange,
  query,
  onQueryChange,
  onSubmitQuery,
  variant = 'dialog',
  className,
  children,
}: CommandPaletteRootProps) {
  const { paletteLabel } = useUiCopy();
  const styles = commandPaletteStyles({ variant });

  return (
    <CommandPaletteContext
      value={{
        variant,
        open,
        query,
        setQuery: onQueryChange,
        submit: onSubmitQuery,
        close: () => onOpenChange(false),
      }}
    >
      <Dialog.Root open={open} onOpenChange={onOpenChange}>
        <Dialog.Content
          aria-describedby={undefined}
          data-slot="command-palette"
          data-variant={variant}
          className={styles.content({ className })}
        >
          <Dialog.Title className="tw:sr-only">{paletteLabel}</Dialog.Title>
          <Command.Root label={paletteLabel} shouldFilter={false} className={styles.command()}>
            {children}
          </Command.Root>
        </Dialog.Content>
      </Dialog.Root>
    </CommandPaletteContext>
  );
}

export type CommandPaletteInputProps = Omit<
  ComponentPropsWithRef<typeof Command.Input>,
  'value' | 'onValueChange' | 'ref'
>;

/** The field: Enter on the raw words submits them when no item is active; Escape closes (Cancel on compact). */
export function CommandPaletteInput({ className, onKeyDown, ...props }: CommandPaletteInputProps) {
  const { variant, query, setQuery, submit, close } = useCommandPalette('Input');
  const { palettePlaceholder, clear, cancel } = useUiCopy();
  const inputRef = useRef<HTMLInputElement>(null);
  const styles = commandPaletteStyles({ variant });

  const submitRawWords = (event: KeyboardEvent<HTMLInputElement>) => {
    onKeyDown?.(event);
    if (event.key !== 'Enter' || event.nativeEvent.isComposing || event.defaultPrevented) {
      return;
    }
    const words = query.trim();
    const active = event.currentTarget
      .closest('[cmdk-root]')
      ?.querySelector('[cmdk-item][data-selected="true"]');
    if (active || !words) {
      return;
    }

    event.preventDefault();
    submit(words);
  };

  const handleClear = () => {
    setQuery('');
    inputRef.current?.focus();
  };

  return (
    <div data-slot="command-palette-input" className={styles.inputRow()}>
      <Command.Input
        ref={inputRef}
        value={query}
        onValueChange={setQuery}
        placeholder={palettePlaceholder}
        onKeyDown={submitRawWords}
        className={className}
        {...props}
      />
      {query && (
        <IconButton size="sm" aria-label={clear} onClick={handleClear}>
          <Icon name="close" />
        </IconButton>
      )}
      {variant === 'sheet' ? (
        <Button variant="ghost" size="sm" onClick={close}>
          {cancel}
        </Button>
      ) : (
        <Kbd aria-hidden="true">Esc</Kbd>
      )}
    </div>
  );
}

/** The 2 px accent line under the field while results load; the results already shown stay. */
export function CommandPaletteLoading({ className }: { className?: string }) {
  const { loading } = useUiCopy();
  const styles = commandPaletteStyles();

  return (
    <Progress
      data-slot="command-palette-loading"
      size="sm"
      tone="accent"
      value={null}
      aria-label={loading}
      className={styles.loading({ className })}
    />
  );
}

export function CommandPaletteList({
  className,
  ...props
}: ComponentPropsWithRef<typeof Command.List>) {
  const { variant } = useCommandPalette('List');

  return (
    <Command.List
      data-slot="command-palette-list"
      className={commandPaletteStyles({ variant }).list({ className })}
      {...props}
    />
  );
}

/** A group of results or actions under an overline heading. */
export function CommandPaletteGroup(props: ComponentPropsWithRef<typeof Command.Group>) {
  return <Command.Group data-slot="command-palette-group" {...props} />;
}

export interface CommandPaletteItemProps
  extends Omit<ComponentPropsWithRef<typeof Command.Item>, 'value' | 'onSelect'> {
  value: string;
  onSelect: () => void;
  meta?: string;
  shortcut?: string[];
  leading?: ReactNode;
}

/** One row; mark matches with `<mark>` in its children, and with `asChild` it draws on the caller's link. */
export function CommandPaletteItem({
  value,
  onSelect,
  meta,
  shortcut,
  leading,
  asChild,
  className,
  children,
  ...props
}: CommandPaletteItemProps) {
  const { variant } = useCommandPalette('Item');
  const styles = commandPaletteStyles({ variant });

  return (
    <Command.Item
      data-slot="command-palette-item"
      value={value}
      onSelect={onSelect}
      asChild={asChild}
      className={styles.item({ className })}
      {...props}
    >
      {leading && <span className={styles.leading()}>{leading}</span>}
      {asChild ? (
        <Slot.Slottable>{children}</Slot.Slottable>
      ) : (
        <span className={styles.text()}>{children}</span>
      )}
      {(meta || shortcut) && (
        <span className={styles.end()}>
          {meta && <span className={styles.meta()}>{meta}</span>}
          {shortcut?.map((key) => (
            <Kbd key={key} aria-hidden="true">
              {key}
            </Kbd>
          ))}
        </span>
      )}
    </Command.Item>
  );
}

/** What shows when nothing matches; the actions group, which still matches, stays beside it. */
export function CommandPaletteEmpty(props: ComponentPropsWithRef<typeof Command.Empty>) {
  return <Command.Empty data-slot="command-palette-empty" {...props} />;
}

/** A one-line notice above the results: an error with its retry, passed as children. */
export function CommandPaletteNotice({ className, ...props }: ComponentPropsWithRef<'div'>) {
  const styles = commandPaletteStyles();

  return (
    <div data-slot="command-palette-notice" className={styles.notice({ className })} {...props} />
  );
}

/** The offline line: actions and recent searches still work. */
export function CommandPaletteOffline({ className }: { className?: string }) {
  const { paletteOffline } = useUiCopy();

  return (
    <CommandPaletteNotice role="status" className={className}>
      <Icon name="wifi-off" size="sm" />
      {paletteOffline}
    </CommandPaletteNotice>
  );
}

/** The result count, read out politely; the caller formats it. */
export function CommandPaletteStatus(props: Omit<ComponentPropsWithRef<'div'>, 'className'>) {
  return (
    <div
      data-slot="command-palette-status"
      role="status"
      aria-live="polite"
      className="tw:sr-only"
      {...props}
    />
  );
}

/** Key hints, and the action that opens every result for the raw words (Tab reaches it from the field). */
const keepEnterFromTheList = (event: KeyboardEvent<HTMLButtonElement>) => {
  if (event.key === 'Enter') {
    event.stopPropagation();
  }
};

export function CommandPaletteFooter({ className }: { className?: string }) {
  const { variant, query, submit } = useCommandPalette('Footer');
  const { paletteNavigate, paletteOpen, paletteSearchAll } = useUiCopy();
  const styles = commandPaletteStyles({ variant });
  const words = query.trim();

  return (
    <div data-slot="command-palette-footer" className={styles.footer({ className })}>
      <span aria-hidden="true" className={styles.hint()}>
        <Kbd>↑</Kbd>
        <Kbd>↓</Kbd>
        {paletteNavigate}
      </span>
      <span aria-hidden="true" className={styles.hint()}>
        <Kbd>↵</Kbd>
        {paletteOpen}
      </span>
      <Button
        variant="ghost"
        size="sm"
        className="tw:ms-auto"
        disabled={!words}
        onClick={() => submit(words)}
        onKeyDown={keepEnterFromTheList}
      >
        {paletteSearchAll}
      </Button>
    </div>
  );
}

export function CommandPaletteSkeleton() {
  return (
    <div data-slot="command-palette-skeleton" aria-hidden="true" className="tw:flex tw:flex-col">
      {SKELETON_ROWS.map((row) => (
        <div
          key={row}
          className="tw:flex tw:h-[3.5rem] tw:items-center tw:gap-stack tw:px-inset-control"
        >
          <Skeleton radius="sm" className="tw:size-control-md tw:shrink-0" />
          <div className="tw:flex tw:flex-1 tw:flex-col tw:gap-inline">
            <Skeleton shape="text" className="tw:w-[60%]" />
            <Skeleton shape="text" className="tw:w-[30%]" />
          </div>
        </div>
      ))}
    </div>
  );
}

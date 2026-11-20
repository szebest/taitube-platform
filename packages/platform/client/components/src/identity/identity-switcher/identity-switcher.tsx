import { Command, ResponsiveModal } from '@kit/ui';
import type { ComponentPropsWithRef, KeyboardEvent, ReactNode } from 'react';

/** Marks a row the digit keys jump to, in a switcher list or an account menu. */
export const IDENTITY_ITEM = 'data-identity-item';

const DIGIT = /^[1-9]$/;

/**
 * `1` to `9` choose the nth identity row inside the element handling the key, unless a modifier is
 * held or the key is being typed into a search field that already holds text.
 */
export function jumpToIdentityItem(event: KeyboardEvent<HTMLElement>): void {
  if (!DIGIT.test(event.key) || event.altKey || event.ctrlKey || event.metaKey) return;
  const { target } = event;
  if (target instanceof HTMLInputElement && target.value !== '') return;
  const rows = event.currentTarget.querySelectorAll<HTMLElement>(`[${IDENTITY_ITEM}]`);
  const row = rows[Number(event.key) - 1];
  if (!row) return;
  event.preventDefault();
  row.click();
}

export interface IdentitySwitcherRootProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}

/** A dialog from the medium width up and a bottom sheet below it, holding the identities as a listbox. */
export function IdentitySwitcherRoot(props: IdentitySwitcherRootProps) {
  return <ResponsiveModal.Root {...props} />;
}

export interface IdentitySwitcherContentProps {
  /** The dialog's heading, which also names the listbox. */
  title: string;
  children: ReactNode;
}

function focusList(event: Event) {
  event.preventDefault();
  const content = event.currentTarget;
  if (!(content instanceof HTMLElement)) return;
  const target =
    content.querySelector<HTMLElement>('[cmdk-input]') ??
    content.querySelector<HTMLElement>('[cmdk-root]');
  target?.focus();
}

export function IdentitySwitcherContent({ title, children }: IdentitySwitcherContentProps) {
  return (
    <ResponsiveModal.Content size="sm" onOpenAutoFocus={focusList}>
      <ResponsiveModal.Header>
        <ResponsiveModal.Title>{title}</ResponsiveModal.Title>
      </ResponsiveModal.Header>
      <Command.Root label={title} onKeyDown={jumpToIdentityItem} loop>
        {children}
      </Command.Root>
    </ResponsiveModal.Content>
  );
}

/** The search field; the caller renders it once the list is long enough to need one. */
export function IdentitySwitcherSearch(props: ComponentPropsWithRef<typeof Command.Input>) {
  return <Command.Input {...props} />;
}

export function IdentitySwitcherList(props: ComponentPropsWithRef<typeof Command.List>) {
  return <Command.List {...props} />;
}

export function IdentitySwitcherEmpty(props: ComponentPropsWithRef<typeof Command.Empty>) {
  return <Command.Empty {...props} />;
}

export function IdentitySwitcherGroup(props: ComponentPropsWithRef<typeof Command.Group>) {
  return <Command.Group {...props} />;
}

/** An identity row: the digit keys count these. */
export function IdentitySwitcherItem(props: ComponentPropsWithRef<typeof Command.Item>) {
  return <Command.Item {...{ [IDENTITY_ITEM]: '' }} {...props} />;
}

/** A row the digit keys skip: add an account, sign out. */
export function IdentitySwitcherAction(props: ComponentPropsWithRef<typeof Command.Item>) {
  return <Command.Item {...props} />;
}

import type { KeyboardEvent } from 'react';

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

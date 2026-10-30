import type { FocusEvent, KeyboardEvent } from 'react';
import { ITEM_SELECTOR, isRtl } from './chip-bar-track';

export function moveFocus(event: KeyboardEvent<HTMLDivElement>, multiple: boolean) {
  const active = document.activeElement;
  if (event.key === ' ' && active instanceof HTMLAnchorElement) {
    event.preventDefault();
    active.click();
    return;
  }
  const track = event.currentTarget;
  const items = Array.from(track.querySelectorAll<HTMLElement>(ITEM_SELECTOR)).filter(
    (item) => item.getAttribute('aria-disabled') !== 'true'
  );
  const current = active instanceof HTMLElement ? items.indexOf(active) : -1;
  const forward = isRtl(track) ? 'ArrowLeft' : 'ArrowRight';
  const backward = isRtl(track) ? 'ArrowRight' : 'ArrowLeft';
  const targets: Record<string, number> = {
    [forward]: current + 1,
    [backward]: current - 1,
    Home: 0,
    End: items.length - 1,
  };
  const index = targets[event.key];
  if (index === undefined || items.length === 0) {
    return;
  }
  event.preventDefault();
  const target = items[(index + items.length) % items.length];
  target?.focus();
  if (!multiple) {
    target?.click();
  }
}

export function enterAtFirstItem(event: FocusEvent<HTMLDivElement>) {
  if (event.target !== event.currentTarget) {
    return;
  }
  const first = event.currentTarget.querySelector<HTMLElement>(
    `${ITEM_SELECTOR}:not([aria-disabled="true"])`
  );
  first?.focus();
}

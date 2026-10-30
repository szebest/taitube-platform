let opener: HTMLElement | null = null;

export function rememberOpener() {
  opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
}

/** Radix's `onCloseAutoFocus`: back to what opened the modal, or the page's heading after a deep link. */
export function restoreFocus(event: Event) {
  event.preventDefault();
  const heading = document.querySelector<HTMLElement>('h1');
  const target = opener?.isConnected ? opener : heading;
  opener = null;
  if (target === heading && heading) {
    heading.tabIndex = -1;
  }
  target?.focus();
}

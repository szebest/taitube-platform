import { useEffect, useRef } from 'react';

const OPENER = 'data-url-modal-opener';

/** Marks the focused element as the one that opened the modal; the page itself counts as none. */
export function rememberOpener() {
  document.querySelector(`[${OPENER}]`)?.removeAttribute(OPENER);
  const { activeElement } = document;
  if (activeElement instanceof HTMLElement && activeElement !== document.body) {
    activeElement.setAttribute(OPENER, '');
  }
}

/** Radix's `onCloseAutoFocus`, which also fires when the container swaps under an open modal: never move focus there. */
export function keepFocus(event: Event) {
  event.preventDefault();
}

/** When the modal closes for good: back to what opened it, or to the page's heading after a deep link. */
export function useRestoreFocusOnClose(isOpen: boolean) {
  const wasOpen = useRef(isOpen);

  useEffect(() => {
    if (wasOpen.current && !isOpen) {
      const opener = document.querySelector<HTMLElement>(`[${OPENER}]`);
      opener?.removeAttribute(OPENER);
      const heading = document.querySelector<HTMLElement>('h1');
      if (!opener && heading) {
        heading.tabIndex = -1;
      }
      (opener ?? heading)?.focus();
    }
    wasOpen.current = isOpen;
  }, [isOpen]);
}

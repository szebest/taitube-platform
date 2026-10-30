import { useEffect, useRef } from 'react';

let opener: HTMLElement | null = null;

export function rememberOpener() {
  const { activeElement } = document;
  opener =
    activeElement instanceof HTMLElement && activeElement !== document.body ? activeElement : null;
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
      const heading = document.querySelector<HTMLElement>('h1');
      const target = opener?.isConnected ? opener : heading;
      opener = null;
      if (target === heading && heading) {
        heading.tabIndex = -1;
      }
      target?.focus();
    }
    wasOpen.current = isOpen;
  }, [isOpen]);
}

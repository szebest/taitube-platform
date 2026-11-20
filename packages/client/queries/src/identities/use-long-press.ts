import { type PointerEvent, useRef } from 'react';

const LONG_PRESS_MS = 500;

/**
 * Handlers that call `onLongPress` once a touch or a click is held still for half a second, and
 * keep the browser's own long-press menu from opening over it.
 */
export function useLongPress(onLongPress: () => void) {
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const cancel = () => clearTimeout(timer.current);

  return {
    onPointerDown: (event: PointerEvent) => {
      if (event.button !== 0) return;
      cancel();
      timer.current = setTimeout(onLongPress, LONG_PRESS_MS);
    },
    onPointerUp: cancel,
    onPointerLeave: cancel,
    onPointerCancel: cancel,
    onContextMenu: (event: { preventDefault: () => void; nativeEvent: Event }) => {
      if (event.nativeEvent instanceof PointerEvent && event.nativeEvent.pointerType === 'touch') {
        event.preventDefault();
      }
    },
  };
}

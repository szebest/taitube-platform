import { Direction } from 'radix-ui';
import type { Ref, RefCallback } from 'react';

/**
 * The classes every sliding indicator shares: hidden until it is placed, then sliding between options
 * (`duration-base`, `ease-settle`), and jumping into place under reduced motion.
 */
export const slidingIndicatorBase =
  'tw:pointer-events-none tw:invisible tw:absolute tw:top-0 tw:start-0 tw:in-data-[indicator=shown]:visible tw:in-data-[indicator=shown]:transition-[translate,width,height] tw:duration-base tw:ease-settle tw:motion-reduce:transition-none';

function place(container: HTMLElement, selected: string, rtl: boolean) {
  const item = container.querySelector<HTMLElement>(`:scope > ${selected}`);
  if (item === null) {
    delete container.dataset.indicator;
    return undefined;
  }

  const start = rtl ? container.clientWidth - item.offsetLeft - item.offsetWidth : item.offsetLeft;
  container.style.setProperty('--indicator-x', `${rtl ? -start : start}px`);
  container.style.setProperty('--indicator-y', `${item.offsetTop}px`);
  container.style.setProperty('--indicator-width', `${item.offsetWidth}px`);
  container.style.setProperty('--indicator-height', `${item.offsetHeight}px`);
  if (container.dataset.indicator === undefined) {
    // Flushes the first position while the indicator has no transition, so it appears in place.
    void container.offsetWidth;
    container.dataset.indicator = 'shown';
  }
  return item;
}

/**
 * Measures the option matching `selected` among the container's children and writes its box as
 * `--indicator-x|y|width|height` on the container, with `data-indicator="shown"` once there is one;
 * an indicator styled with `slidingIndicatorBase` then slides to every new selection. Returns the
 * container's ref, merged with the caller's `ref`.
 */
export function useSlidingIndicator<T extends HTMLElement>(
  selected: string,
  ref?: Ref<T>
): RefCallback<T> {
  const rtl = Direction.useDirection() === 'rtl';

  return (container) => {
    const cleanUpRef = typeof ref === 'function' ? ref(container) : undefined;
    if (ref !== null && ref !== undefined && typeof ref !== 'function') {
      ref.current = container;
    }
    if (container === null) {
      return undefined;
    }

    const resized = new ResizeObserver(() => place(container, selected, rtl));
    const follow = () => {
      const item = place(container, selected, rtl);
      if (item !== undefined) {
        resized.observe(item);
      }
    };
    const changed = new MutationObserver(follow);
    resized.observe(container);
    changed.observe(container, { subtree: true, attributeFilter: ['data-state'] });
    follow();

    return () => {
      resized.disconnect();
      changed.disconnect();
      if (typeof cleanUpRef === 'function') {
        cleanUpRef();
      } else if (typeof ref === 'function') {
        ref(null);
      } else if (ref !== null && ref !== undefined) {
        ref.current = null;
      }
    };
  };
}

import { ScrollArea as ScrollAreaPrimitive } from 'radix-ui';
import type { ComponentPropsWithRef } from 'react';
import { scrollAreaStyles } from './scroll-area.variants';
import type { ScrollAreaSize } from './types';

const ORIENTATIONS = ['vertical', 'horizontal'] as const;

export interface ScrollAreaProps extends ComponentPropsWithRef<typeof ScrollAreaPrimitive.Root> {
  size?: ScrollAreaSize;
  /** Fades the edges where the content is clipped. */
  fade?: boolean;
}

/**
 * A fixed box whose content scrolls natively under a themed bar. `tabIndex` and a name go on the
 * scrolling viewport, which needs both when nothing inside it takes focus.
 */
export function ScrollArea({
  size,
  fade,
  tabIndex,
  'aria-label': label,
  'aria-labelledby': labelledBy,
  className,
  children,
  ...props
}: ScrollAreaProps) {
  const styles = scrollAreaStyles({ size, fade });
  const named = label !== undefined || labelledBy !== undefined;

  return (
    <ScrollAreaPrimitive.Root
      data-slot="scroll-area"
      className={styles.root({ className })}
      {...props}
    >
      <ScrollAreaPrimitive.Viewport
        data-slot="scroll-area-viewport"
        tabIndex={tabIndex}
        role={named ? 'region' : undefined}
        aria-label={label}
        aria-labelledby={labelledBy}
        className={styles.viewport()}
      >
        {children}
      </ScrollAreaPrimitive.Viewport>
      {ORIENTATIONS.map((orientation) => (
        <ScrollAreaPrimitive.Scrollbar
          key={orientation}
          orientation={orientation}
          className={styles.scrollbar()}
        >
          <ScrollAreaPrimitive.Thumb className={styles.thumb()} />
        </ScrollAreaPrimitive.Scrollbar>
      ))}
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  );
}

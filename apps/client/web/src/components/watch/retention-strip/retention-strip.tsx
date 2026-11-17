import { IconButton } from '@kit/ui';
import { seriesColor } from '@vp/components';
import type { ComponentPropsWithRef } from 'react';
import { retentionStripStyles } from './retention-strip.variants';

export interface RetentionStripRootProps extends ComponentPropsWithRef<'div'> {
  /** The share of the viewers still watching at each step, 0 to 1, in the order of the video. */
  values: readonly number[];
}

/** The retention curve as a row of bars, one per step, with its markers laid over it. */
export function RetentionStripRoot({
  values,
  className,
  children,
  ...props
}: RetentionStripRootProps) {
  const styles = retentionStripStyles();

  return (
    <div data-slot="retention-strip" className={styles.root({ className })} {...props}>
      <div aria-hidden="true" className={styles.bars()}>
        {values.map((value, step) => {
          const at = (step / Math.max(values.length - 1, 1)) * 100;
          return (
            <span
              key={at}
              data-slot="retention-strip-bar"
              className={styles.bar()}
              style={{ height: `${Math.max(value, 0) * 100}%`, backgroundColor: seriesColor(0) }}
            />
          );
        })}
      </div>
      {children}
    </div>
  );
}

export interface RetentionStripMarkerProps extends Omit<
  ComponentPropsWithRef<'button'>,
  'children'
> {
  /** Where the marker sits along the video, 0 to 100. */
  percent: number;
  'aria-label': string;
}

/** A button on the strip at one point of the video; pointer only, because the same action is listed beside it. */
export function RetentionStripMarker({
  percent,
  className,
  style,
  ...props
}: RetentionStripMarkerProps) {
  return (
    <IconButton
      data-slot="retention-strip-marker"
      aria-hidden="true"
      tabIndex={-1}
      variant="solid"
      tone="danger"
      size="sm"
      className={retentionStripStyles().marker({ className })}
      style={{ insetInlineStart: `${percent}%`, ...style }}
      {...props}
    >
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
    </IconButton>
  );
}

import { cn, Skeleton, useUiCopy, Slot } from '@vp/ui';
import { type ComponentPropsWithRef, useId } from 'react';
import { PickOfTheDayContext, usePickOfTheDay } from './pick-of-the-day.context';
import { pickOfTheDayStyles } from './pick-of-the-day.variants';
import type { PickOfTheDayLayout } from './types';

export interface PickOfTheDayRootProps extends ComponentPropsWithRef<'section'> {
  /** Omitted, it follows the breakpoint: stacked below expanded. */
  layout?: PickOfTheDayLayout;
  /** A CSS colour sampled from the thumbnail, painted only as the blurred glow behind the card. */
  glowColor?: string;
}

/**
 * Home's hero. Its child is a `VideoCard.Root variant="spotlight"`, with this component's
 * `Kicker`, `Note`, `Window` and `Actions` composed in among the card's own parts.
 */
export function PickOfTheDayRoot({
  layout,
  glowColor,
  className,
  children,
  ...props
}: PickOfTheDayRootProps) {
  const kickerId = useId();
  const layoutStyle = layout ?? 'responsive';
  const styles = pickOfTheDayStyles({ layout: layoutStyle });

  return (
    <PickOfTheDayContext value={{ layout, glowColor, kickerId }}>
      <section
        data-slot="pick-of-the-day"
        data-layout={layoutStyle}
        aria-labelledby={kickerId}
        className={styles.root({ className })}
        {...props}
      >
        {glowColor !== undefined && (
          <div
            aria-hidden="true"
            className={styles.glow()}
            style={{ backgroundColor: glowColor }}
          />
        )}
        {children}
      </section>
    </PickOfTheDayContext>
  );
}

export interface PickOfTheDayPartProps extends ComponentPropsWithRef<'p'> {
  /** Renders the element the caller passes, a heading for one, instead of a `p`. */
  asChild?: boolean;
}

/** "Pick of the day", the label that names the section. */
export function PickOfTheDayKicker({
  asChild = false,
  className,
  children,
  ...props
}: PickOfTheDayPartProps) {
  const { kickerId } = usePickOfTheDay('Kicker');
  const { pickOfTheDay } = useUiCopy();
  const Element = asChild ? Slot.Root : 'p';

  return (
    <Element
      data-slot="pick-of-the-day-kicker"
      id={kickerId}
      className={pickOfTheDayStyles().kicker({ className })}
      {...props}
    >
      <Slot.Slottable>{children}</Slot.Slottable>
      {pickOfTheDay}
    </Element>
  );
}

/** The curator's note in the editorial serif, as plain text. */
export function PickOfTheDayNote({ asChild = false, className, ...props }: PickOfTheDayPartProps) {
  usePickOfTheDay('Note');
  const Element = asChild ? Slot.Root : 'p';

  return (
    <Element
      data-slot="pick-of-the-day-note"
      className={pickOfTheDayStyles().note({ className })}
      {...props}
    />
  );
}

/** How long the pick stays, a finished string: "Picked today, 14 h left". */
export function PickOfTheDayWindow({ className, ...props }: ComponentPropsWithRef<'p'>) {
  usePickOfTheDay('Window');

  return (
    <p
      data-slot="pick-of-the-day-window"
      className={pickOfTheDayStyles().window({ className })}
      {...props}
    />
  );
}

/** Watch, Queue and Save, above the card's stretched title link. */
export function PickOfTheDayActions({ className, ...props }: ComponentPropsWithRef<'div'>) {
  usePickOfTheDay('Actions');

  return (
    <div
      data-slot="pick-of-the-day-actions"
      className={pickOfTheDayStyles().actions({ className })}
      {...props}
    />
  );
}

const bar = (className: string) => <Skeleton shape="text" radius="xs" className={className} />;

export function PickOfTheDaySkeleton({ layout }: Pick<PickOfTheDayRootProps, 'layout'>) {
  const split = layout === 'default';
  const responsive = layout === undefined;

  return (
    <div
      data-slot="pick-of-the-day-skeleton"
      aria-hidden="true"
      className={cn(
        'tw:flex tw:flex-col tw:gap-section tw:rounded-card tw:bg-surface tw:p-inset-card',
        split && 'tw:min-h-[19rem] tw:flex-row',
        responsive && 'tw:expanded:min-h-[19rem] tw:expanded:flex-row'
      )}
    >
      <Skeleton
        radius="thumb"
        className={cn(
          'tw:aspect-video tw:w-full tw:shrink-0 tw:medium:max-w-[30rem]',
          split && 'tw:w-[28.75rem]',
          responsive && 'tw:expanded:w-[28.75rem]'
        )}
      />
      <div className="tw:flex tw:min-w-0 tw:flex-1 tw:flex-col tw:gap-inline">
        {bar('tw:w-[5.5rem] tw:text-overline')}
        {bar('tw:w-full tw:text-headline')}
        {bar('tw:w-[64%] tw:text-headline')}
        {bar('tw:w-full tw:text-editorial')}
        {bar('tw:w-4/5 tw:text-editorial')}
        {bar('tw:w-[10rem] tw:text-caption')}
        <div className="tw:flex tw:gap-inline">
          <Skeleton radius="control" className="tw:h-control-md tw:w-[6rem]" />
          <Skeleton radius="control" className="tw:h-control-md tw:w-[5.5rem]" />
        </div>
      </div>
    </div>
  );
}

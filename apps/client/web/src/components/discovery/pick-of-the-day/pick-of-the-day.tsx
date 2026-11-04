import { cn, Skeleton, Slot, useUiCopy } from '@vp/ui';
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
      role="timer"
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
        'flex flex-col gap-section rounded-card bg-surface p-inset-card',
        split && 'min-h-[19rem] flex-row',
        responsive && 'expanded:min-h-[19rem] expanded:flex-row'
      )}
    >
      <Skeleton
        radius="thumb"
        className={cn(
          'aspect-video w-full shrink-0 medium:max-w-[30rem]',
          split && 'w-[28.75rem]',
          responsive && 'expanded:w-[28.75rem]'
        )}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-inline">
        {bar('w-[5.5rem] text-overline')}
        {bar('w-full text-headline')}
        {bar('w-[64%] text-headline')}
        {bar('w-full text-editorial')}
        {bar('w-4/5 text-editorial')}
        {bar('w-[10rem] text-caption')}
        <div className="flex gap-inline">
          <Skeleton radius="control" className="h-control-md w-[6rem]" />
          <Skeleton radius="control" className="h-control-md w-[5.5rem]" />
        </div>
      </div>
    </div>
  );
}

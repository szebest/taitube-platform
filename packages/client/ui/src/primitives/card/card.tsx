import { Slot } from 'radix-ui';
import { type ComponentPropsWithRef, useMemo } from 'react';
import { CardContext, useCard } from './card.context';
import { cardStyles } from './card.variants';
import type { CardElevation, CardFill, CardSize } from './types';

export interface CardRootProps extends ComponentPropsWithRef<'div'> {
  variant?: CardFill;
  elevation?: CardElevation;
  size?: CardSize;
  /** Renders its one child, an `article` or a whole-card link, which then lifts on hover. */
  asChild?: boolean;
}

export function CardRoot({
  variant = 'solid',
  elevation,
  size = 'md',
  asChild = false,
  className,
  ...props
}: CardRootProps) {
  const shared = useMemo(() => ({ variant, size }), [variant, size]);
  const Element = asChild ? Slot.Root : 'div';

  return (
    <CardContext value={shared}>
      <Element
        data-slot="card"
        className={cardStyles({ variant, elevation, size }).root({ className })}
        {...props}
      />
    </CardContext>
  );
}

export type CardPartProps = ComponentPropsWithRef<'div'>;

export function CardHeader({ className, ...props }: CardPartProps) {
  const shared = useCard('Header');

  return (
    <div data-slot="card-header" className={cardStyles(shared).header({ className })} {...props} />
  );
}

export interface CardTitleProps extends ComponentPropsWithRef<'h3'> {
  /** Renders its one child, so the caller picks the heading level: `<h2>`. */
  asChild?: boolean;
}

export function CardTitle({ asChild = false, className, ...props }: CardTitleProps) {
  const shared = useCard('Title');
  const Element = asChild ? Slot.Root : 'h3';

  return (
    <Element
      data-slot="card-title"
      className={cardStyles(shared).title({ className })}
      {...props}
    />
  );
}

export function CardDescription({ className, ...props }: ComponentPropsWithRef<'p'>) {
  const shared = useCard('Description');

  return (
    <p
      data-slot="card-description"
      className={cardStyles(shared).description({ className })}
      {...props}
    />
  );
}

export interface CardActionProps extends CardPartProps {
  asChild?: boolean;
}

export function CardAction({ asChild = false, className, ...props }: CardActionProps) {
  const shared = useCard('Action');
  const Element = asChild ? Slot.Root : 'div';

  return (
    <Element
      data-slot="card-action"
      className={cardStyles(shared).action({ className })}
      {...props}
    />
  );
}

export function CardBody({ className, ...props }: CardPartProps) {
  const shared = useCard('Body');

  return (
    <div data-slot="card-body" className={cardStyles(shared).body({ className })} {...props} />
  );
}

export function CardFooter({ className, ...props }: CardPartProps) {
  const shared = useCard('Footer');

  return (
    <div data-slot="card-footer" className={cardStyles(shared).footer({ className })} {...props} />
  );
}

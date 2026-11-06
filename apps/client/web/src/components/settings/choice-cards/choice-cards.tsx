import { cn } from '@vp/ui';
import { type ComponentPropsWithRef, useId } from 'react';

import { ChoiceCardsContext, useChoiceCards } from './choice-cards.context';

export interface ChoiceCardsRootProps extends Omit<ComponentPropsWithRef<'div'>, 'onChange'> {
  value: string;
  onValueChange: (value: string) => void;
}

/** One of several options, each a card with a preview; name the group with `aria-label`. */
export function ChoiceCardsRoot({
  value,
  onValueChange,
  className,
  ...props
}: ChoiceCardsRootProps) {
  const name = useId();

  return (
    <ChoiceCardsContext value={{ name, value, onValueChange }}>
      <div
        data-slot="choice-cards"
        role="radiogroup"
        className={cn(
          'grid grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] gap-inline',
          className
        )}
        {...props}
      />
    </ChoiceCardsContext>
  );
}

export interface ChoiceCardsOptionProps extends Omit<ComponentPropsWithRef<'label'>, 'onChange'> {
  value: string;
}

/** A card holding a preview and a label; the radio inside it is what the keyboard and screen readers meet. */
export function ChoiceCardsOption({
  value,
  className,
  children,
  ...props
}: ChoiceCardsOptionProps) {
  const choice = useChoiceCards('Option');

  return (
    <label
      data-slot="choice-cards-option"
      className={cn(
        'relative flex min-w-0 cursor-pointer flex-col gap-inline rounded-card border-control border-border bg-surface p-inset-control text-fg has-checked:border-accent has-checked:bg-accent-soft has-focus-visible:focus-ring hover:border-border-strong touch-target',
        className
      )}
      {...props}
    >
      <input
        type="radio"
        name={choice.name}
        value={value}
        checked={choice.value === value}
        onChange={() => choice.onValueChange(value)}
        className="absolute size-0 opacity-0"
      />
      {children}
    </label>
  );
}

/** What the option changes, drawn with its own value; decoration, so assistive technology skips it. */
export function ChoiceCardsPreview({ className, ...props }: ComponentPropsWithRef<'div'>) {
  return (
    <div
      data-slot="choice-cards-preview"
      aria-hidden="true"
      className={cn('pointer-events-none min-w-0 overflow-hidden', className)}
      {...props}
    />
  );
}

export function ChoiceCardsLabel({ className, ...props }: ComponentPropsWithRef<'span'>) {
  return (
    <span
      data-slot="choice-cards-label"
      className={cn('text-label text-fg', className)}
      {...props}
    />
  );
}

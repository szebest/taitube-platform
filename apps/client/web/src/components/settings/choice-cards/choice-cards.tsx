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
          'tw:grid tw:grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] tw:gap-inline',
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
        'tw:relative tw:flex tw:min-w-0 tw:cursor-pointer tw:flex-col tw:gap-inline tw:rounded-card tw:border-control tw:border-border tw:bg-surface tw:p-inset-control tw:text-fg tw:has-checked:border-accent tw:has-checked:bg-accent-soft tw:has-focus-visible:focus-ring tw:hover:border-border-strong tw:touch-target',
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
        className="tw:absolute tw:size-0 tw:opacity-0"
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
      className={cn('tw:pointer-events-none tw:min-w-0 tw:overflow-hidden', className)}
      {...props}
    />
  );
}

export function ChoiceCardsLabel({ className, ...props }: ComponentPropsWithRef<'span'>) {
  return (
    <span
      data-slot="choice-cards-label"
      className={cn('tw:text-label tw:text-fg', className)}
      {...props}
    />
  );
}

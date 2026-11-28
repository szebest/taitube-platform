import { Button, type ButtonProps, cn, Icon, IconButton } from '@kit/ui';
import type { ComponentPropsWithRef } from 'react';

/** The layout of a smart playlist's rules; the caller binds its form fields into the parts. Pass `aria-label`. */
export function SmartRuleBuilderRoot({ className, ...props }: ComponentPropsWithRef<'fieldset'>) {
  return (
    <fieldset
      data-slot="smart-rule-builder"
      className={cn('m-0 flex min-w-0 flex-col gap-stack border-0 p-0', className)}
      {...props}
    />
  );
}

/** The header row, for the caller's "match all or any" control. */
export function SmartRuleBuilderMatch({ className, ...props }: ComponentPropsWithRef<'div'>) {
  return (
    <div
      data-slot="smart-rule-builder-match"
      className={cn('flex flex-wrap items-center gap-inline', className)}
      {...props}
    />
  );
}

export function SmartRuleBuilderConditions({ className, ...props }: ComponentPropsWithRef<'ol'>) {
  return (
    <ol
      data-slot="smart-rule-builder-conditions"
      className={cn('m-0 flex list-none flex-col gap-inline p-0', className)}
      {...props}
    />
  );
}

export interface SmartRuleBuilderConditionProps extends ComponentPropsWithRef<'li'> {
  onRemove: () => void;
  /** The finished name of the remove button ("Remove condition 2"). */
  removeLabel: string;
}

/** One rule: the caller's field select and operand inputs in a wrapping row, and a remove button. */
export function SmartRuleBuilderCondition({
  onRemove,
  removeLabel,
  className,
  children,
  ...props
}: SmartRuleBuilderConditionProps) {
  return (
    <li
      data-slot="smart-rule-builder-condition"
      className={cn(
        'flex min-w-0 items-start gap-inline rounded-card border-divider border-border bg-surface p-inset-card',
        className
      )}
      {...props}
    >
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-inline">{children}</div>
      <IconButton size="sm" aria-label={removeLabel} onClick={onRemove}>
        <Icon name="close" />
      </IconButton>
    </li>
  );
}

export function SmartRuleBuilderAdd({ className, children, ...props }: ButtonProps) {
  return (
    <Button
      type="button"
      variant="outline"
      data-slot="smart-rule-builder-add"
      className={cn('self-start', className)}
      {...props}
    >
      <Icon name="plus" />
      {children}
    </Button>
  );
}

/** The caller's sort and limit controls, under the conditions. */
export function SmartRuleBuilderFooter({ className, ...props }: ComponentPropsWithRef<'div'>) {
  return (
    <div
      data-slot="smart-rule-builder-footer"
      className={cn(
        'flex flex-wrap items-center gap-inline border-t-divider border-border pt-stack',
        className
      )}
      {...props}
    />
  );
}

import { Checkbox, cn } from '@kit/ui';
import type { ApiScope } from '@vp/domain';
import { type ComponentPropsWithRef, useId } from 'react';
import {
  ScopeGroupContext,
  ScopePickerContext,
  useScopeGroup,
  useScopePicker,
} from './scope-picker.context';

export interface ScopePickerRootProps extends Omit<
  ComponentPropsWithRef<'fieldset'>,
  'onChange' | 'defaultValue'
> {
  value: readonly ApiScope[];
  onValueChange: (value: ApiScope[]) => void;
}

/** The scopes a token may use, as checkboxes in groups by what they touch; the value is the chosen scopes. */
export function ScopePickerRoot({
  value,
  onValueChange,
  disabled = false,
  className,
  ...props
}: ScopePickerRootProps) {
  const shared = {
    value,
    disabled,
    toggle: (scope: ApiScope, chosen: boolean) =>
      onValueChange(
        chosen
          ? [...value.filter((held) => held !== scope), scope]
          : value.filter((held) => held !== scope)
      ),
  };

  return (
    <ScopePickerContext value={shared}>
      <fieldset
        data-slot="scope-picker"
        disabled={disabled}
        className={cn('m-0 flex min-w-0 flex-col gap-stack border-0 p-0', className)}
        {...props}
      />
    </ScopePickerContext>
  );
}

export function ScopePickerLegend({ className, ...props }: ComponentPropsWithRef<'legend'>) {
  return (
    <legend
      data-slot="scope-picker-legend"
      className={cn('mb-1 p-0 text-label text-fg', className)}
      {...props}
    />
  );
}

export function ScopePickerGroup({ className, ...props }: ComponentPropsWithRef<'div'>) {
  const titleId = useId();

  return (
    <ScopeGroupContext value={{ titleId }}>
      <div
        role="group"
        aria-labelledby={titleId}
        data-slot="scope-picker-group"
        className={cn('flex flex-col gap-inline', className)}
        {...props}
      />
    </ScopeGroupContext>
  );
}

export function ScopePickerGroupTitle({ className, ...props }: ComponentPropsWithRef<'span'>) {
  const { titleId } = useScopeGroup('GroupTitle');

  return (
    <span
      id={titleId}
      data-slot="scope-picker-group-title"
      className={cn('text-caption text-fg-muted', className)}
      {...props}
    />
  );
}

export interface ScopePickerItemProps {
  scope: ApiScope;
  /** What the scope lets a token do, in the creator's words; the scope's own name is shown under it. */
  children: string;
}

export function ScopePickerItem({ scope, children }: ScopePickerItemProps) {
  const { value, toggle, disabled } = useScopePicker('Item');
  const id = useId();

  return (
    <div data-slot="scope-picker-item" className="flex items-start gap-inline">
      <Checkbox
        id={id}
        checked={value.includes(scope)}
        disabled={disabled}
        aria-describedby={`${id}-scope`}
        onCheckedChange={(checked) => toggle(scope, checked === true)}
        className="mt-0.5"
      />
      <span className="flex min-w-0 flex-col">
        <label htmlFor={id} className="text-body-sm text-fg">
          {children}
        </label>
        <code id={`${id}-scope`} className="font-mono text-caption text-fg-muted">
          {scope}
        </code>
      </span>
    </div>
  );
}

import { DisclosureControl, type DisclosureControlProps } from '@vp/components';
import { Button, type ButtonProps, cn } from '@vp/ui';
import type { ComponentPropsWithRef } from 'react';
import { BulkActionBarContext, useBulkActionBar } from './bulk-action-bar.context';

export interface BulkActionBarRootProps extends ComponentPropsWithRef<'div'> {
  /** Every action waits while one is running, so a second click cannot start a second batch. */
  pending?: boolean;
}

/** The actions on the selected rows of a table, one toolbar the batch bar shows while rows are selected. */
export function BulkActionBarRoot({
  pending = false,
  className,
  ...props
}: BulkActionBarRootProps) {
  return (
    <BulkActionBarContext value={{ pending }}>
      <div
        role="toolbar"
        data-slot="bulk-action-bar"
        className={cn('flex flex-wrap items-center gap-inline', className)}
        {...props}
      />
    </BulkActionBarContext>
  );
}

export type BulkActionBarActionProps = ComponentPropsWithRef<'button'> & {
  tone?: ButtonProps['tone'];
};

export function BulkActionBarAction({ disabled, ...props }: BulkActionBarActionProps) {
  const { pending } = useBulkActionBar('Action');

  return (
    <Button
      data-slot="bulk-action-bar-action"
      variant="outline"
      size="sm"
      disabled={disabled || pending}
      {...props}
    />
  );
}

export type BulkActionBarDisclosureProps = Omit<DisclosureControlProps, 'size'>;

/** Whether the authors of the selected comments are told; shared by every action in the bar. */
export function BulkActionBarDisclosure(props: BulkActionBarDisclosureProps) {
  const { pending } = useBulkActionBar('Disclosure');

  return <DisclosureControl size="sm" disabled={pending} {...props} />;
}

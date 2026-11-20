import { EmptyState } from '@kit/components';
import { Button, cn, Field, Icon, Input } from '@kit/ui';
import type { ComponentPropsWithRef } from 'react';
import { PASSWORD_FIELD } from './constants';
import type { AccessGateIcon, AccessGateSize } from './types';

export interface AccessGateRootProps extends ComponentPropsWithRef<'section'> {
  icon: AccessGateIcon;
  size?: AccessGateSize;
}

/** What stands in for a video the viewer may not watch yet: why, and the one way on. */
export function AccessGateRoot({
  icon,
  size = 'page',
  className,
  children,
  ...props
}: AccessGateRootProps) {
  return (
    <section
      data-slot="access-gate"
      className={cn('mx-auto box-border w-full max-w-prose', className)}
      {...props}
    >
      <EmptyState.Root size={size}>
        <span className="flex basis-full justify-center text-fg-muted">
          <Icon name={icon} size="lg" />
        </span>
        {children}
      </EmptyState.Root>
    </section>
  );
}

export function AccessGateTitle(props: ComponentPropsWithRef<'h1'>) {
  return (
    <EmptyState.Title asChild>
      <h1 {...props} />
    </EmptyState.Title>
  );
}

export interface AccessGatePasswordFormProps extends Omit<
  ComponentPropsWithRef<'form'>,
  'onSubmit' | 'children'
> {
  label: string;
  submitLabel: string;
  /** Why the last attempt was refused, in the viewer's words. */
  error?: string;
  pending?: boolean;
  onUnlock: (password: string) => void;
}

/** One password field and its submit; the password never reaches the URL, even before the page hydrates. */
export function AccessGatePasswordForm({
  label,
  submitLabel,
  error,
  pending = false,
  onUnlock,
  className,
  ...props
}: AccessGatePasswordFormProps) {
  return (
    <form
      method="post"
      className={cn('flex basis-full flex-col gap-inline text-start', className)}
      onSubmit={(event) => {
        event.preventDefault();
        const password = new FormData(event.currentTarget).get(PASSWORD_FIELD);
        if (typeof password === 'string' && password !== '') onUnlock(password);
      }}
      {...props}
    >
      <Field.Root invalid={error !== undefined} required>
        <Field.Label>{label}</Field.Label>
        <Input name={PASSWORD_FIELD} type="password" autoComplete="current-password" required />
        {error !== undefined && <Field.Error>{error}</Field.Error>}
      </Field.Root>
      <Button type="submit" tone="accent" variant="solid" loading={pending}>
        {submitLabel}
      </Button>
    </form>
  );
}

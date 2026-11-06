import { Button, cn, Icon, IconButton, Input } from '@vp/ui';
import { type ComponentPropsWithRef, useId, useState } from 'react';
import { CredentialFieldContext, useCredentialField } from './credential-field.context';

export interface CredentialFieldRootProps extends ComponentPropsWithRef<'div'> {
  /** Starts masked, with a Reveal part to show it. */
  secret?: boolean;
}

/** One value the creator pastes elsewhere: a read-only field with a Copy part, and a Reveal one when it is secret. */
export function CredentialFieldRoot({
  secret = false,
  className,
  ...props
}: CredentialFieldRootProps) {
  const labelId = useId();
  const [revealed, setRevealed] = useState(false);
  const shared = { secret, revealed, toggle: () => setRevealed((shown) => !shown), labelId };

  return (
    <CredentialFieldContext value={shared}>
      <div
        data-slot="credential-field"
        className={cn(
          'grid grid-cols-[1fr_auto] items-center gap-x-inline gap-y-1',
          className
        )}
        {...props}
      />
    </CredentialFieldContext>
  );
}

export function CredentialFieldLabel({ className, ...props }: ComponentPropsWithRef<'span'>) {
  const { labelId } = useCredentialField('Label');

  return (
    <span
      id={labelId}
      data-slot="credential-field-label"
      className={cn('col-span-2 text-label text-fg-muted', className)}
      {...props}
    />
  );
}

export interface CredentialFieldValueProps {
  children: string;
}

export function CredentialFieldValue({ children }: CredentialFieldValueProps) {
  const { secret, revealed, labelId } = useCredentialField('Value');

  return (
    <Input
      readOnly
      type={secret && !revealed ? 'password' : 'text'}
      value={children}
      aria-labelledby={labelId}
      autoComplete="off"
      spellCheck={false}
      className="font-mono"
    />
  );
}

export interface CredentialFieldRevealProps {
  showLabel: string;
  hideLabel: string;
}

export function CredentialFieldReveal({ showLabel, hideLabel }: CredentialFieldRevealProps) {
  const { secret, revealed, toggle } = useCredentialField('Reveal');

  if (!secret) {
    return null;
  }

  return (
    <IconButton aria-label={revealed ? hideLabel : showLabel} onClick={toggle}>
      <Icon name={revealed ? 'eye-off' : 'eye'} />
    </IconButton>
  );
}

export function CredentialFieldCopy(props: ComponentPropsWithRef<'button'>) {
  return <Button variant="outline" size="sm" {...props} />;
}

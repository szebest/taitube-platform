import { Button, type ButtonProps, Callout, Checkbox, cn, Input, useUiCopy } from '@vp/ui';
import { type ComponentPropsWithRef, useId, useState } from 'react';
import { SecretRevealContext, useSecretReveal } from './secret-reveal.context';

export interface SecretRevealRootProps extends ComponentPropsWithRef<'div'> {
  /** The secret, which the page holds only until this closes. */
  value: string;
}

/** A secret shown once: the warning, the value with Copy, and a Done that waits for the creator to say it is saved. */
export function SecretRevealRoot({ value, className, ...props }: SecretRevealRootProps) {
  const labelId = useId();
  const [copied, setCopied] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const shared = {
    value,
    labelId,
    copied,
    markCopied: () => setCopied(true),
    acknowledged,
    acknowledge: setAcknowledged,
  };

  return (
    <SecretRevealContext value={shared}>
      <div
        data-slot="secret-reveal"
        className={cn('flex flex-col gap-stack', className)}
        {...props}
      />
    </SecretRevealContext>
  );
}

export function SecretRevealNotice({ children, ...props }: ComponentPropsWithRef<'div'>) {
  return (
    <Callout.Root tone="warning" role="status" {...props}>
      <Callout.Icon />
      <Callout.Body>{children}</Callout.Body>
    </Callout.Root>
  );
}

export function SecretRevealLabel({ className, ...props }: ComponentPropsWithRef<'span'>) {
  const { labelId } = useSecretReveal('Label');

  return (
    <span
      id={labelId}
      data-slot="secret-reveal-label"
      className={cn('text-label text-fg', className)}
      {...props}
    />
  );
}

export function SecretRevealValue({ className }: { className?: string }) {
  const { value, labelId } = useSecretReveal('Value');

  return (
    <Input
      readOnly
      value={value}
      aria-labelledby={labelId}
      autoComplete="off"
      spellCheck={false}
      onFocus={(event) => event.currentTarget.select()}
      className={cn('font-mono', className)}
    />
  );
}

export interface SecretRevealCopyProps extends Omit<ButtonProps, 'onClick' | 'onCopy' | 'asChild'> {
  /** Writes the value wherever the app copies to; the part says Copied once it was asked. */
  onCopy: (value: string) => void;
}

export function SecretRevealCopy({ onCopy, children, ...props }: SecretRevealCopyProps) {
  const { value, copied, markCopied } = useSecretReveal('Copy');
  const copy = useUiCopy();

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => {
        onCopy(value);
        markCopied();
      }}
      {...props}
    >
      {children ?? (copied ? copy.copied : copy.copy)}
    </Button>
  );
}

export function SecretRevealAcknowledge({ children, className }: ComponentPropsWithRef<'label'>) {
  const { acknowledged, acknowledge } = useSecretReveal('Acknowledge');
  const id = useId();

  return (
    <div className={cn('flex items-center gap-inline', className)}>
      <Checkbox
        id={id}
        checked={acknowledged}
        onCheckedChange={(checked) => acknowledge(checked === true)}
      />
      <label htmlFor={id} className="text-body-sm text-fg">
        {children}
      </label>
    </div>
  );
}

/** Closes what showed the secret, and stays disabled until the creator ticked that they saved it. */
export function SecretRevealDone({ disabled, ...props }: Omit<ButtonProps, 'asChild'>) {
  const { acknowledged } = useSecretReveal('Done');

  return <Button variant="solid" tone="accent" disabled={!acknowledged || disabled} {...props} />;
}

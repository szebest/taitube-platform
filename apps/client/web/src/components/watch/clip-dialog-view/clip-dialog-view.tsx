import { Button, Field, Input, ResponsiveModal, useUiCopy } from '@vp/ui';
import type { ComponentProps, ComponentPropsWithRef } from 'react';

export interface ClipDialogViewRootProps extends ComponentProps<typeof ResponsiveModal.Root> {
  title: string;
  description: string;
  /** Where focus goes when the modal closes; the modal knows no trigger of its own to return it to. */
  onCloseAutoFocus?: ComponentProps<typeof ResponsiveModal.Content>['onCloseAutoFocus'];
}

/** The modal a clip is made in: its title and what it asks for, the form and the editor inside. */
export function ClipDialogViewRoot({
  title,
  description,
  onCloseAutoFocus,
  children,
  ...props
}: ClipDialogViewRootProps) {
  return (
    <ResponsiveModal.Root {...props}>
      <ResponsiveModal.Content size="lg" onCloseAutoFocus={onCloseAutoFocus}>
        <ResponsiveModal.Title>{title}</ResponsiveModal.Title>
        <ResponsiveModal.Description>{description}</ResponsiveModal.Description>
        {children}
      </ResponsiveModal.Content>
    </ResponsiveModal.Root>
  );
}

export function ClipDialogViewForm({ onSubmit, ...props }: ComponentPropsWithRef<'form'>) {
  return (
    <form
      data-slot="clip-dialog-form"
      className="flex flex-col gap-stack"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit?.(event);
      }}
      {...props}
    />
  );
}

export interface ClipDialogViewTitleFieldProps extends Omit<
  ComponentPropsWithRef<typeof Input>,
  'onChange'
> {
  label: string;
  onValueChange: (value: string) => void;
  /** The refusal to show; the field is invalid while there is one. */
  error?: string;
}

export function ClipDialogViewTitleField({
  label,
  onValueChange,
  error,
  ...props
}: ClipDialogViewTitleFieldProps) {
  return (
    <Field.Root invalid={error !== undefined} className="mt-stack">
      <Field.Label>{label}</Field.Label>
      <Input onChange={(event) => onValueChange(event.target.value)} {...props} />
      {error !== undefined && <Field.Error>{error}</Field.Error>}
    </Field.Root>
  );
}

export interface ClipDialogViewFooterProps {
  saveLabel: string;
  saving?: boolean;
  canSave: boolean;
}

export function ClipDialogViewFooter({ saveLabel, saving, canSave }: ClipDialogViewFooterProps) {
  const { cancel } = useUiCopy();

  return (
    <ResponsiveModal.Footer>
      <ResponsiveModal.Close asChild>
        <Button variant="ghost">{cancel}</Button>
      </ResponsiveModal.Close>
      <Button type="submit" variant="solid" tone="accent" loading={saving} disabled={!canSave}>
        {saveLabel}
      </Button>
    </ResponsiveModal.Footer>
  );
}

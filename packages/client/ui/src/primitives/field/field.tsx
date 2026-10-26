import { Slot } from 'radix-ui';
import {
  type ComponentPropsWithRef,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useState,
} from 'react';
import { useUiCopy } from '../../copy/ui-copy';
import { Icon } from '../icon';
import { Label, type LabelProps } from '../label';
import { VisuallyHidden } from '../visually-hidden';
import { FieldContext, useField } from './field.context';
import { fieldStyles } from './field.variants';
import type { FieldOrientation, FieldSize } from './types';

export interface FieldRootProps extends ComponentPropsWithRef<'div'> {
  orientation?: FieldOrientation;
  size?: FieldSize;
  invalid?: boolean;
  required?: boolean;
}

export function FieldRoot({
  orientation = 'vertical',
  size = 'md',
  invalid = false,
  required = false,
  className,
  ...props
}: FieldRootProps) {
  const id = useId();
  const [describedIds, setDescribedIds] = useState<readonly string[]>([]);
  const describe = useCallback((partId: string) => {
    setDescribedIds((ids) => [...ids, partId]);
    return () => setDescribedIds((ids) => ids.filter((other) => other !== partId));
  }, []);
  const shared = useMemo(
    () => ({
      orientation,
      size,
      invalid,
      required,
      controlId: `${id}control`,
      hintId: `${id}hint`,
      errorId: `${id}error`,
      describedBy: describedIds.join(' ') || undefined,
      describe,
    }),
    [orientation, size, invalid, required, id, describedIds, describe]
  );

  return (
    <FieldContext value={shared}>
      <div
        data-slot="field"
        data-invalid={invalid ? '' : undefined}
        className={fieldStyles({ orientation }).root({ className })}
        {...props}
      />
    </FieldContext>
  );
}

export function FieldLabel({ className, children, ...props }: LabelProps) {
  const shared = useField('Label');
  const { required } = useUiCopy();

  return (
    <Label
      data-slot="field-label"
      htmlFor={shared.controlId}
      className={fieldStyles(shared).label({ className })}
      {...props}
    >
      {children}
      {shared.required && (
        <>
          <span aria-hidden="true">*</span>
          <VisuallyHidden>{required}</VisuallyHidden>
        </>
      )}
    </Label>
  );
}

export function FieldHint({ className, ...props }: ComponentPropsWithRef<'p'>) {
  const shared = useField('Hint');
  const { describe, hintId } = shared;
  useEffect(() => describe(hintId), [describe, hintId]);

  return (
    <p
      data-slot="field-hint"
      id={hintId}
      className={fieldStyles(shared).hint({ className })}
      {...props}
    />
  );
}

export function FieldError({ className, children, ...props }: ComponentPropsWithRef<'p'>) {
  const shared = useField('Error');
  const { describe, errorId } = shared;
  useEffect(() => describe(errorId), [describe, errorId]);

  return (
    <p
      data-slot="field-error"
      id={errorId}
      aria-live="polite"
      className={fieldStyles(shared).error({ className })}
      {...props}
    >
      <Icon name="alert" size="sm" />
      {children}
    </p>
  );
}

interface FieldControlProps {
  id?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: true;
  'aria-required'?: true;
}

/** The id and the aria links of the control inside a `Field`; nothing outside one. */
export function useFieldControl(): FieldControlProps {
  const shared = useContext(FieldContext);
  if (shared === undefined) {
    return {};
  }

  return {
    id: shared.controlId,
    'aria-describedby': shared.describedBy,
    'aria-invalid': shared.invalid || undefined,
    'aria-required': shared.required || undefined,
  };
}

/** The size set on the `Field` around a control, for the control to fall back to. */
export function useFieldSize(): FieldSize | undefined {
  return useContext(FieldContext)?.size;
}

/** Wires the field's id and aria links onto its one child. */
export function FieldControl(props: ComponentPropsWithRef<typeof Slot.Root>) {
  return <Slot.Root {...useFieldControl()} {...props} />;
}

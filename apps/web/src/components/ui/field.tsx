import { type ReactNode, createContext, useContext, useId } from 'react';

import { type VariantProps, tv } from 'tailwind-variants';
import { Label } from './label';

/** The box every text-like control draws: an input, a textarea, a select trigger. */
export const controlVariants = tv({
  base: 'tw:w-full tw:min-w-0 tw:rounded-md tw:border tw:border-border-strong tw:bg-surface tw:px-3 tw:font-sans tw:text-fg tw:transition-colors tw:placeholder:text-fg-muted tw:hover:border-fg-muted tw:focus-ring tw:disabled:cursor-not-allowed tw:disabled:opacity-50 tw:aria-invalid:border-danger',
  variants: {
    kind: {
      input: '',
      textarea: 'tw:min-h-20 tw:resize-y tw:py-2',
      select:
        'tw:inline-flex tw:cursor-pointer tw:items-center tw:justify-between tw:gap-2 tw:data-placeholder:text-fg-muted tw:[&_svg]:size-4 tw:[&_svg]:shrink-0 tw:[&_svg]:text-fg-muted',
    },
    size: {
      sm: 'tw:text-sm',
      md: 'tw:text-sm',
      lg: 'tw:text-base',
    },
  },
  compoundVariants: [
    { kind: ['input', 'select'], size: 'sm', class: 'tw:h-8' },
    { kind: ['input', 'select'], size: 'md', class: 'tw:h-9' },
    { kind: ['input', 'select'], size: 'lg', class: 'tw:h-11' },
  ],
  defaultVariants: { kind: 'input', size: 'md' },
});

export const fieldVariants = tv({
  slots: {
    root: 'tw:font-sans',
    label: '',
    description: 'tw:m-0 tw:text-xs tw:text-fg-muted',
    error: 'tw:m-0 tw:text-xs tw:text-danger',
  },
  variants: {
    orientation: {
      vertical: { root: 'tw:flex tw:flex-col tw:gap-1.5' },
      horizontal: {
        root: 'tw:grid tw:grid-cols-[auto_1fr] tw:items-center tw:gap-x-3 tw:gap-y-1',
        label: 'tw:col-start-2 tw:row-start-1',
        description: 'tw:col-start-2',
        error: 'tw:col-start-2',
      },
    },
  },
  defaultVariants: { orientation: 'vertical' },
});

type FieldControlProps = {
  id?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: true;
};

const FieldContext = createContext<FieldControlProps>({});

/** The id and the description links of the control inside a `Field`; nothing outside one. */
export function useFieldControl(): FieldControlProps {
  return useContext(FieldContext);
}

export type FieldProps = VariantProps<typeof fieldVariants> & {
  label: ReactNode;
  description?: ReactNode;
  /** Marks the control invalid and tells assistive technology why. */
  error?: ReactNode;
  /** One control: `Input`, `Textarea`, `SelectTrigger` inside `Select`, `Checkbox`, `Switch`. */
  children: ReactNode;
  className?: string;
};

export function Field({ label, description, error, orientation, className, children }: FieldProps) {
  const id = useId();
  const controlId = `${id}control`;
  const descriptionId = description ? `${id}description` : undefined;
  const errorId = error ? `${id}error` : undefined;
  const describedBy = [descriptionId, errorId].filter(Boolean).join(' ') || undefined;
  const slots = fieldVariants({ orientation });

  return (
    <FieldContext.Provider
      value={{
        id: controlId,
        'aria-describedby': describedBy,
        'aria-invalid': error ? true : undefined,
      }}
    >
      <div
        data-slot="field"
        data-invalid={error ? '' : undefined}
        className={slots.root({ className })}
      >
        <Label htmlFor={controlId} className={slots.label()}>
          {label}
        </Label>
        {children}
        {description && (
          <p data-slot="field-description" id={descriptionId} className={slots.description()}>
            {description}
          </p>
        )}
        {error && (
          <p data-slot="field-error" id={errorId} className={slots.error()}>
            {error}
          </p>
        )}
      </div>
    </FieldContext.Provider>
  );
}

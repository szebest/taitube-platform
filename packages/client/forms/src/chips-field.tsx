import { Chip, Field, Icon, Input } from '@vp/ui';
import { type KeyboardEvent, useState } from 'react';

import { fieldError } from './field-error';
import { useFieldContext } from './form-context';

export type ChipsFieldProps = {
  label: string;
  placeholder?: string;
  removeLabel: (chip: string) => string;
};

export function ChipsField({ label, placeholder, removeLabel }: ChipsFieldProps) {
  const field = useFieldContext<string[]>();
  const [draft, setDraft] = useState('');
  const chips = field.state.value;
  const error = fieldError(field.state.meta);

  const add = () => {
    const chip = draft.trim();
    setDraft('');
    if (chip !== '' && !chips.includes(chip)) field.handleChange([...chips, chip]);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') return;

    event.preventDefault();
    add();
  };

  return (
    <Field.Root invalid={error !== undefined}>
      <Field.Label>{label}</Field.Label>
      {chips.length > 0 && (
        <ul className="tw:flex tw:flex-wrap tw:gap-inline">
          {chips.map((chip) => (
            <li key={chip}>
              <Chip
                size="sm"
                aria-label={removeLabel(chip)}
                onClick={() => field.handleChange(chips.filter((other) => other !== chip))}
              >
                {chip}
                <Icon name="close" size="sm" />
              </Chip>
            </li>
          ))}
        </ul>
      )}
      <Input
        name={field.name}
        value={draft}
        placeholder={placeholder}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => {
          add();
          field.handleBlur();
        }}
      />
      {error !== undefined && <Field.Error>{error}</Field.Error>}
    </Field.Root>
  );
}

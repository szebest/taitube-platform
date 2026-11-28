import type { ComponentProps } from 'react';
import { type SelectFieldProps, SelectField } from '../../select-field';

type Quality = 'low' | 'high';

expectTypeOf<SelectFieldProps<Quality>['options']>().toEqualTypeOf<readonly Quality[]>();
expectTypeOf<SelectFieldProps<Quality>['labelOf']>().toEqualTypeOf<
  ((option: Quality) => string) | undefined
>();
expectTypeOf<ComponentProps<typeof SelectField<Quality>>>().toEqualTypeOf<
  SelectFieldProps<Quality>
>();

const options = ['low', 'high'] as const;

function _optionsInfer() {
  return SelectField({ label: 'Quality', options, labelOf: (option) => option.toUpperCase() });
}

function _labelOfTakesTheOption() {
  return SelectField({
    label: 'Quality',
    options,
    labelOf: (option) => {
      expectTypeOf(option).toEqualTypeOf<'low' | 'high'>();
      return option;
    },
  });
}

function _optionOutsideTheUnion() {
  // @ts-expect-error an explicit union closes the list, 'high' is not in it
  return SelectField<'low'>({ label: 'Quality', options: ['high'] });
}

// @ts-expect-error the options are strings, a number has no place in the list
SelectField({ label: 'Size', options: [1, 2] });

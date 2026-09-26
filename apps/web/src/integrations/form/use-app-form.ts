import { createFormHook } from '@tanstack/react-form';

import { FileField } from './file-field';
import { fieldContext, formContext } from './form-context';
import { SelectField } from './select-field';
import { TextField } from './text-field';

export const { useAppForm } = createFormHook({
  fieldContext,
  formContext,
  fieldComponents: { TextField, SelectField, FileField },
  formComponents: {},
});

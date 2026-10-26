import { permittedFieldsOf } from '@casl/ability/extra';
import type { AppAbility, AppAction, AppSubjects } from '../types/index';

export function pickPermittedFields<TData extends object>({
  ability,
  action,
  subject,
  data,
}: {
  ability: AppAbility;
  action: AppAction;
  subject: AppSubjects | undefined;
  data: TData;
}): Partial<TData> {
  if (!subject) return {};
  const permitted = new Set(
    permittedFieldsOf(ability, action, subject, {
      fieldsFrom: (rule) => rule.fields ?? Object.keys(data),
    })
  );
  return Object.fromEntries(
    Object.entries(data).filter(([key]) => permitted.has(key))
  ) as Partial<TData>;
}

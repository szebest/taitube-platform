import { type InvalidField, invalidField } from '../failures';

export type ViewTooShort = InvalidField<{ watchSeconds: number; requiredSeconds: number }>;

export function viewTooShort(watchSeconds: number, requiredSeconds: number): ViewTooShort {
  return invalidField('watchSeconds', `A view needs at least ${requiredSeconds}s of watch time`, {
    watchSeconds,
    requiredSeconds,
  });
}

import type { AnyFieldMeta } from '@tanstack/react-form';

export function fieldError({ isTouched, errors }: AnyFieldMeta): string | undefined {
  if (!isTouched) return undefined;
  const [first] = errors;
  return typeof first === 'string' ? first : undefined;
}

import type { ListOptions } from '@kit/intl';
import { defineKind, isRecord } from '../kind';

const isStringList = (value: unknown): value is readonly string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string');

/** `{names:list}`: a list of strings, options from `ListOptions`. */
export const listKind = defineKind({
  name: 'list',
  config: 'optional',
  arg: isStringList,
  options: (value): value is ListOptions => isRecord(value),
  render: (value, options, { intl }) => intl.format({ type: 'list', value, options }),
});

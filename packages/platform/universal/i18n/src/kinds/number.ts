import type { NumberOptions } from '@vp/intl';
import { defineKind, isRecord } from '../kind';

const isNumber = (value: unknown): value is number => typeof value === 'number';

/** `{n:number}`: a number, options from `NumberOptions`, which `@vp/intl` checks key by key. */
export const numberKind = defineKind({
  name: 'number',
  config: 'optional',
  arg: isNumber,
  options: (value): value is NumberOptions => isRecord(value),
  render: (value, options, { intl }) => intl.format({ type: 'number', value, options }),
});

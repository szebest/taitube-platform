import type { DateOptions } from '@kit/intl';
import { defineKind, isRecord } from '../kind';

const isString = (value: unknown): value is string => typeof value === 'string';

/** `{when:date}`: an ISO instant, options from `DateOptions`. */
export const dateKind = defineKind({
  name: 'date',
  config: 'optional',
  arg: isString,
  options: (value): value is DateOptions => isRecord(value),
  render: (value, options, { intl }) => intl.format({ type: 'date', value, options }),
});

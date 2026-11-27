import { date, list, number } from '@kit/intl';
import { messageKind } from '../kind';
import { enumKind } from './enum';
import { pluralKind } from './plural';

export const numberKind = messageKind(number, 'optional');
export const dateKind = messageKind(date, 'optional');
export const listKind = messageKind(list, 'optional');

export { enumKind, pluralKind };
export type { Branches } from './plural';

/** `number`, `date` and `list` from `@kit/intl`, `plural` and `enum` of messages alone. */
export const builtInKinds = [numberKind, dateKind, listKind, pluralKind, enumKind] as const;

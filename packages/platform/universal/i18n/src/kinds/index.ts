import { dateKind } from './date';
import { enumKind } from './enum';
import { listKind } from './list';
import { numberKind } from './number';
import { pluralKind } from './plural';

export { dateKind, enumKind, listKind, numberKind, pluralKind };
export type { Branches } from './plural';

/** `number`, `date`, `list`, `plural` and `enum`, written with `defineKind` as an app writes its own. */
export const builtInKinds = [numberKind, dateKind, listKind, pluralKind, enumKind] as const;

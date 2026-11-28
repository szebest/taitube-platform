import type { ListItem } from '@kit/intl';
import type { ParamsOf } from '../../message';
import { defineParams } from '../../params';
import { engine } from '../fixtures';

const { dt } = engine;

const greeting = dt('Hi {name}, {count:number} new in {names:list} since {when:date}');

expectTypeOf<ParamsOf<typeof greeting>>().toEqualTypeOf<{
  readonly name: string | number;
  readonly count: number;
  readonly names: readonly ListItem[];
  readonly when: string;
}>();

// @ts-expect-error InvalidParamName: a positional name
dt('{0}');

// @ts-expect-error InvalidParamName: a numbered name
dt('{count2}');

// @ts-expect-error InvalidParamName: not lower camelCase
dt('{Name}');

// @ts-expect-error InvalidParamName: not letters only
dt('{a_b}');

// @ts-expect-error DuplicateParam: one name twice
dt('{count} of {count}');

// @ts-expect-error ClashingKinds: one name with two kinds
dt('{price:number} or {price:date}', { date: { price: {} } });

// @ts-expect-error ClashingKinds: one name bare and typed
dt('{name} {name:number}');

// @ts-expect-error UnknownParam: a name outside the vocabulary
dt('{cnt}');

// @ts-expect-error UnknownKind: a kind the engine does not list
dt('{price:money}');

defineParams(['count', 'userName'] as const);

// @ts-expect-error InvalidParamName: a vocabulary holds lower camelCase names only
defineParams(['count', 'user_name'] as const);

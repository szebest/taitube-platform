import { ok } from '@kit/result';
import { isString } from '../inputs';
import { type TaggedOf, defineKind, optionKeys } from '../kind';

const FIRST_STRONG_ISOLATE = '⁨';
const POP_DIRECTIONAL_ISOLATE = '⁩';

/**
 * Wraps text the viewer wrote so it keeps its own direction inside a sentence of the other one
 * (`ahmed` replied, in Arabic). Opt-in per placeholder: every other output stays as it was.
 */
export const isolate = defineKind({
  name: 'isolate',
  arg: isString,
  options: optionKeys<Record<string, never>>([]),
  render: (text) => ok(`${FIRST_STRONG_ISOLATE}${text}${POP_DIRECTIONAL_ISOLATE}`),
});

/** @public */
export type IsolateValue = TaggedOf<typeof isolate>;

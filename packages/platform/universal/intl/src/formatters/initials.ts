import { all, err, map } from '@kit/result';
import { unrenderable } from '../failures';
import { upperFirstGrapheme } from '../first-grapheme';
import { isString } from '../inputs';
import { type OptionKeys, type TaggedOf, defineKind, optionKeys } from '../kind';

const DEFAULT_COUNT = 2;

const INITIALS_OPTION_KEYS = ['count'] as const satisfies OptionKeys<InitialsOptions>;

/** `count` is how many words contribute a letter, the first ones. */
export interface InitialsOptions {
  readonly count?: number;
}

/** `Ada Lovelace` is `AL`, `ilker` in `tr` is `İ`, and an emoji is whole, never half. */
export const initials = defineKind({
  name: 'initials',
  arg: isString,
  options: optionKeys<InitialsOptions>(INITIALS_OPTION_KEYS),
  render: (name, options, context) => {
    const { count = DEFAULT_COUNT } = options ?? {};
    if (!Number.isInteger(count) || count < 1) {
      return err(unrenderable('initials', `count ${count} is not a whole number of letters`));
    }
    const words = name.split(/\s+/).filter((word) => word !== '');
    if (words.length === 0) return err(unrenderable('initials', 'the name has no letters'));
    return map(
      all(words.slice(0, count).map((word) => upperFirstGrapheme(word, context))),
      (letters) => letters.map(({ first }) => first).join('')
    );
  },
});

/** @public */
export type InitialsValue = TaggedOf<typeof initials>;

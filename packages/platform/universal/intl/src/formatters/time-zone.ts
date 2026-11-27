import { andThen, err, ok } from '@kit/result';
import { type User, USER } from '../context';
import { unrenderable } from '../failures';
import { type OptionKeys, type TaggedOf, defineKind, optionKeys } from '../kind';
import { referenceInstant } from '../reference-instant';

const TIME_ZONE_OPTION_KEYS = ['style', 'at'] as const satisfies OptionKeys<
  TimeZoneOptions,
  'style' | 'at'
>;

const TIME_ZONE_NAME = {
  long: 'long',
  short: 'short',
  offset: 'shortOffset',
} as const;

/**
 * `at` is the instant the name is for, else the context's: a zone is `CET` in winter and `CEST` in
 * summer, so a name with no instant is a guess.
 */
export interface TimeZoneOptions {
  readonly style?: keyof typeof TIME_ZONE_NAME;
  readonly at?: string;
}

const isZone = (value: unknown): value is string | User => typeof value === 'string';

/** An IANA zone as the viewer reads it: `Central European Summer Time`, `CEST` or `GMT+2`. `USER` is the viewer's own. */
export const timeZone = defineKind({
  name: 'timeZone',
  arg: isZone,
  options: optionKeys<TimeZoneOptions>(TIME_ZONE_OPTION_KEYS),
  render: (zone, options, context) => {
    const { style = 'long', at } = options ?? {};
    return andThen(referenceInstant('timeZone', at, context), (instant) =>
      andThen(
        context.cache.dateTimeFormat(context.locale, {
          timeZone: zone === USER ? context.timeZone : zone,
          timeZoneName: TIME_ZONE_NAME[style],
        }),
        (format) => {
          const name = format.formatToParts(instant).find(({ type }) => type === 'timeZoneName');
          return name === undefined
            ? err(unrenderable('timeZone', `no name for ${zone}`))
            : ok(name.value);
        }
      )
    );
  },
});

/** @public */
export type TimeZoneValue = TaggedOf<typeof timeZone>;

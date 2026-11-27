import { type Result, andThen, err, ok, tryCatch } from '@kit/result';
import {
  type DurationFormatLike,
  type DurationFormatOptions,
  createDurationFallback,
} from './duration-fallback';
import { type FormatFailure, unrenderable, unsupportedLocale } from './failures';

const MAX_ENTRIES_PER_DESCRIPTOR = 256;

type Built<T> = Result<T, FormatFailure>;

interface DurationFormatConstructor {
  new (locale: string, options: DurationFormatOptions): DurationFormatLike;
  supportedLocalesOf(locales: string[]): string[];
}

/**
 * The `Intl` constructors a cache builds from. `Intl` itself is one; an engine without
 * `DurationFormat` (or a spec standing in for one) leaves it out and gets the fallback.
 * @public
 */
export interface IntlEnvironment {
  readonly NumberFormat: typeof Intl.NumberFormat;
  readonly DateTimeFormat: typeof Intl.DateTimeFormat;
  readonly RelativeTimeFormat: typeof Intl.RelativeTimeFormat;
  readonly PluralRules: typeof Intl.PluralRules;
  readonly ListFormat: typeof Intl.ListFormat;
  readonly DisplayNames: typeof Intl.DisplayNames;
  readonly Collator: typeof Intl.Collator;
  readonly Segmenter: typeof Intl.Segmenter;
  readonly DurationFormat?: DurationFormatConstructor;
  readonly supportedValuesOf: typeof Intl.supportedValuesOf;
}

/**
 * How to build one kind of `Intl` object: a kind needing a constructor the cache has no
 * accessor for passes its own to `get`. `is` recognises what `create` built.
 * @public
 */
export interface IntlDescriptor<T, Options extends object> {
  readonly name: string;
  create(locale: string, options: Options): T;
  supportedLocalesOf(locales: string[]): string[];
  is(value: unknown): value is T;
}

/**
 * A shared `Intl` object per `(descriptor, locale, options)`. Constructing one costs about two
 * orders of magnitude more than using it, and a feed formats hundreds per scroll. Failures are
 * kept too, so an unsupported locale is detected once rather than on every format.
 */
export interface IntlCache {
  get<T, Options extends object>(
    descriptor: IntlDescriptor<T, Options>,
    locale: string,
    options: Options
  ): Built<T>;
  numberFormat(locale: string, options?: Intl.NumberFormatOptions): Built<Intl.NumberFormat>;
  dateTimeFormat(locale: string, options?: Intl.DateTimeFormatOptions): Built<Intl.DateTimeFormat>;
  relativeTimeFormat(
    locale: string,
    options?: Intl.RelativeTimeFormatOptions
  ): Built<Intl.RelativeTimeFormat>;
  pluralRules(locale: string, options?: Intl.PluralRulesOptions): Built<Intl.PluralRules>;
  listFormat(locale: string, options?: Intl.ListFormatOptions): Built<Intl.ListFormat>;
  displayNames(locale: string, options: Intl.DisplayNamesOptions): Built<Intl.DisplayNames>;
  collator(locale: string, options?: Intl.CollatorOptions): Built<Intl.Collator>;
  segmenter(locale: string, options?: Intl.SegmenterOptions): Built<Intl.Segmenter>;
  durationFormat(locale: string, options: DurationFormatOptions): Built<DurationFormatLike>;
  currencies(): ReadonlySet<string>;
  clear(): void;
}

interface Constructor<T, Options> {
  new (locale: string, options: Options): T;
  supportedLocalesOf(locales: string[]): string[];
}

function describe<T, Options extends object>(
  name: string,
  Native: Constructor<T, Options>
): IntlDescriptor<T, Options> {
  return {
    name,
    create: (locale, options) => new Native(locale, options),
    supportedLocalesOf: (locales) => Native.supportedLocalesOf(locales),
    is: (value): value is T => value instanceof Native,
  };
}

function optionsKey(options: object): string {
  const defined = Object.entries(options).filter(([, value]) => value !== undefined);
  defined.sort(([a], [b]) => (a < b ? -1 : 1));
  return JSON.stringify(defined);
}

class BoundedMemo<T> {
  private readonly entries = new Map<string, Built<T>>();

  get(locale: string, options: object, build: () => Built<T>): Built<T> {
    const key = `${locale}|${optionsKey(options)}`;
    const hit = this.entries.get(key);
    if (hit !== undefined) return hit;

    const built = build();
    const oldest = this.entries.keys().next();
    if (this.entries.size >= MAX_ENTRIES_PER_DESCRIPTOR && !oldest.done) {
      this.entries.delete(oldest.value);
    }
    this.entries.set(key, built);
    return built;
  }

  clear(): void {
    this.entries.clear();
  }
}

function construct<T, Options extends object>(
  descriptor: IntlDescriptor<T, Options>,
  locale: string,
  options: Options
): Built<T> {
  const supported = tryCatch(
    () => descriptor.supportedLocalesOf([locale]),
    () => unsupportedLocale(locale)
  );
  return andThen(supported, (found): Built<T> =>
    found.length === 0
      ? err(unsupportedLocale(locale))
      : tryCatch(
          () => descriptor.create(locale, options),
          (cause) => unrenderable(descriptor.name, String(cause))
        )
  );
}

class MemoisedIntl implements IntlCache {
  private readonly memos = new Map<object, BoundedMemo<unknown>>();
  private readonly fallbacks = new BoundedMemo<DurationFormatLike>();
  private readonly number;
  private readonly dateTime;
  private readonly relativeTime;
  private readonly plural;
  private readonly list;
  private readonly names;
  private readonly collation;
  private readonly segments;
  private readonly duration;
  private knownCurrencies: ReadonlySet<string> | undefined;

  constructor(private readonly env: IntlEnvironment) {
    this.number = describe('NumberFormat', env.NumberFormat);
    this.dateTime = describe('DateTimeFormat', env.DateTimeFormat);
    this.relativeTime = describe('RelativeTimeFormat', env.RelativeTimeFormat);
    this.plural = describe('PluralRules', env.PluralRules);
    this.list = describe('ListFormat', env.ListFormat);
    this.names = describe('DisplayNames', env.DisplayNames);
    this.collation = describe('Collator', env.Collator);
    this.segments = describe('Segmenter', env.Segmenter);
    this.duration = env.DurationFormat && describe('DurationFormat', env.DurationFormat);
  }

  get<T, Options extends object>(
    descriptor: IntlDescriptor<T, Options>,
    locale: string,
    options: Options
  ): Built<T> {
    const memo = this.memos.get(descriptor) ?? new BoundedMemo<unknown>();
    this.memos.set(descriptor, memo);
    const built = memo.get(locale, options, () => construct(descriptor, locale, options));
    if (!built.ok) return built;
    return descriptor.is(built.value)
      ? ok(built.value)
      : err(unrenderable(descriptor.name, 'a second descriptor shares this one'));
  }

  numberFormat(locale: string, options: Intl.NumberFormatOptions = {}) {
    return this.get(this.number, locale, options);
  }

  dateTimeFormat(locale: string, options: Intl.DateTimeFormatOptions = {}) {
    return this.get(this.dateTime, locale, options);
  }

  relativeTimeFormat(locale: string, options: Intl.RelativeTimeFormatOptions = {}) {
    return this.get(this.relativeTime, locale, options);
  }

  pluralRules(locale: string, options: Intl.PluralRulesOptions = {}) {
    return this.get(this.plural, locale, options);
  }

  listFormat(locale: string, options: Intl.ListFormatOptions = {}) {
    return this.get(this.list, locale, options);
  }

  displayNames(locale: string, options: Intl.DisplayNamesOptions) {
    return this.get(this.names, locale, options);
  }

  collator(locale: string, options: Intl.CollatorOptions = {}) {
    return this.get(this.collation, locale, options);
  }

  segmenter(locale: string, options: Intl.SegmenterOptions = {}) {
    return this.get(this.segments, locale, options);
  }

  durationFormat(locale: string, options: DurationFormatOptions) {
    if (this.duration !== undefined) return this.get(this.duration, locale, options);
    return this.fallbacks.get(locale, options, () => createDurationFallback(locale, options, this));
  }

  currencies(): ReadonlySet<string> {
    this.knownCurrencies ??= new Set(this.env.supportedValuesOf('currency'));
    return this.knownCurrencies;
  }

  clear(): void {
    this.memos.clear();
    this.fallbacks.clear();
  }
}

/**
 * One per owner with a lifetime - a provider per locale, a container per process - never a
 * module constant. `env` is where the constructors come from: `Intl` unless a caller says else.
 */
export function createIntlCache(env: IntlEnvironment = Intl): IntlCache {
  return new MemoisedIntl(env);
}

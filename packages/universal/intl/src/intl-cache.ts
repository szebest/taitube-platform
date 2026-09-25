import { type Result, andThen, err, tryCatch } from '@vp/result';
import {
  type DurationFormatLike,
  type DurationFormatOptions,
  createDurationFallback,
} from './duration-fallback';
import { type FormatFailure, describeCause, unrenderable, unsupportedLocale } from './failures';

const MAX_ENTRIES_PER_KIND = 256;

type Built<T> = Result<T, FormatFailure>;

/**
 * A shared `Intl` object per `(locale, kind, options)`. Constructing one costs about two orders of
 * magnitude more than using it, and a feed formats hundreds per scroll. Failures are kept too, so
 * an unsupported locale is detected once rather than on every format.
 */
export interface IntlCache {
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

class BoundedMemo<T> {
  private readonly entries = new Map<string, Built<T>>();

  get(locale: string, options: object, build: () => Built<T>): Built<T> {
    const key = `${locale}|${optionsKey(options)}`;
    const hit = this.entries.get(key);
    if (hit !== undefined) return hit;

    const built = build();
    const oldest = this.entries.keys().next();
    if (this.entries.size >= MAX_ENTRIES_PER_KIND && !oldest.done)
      this.entries.delete(oldest.value);
    this.entries.set(key, built);
    return built;
  }

  clear(): void {
    this.entries.clear();
  }
}

function optionsKey(options: object): string {
  const defined = Object.entries(options).filter(([, value]) => value !== undefined);
  defined.sort(([a], [b]) => (a < b ? -1 : 1));
  return JSON.stringify(defined);
}

type SupportedLocalesOf = (locales: string[]) => string[];

function construct<T>(
  kind: string,
  locale: string,
  supportedLocalesOf: SupportedLocalesOf,
  build: () => T
): Built<T> {
  const supported = tryCatch(
    () => supportedLocalesOf([locale]),
    () => unsupportedLocale(locale)
  );
  return andThen(
    supported,
    (found): Built<T> =>
      found.length === 0
        ? err(unsupportedLocale(locale))
        : tryCatch(build, (cause) => unrenderable(kind, describeCause(cause)))
  );
}

interface DurationFormatConstructor {
  new (locale: string, options: DurationFormatOptions): DurationFormatLike;
}

function nativeDurationFormat(): DurationFormatConstructor | undefined {
  // TypeScript 5.9's lib has no Intl.DurationFormat, and older engines ship none.
  return (Intl as { DurationFormat?: DurationFormatConstructor }).DurationFormat;
}

class MemoisedIntl implements IntlCache {
  private readonly numbers = new BoundedMemo<Intl.NumberFormat>();
  private readonly dates = new BoundedMemo<Intl.DateTimeFormat>();
  private readonly relatives = new BoundedMemo<Intl.RelativeTimeFormat>();
  private readonly plurals = new BoundedMemo<Intl.PluralRules>();
  private readonly lists = new BoundedMemo<Intl.ListFormat>();
  private readonly names = new BoundedMemo<Intl.DisplayNames>();
  private readonly collators = new BoundedMemo<Intl.Collator>();
  private readonly segmenters = new BoundedMemo<Intl.Segmenter>();
  private readonly durations = new BoundedMemo<DurationFormatLike>();
  private knownCurrencies: ReadonlySet<string> | undefined;

  numberFormat(locale: string, options: Intl.NumberFormatOptions = {}) {
    return this.numbers.get(locale, options, () =>
      construct('NumberFormat', locale, Intl.NumberFormat.supportedLocalesOf, () => {
        return new Intl.NumberFormat(locale, options);
      })
    );
  }

  dateTimeFormat(locale: string, options: Intl.DateTimeFormatOptions = {}) {
    return this.dates.get(locale, options, () =>
      construct('DateTimeFormat', locale, Intl.DateTimeFormat.supportedLocalesOf, () => {
        return new Intl.DateTimeFormat(locale, options);
      })
    );
  }

  relativeTimeFormat(locale: string, options: Intl.RelativeTimeFormatOptions = {}) {
    return this.relatives.get(locale, options, () =>
      construct('RelativeTimeFormat', locale, Intl.RelativeTimeFormat.supportedLocalesOf, () => {
        return new Intl.RelativeTimeFormat(locale, options);
      })
    );
  }

  pluralRules(locale: string, options: Intl.PluralRulesOptions = {}) {
    return this.plurals.get(locale, options, () =>
      construct('PluralRules', locale, Intl.PluralRules.supportedLocalesOf, () => {
        return new Intl.PluralRules(locale, options);
      })
    );
  }

  listFormat(locale: string, options: Intl.ListFormatOptions = {}) {
    return this.lists.get(locale, options, () =>
      construct('ListFormat', locale, Intl.ListFormat.supportedLocalesOf, () => {
        return new Intl.ListFormat(locale, options);
      })
    );
  }

  displayNames(locale: string, options: Intl.DisplayNamesOptions) {
    return this.names.get(locale, options, () =>
      construct('DisplayNames', locale, Intl.DisplayNames.supportedLocalesOf, () => {
        return new Intl.DisplayNames(locale, options);
      })
    );
  }

  collator(locale: string, options: Intl.CollatorOptions = {}) {
    return this.collators.get(locale, options, () =>
      construct('Collator', locale, Intl.Collator.supportedLocalesOf, () => {
        return new Intl.Collator(locale, options);
      })
    );
  }

  segmenter(locale: string, options: Intl.SegmenterOptions = {}) {
    return this.segmenters.get(locale, options, () =>
      construct('Segmenter', locale, Intl.Segmenter.supportedLocalesOf, () => {
        return new Intl.Segmenter(locale, options);
      })
    );
  }

  durationFormat(locale: string, options: DurationFormatOptions) {
    return this.durations.get(locale, options, () => {
      const Native = nativeDurationFormat();
      if (Native === undefined) return createDurationFallback(locale, options, this);
      return construct('DurationFormat', locale, Intl.NumberFormat.supportedLocalesOf, () => {
        return new Native(locale, options);
      });
    });
  }

  currencies(): ReadonlySet<string> {
    this.knownCurrencies ??= new Set(Intl.supportedValuesOf('currency'));
    return this.knownCurrencies;
  }

  clear(): void {
    for (const memo of [
      this.numbers,
      this.dates,
      this.relatives,
      this.plurals,
      this.lists,
      this.names,
      this.collators,
      this.segmenters,
      this.durations,
    ]) {
      memo.clear();
    }
  }
}

/** One per owner with a lifetime - a provider per locale, a container per process - never a module constant. */
export function createIntlCache(): IntlCache {
  return new MemoisedIntl();
}

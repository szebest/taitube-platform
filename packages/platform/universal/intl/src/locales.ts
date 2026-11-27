export interface LocaleDetails {
  /** The language's name in itself, which is how a chooser lists it. */
  readonly name: string;
  readonly direction: 'ltr' | 'rtl';
}

export interface Locales<Tag extends string, Details extends LocaleDetails> {
  /** The locale the app writes its source catalogue in, where every chain ends. */
  readonly source: Tag;
  readonly tags: readonly Tag[];
  readonly details: Readonly<Record<Tag, Details>>;
  readonly isSupported: (tag: string) => tag is Tag;
}

interface LocalesDefinition<Tag extends string, Details extends LocaleDetails> {
  readonly source: NoInfer<Tag>;
  readonly details: Readonly<Record<Tag, Details>>;
}

/** The locales an app serves, registered by the app: this package holds no locale list of its own. */
export function defineLocales<const Tag extends string, Details extends LocaleDetails>({
  source,
  details,
}: LocalesDefinition<Tag, Details>): Locales<Tag, Details> {
  const isSupported = (tag: string): tag is Tag => Object.hasOwn(details, tag);
  return Object.freeze({
    source,
    tags: Object.keys(details).filter(isSupported),
    details,
    isSupported,
  });
}

import type { Message, Params } from './define';
import type { en } from './en';

type Catalogue = typeof en;

/** A translation: any feature or message may be missing, and the fallback chain fills the gap. */
type PartialCatalogue = {
  readonly [F in keyof Catalogue]?: { readonly [M in keyof Catalogue[F]]?: Message };
};

export type Catalogues = Readonly<Record<string, PartialCatalogue>> & { readonly en: Catalogue };

export type MessageKey = {
  [F in keyof Catalogue]: `${F & string}.${keyof Catalogue[F] & string}`;
}[keyof Catalogue];

type MessageAt<K extends MessageKey> = K extends `${infer F extends keyof Catalogue}.${infer M}`
  ? M extends keyof Catalogue[F]
    ? Catalogue[F][M]
    : never
  : never;

export type ArgsOf<K extends MessageKey> = MessageAt<K> extends Message<infer T, infer C>
  ? Params<T, C>
  : never;

/** A key whose message takes no arguments, and so can render with nothing but its name. */
export type ArgumentFreeKey = {
  [K in MessageKey]: keyof ArgsOf<K> extends never ? K : never;
}[MessageKey];

type LooseCatalogue = Readonly<Record<string, Readonly<Record<string, Message>> | undefined>>;

export function findMessage(
  catalogue: LooseCatalogue | undefined,
  key: string
): Message | undefined {
  const [feature = '', name = ''] = key.split('.');
  return catalogue?.[feature]?.[name];
}

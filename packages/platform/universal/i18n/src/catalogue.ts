import type { AnyMessage, ParamsOf } from './message';

/** Namespaces of messages, `{ videos: { views: dt(...) } }`: the shape of an app's source catalogue. */
export type CatalogueShape = {
  readonly [namespace: string]: { readonly [name: string]: AnyMessage };
};

/** Any catalogue as the renderer reads it: a translation may miss a namespace or a message. */
export type LooseCatalogue = {
  readonly [namespace: string]: { readonly [name: string]: AnyMessage | undefined } | undefined;
};

export type MessageKey<App> = {
  [F in keyof App]: `${F & string}.${keyof App[F] & string}`;
}[keyof App];

type MessageAt<App, K> = K extends `${infer F}.${infer M}`
  ? F extends keyof App
    ? M extends keyof App[F]
      ? App[F][M]
      : never
    : never
  : never;

export type ArgsOf<App, K> = ParamsOf<MessageAt<App, K>>;

/** A key whose message takes no arguments, and so renders with nothing but its name. */
export type ArgumentFreeKey<App> = {
  [K in MessageKey<App>]: keyof ArgsOf<App, K> extends never ? K : never;
}[MessageKey<App>];

type SameParams<M> = AnyMessage & {
  readonly _params?: (params: ParamsOf<M>) => ParamsOf<M>;
};

/**
 * Another locale's catalogue for `Source`: any namespace or message may be missing (the chain fills
 * it), and a message present takes exactly the source message's params.
 */
export type Translation<Source> = {
  readonly [F in keyof Source]?: { readonly [M in keyof Source[F]]?: SameParams<Source[F][M]> };
};

export type NamespaceCollision<Namespace extends string> = `NamespaceCollision<'${Namespace}'>`;

type Flatten<T> = { [K in keyof T]: T[K] };

/** The catalogues of one app merged, or `NamespaceCollision` when two share a namespace. */
export type DisjointNamespaces<
  Parts extends readonly CatalogueShape[],
  Merged = unknown,
> = Parts extends readonly [infer Head, ...infer Rest extends readonly CatalogueShape[]]
  ? [keyof Head & keyof Merged] extends [never]
    ? DisjointNamespaces<Rest, Merged & Head>
    : NamespaceCollision<keyof Head & keyof Merged & string>
  : Flatten<Merged>;

/** An app's catalogues: the source locale's, complete, and any translations of it. */
export interface CatalogueSet<App> {
  readonly locale: string;
  readonly source: App;
  readonly translations: { readonly [locale: string]: Translation<App> };
}

/** The same, as a registry carries it, whatever the app's catalogue type. */
export interface LooseCatalogueSet {
  readonly locale: string;
  readonly source: LooseCatalogue;
  readonly translations: { readonly [locale: string]: LooseCatalogue };
}

export function findMessage(
  catalogue: LooseCatalogue | undefined,
  key: string
): AnyMessage | undefined {
  const dot = key.indexOf('.');
  return catalogue?.[key.slice(0, dot)]?.[key.slice(dot + 1)];
}

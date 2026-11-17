/** Per kind name, per placeholder name, that placeholder's config entry. */
export type MessageConfig = Readonly<Record<string, Readonly<Record<string, unknown>>>>;

/** A message whatever its template: what a catalogue holds and the renderer reads. */
export interface AnyMessage {
  readonly template: string;
  readonly config: MessageConfig;
}

/**
 * A message from `dt`. `_params` carries the argument object at the type level only; it is a
 * function type so that two messages agree on their params both ways or not at all.
 */
export interface Message<T extends string, C extends MessageConfig, Params> extends AnyMessage {
  readonly template: T;
  readonly config: C;
  readonly _params?: (params: Params) => Params;
}

/** The argument object a message takes. */
export type ParamsOf<M> = M extends { readonly _params?: (params: infer Params) => unknown }
  ? Params
  : never;

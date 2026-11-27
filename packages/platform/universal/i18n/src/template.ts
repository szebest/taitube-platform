/** One `{name}` or `{name:kind}` token; `kind` is `undefined` for a bare `{name}`. */
export interface Placeholder {
  readonly name: string;
  readonly kind: string | undefined;
}

interface Located extends Placeholder {
  readonly start: number;
  readonly end: number;
}

type PlaceholderOf<Token extends string> = Token extends `${infer Name}:${infer Kind}`
  ? { readonly name: Name; readonly kind: Kind }
  : { readonly name: Token; readonly kind: undefined };

/** The placeholders of a template, in order, read by the same flat grammar `placeholders` reads at run time. */
export type ParseTemplate<T extends string> = T extends `${string}{${infer Token}}${infer Rest}`
  ? [PlaceholderOf<Token>, ...ParseTemplate<Rest>]
  : [];

const TOKEN = /\{([^}]*)\}/g;

function placeholderOf(token: string): Placeholder {
  const colon = token.indexOf(':');
  return colon === -1
    ? { name: token, kind: undefined }
    : { name: token.slice(0, colon), kind: token.slice(colon + 1) };
}

export function placeholders(template: string): Located[] {
  return Array.from(template.matchAll(TOKEN), (match) => ({
    ...placeholderOf(match[1] ?? ''),
    start: match.index,
    end: match.index + match[0].length,
  }));
}

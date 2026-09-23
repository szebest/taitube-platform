declare const cdnBase: unique symbol;

export type CdnBase = string & { readonly [cdnBase]: true };

export function asCdnBase(raw: string): CdnBase {
  return raw.replace(/\/+$/, '') as CdnBase;
}

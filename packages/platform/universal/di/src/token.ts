export interface Token<T> {
  readonly name: string;
  readonly _t?: (x: T) => T;
}

export const token = <T>(name: string): Token<T> => ({ name });

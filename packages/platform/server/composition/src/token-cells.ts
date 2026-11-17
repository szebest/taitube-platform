import type { Token } from '@kit/di';

export interface Cell<T> {
  readonly value: T;
}

type Key = { readonly name: string };

/** Holds one cell per token, and hands each back typed by the token it was stored under. */
export class TokenCells {
  private readonly cells = new Map<Key, Cell<unknown>>();

  get<T>(t: Token<T>): Cell<T> | undefined;
  get(t: Key): Cell<unknown> | undefined {
    return this.cells.get(t);
  }

  set<T>(t: Token<T>, cell: Cell<T>): void;
  set(t: Key, cell: Cell<unknown>): void {
    this.cells.set(t, cell);
  }
}

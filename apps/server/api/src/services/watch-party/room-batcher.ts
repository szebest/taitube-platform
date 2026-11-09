export interface RoomBatcherOptions<T> {
  readonly windowMs: number;
  /** Handed everything a room gathered in one window; it reports its own failures. */
  readonly flush: (roomId: string, items: readonly T[]) => Promise<void>;
}

/**
 * Gathers what one pod hears per room and hands it on once per window, so a burst from a full room
 * is one frame rather than one per sender.
 */
export class RoomBatcher<T> {
  private readonly pending = new Map<string, T[]>();
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(private readonly options: RoomBatcherOptions<T>) {}

  add(roomId: string, item: T): void {
    this.pending.set(roomId, [...(this.pending.get(roomId) ?? []), item]);
    if (this.timers.has(roomId)) return;
    this.timers.set(
      roomId,
      setTimeout(() => void this.flush(roomId), this.options.windowMs)
    );
  }

  close(): void {
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
    this.pending.clear();
  }

  private async flush(roomId: string): Promise<void> {
    const items = this.pending.get(roomId) ?? [];
    this.pending.delete(roomId);
    this.timers.delete(roomId);
    if (items.length > 0) await this.options.flush(roomId, items);
  }
}

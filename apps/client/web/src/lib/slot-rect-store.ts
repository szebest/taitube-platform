export interface SlotRect {
  /** Where the player's own origin moves to, so a `translate` puts it over the slot. */
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Where a slot is in the viewport, as an external store: measured when the slot resizes, the window
 * resizes or anything scrolls, and handed out as the same object until a number changes. The player is
 * `position: fixed` over the slot and moved with a `translate`, so it is never reparented.
 */
export class SlotRectStore {
  private readonly listeners = new Set<() => void>();
  private slot: HTMLElement | undefined;
  private observer: ResizeObserver | undefined;
  private rect: SlotRect | undefined;

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    if (this.listeners.size === 1) {
      window.addEventListener('scroll', this.measure, { capture: true, passive: true });
      window.addEventListener('resize', this.measure);
    }

    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0) {
        window.removeEventListener('scroll', this.measure, { capture: true });
        window.removeEventListener('resize', this.measure);
      }
    };
  };

  readonly snapshot = (): SlotRect | undefined => this.rect;

  /** Follows `slot` from now on, or nothing; the returned function stops following it. */
  track(slot: HTMLElement | undefined): () => void {
    this.slot = slot;
    this.observer =
      slot && typeof ResizeObserver !== 'undefined' ? new ResizeObserver(this.measure) : undefined;
    if (slot) this.observer?.observe(slot);
    this.measure();

    return () => {
      this.observer?.disconnect();
      this.observer = undefined;
    };
  }

  private readonly measure = (): void => {
    const next = this.slot ? this.place(this.slot) : undefined;
    const same =
      this.rect?.x === next?.x &&
      this.rect?.y === next?.y &&
      this.rect?.width === next?.width &&
      this.rect?.height === next?.height;
    if (same) return;

    this.rect = next;
    for (const listener of this.listeners) listener();
  };

  private place(slot: HTMLElement): SlotRect {
    const { left, top, width, height } = slot.getBoundingClientRect();
    const root = document.documentElement;
    const rightToLeft = getComputedStyle(root).direction === 'rtl';

    return { x: rightToLeft ? left - (root.clientWidth - width) : left, y: top, width, height };
  }
}

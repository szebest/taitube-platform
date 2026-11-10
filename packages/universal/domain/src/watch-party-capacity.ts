/** Who is asking for a spot: the owner is never refused, a `members.joinWhenFull` holder passes `capacity`. */
export interface CapacitySeat {
  readonly isOwner: boolean;
  readonly joinWhenFull: boolean;
}

/** What "12 / 20" shows: the room's capacity, or the operator ceiling when it set none. */
export function effectiveCapacity(capacity: number | null, ceiling: number): number {
  return Math.min(capacity ?? ceiling, ceiling);
}

/** The present count below which this seat is admitted; `null` admits at any count. */
export function admissionLimit(
  capacity: number | null,
  ceiling: number,
  seat: CapacitySeat
): number | null {
  if (seat.isOwner) return null;
  if (seat.joinWhenFull) return ceiling;
  return effectiveCapacity(capacity, ceiling);
}

export function hasSpace(present: number, limit: number | null): boolean {
  return limit === null || present < limit;
}

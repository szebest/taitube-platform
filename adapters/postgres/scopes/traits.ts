import type { Column } from 'drizzle-orm';

/**
 * Composable schema trait interfaces for generic Drizzle table scoping.
 * Reusable across any entity (videos, channels, playlists, comments, uploads).
 */
export interface WithOwner {
  readonly ownerId: Column;
}

export interface WithVisibility {
  readonly visibility: Column;
}

export interface SoftDeletable {
  readonly deletedAt?: Column;
  readonly status?: Column;
}

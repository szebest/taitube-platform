import type { EmptyStateSize } from '@kit/components';
import type { IconId } from '@kit/ui';

/** Locked by a password, or a share link that stopped working. */
export type AccessGateIcon = Extract<IconId, 'lock' | 'clock'>;

/** The watch page's whole width, or an embed's frame. */
export type AccessGateSize = Extract<EmptyStateSize, 'page' | 'section'>;

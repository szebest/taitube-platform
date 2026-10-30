import type { DialogSize } from '../dialog';
import type { DrawerSize } from '../drawer';

export type ResponsiveModalSize = Extract<DialogSize, DrawerSize>;

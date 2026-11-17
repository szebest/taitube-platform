import type { Side } from '@kit/ui';

export type InspectorSide = Extract<Side, 'inline-end' | 'inline-start'>;
export type WorkspaceLayout = 'three-column' | 'two-column' | 'single';

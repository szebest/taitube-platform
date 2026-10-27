import type { CalloutTone } from '@vp/ui';

export type OfflineStateSize = 'page' | 'banner' | 'section';
export type OfflineStateTone = Extract<CalloutTone, 'neutral' | 'success'>;

import type { CalloutTone } from '@kit/ui';

export type OfflineStateSize = 'page' | 'banner' | 'section';
export type OfflineStateTone = Extract<CalloutTone, 'neutral' | 'success'>;

import type { ToneOption } from '@vp/design-tokens';

export type SectionErrorLayout = 'bar' | 'block';
export type SectionErrorTone = Extract<ToneOption, 'danger' | 'warning'>;

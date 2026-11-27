import type { ToneOption } from '@kit/design-tokens';

export type SectionErrorLayout = 'bar' | 'block';
export type SectionErrorTone = Extract<ToneOption, 'danger' | 'warning'>;

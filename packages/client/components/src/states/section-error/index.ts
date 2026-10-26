import { SectionErrorMessage, SectionErrorRoot, SectionErrorSupport } from './section-error';

export const SectionError = {
  Root: SectionErrorRoot,
  Message: SectionErrorMessage,
  Support: SectionErrorSupport,
};
export type { SectionErrorRootProps } from './section-error';
export { useSectionError } from './section-error.context';
export { sectionErrorStyles } from './section-error.variants';
export type { SectionErrorLayout, SectionErrorTone } from './types';

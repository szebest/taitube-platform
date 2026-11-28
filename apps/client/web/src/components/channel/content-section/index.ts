import {
  ContentSectionAction,
  ContentSectionHeader,
  ContentSectionItem,
  ContentSectionItems,
  ContentSectionRoot,
  ContentSectionSubtitle,
  ContentSectionTitle,
} from './content-section';

export const ContentSection = {
  Root: ContentSectionRoot,
  Header: ContentSectionHeader,
  Title: ContentSectionTitle,
  Subtitle: ContentSectionSubtitle,
  Action: ContentSectionAction,
  Items: ContentSectionItems,
  Item: ContentSectionItem,
};
export { useContentSection } from './content-section.context';
export { contentSectionStyles } from './content-section.variants';
export type {
  ContentSectionDensity,
  ContentSectionLayout,
  ContentSectionShelfVariant,
} from './types';

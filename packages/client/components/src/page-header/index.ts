import {
  PageHeaderActions,
  PageHeaderBack,
  PageHeaderDescription,
  PageHeaderRoot,
  PageHeaderTabs,
  PageHeaderTitle,
} from './page-header';

export const PageHeader = {
  Root: PageHeaderRoot,
  Back: PageHeaderBack,
  Title: PageHeaderTitle,
  Description: PageHeaderDescription,
  Actions: PageHeaderActions,
  Tabs: PageHeaderTabs,
};
export type { PageHeaderPartProps, PageHeaderRootProps } from './page-header';
export { PageHeaderSkeleton } from './page-header';
export { usePageHeader } from './page-header.context';
export { pageHeaderStyles } from './page-header.variants';
export type { PageHeaderTitleStyle } from './types';

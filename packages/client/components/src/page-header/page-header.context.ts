import { createCompoundContext } from '@vp/ui';
import type { PageHeaderTitleStyle } from './types';

export const [PageHeaderContext, usePageHeader] = createCompoundContext<{
  titleStyle: PageHeaderTitleStyle;
}>('PageHeader');

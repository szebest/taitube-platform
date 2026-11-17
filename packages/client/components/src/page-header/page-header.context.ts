import { createCompoundContext } from '@kit/ui';
import type { PageHeaderTitleStyle } from './types';

export const [PageHeaderContext, usePageHeader] = createCompoundContext<{
  titleStyle: PageHeaderTitleStyle;
  sticky: boolean;
}>('PageHeader');

import { createCompoundContext } from '../../lib/create-compound-context';
import type { TabsFill, TabsOrientation, TabsSize } from './types';

export const [TabsContext, useTabs] = createCompoundContext<{
  variant: TabsFill;
  size: TabsSize;
  orientation: TabsOrientation;
}>('Tabs');

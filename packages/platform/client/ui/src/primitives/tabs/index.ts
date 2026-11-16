import { TabsList, TabsPanel, TabsRoot, TabsTab } from './tabs';

export const Tabs = { Root: TabsRoot, List: TabsList, Tab: TabsTab, Panel: TabsPanel };
export type { TabsPartProps, TabsRootProps } from './tabs';
export { useTabs } from './tabs.context';
export { tabsStyles } from './tabs.variants';
export type { TabsFill, TabsOrientation, TabsSize } from './types';

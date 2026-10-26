import { Tabs as TabsPrimitive } from 'radix-ui';
import { type ComponentPropsWithRef, useMemo } from 'react';
import { TabsContext, useTabs } from './tabs.context';
import { tabsStyles } from './tabs.variants';
import type { TabsFill, TabsOrientation, TabsSize } from './types';

export interface TabsRootProps
  extends Omit<ComponentPropsWithRef<typeof TabsPrimitive.Root>, 'orientation'> {
  variant?: TabsFill;
  size?: TabsSize;
  orientation?: TabsOrientation;
}

export function TabsRoot({
  variant = 'ghost',
  size = 'md',
  orientation = 'horizontal',
  className,
  ...props
}: TabsRootProps) {
  const shared = useMemo(() => ({ variant, size, orientation }), [variant, size, orientation]);

  return (
    <TabsContext value={shared}>
      <TabsPrimitive.Root
        data-slot="tabs"
        orientation={orientation}
        className={tabsStyles(shared).root({ className })}
        {...props}
      />
    </TabsContext>
  );
}

export type TabsPartProps<Part extends 'List' | 'Trigger' | 'Content'> = ComponentPropsWithRef<
  (typeof TabsPrimitive)[Part]
>;

export function TabsList({ className, ...props }: TabsPartProps<'List'>) {
  const shared = useTabs('List');

  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={tabsStyles(shared).list({ className })}
      {...props}
    />
  );
}

export function TabsTab({ className, ...props }: TabsPartProps<'Trigger'>) {
  const shared = useTabs('Tab');

  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-tab"
      className={tabsStyles(shared).tab({ className })}
      {...props}
    />
  );
}

export function TabsPanel({ className, ...props }: TabsPartProps<'Content'>) {
  const shared = useTabs('Panel');

  return (
    <TabsPrimitive.Content
      data-slot="tabs-panel"
      className={tabsStyles(shared).panel({ className })}
      {...props}
    />
  );
}

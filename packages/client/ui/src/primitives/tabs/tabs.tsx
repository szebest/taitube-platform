import { Tabs as TabsPrimitive } from 'radix-ui';
import { useMemo, type ComponentPropsWithRef } from 'react';
import { useSlidingIndicator } from '../../lib/sliding-indicator';
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

export function TabsList({ ref, className, children, ...props }: TabsPartProps<'List'>) {
  const styles = tabsStyles(useTabs('List'));
  const indicated = useSlidingIndicator('[data-state="active"]', ref);

  return (
    <TabsPrimitive.List
      ref={indicated}
      data-slot="tabs-list"
      className={styles.list({ className })}
      {...props}
    >
      <span aria-hidden="true" data-slot="tabs-indicator" className={styles.indicator()} />
      {children}
    </TabsPrimitive.List>
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

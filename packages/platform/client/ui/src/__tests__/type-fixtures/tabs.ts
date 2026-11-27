import type { Tabs } from 'radix-ui';
import type { ComponentPropsWithRef } from 'react';
import type { TabsPartProps } from '../../primitives/tabs/tabs';

expectTypeOf<TabsPartProps<'List'>>().toEqualTypeOf<ComponentPropsWithRef<typeof Tabs.List>>();
expectTypeOf<TabsPartProps<'Trigger'>['value']>().toEqualTypeOf<string>();
expectTypeOf<TabsPartProps<'Content'>['value']>().toEqualTypeOf<string>();

// @ts-expect-error a part of the tabs, not an arbitrary name
type _Unknown = TabsPartProps<'Root'>;

import { Tabs as TabsPrimitive } from 'radix-ui';
import type { ComponentProps } from 'react';
import { cn } from './class-names';

export function Tabs({ className, ...props }: ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn('tw:flex tw:flex-col tw:gap-4 tw:font-sans tw:text-fg', className)}
      {...props}
    />
  );
}

export function TabsList({ className, ...props }: ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn('tw:flex tw:gap-1 tw:overflow-x-auto tw:border-b tw:border-border', className)}
      {...props}
    />
  );
}

export function TabsTrigger({ className, ...props }: ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        'tw:-mb-px tw:inline-flex tw:shrink-0 tw:cursor-pointer tw:items-center tw:gap-2 tw:border-x-0 tw:border-t-0 tw:border-b-2 tw:border-transparent tw:bg-transparent tw:px-4 tw:py-2 tw:text-sm tw:font-medium tw:text-fg-muted tw:transition-colors tw:hover:text-fg tw:focus-ring tw:disabled:pointer-events-none tw:disabled:opacity-50 tw:data-[state=active]:border-fg tw:data-[state=active]:text-fg tw:[&_svg]:size-4',
        className
      )}
      {...props}
    />
  );
}

export function TabsContent({ className, ...props }: ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn('tw:focus-ring', className)}
      {...props}
    />
  );
}

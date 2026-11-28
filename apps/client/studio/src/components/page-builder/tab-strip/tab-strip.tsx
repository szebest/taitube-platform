import { Badge, Button, cn, createCompoundContext, Icon, SortableList } from '@kit/ui';
import type { ComponentPropsWithRef, ReactNode } from 'react';
import { useT } from '#app/lib/messages';

interface TabStripValue {
  value: string;
  onValueChange: (id: string) => void;
}

const [TabStripContext, useTabStrip] = createCompoundContext<TabStripValue>('TabStrip');

export interface TabStripRootProps
  extends Omit<ComponentPropsWithRef<'ul'>, 'onReorder'>, TabStripValue {
  ids: readonly string[];
  onReorder: (order: readonly string[]) => void;
}

function TabStripRoot({
  ids,
  value,
  onValueChange,
  onReorder,
  className,
  ...props
}: TabStripRootProps) {
  return (
    <TabStripContext value={{ value, onValueChange }}>
      <SortableList.Root
        items={ids}
        orientation="horizontal"
        onReorder={onReorder}
        className={cn('m-0 flex list-none flex-wrap items-center gap-inline p-0', className)}
        {...props}
      />
    </TabStripContext>
  );
}

export interface TabStripTabProps {
  id: string;
  label: string;
  hidden?: boolean;
  /** The tab's own actions, beside its name. */
  children?: ReactNode;
}

function TabStripTab({ id, label, hidden = false, children }: TabStripTabProps) {
  const { tOr } = useT();
  const { value, onValueChange } = useTabStrip('Tab');
  const selected = value === id;

  return (
    <SortableList.Item
      id={id}
      aria-label={label}
      className={cn(
        'flex items-center gap-inline rounded-control border border-border px-inline py-1',
        selected && 'bg-accent-soft'
      )}
    >
      <SortableList.Handle />
      <button
        type="button"
        aria-current={selected ? 'page' : undefined}
        className="border-0 bg-transparent text-label text-fg"
        onClick={() => onValueChange(id)}
      >
        {label}
      </button>
      {hidden && <Badge size="sm">{tOr('studio.pageTabHidden', {}, '')}</Badge>}
      {children}
    </SortableList.Item>
  );
}

export type TabStripAddProps = ComponentPropsWithRef<typeof Button>;

function TabStripAdd({ children, ...props }: TabStripAddProps) {
  return (
    <li>
      <Button variant="outline" size="sm" {...props}>
        <Icon name="plus" />
        {children}
      </Button>
    </li>
  );
}

export const TabStrip = { Root: TabStripRoot, Tab: TabStripTab, Add: TabStripAdd };

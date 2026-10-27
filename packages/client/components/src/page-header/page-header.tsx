import { Skeleton, useUiCopy } from '@vp/ui';
import { Slot } from 'radix-ui';
import { type ComponentPropsWithRef, useMemo } from 'react';
import { PageHeaderContext, usePageHeader } from './page-header.context';
import { pageHeaderStyles } from './page-header.variants';
import type { PageHeaderTitleStyle } from './types';

export interface PageHeaderRootProps extends ComponentPropsWithRef<'div'> {
  titleStyle?: PageHeaderTitleStyle;
}

export function PageHeaderRoot({
  titleStyle = 'headline',
  className,
  ...props
}: PageHeaderRootProps) {
  const shared = useMemo(() => ({ titleStyle }), [titleStyle]);

  return (
    <PageHeaderContext value={shared}>
      <div
        data-slot="page-header"
        className={pageHeaderStyles(shared).root({ className })}
        {...props}
      />
    </PageHeaderContext>
  );
}

export interface PageHeaderPartProps extends ComponentPropsWithRef<'div'> {
  asChild?: boolean;
}

/** The heading element the caller passes, normally the page's one `h1`, as the single child with `asChild`. */
export function PageHeaderTitle({ asChild = false, className, ...props }: PageHeaderPartProps) {
  const shared = usePageHeader('Title');
  const Element = asChild ? Slot.Root : 'div';

  return (
    <Element
      data-slot="page-header-title"
      className={pageHeaderStyles(shared).title({ className })}
      {...props}
    />
  );
}

export function PageHeaderDescription({
  asChild = false,
  className,
  ...props
}: PageHeaderPartProps) {
  const shared = usePageHeader('Description');
  const Element = asChild ? Slot.Root : 'p';

  return (
    <Element
      data-slot="page-header-description"
      className={pageHeaderStyles(shared).description({ className })}
      {...props}
    />
  );
}

export function PageHeaderActions({ className, ...props }: ComponentPropsWithRef<'div'>) {
  const shared = usePageHeader('Actions');

  return (
    <div
      data-slot="page-header-actions"
      className={pageHeaderStyles(shared).actions({ className })}
      {...props}
    />
  );
}

export function PageHeaderTabs({ className, ...props }: ComponentPropsWithRef<'div'>) {
  const shared = usePageHeader('Tabs');

  return (
    <div
      data-slot="page-header-tabs"
      className={pageHeaderStyles(shared).tabs({ className })}
      {...props}
    />
  );
}

/** A link or two to the pages above this one; its children are the list items' links. */
export function PageHeaderBack({ className, children, ...props }: ComponentPropsWithRef<'nav'>) {
  const shared = usePageHeader('Back');
  const { breadcrumb } = useUiCopy();

  return (
    <nav
      data-slot="page-header-back"
      aria-label={breadcrumb}
      className={pageHeaderStyles(shared).back({ className })}
      {...props}
    >
      {children}
    </nav>
  );
}

export function PageHeaderSkeleton({
  titleStyle = 'headline',
}: Pick<PageHeaderRootProps, 'titleStyle'>) {
  const styles = pageHeaderStyles({ titleStyle });

  return (
    <div data-slot="page-header-skeleton" className={styles.root()}>
      <Skeleton shape="text" radius="xs" className={styles.title({ className: 'tw:w-60' })} />
      <Skeleton
        shape="text"
        radius="xs"
        className={styles.description({ className: 'tw:w-96 tw:max-w-full' })}
      />
    </div>
  );
}

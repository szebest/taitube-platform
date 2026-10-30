import { DropdownMenu, Icon, IconButton, Skeleton, Slot, useUiCopy } from '@vp/ui';
import { Children, type ComponentPropsWithRef, useEffect, useMemo, useRef, useState } from 'react';
import { PageHeaderContext, usePageHeader } from './page-header.context';
import { pageHeaderStyles } from './page-header.variants';
import type { PageHeaderTitleStyle } from './types';

export interface PageHeaderRootProps extends ComponentPropsWithRef<'div'> {
  titleStyle?: PageHeaderTitleStyle;
  /** Pins the header under the shell's toolbar; a divider fades in once the page scrolls beneath it. */
  sticky?: boolean;
}

/** Whether a sticky header is pinned: a one pixel sentinel on its top edge leaves the area under the offset. */
function useStuck(sticky: boolean) {
  const [stuck, setStuck] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sticky) {
      return;
    }

    const target = sentinel.current;
    if (!target?.parentElement) {
      return;
    }

    const offset = Number.parseFloat(getComputedStyle(target.parentElement).top) || 0;
    const observer = new IntersectionObserver(
      ([entry]) =>
        setStuck(!!entry && entry.boundingClientRect.top <= (entry.rootBounds?.top ?? 0)),
      { rootMargin: `-${offset + 1}px 0px 0px 0px` }
    );
    observer.observe(target);

    return () => {
      observer.disconnect();
      setStuck(false);
    };
  }, [sticky]);

  return { stuck, sentinel };
}

export function PageHeaderRoot({
  titleStyle = 'headline',
  sticky = false,
  className,
  children,
  ...props
}: PageHeaderRootProps) {
  const shared = useMemo(() => ({ titleStyle, sticky }), [titleStyle, sticky]);
  const { stuck, sentinel } = useStuck(sticky);
  const styles = pageHeaderStyles(shared);

  return (
    <PageHeaderContext value={shared}>
      <div
        data-slot="page-header"
        data-stuck={stuck || undefined}
        className={styles.root({ className })}
        {...props}
      >
        {sticky && (
          <div
            ref={sentinel}
            data-slot="page-header-sentinel"
            aria-hidden="true"
            className={styles.sentinel()}
          />
        )}
        {children}
      </div>
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

/**
 * The last child is the primary action and always shows. Below the medium breakpoint the others
 * fold into one menu behind a "more" button; from medium up they sit inline beside it.
 */
export function PageHeaderActions({ className, children, ...props }: ComponentPropsWithRef<'div'>) {
  const shared = usePageHeader('Actions');
  const { moreActions } = useUiCopy();
  const styles = pageHeaderStyles(shared);
  const secondary = Children.toArray(children);
  const primary = secondary.pop();

  return (
    <div data-slot="page-header-actions" className={styles.actions({ className })} {...props}>
      {secondary.length > 0 && (
        <>
          <div data-slot="page-header-secondary-actions" className={styles.secondary()}>
            {secondary}
          </div>
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <IconButton
                data-slot="page-header-overflow"
                aria-label={moreActions}
                className={styles.overflow()}
              >
                <Icon name="more" />
              </IconButton>
            </DropdownMenu.Trigger>
            <DropdownMenu.Content align="end">
              {Children.map(secondary, (action) => (
                <DropdownMenu.Item asChild>{action}</DropdownMenu.Item>
              ))}
            </DropdownMenu.Content>
          </DropdownMenu.Root>
        </>
      )}
      {primary}
    </div>
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

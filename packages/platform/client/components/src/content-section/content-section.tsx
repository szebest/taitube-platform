import { cn, Slot } from '@kit/ui';
import { type ComponentPropsWithRef, useId } from 'react';
import { Shelf, shelfStyles } from '../shelf';
import { ContentSectionContext, useContentSection } from './content-section.context';
import { GRID_COLUMN_CLASSES, contentSectionStyles } from './content-section.variants';
import type {
  ContentSectionDensity,
  ContentSectionLayout,
  ContentSectionShelfVariant,
} from './types';

export interface ContentSectionRootProps extends ComponentPropsWithRef<'section'> {
  layout: ContentSectionLayout;
  density: ContentSectionDensity;
  /** The card width a `shelf` layout scrolls: video cards by default, posters for Shorts, tiles for channels. */
  shelfVariant?: ContentSectionShelfVariant;
}

/** One section of a channel page, laid out as the creator chose: a shelf, a grid of two to six columns, a list, one hero item or a masonry of posts. */
export function ContentSectionRoot({
  layout,
  density,
  shelfVariant = 'card',
  className,
  ...props
}: ContentSectionRootProps) {
  const titleId = useId();
  const value = { layout, density, shelfVariant, titleId };

  return (
    <ContentSectionContext value={value}>
      {layout.type === 'shelf' ? (
        <Shelf.Root variant={shelfVariant} className={className} {...props} />
      ) : (
        <section
          data-slot="content-section"
          data-layout={layout.type}
          aria-labelledby={titleId}
          className={shelfStyles().root({ className })}
          {...props}
        />
      )}
    </ContentSectionContext>
  );
}

export function ContentSectionHeader({ className, ...props }: ComponentPropsWithRef<'div'>) {
  const { layout } = useContentSection('Header');

  return layout.type === 'shelf' ? (
    <Shelf.Header className={className} {...props} />
  ) : (
    <div
      data-slot="content-section-header"
      className={shelfStyles().header({ className })}
      {...props}
    />
  );
}

/** The heading that names the section: an `h2`. */
export function ContentSectionTitle({ className, ...props }: ComponentPropsWithRef<'h2'>) {
  const { layout, titleId } = useContentSection('Title');

  return layout.type === 'shelf' ? (
    <Shelf.Title className={className} {...props} />
  ) : (
    <h2
      data-slot="content-section-title"
      id={titleId}
      className={shelfStyles().title({ className })}
      {...props}
    />
  );
}

export function ContentSectionSubtitle({ className, ...props }: ComponentPropsWithRef<'p'>) {
  const { layout } = useContentSection('Subtitle');

  return layout.type === 'shelf' ? (
    <Shelf.Note className={className} {...props} />
  ) : (
    <p
      data-slot="content-section-subtitle"
      className={shelfStyles().note({ className })}
      {...props}
    />
  );
}

export interface ContentSectionActionProps extends ComponentPropsWithRef<'div'> {
  asChild?: boolean;
}

/** The link at the end of the heading row, the router link passed with `asChild`. */
export function ContentSectionAction({
  asChild = false,
  className,
  ...props
}: ContentSectionActionProps) {
  const { layout } = useContentSection('Action');

  if (layout.type === 'shelf') {
    return <Shelf.Action asChild={asChild} className={className} {...props} />;
  }

  const Element = asChild ? Slot.Root : 'div';
  return (
    <Element
      data-slot="content-section-action"
      className={shelfStyles().action({ className })}
      {...props}
    />
  );
}

export function ContentSectionItems({ className, ...props }: ComponentPropsWithRef<'ul'>) {
  const { layout, density } = useContentSection('Items');

  return layout.type === 'shelf' ? (
    <Shelf.Track className={className} {...props} />
  ) : (
    <ul
      data-slot="content-section-items"
      className={contentSectionStyles({ layout: layout.type, density }).list({
        className: cn(layout.type === 'grid' && GRID_COLUMN_CLASSES[layout.columns], className),
      })}
      {...props}
    />
  );
}

export function ContentSectionItem({ className, ...props }: ComponentPropsWithRef<'li'>) {
  const { layout, density } = useContentSection('Item');

  return layout.type === 'shelf' ? (
    <Shelf.Item className={className} {...props} />
  ) : (
    <li
      data-slot="content-section-item"
      className={contentSectionStyles({ layout: layout.type, density }).item({ className })}
      {...props}
    />
  );
}

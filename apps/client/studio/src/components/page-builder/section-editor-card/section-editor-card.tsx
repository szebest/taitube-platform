import { Badge, Card, cn } from '@kit/ui';
import type { ComponentPropsWithRef } from 'react';

function CardRoot(props: ComponentPropsWithRef<'div'>) {
  return <Card.Root {...props} />;
}

export interface SectionEditorCardHeaderProps extends ComponentPropsWithRef<'div'> {
  /** The kind of block, as the creator knows it. */
  kind: string;
}

function CardHeader({ kind, children, ...props }: SectionEditorCardHeaderProps) {
  return (
    <Card.Header {...props}>
      <Card.Title>{children}</Card.Title>
      <Badge size="sm">{kind}</Badge>
    </Card.Header>
  );
}

export interface SectionEditorCardGroupProps extends ComponentPropsWithRef<'fieldset'> {
  title: string;
}

/** One of the groups of fields a section is edited in: Source, Filters, Sort and layout, Presentation, Visibility. */
function CardGroup({ title, className, children, ...props }: SectionEditorCardGroupProps) {
  return (
    <fieldset
      className={cn('m-0 flex min-w-0 flex-col gap-stack border-0 p-0', className)}
      {...props}
    >
      <legend className="mb-inline p-0 text-label text-fg">{title}</legend>
      {children}
    </fieldset>
  );
}

function CardPreview({ className, ...props }: ComponentPropsWithRef<'div'>) {
  return (
    <div
      data-slot="section-editor-card-preview"
      className={cn('rounded-card border border-border p-stack', className)}
      {...props}
    />
  );
}

export const SectionEditorCard = {
  Root: CardRoot,
  Header: CardHeader,
  Group: CardGroup,
  Preview: CardPreview,
};

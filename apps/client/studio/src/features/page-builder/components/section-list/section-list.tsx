import { Badge, Icon, IconButton, SortableList } from '@kit/ui';
import type { LayoutSection } from '@vp/domain';
import { isSectionHidden } from '#app/features/page-builder/utils/layout-edits';
import { useT } from '#app/lib/messages';

export interface SectionListActions {
  onReorder: (order: readonly string[]) => void;
  onOpen: (sectionId: string) => void;
  onToggleHidden: (section: LayoutSection) => void;
  onDuplicate: (sectionId: string) => void;
  onDelete: (sectionId: string) => void;
}

export interface SectionListProps extends SectionListActions {
  sections: readonly LayoutSection[];
  canDuplicate: boolean;
}

/** The sections of one tab in page order, moved by drag or by keyboard. */
export function SectionList({ sections, canDuplicate, ...actions }: SectionListProps) {
  const { tOr } = useT();

  return (
    <SortableList.Root
      items={sections.map(({ id }) => id)}
      onReorder={actions.onReorder}
      aria-label={tOr('studio.pageSectionsLabel', {}, '')}
      className="m-0 flex list-none flex-col gap-inline p-0"
    >
      {sections.map((section) => {
        const title =
          section.presentation.title?.default ?? tOr('studio.pageUntitledSection', {}, '');
        const hidden = isSectionHidden(section);

        return (
          <SortableList.Item
            key={section.id}
            id={section.id}
            aria-label={title}
            className="flex items-center gap-stack rounded-card border border-border px-stack py-inline"
          >
            <SortableList.Handle />
            <button
              type="button"
              className="min-w-0 flex-1 truncate border-0 bg-transparent text-start text-label text-fg"
              onClick={() => actions.onOpen(section.id)}
            >
              {title}
            </button>
            <Badge size="sm">{tOr('studio.pageBlockOption', { kind: section.kind }, '')}</Badge>
            {hidden && <Badge size="sm">{tOr('studio.pageTabHidden', {}, '')}</Badge>}
            <IconButton
              size="sm"
              aria-label={tOr('studio.pageSectionEdit', { title }, '')}
              onClick={() => actions.onOpen(section.id)}
            >
              <Icon name="edit" size="sm" />
            </IconButton>
            <IconButton
              size="sm"
              aria-label={tOr(
                hidden ? 'studio.pageSectionShow' : 'studio.pageSectionHide',
                { title },
                ''
              )}
              onClick={() => actions.onToggleHidden(section)}
            >
              <Icon name={hidden ? 'eye' : 'eye-off'} size="sm" />
            </IconButton>
            <IconButton
              size="sm"
              disabled={!canDuplicate}
              aria-label={tOr('studio.pageSectionDuplicate', { title }, '')}
              onClick={() => actions.onDuplicate(section.id)}
            >
              <Icon name="queue-add" size="sm" />
            </IconButton>
            <IconButton
              size="sm"
              aria-label={tOr('studio.pageSectionDelete', { title }, '')}
              onClick={() => actions.onDelete(section.id)}
            >
              <Icon name="trash" size="sm" />
            </IconButton>
          </SortableList.Item>
        );
      })}
    </SortableList.Root>
  );
}

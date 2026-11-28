import { assertNever } from '@kit/result';
import { Drawer } from '@kit/ui';
import type { LayoutSection } from '@vp/domain';
import { SectionEditorCard } from '#app/components/page-builder/section-editor-card';
import { SectionPreview } from '#app/components/page-builder/section-preview';
import { useT } from '#app/lib/messages';
import { FilterFields } from '../filter-fields/filter-fields';
import { LayoutFields } from '../layout-fields/layout-fields';
import { PresentationFields } from '../presentation-fields/presentation-fields';
import {
  FeaturedChannelsFields,
  LinksFields,
  RichTextFields,
} from '../section-body-fields/section-body-fields';
import { SourceFields } from '../source-fields/source-fields';
import { VisibilityFields } from '../visibility-fields/visibility-fields';

export interface SectionDrawerProps {
  section: LayoutSection;
  tabs: readonly { id: string; title: string }[];
  onChange: (section: LayoutSection) => void;
  onClose: () => void;
}

function Fields({ section, tabs, onChange }: Omit<SectionDrawerProps, 'onClose'>) {
  const { tOr } = useT();

  switch (section.kind) {
    case 'content':
      return (
        <>
          <SectionEditorCard.Group title={tOr('studio.pageGroupSource', {}, '')}>
            <SourceFields section={section} onChange={onChange} />
          </SectionEditorCard.Group>
          <SectionEditorCard.Group title={tOr('studio.pageGroupFilters', {}, '')}>
            <FilterFields section={section} onChange={onChange} />
          </SectionEditorCard.Group>
          <SectionEditorCard.Group title={tOr('studio.pageGroupLayout', {}, '')}>
            <LayoutFields section={section} tabs={tabs} onChange={onChange} />
          </SectionEditorCard.Group>
        </>
      );
    case 'rich_text':
      return (
        <SectionEditorCard.Group title={tOr('studio.pageGroupContent', {}, '')}>
          <RichTextFields section={section} onChange={onChange} />
        </SectionEditorCard.Group>
      );
    case 'links':
      return (
        <SectionEditorCard.Group title={tOr('studio.pageGroupContent', {}, '')}>
          <LinksFields section={section} onChange={onChange} />
        </SectionEditorCard.Group>
      );
    case 'featured_channels':
      return (
        <SectionEditorCard.Group title={tOr('studio.pageGroupContent', {}, '')}>
          <FeaturedChannelsFields section={section} onChange={onChange} />
        </SectionEditorCard.Group>
      );
    default:
      return assertNever(section, 'LayoutSection');
  }
}

/** One section's fields, grouped, beside a preview of it that follows every change. */
export function SectionDrawer({ section, tabs, onChange, onClose }: SectionDrawerProps) {
  const { tOr } = useT();
  const title = section.presentation.title?.default ?? tOr('studio.pageUntitledSection', {}, '');

  return (
    <Drawer.Root open onOpenChange={(open) => !open && onClose()}>
      <Drawer.Content size="lg">
        <Drawer.Header>
          <Drawer.Title>{tOr('studio.pageSectionDrawerTitle', { title }, '')}</Drawer.Title>
          <Drawer.Description>
            {tOr('studio.pageSectionDrawerDescription', {}, '')}
          </Drawer.Description>
        </Drawer.Header>
        <Drawer.Body>
          <SectionEditorCard.Root className="flex flex-col gap-section">
            <SectionEditorCard.Header
              kind={tOr('studio.pageBlockOption', { kind: section.kind }, '')}
            >
              {title}
            </SectionEditorCard.Header>
            <SectionEditorCard.Preview>
              <SectionPreview section={section} />
            </SectionEditorCard.Preview>
            <Fields section={section} tabs={tabs} onChange={onChange} />
            <SectionEditorCard.Group title={tOr('studio.pageGroupPresentation', {}, '')}>
              <PresentationFields section={section} onChange={onChange} />
            </SectionEditorCard.Group>
            <SectionEditorCard.Group title={tOr('studio.pageGroupVisibility', {}, '')}>
              <VisibilityFields section={section} onChange={onChange} />
            </SectionEditorCard.Group>
          </SectionEditorCard.Root>
        </Drawer.Body>
      </Drawer.Content>
    </Drawer.Root>
  );
}

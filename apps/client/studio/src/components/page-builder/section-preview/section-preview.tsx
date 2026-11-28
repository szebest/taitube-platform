import { ContentSection } from '@kit/components';
import { assertNever } from '@kit/result';
import { Skeleton } from '@kit/ui';
import type { LayoutSection } from '@vp/domain';
import type { ComponentPropsWithRef } from 'react';
import { useT } from '#app/lib/messages';

const PREVIEW_ITEMS = 6;

export interface SectionPreviewProps extends ComponentPropsWithRef<'div'> {
  section: LayoutSection;
}

function Tiles({ section }: { section: Extract<LayoutSection, { kind: 'content' }> }) {
  const count = Math.min(section.itemCount, PREVIEW_ITEMS);

  return (
    <ContentSection.Items>
      {Array.from({ length: count }, (_, index) => (
        <ContentSection.Item key={index}>
          <Skeleton className="aspect-video w-full" />
        </ContentSection.Item>
      ))}
    </ContentSection.Items>
  );
}

function Body({ section }: SectionPreviewProps) {
  const { tOr } = useT();

  switch (section.kind) {
    case 'content':
      return <Tiles section={section} />;
    case 'rich_text':
      return <p className="m-0 line-clamp-4 text-body-sm text-fg-muted">{section.body}</p>;
    case 'links':
      return (
        <ul className="m-0 flex list-none flex-wrap gap-inline p-0 text-body-sm text-fg-muted">
          {section.links.map(({ label, url }) => (
            <li key={url}>{label}</li>
          ))}
        </ul>
      );
    case 'featured_channels':
      return (
        <p className="m-0 text-body-sm text-fg-muted">
          {tOr('studio.pagePreviewChannels', { count: section.channelIds.length }, '')}
        </p>
      );
    default:
      return assertNever(section, 'LayoutSection');
  }
}

/** The section as the page draws it, with placeholders where its items go, so a change to the layout shows before it is saved. */
export function SectionPreview({ section, ...props }: SectionPreviewProps) {
  const { tOr } = useT();
  const { presentation } = section;
  const layout = section.kind === 'content' ? section.layout : { type: 'list' as const };

  return (
    <div data-slot="section-preview" {...props}>
      <ContentSection.Root layout={layout} density={presentation.density}>
        <ContentSection.Header>
          <ContentSection.Title>
            {presentation.title?.default ?? tOr('studio.pageUntitledSection', {}, '')}
          </ContentSection.Title>
          {presentation.subtitle && (
            <ContentSection.Subtitle>{presentation.subtitle.default}</ContentSection.Subtitle>
          )}
        </ContentSection.Header>
        <Body section={section} />
      </ContentSection.Root>
    </div>
  );
}

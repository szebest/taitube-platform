import { assertNever } from '@kit/result';
import { BrandScope, PlatformIcon } from '@kit/ui';
import { Link } from '@tanstack/react-router';
import type { ChannelPageView, ResolvedSectionView } from '@vp/api-contracts';
import { richTextTree } from '@vp/validation';
import { ContentSection } from '#app/components/channel/content-section';
import { RichTextView } from '#app/components/channel/rich-text-view';
import { SectionBackdrop } from '#app/components/channel/section-backdrop';
import { httpsUrl } from '#app/features/channel/utils/https-url';
import { useT } from '#app/lib/messages';
import { PageItemCard } from '../page-item-card/page-item-card';

export interface PageSectionProps {
  section: ResolvedSectionView;
  handle: string;
  images: ChannelPageView['images'];
}

type ContentView = Extract<ResolvedSectionView, { kind: 'content' | 'featured_channels' }>;

function cardVariant(layout: Extract<ResolvedSectionView, { kind: 'content' }>['layout']) {
  switch (layout.type) {
    case 'shelf':
      return 'shelf';
    case 'list':
      return 'row';
    case 'hero':
      return 'spotlight';
    case 'grid':
    case 'masonry':
      return 'grid';
    default:
      return assertNever(layout, 'SectionLayout');
  }
}

function SectionHeading({ section, handle }: { section: ResolvedSectionView; handle: string }) {
  const { tOr } = useT();
  const { title, subtitle } = section.presentation;
  const seeAll = section.kind === 'content' ? section.seeAll : null;

  return (
    <ContentSection.Header>
      <ContentSection.Title>
        {title?.default ?? tOr('channelPage.untitled', {}, '')}
      </ContentSection.Title>
      {subtitle && <ContentSection.Subtitle>{subtitle.default}</ContentSection.Subtitle>}
      {seeAll && (
        <ContentSection.Action asChild>
          <Link
            to="/channels/$handle/$slug"
            params={{ handle, slug: seeAll }}
            search={{ preview: undefined, as: undefined }}
          >
            {tOr('channelPage.seeAll', {}, '')}
          </Link>
        </ContentSection.Action>
      )}
    </ContentSection.Header>
  );
}

function ItemsSection({ section, handle }: { section: ContentView; handle: string }) {
  const { presentation } = section;
  const layout = section.kind === 'content' ? section.layout : { type: 'shelf' as const };
  const variant = section.kind === 'content' ? cardVariant(section.layout) : 'shelf';

  return (
    <ContentSection.Root
      layout={layout}
      density={presentation.density}
      shelfVariant={section.kind === 'featured_channels' ? 'channel' : 'card'}
    >
      <SectionHeading section={section} handle={handle} />
      <ContentSection.Items>
        {section.items.map((item) => (
          <ContentSection.Item key={item.kind === 'channel' ? item.channel.id : item.id}>
            <PageItemCard
              item={item}
              variant={variant}
              density={presentation.density}
              show={presentation.show}
            />
          </ContentSection.Item>
        ))}
      </ContentSection.Items>
    </ContentSection.Root>
  );
}

function Body({ section, handle, images }: PageSectionProps) {
  const { tOr } = useT();

  switch (section.kind) {
    case 'content':
    case 'featured_channels':
      return <ItemsSection section={section} handle={handle} />;
    case 'rich_text':
      return (
        <section className="flex flex-col gap-stack">
          {section.presentation.title && (
            <h2 className="m-0 text-title-lg">{section.presentation.title.default}</h2>
          )}
          <RichTextView tree={richTextTree(section.body)} images={images} />
        </section>
      );
    case 'links':
      return (
        <section className="flex flex-col gap-stack">
          <h2 className="m-0 text-title-lg">
            {section.presentation.title?.default ?? tOr('channelPage.linksLabel', {}, '')}
          </h2>
          <ul className="m-0 flex list-none flex-wrap gap-inline p-0">
            {section.links.flatMap(({ label, url, platform }) => {
              const href = httpsUrl(url);
              return href === undefined
                ? []
                : [
                    <li key={url}>
                      <a
                        href={href}
                        rel="nofollow noopener ugc"
                        className="inline-flex items-center gap-inline text-label text-accent-ink focus-ring"
                      >
                        <PlatformIcon platform={platform} size="sm" />
                        {label}
                      </a>
                    </li>,
                  ];
            })}
          </ul>
        </section>
      );
    default:
      return assertNever(section, 'ResolvedSection');
  }
}

/** One resolved section of a channel page: its accent scoped to it below the viewer's own, a backdrop behind it when the creator chose one. */
export function PageSection(props: PageSectionProps) {
  const { presentation } = props.section;
  const background = presentation.background ? props.images[presentation.background] : undefined;
  const body = <Body {...props} />;

  return (
    <BrandScope color={presentation.accent}>
      {background ? <SectionBackdrop image={background}>{body}</SectionBackdrop> : body}
    </BrandScope>
  );
}

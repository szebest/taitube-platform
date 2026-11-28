import { axeViolations } from '@kit/web-testing/dom';
import { render, screen, within } from '@testing-library/react';
import { AppProviders } from '#app/__tests__/providers';
import { ContentSection } from '..';
import type { ContentSectionLayout } from '../types';

const renderSection = (layout: ContentSectionLayout) =>
  render(
    <AppProviders>
      <ContentSection.Root layout={layout} density="comfortable">
        <ContentSection.Header>
          <ContentSection.Title>Latest</ContentSection.Title>
          <ContentSection.Subtitle>Fresh from the studio</ContentSection.Subtitle>
          <ContentSection.Action asChild>
            <a href="/channels/c/videos">See all</a>
          </ContentSection.Action>
        </ContentSection.Header>
        <ContentSection.Items>
          <ContentSection.Item>One</ContentSection.Item>
          <ContentSection.Item>Two</ContentSection.Item>
        </ContentSection.Items>
      </ContentSection.Root>
    </AppProviders>
  );

describe('apps/client/web: ContentSection', () => {
  it('is a shelf of the items under its heading for the shelf layout', () => {
    const { container } = renderSection({ type: 'shelf' });

    expect(screen.getByRole('region', { name: 'Latest' })).toBeInTheDocument();
    expect(container.querySelector('[data-slot=shelf-track]')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it.each([
    { layout: { type: 'grid', columns: 3 }, classes: 'expanded:grid-cols-3' },
    { layout: { type: 'grid', columns: 6 }, classes: 'expanded:grid-cols-6' },
    { layout: { type: 'list' }, classes: 'flex-col' },
    { layout: { type: 'hero' }, classes: 'grid-cols-1' },
    { layout: { type: 'masonry' }, classes: 'expanded:columns-3' },
  ] as const)(
    'lists the items of a $layout.type layout under the named section',
    ({ layout, classes }) => {
      renderSection(layout);

      const section = screen.getByRole('region', { name: 'Latest' });

      expect(section).toHaveAttribute('data-layout', layout.type);
      expect(within(section).getAllByRole('listitem')).toHaveLength(2);
      expect(within(section).getByRole('list')).toHaveClass(classes);
      expect(within(section).getByRole('link', { name: 'See all' })).toBeInTheDocument();
    }
  );

  it('has no accessibility violations in a grid', async () => {
    const { container } = renderSection({ type: 'grid', columns: 4 });

    expect(await axeViolations(container)).toEqual([]);
  });

  it('names a part used outside the root', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() => render(<ContentSection.Title>Latest</ContentSection.Title>)).toThrow(
      'ContentSection.Title must be inside ContentSection.Root'
    );
  });
});

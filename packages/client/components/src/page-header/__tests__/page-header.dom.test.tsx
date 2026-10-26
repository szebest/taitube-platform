import { screen } from '@testing-library/react';
import { variantNames } from '@vp/ui';
import { axeViolations } from '@vp/web-testing/dom';
import { renderWithCopy } from '../../__tests__/render-with-copy';
import { PageHeader, PageHeaderSkeleton, pageHeaderStyles } from '..';
import type { PageHeaderRootProps } from '../page-header';

const renderHeader = (props: PageHeaderRootProps = {}) =>
  renderWithCopy(
    <PageHeader.Root {...props}>
      <PageHeader.Back>
        <a href="/library">Library</a>
      </PageHeader.Back>
      <PageHeader.Title asChild>
        <h1>Your videos</h1>
      </PageHeader.Title>
      <PageHeader.Description>142 videos, 3 still processing</PageHeader.Description>
      <PageHeader.Actions>
        <button type="button">Upload</button>
      </PageHeader.Actions>
      <PageHeader.Tabs>
        <a href="/library/drafts">Drafts</a>
      </PageHeader.Tabs>
    </PageHeader.Root>
  );

describe('@vp/components: PageHeader', () => {
  it.each(variantNames(pageHeaderStyles.variants.titleStyle))(
    'makes the heading the caller passes the title in the %s style',
    (titleStyle) => {
      renderHeader({ titleStyle });

      expect(screen.getByRole('heading', { level: 1, name: 'Your videos' })).toHaveAttribute(
        'data-slot',
        'page-header-title'
      );
    }
  );

  it('names the way back by the breadcrumb word', () => {
    renderHeader();

    expect(screen.getByRole('navigation', { name: 'breadcrumb' })).toHaveTextContent('Library');
  });

  it('passes axe, loaded and as a skeleton', async () => {
    renderHeader();
    renderWithCopy(<PageHeaderSkeleton titleStyle="display" />);

    expect(await axeViolations()).toEqual([]);
  });
});

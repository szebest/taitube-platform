import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

type ObserverCallback = (entries: Partial<IntersectionObserverEntry>[]) => void;

let reportIntersection: ObserverCallback = () => undefined;

class CapturedObserver {
  constructor(callback: ObserverCallback) {
    reportIntersection = callback;
  }
  observe = vi.fn();
  disconnect = vi.fn();
}

const renderActions = (...actions: string[]) => {
  const clicked = vi.fn();
  const view = renderWithCopy(
    <PageHeader.Root>
      <PageHeader.Title asChild>
        <h1>Your videos</h1>
      </PageHeader.Title>
      <PageHeader.Actions>
        {actions.map((name) => (
          <button key={name} type="button" onClick={() => clicked(name)}>
            {name}
          </button>
        ))}
      </PageHeader.Actions>
    </PageHeader.Root>
  );

  return { ...view, clicked };
};

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

  describe('actions', () => {
    it('folds every action but the last into a menu that runs them', async () => {
      const { clicked } = renderActions('Filter', 'Export', 'Upload');

      await userEvent.click(screen.getByRole('button', { name: 'moreActions' }));
      await userEvent.click(screen.getByRole('menuitem', { name: 'Export' }));

      expect(screen.getAllByRole('button', { name: 'Upload' })).toHaveLength(1);
      expect(screen.queryByRole('menuitem', { name: 'Upload' })).not.toBeInTheDocument();
      expect(clicked).toHaveBeenCalledWith('Export');
    });

    it('has no menu when there is only the primary action', () => {
      renderActions('Upload');

      expect(screen.queryByRole('button', { name: 'moreActions' })).not.toBeInTheDocument();
    });
  });

  describe('sticky', () => {
    beforeEach(() => {
      vi.stubGlobal('IntersectionObserver', CapturedObserver);
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('draws the divider only while the header is pinned under the toolbar', () => {
      renderHeader({ sticky: true });
      const header = document.querySelector('[data-slot="page-header"]');
      const report = (top: number) =>
        act(() =>
          reportIntersection([
            {
              isIntersecting: false,
              boundingClientRect: { top } as DOMRectReadOnly,
              rootBounds: { top: 57 } as DOMRectReadOnly,
            },
          ])
        );

      expect(header).not.toHaveAttribute('data-stuck');

      report(55);
      expect(header).toHaveAttribute('data-stuck');

      report(300);
      expect(header).not.toHaveAttribute('data-stuck');
    });

    it('watches nothing when the header is not sticky', () => {
      renderHeader();

      expect(document.querySelector('[data-slot="page-header-sentinel"]')).not.toBeInTheDocument();
    });
  });

  it('passes axe, loaded and as a skeleton', async () => {
    renderHeader();
    renderWithCopy(<PageHeaderSkeleton titleStyle="display" />);

    expect(await axeViolations()).toEqual([]);
  });
});

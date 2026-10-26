import { screen } from '@testing-library/react';
import { variantNames } from '@vp/ui';
import { axeViolations } from '@vp/web-testing/dom';
import { renderWithCopy } from '../../../__tests__/render-with-copy';
import { EmptyState, emptyStateStyles } from '..';
import type { EmptyStateRootProps } from '../empty-state';

const renderEmptyState = (props: EmptyStateRootProps = {}) =>
  renderWithCopy(
    <EmptyState.Root {...props}>
      <EmptyState.Illustration>
        <svg data-testid="drawing" />
      </EmptyState.Illustration>
      <EmptyState.Title asChild>
        <h2>Nothing queued yet</h2>
      </EmptyState.Title>
      <EmptyState.Description>Save a video and it will wait here.</EmptyState.Description>
      <EmptyState.Action asChild>
        <a href="/">Browse videos</a>
      </EmptyState.Action>
      <EmptyState.Secondary href="/help">How queues work</EmptyState.Secondary>
    </EmptyState.Root>
  );

describe('@vp/components: EmptyState', () => {
  it.each(variantNames(emptyStateStyles.variants.size))(
    'says what is missing and offers the way on at the %s size',
    (size) => {
      renderEmptyState({ size });

      expect(screen.getByRole('heading', { level: 2, name: 'Nothing queued yet' })).toBeVisible();
      expect(screen.getByRole('link', { name: 'Browse videos' })).toHaveAttribute(
        'data-slot',
        'empty-state-action'
      );
      expect(screen.getByRole('link', { name: 'How queues work' })).toBeVisible();
    }
  );

  it('hides the drawing from assistive technology', () => {
    renderEmptyState();

    expect(screen.getByTestId('drawing').parentElement).toHaveAttribute('aria-hidden', 'true');
  });

  it('passes axe in every size and title style', async () => {
    for (const size of variantNames(emptyStateStyles.variants.size)) {
      for (const titleStyle of variantNames(emptyStateStyles.variants.titleStyle)) {
        renderEmptyState({ size, titleStyle });
      }
    }

    expect(await axeViolations()).toEqual([]);
  });
});

import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axeViolations } from '@vp/web-testing/dom';

import { renderWorkspace } from './workspace.fixture';

describe('apps/client/studio: StudioWorkspace.Inspector', () => {
  it.each([
    {
      scenario: 'nothing selected',
      inspectorOpen: false,
      shown: 'Select a video to see its details',
    },
    { scenario: 'a video selected', inspectorOpen: true, shown: 'Public' },
  ])('docks beside the content with $scenario', ({ inspectorOpen, shown }) => {
    renderWorkspace('large', { inspectorOpen });

    expect(screen.getByRole('complementary', { name: 'Lisbon at night' })).toHaveTextContent(shown);
  });

  it.each(['medium', 'compact'] as const)(
    'opens as a modal on a %s screen, in place of the docked aside, and closes on Escape',
    async (width) => {
      const onInspectorOpenChange = vi.fn();
      renderWorkspace(width, { inspectorOpen: true, onInspectorOpenChange });

      expect(screen.getByRole('dialog', { name: 'Lisbon at night' })).toHaveTextContent('Public');
      expect(screen.queryByRole('complementary')).not.toBeInTheDocument();

      await userEvent.keyboard('{Escape}');

      expect(onInspectorOpenChange).toHaveBeenCalledWith(false);
    }
  );

  it.each(['large', 'medium'] as const)('passes axe open on a %s screen', async (width) => {
    renderWorkspace(width, { inspectorOpen: true });

    expect(await axeViolations()).toEqual([]);
  });
});

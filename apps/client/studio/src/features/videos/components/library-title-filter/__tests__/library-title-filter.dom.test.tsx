import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppProviders } from '#app/__tests__/providers';
import { LibraryTitleFilter, type LibraryTitleFilterProps } from '../library-title-filter';

const renderFilter = (props: Partial<LibraryTitleFilterProps> = {}) => {
  const onSettle = vi.fn();
  render(
    <AppProviders>
      <LibraryTitleFilter value={undefined} onSettle={onSettle} {...props} />
    </AppProviders>
  );
  return { onSettle, box: screen.getByRole('searchbox', { name: 'Filter by title' }) };
};

describe('apps/client/studio: LibraryTitleFilter', () => {
  it('starts from the filter it is given', () => {
    const { box } = renderFilter({ value: 'night' });

    expect(box).toHaveValue('night');
  });

  it.each([
    { typed: '  harb ', settled: 'harb' },
    { typed: '   ', settled: undefined },
  ])('hands over $settled once, when typing "$typed" pauses', async ({ typed, settled }) => {
    const { onSettle, box } = renderFilter();

    await userEvent.type(box, typed);

    await vi.waitFor(() => expect(onSettle).toHaveBeenCalledExactlyOnceWith(settled));
  });
});

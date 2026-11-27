import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { AppProviders } from '#app/__tests__/providers';
import type { ShareTarget } from '#app/components/posts/post-composer';
import { ShareTargetPicker, type ShareTargetPickerProps } from '../share-target-picker';

const TOUR: ShareTarget = { id: 'a', title: 'City tour', durationMs: 1000 };
const OPTIONS = [TOUR, { id: 'b', title: 'Night walk', durationMs: 2000 }];

function renderPicker(props: Partial<ShareTargetPickerProps> = {}) {
  const onChange = vi.fn();
  render(
    <ShareTargetPicker
      label="Video"
      value={null}
      options={OPTIONS}
      onChange={onChange}
      {...props}
    />,
    { wrapper: AppProviders }
  );
  return { onChange, user: userEvent.setup() };
}

describe('apps/client/studio: ShareTargetPicker', () => {
  it.each([
    { scenario: 'nothing chosen', value: null, shown: 'Nothing chosen yet', button: 'Choose' },
    { scenario: 'a pick', value: TOUR, shown: 'City tour', button: 'Change' },
  ])('shows $scenario beside a "$button" button', ({ value, shown, button }) => {
    renderPicker({ value });

    expect(screen.getByText(shown)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: button })).toBeInTheDocument();
  });

  it('picks from the list and closes it', async () => {
    const { user, onChange } = renderPicker();

    await user.click(screen.getByRole('button', { name: 'Choose' }));
    await user.click(await screen.findByRole('option', { name: 'Night walk' }));

    expect(onChange).toHaveBeenCalledWith(OPTIONS[1]);
    expect(screen.queryByRole('option', { name: 'Night walk' })).toBeNull();
  });

  it('filters the list by what is typed', async () => {
    const { user } = renderPicker();

    await user.click(screen.getByRole('button', { name: 'Choose' }));
    await user.type(await screen.findByPlaceholderText('Search by title'), 'night');

    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
      'Night walk',
    ]);
  });

  it('loads more on request while there is more', async () => {
    const onLoadMore = vi.fn();
    const { user } = renderPicker({ hasNextPage: true, onLoadMore });

    await user.click(screen.getByRole('button', { name: 'Choose' }));
    await user.click(await screen.findByRole('option', { name: 'Load more' }));

    expect(onLoadMore).toHaveBeenCalledOnce();
  });

  it('says so when there is nothing to share', async () => {
    const { user } = renderPicker({ options: [] });

    await user.click(screen.getByRole('button', { name: 'Choose' }));

    expect(await screen.findByText('Nothing public to share.')).toBeInTheDocument();
  });
});

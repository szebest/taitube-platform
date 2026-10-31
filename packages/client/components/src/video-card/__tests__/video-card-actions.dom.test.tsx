import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithCopy } from '../../__tests__/render-with-copy';
import { VideoCardContext } from '../video-card.context';
import { VideoCardExpanded, VideoCardMenu } from '../video-card-actions';

const renderWith = (expanded: boolean, ui: React.ReactNode) =>
  renderWithCopy(
    <VideoCardContext
      value={{ variant: 'grid', state: 'rest', size: 'md', videoId: undefined, expanded }}
    >
      {ui}
    </VideoCardContext>
  );

describe('@vp/components: video-card.actions', () => {
  it('renders no menu when there are no actions', () => {
    const { container } = renderWith(false, <VideoCardMenu />);

    expect(container.querySelector('[data-slot="video-card-menu"]')).toBeNull();
  });

  it('calls Save from the menu', async () => {
    const onSave = vi.fn();
    const user = userEvent.setup();
    renderWith(false, <VideoCardMenu onSave={onSave} />);

    await user.click(screen.getByRole('button'));
    await user.click(await screen.findByRole('menuitem'));

    expect(onSave).toHaveBeenCalledOnce();
  });

  it.each([
    { expanded: false, count: 0 },
    { expanded: true, count: 1 },
  ])('renders the panel $count times when expanded is $expanded', ({ expanded, count }) => {
    const { container } = renderWith(
      expanded,
      <VideoCardExpanded onSave={vi.fn()}>Text</VideoCardExpanded>
    );

    expect(container.querySelectorAll('[data-slot="video-card-expanded"]')).toHaveLength(count);
  });
});

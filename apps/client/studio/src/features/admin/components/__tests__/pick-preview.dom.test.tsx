import { render, screen } from '@testing-library/react';

import { AppProviders } from '#app/__tests__/providers';
import type { PickVideo } from '#app/features/admin/api/pick-videos';
import { PickPreview, type PickPreviewProps } from '../pick-preview';

const VIDEO = { id: 'v1', title: 'Cats at dawn', channel: null } as PickVideo;

const renderPreview = (props: Partial<PickPreviewProps> = {}) =>
  render(<PickPreview video={VIDEO} note="Start here" window="Nov 2 to Nov 3" {...props} />, {
    wrapper: AppProviders,
  });

describe('apps/client/studio: PickPreview', () => {
  it('shows the spotlight as home will: kicker, title, note and window', () => {
    renderPreview();

    const preview = screen.getByRole('region', { name: 'Preview' });

    expect(preview).toHaveTextContent('Pick of the day');
    expect(screen.getByRole('heading', { name: 'Cats at dawn' })).toBeInTheDocument();
    expect(screen.getByText('Start here')).toBeInTheDocument();
    expect(screen.getByText('Nov 2 to Nov 3')).toBeInTheDocument();
  });

  it.each([
    { name: 'a blank note', props: { note: '   ' } },
    { name: 'no window', props: { window: '' } },
  ])('leaves out $name', ({ props }) => {
    renderPreview(props);

    expect(screen.getByRole('region', { name: 'Preview' }).querySelectorAll('p')).toHaveLength(2);
  });

  it('asks for a video before it has one', () => {
    renderPreview({ video: null });

    expect(screen.getByText('Choose a video to preview the spotlight.')).toBeInTheDocument();
  });
});

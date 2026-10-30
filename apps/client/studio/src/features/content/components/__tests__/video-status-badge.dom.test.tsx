import { render, screen } from '@testing-library/react';
import type { VideoSummary } from '@vp/api-contracts';

import { AppProviders } from '#app/__tests__/providers';
import { VideoStatusBadge } from '../video-status-badge';

const renderBadge = (status: VideoSummary['status']) =>
  render(
    <AppProviders>
      <VideoStatusBadge status={status} />
    </AppProviders>
  );

describe('apps/client/studio: VideoStatusBadge', () => {
  it.each([
    { status: 'UPLOADING', label: 'Uploading', icon: 'upload' },
    { status: 'PROCESSING', label: 'Processing', icon: 'clock' },
    { status: 'READY', label: 'Ready', icon: 'check' },
    { status: 'FAILED', label: 'Failed', icon: 'alert' },
  ] as const)('names a $status video $label, with its icon', ({ status, label, icon }) => {
    renderBadge(status);

    const badge = screen.getByText(label);

    expect(badge.querySelector(`[data-icon="${icon}"]`)).not.toBeNull();
  });
});

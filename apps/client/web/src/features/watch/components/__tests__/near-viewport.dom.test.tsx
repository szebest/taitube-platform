import { render, screen } from '@testing-library/react';

import { RecordingObserver } from '#app/features/watch/__tests__/recording-observer';
import { NearViewport, type NearViewportProps } from '../near-viewport';

const renderSection = (props: Partial<NearViewportProps> = {}) =>
  render(
    <NearViewport fallback={<p>Placeholder</p>} {...props}>
      <p>Loaded</p>
    </NearViewport>
  );

describe('apps/client/web: near viewport', () => {
  beforeEach(() => {
    RecordingObserver.install();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows the fallback until the section comes within the margin, then the children', () => {
    renderSection({ rootMargin: '0px 0px 300px 0px' });

    expect(screen.getByText('Placeholder')).toBeInTheDocument();
    expect(screen.queryByText('Loaded')).not.toBeInTheDocument();
    expect(RecordingObserver.all[0]?.rootMargin).toBe('0px 0px 300px 0px');

    RecordingObserver.enterView();

    expect(screen.getByText('Loaded')).toBeInTheDocument();
    expect(screen.queryByText('Placeholder')).not.toBeInTheDocument();
  });
});

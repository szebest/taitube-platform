import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { axeViolations } from '@vp/web-testing/dom';
import type { ReactNode } from 'react';

import { AppProviders } from '#app/__tests__/providers';
import { Stage, StageSkeleton } from '..';
import type { StageRootProps } from '../stage';

const VIDEO_ID = '0f8fad5b-d9cb-469f-a165-70867728950e';

const renderStage = (props: Partial<StageRootProps> = {}, children: ReactNode = null) =>
  render(
    <AppProviders>
      <Stage.Root videoId={VIDEO_ID} glowColors={['rgb(200 120 40)']} {...props}>
        <Stage.Glow />
        <Stage.Poster src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" alt="Launch day" />
        {children}
      </Stage.Root>
    </AppProviders>
  );

const glow = () => document.querySelector('[data-slot="stage-glow"]');

describe('apps/client/web: Stage', () => {
  it('is a region named for the player, carrying the shared element name of its video', () => {
    renderStage();

    expect(screen.getByRole('region', { name: 'Video player' })).toHaveStyle({
      viewTransitionName: `video-${VIDEO_ID}`,
    });
    expect(screen.getByRole('img', { name: 'Launch day' })).toBeInTheDocument();
  });

  it('paints one glow band per sampled colour, hidden from assistive technology', () => {
    renderStage({ glowColors: ['rgb(200 120 40)', 'rgb(90 40 20)'] });

    expect(glow()).toHaveAttribute('aria-hidden', 'true');
    expect(glow()?.children).toHaveLength(2);
  });

  it.each([
    { scenario: 'no colours', glowColors: undefined },
    { scenario: 'an empty sample', glowColors: [] },
  ])('renders no glow for $scenario', ({ glowColors }) => {
    renderStage({ glowColors });

    expect(glow()).not.toBeInTheDocument();
  });

  it('marks a paused stage, for the glow to dim', () => {
    renderStage({ paused: true });

    expect(screen.getByRole('region')).toHaveAttribute('data-paused', 'true');
  });

  it('draws a banner tint with no player region and no shared element', () => {
    renderStage({ variant: 'banner' });

    expect(screen.queryByRole('region')).not.toBeInTheDocument();
    expect(document.querySelector('[data-slot="stage"]')).not.toHaveStyle({
      viewTransitionName: `video-${VIDEO_ID}`,
    });
  });

  it('announces an error once and retries on request', async () => {
    const onRetry = vi.fn();
    renderStage(
      {},
      <Stage.Status kind="error" onRetry={onRetry}>
        This video could not be played.
      </Stage.Status>
    );

    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(screen.getByRole('alert')).toHaveTextContent('This video could not be played.');
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it.each([
    { kind: 'error' as const, children: 'Could not play.' },
    { kind: 'unavailable' as const, children: 'This video is private.' },
  ])('offers no retry for $kind without a handler', ({ kind, children }) => {
    renderStage({}, <Stage.Status kind={kind}>{children}</Stage.Status>);

    expect(screen.getByText(children)).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('hides the loading cover from assistive technology', () => {
    renderStage({}, <Stage.Status kind="loading" />);

    expect(document.querySelector('[data-kind="loading"]')).toHaveAttribute('aria-hidden', 'true');
  });

  it('passes axe, loaded and as a skeleton', async () => {
    renderStage({}, <Stage.Status kind="error">Could not play.</Stage.Status>);
    render(<StageSkeleton />);

    expect(await axeViolations()).toEqual([]);
  });
});

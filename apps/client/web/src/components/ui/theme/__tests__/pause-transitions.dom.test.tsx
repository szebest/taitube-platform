import { pauseTransitions } from '../pause-transitions';

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

describe('apps/client/web: pauseTransitions', () => {
  it('marks the document while the theme swaps, and clears the mark once it has painted', async () => {
    pauseTransitions();
    expect(document.documentElement).toHaveAttribute('data-theme-switching');

    await nextFrame();
    await nextFrame();

    expect(document.documentElement).not.toHaveAttribute('data-theme-switching');
  });
});

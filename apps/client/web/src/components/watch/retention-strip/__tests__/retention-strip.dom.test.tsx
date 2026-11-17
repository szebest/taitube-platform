import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { axeViolations } from '@vp/web-testing/dom';
import { AppProviders } from '#app/__tests__/providers';
import { RetentionStrip } from '..';

const renderStrip = (onSelect = vi.fn()) =>
  render(
    <AppProviders>
      <RetentionStrip.Root values={[1, 0.5, 0.25]} aria-label="Retention" role="group">
        <RetentionStrip.Marker percent={50} aria-label="Play from 0:42" onClick={onSelect} />
      </RetentionStrip.Root>
    </AppProviders>
  );

describe('apps/client/web: RetentionStrip', () => {
  it('draws one bar a step, as tall as the share still watching', () => {
    const { container } = renderStrip();

    const heights = [...container.querySelectorAll('[data-slot="retention-strip-bar"]')].map(
      (bar) => (bar as HTMLElement).style.height
    );

    expect(heights).toEqual(['100%', '50%', '25%']);
  });

  it('puts a marker at its place along the video and calls back when it is pressed', async () => {
    const onSelect = vi.fn();
    const { container } = renderStrip(onSelect);
    const marker = container.querySelector<HTMLElement>('[data-slot="retention-strip-marker"]');

    expect(marker?.style.insetInlineStart).toBe('50%');

    await userEvent.click(marker as HTMLElement);

    expect(onSelect).toHaveBeenCalledOnce();
  });

  it('keeps the markers out of the tab order and the accessibility tree', () => {
    renderStrip();

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('passes axe', async () => {
    renderStrip();

    expect(await axeViolations()).toEqual([]);
  });
});

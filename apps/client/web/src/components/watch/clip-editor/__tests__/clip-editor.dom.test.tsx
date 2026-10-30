import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { axeViolations } from '@vp/web-testing/dom';
import { useState } from 'react';

import { AppProviders } from '#app/__tests__/providers';
import { ClipEditor, type ClipEditorSprite, type ClipEditorValue } from '..';

const SPRITE: ClipEditorSprite = {
  url: 'http://localhost:9000/sprites/s.jpg',
  intervalSec: 10,
  columns: 10,
  tileWidth: 160,
  tileHeight: 90,
};

function Harness({ sprite, initial }: { sprite?: ClipEditorSprite; initial: ClipEditorValue }) {
  const [range, setRange] = useState(initial);

  return (
    <AppProviders>
      <ClipEditor.Root durationMs={120_000} range={range} onRangeChange={setRange}>
        <ClipEditor.Preview aria-label="Preview">player</ClipEditor.Preview>
        <ClipEditor.Range
          aria-label="Clip range"
          sprite={sprite}
          startLabel="Clip start"
          endLabel="Clip end"
          summary={`${range.startMs} to ${range.endMs}`}
        />
      </ClipEditor.Root>
    </AppProviders>
  );
}

const INITIAL = { startMs: 20_000, endMs: 40_000 };

describe('apps/client/web: ClipEditor', () => {
  it('names the two thumbs and says the range in words', () => {
    render(<Harness initial={INITIAL} />);

    expect([
      screen.getByRole('slider', { name: 'Clip start' }).getAttribute('aria-valuenow'),
      screen.getByRole('slider', { name: 'Clip end' }).getAttribute('aria-valuenow'),
      screen.getByText('20000 to 40000') !== null,
    ]).toEqual(['20', '40', true]);
  });

  it.each([
    { scenario: 'with a sprite', sprite: SPRITE, frames: 8 },
    { scenario: 'without one', sprite: undefined, frames: 0 },
  ])('lays $frames frames under the slider $scenario', ({ sprite, frames }) => {
    const { container } = render(<Harness sprite={sprite} initial={INITIAL} />);

    const strip = container.querySelector('[data-slot="clip-editor-frames"]');

    expect(strip?.querySelectorAll('div[style*="background-image"]').length ?? 0).toBe(frames);
  });

  it.each([
    { thumb: 'Clip end', key: '{ArrowRight}', expected: '20000 to 41000' },
    { thumb: 'Clip start', key: '{ArrowLeft}', expected: '19000 to 40000' },
    { thumb: 'Clip start', key: '{ArrowRight}', expected: '21000 to 40000' },
    { thumb: 'Clip end', key: '{ArrowLeft}', expected: '20000 to 39000' },
  ])('moves $thumb with $key', async ({ thumb, key, expected }) => {
    render(<Harness initial={INITIAL} />);
    const user = userEvent.setup();

    screen.getByRole('slider', { name: thumb }).focus();
    await user.keyboard(key);

    expect(screen.getByText(expected)).toBeInTheDocument();
  });

  it.each([
    {
      scenario: 'an end that would make it too long pulls the start along',
      thumb: 'Clip end',
      key: '{PageUp}',
      expected: '35000 to 95000',
    },
    {
      scenario: 'a start that would make it too long pulls the end along',
      thumb: 'Clip start',
      key: '{PageDown}',
      expected: '20000 to 80000',
    },
  ])('keeps it within sixty seconds: $scenario', async ({ thumb, key, expected }) => {
    render(<Harness initial={{ startMs: 30_000, endMs: 85_000 }} />);
    const user = userEvent.setup();

    screen.getByRole('slider', { name: thumb }).focus();
    await user.keyboard(key);

    expect(screen.getByText(expected)).toBeInTheDocument();
  });

  it('passes axe', async () => {
    render(<Harness sprite={SPRITE} initial={INITIAL} />);

    expect(await axeViolations()).toEqual([]);
  });
});

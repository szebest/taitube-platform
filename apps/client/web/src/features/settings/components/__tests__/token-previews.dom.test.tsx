import { act, render, screen } from '@testing-library/react';

import { AppProviders } from '#app/__tests__/providers';
import {
  AmbientPreview,
  BorderPreview,
  MotionPreview,
  RadiusPreview,
  ShadowPreview,
  SizingPreview,
  SpacingPreview,
  TextPreview,
} from '../token-previews';

const renderPreview = (Preview: () => React.ReactNode) =>
  render(<Preview />, { wrapper: AppProviders });

describe('apps/client/web: the token previews', () => {
  it.each([
    { scenario: 'radius', Preview: RadiusPreview, words: ['Button', 'Card'] },
    {
      scenario: 'text',
      Preview: TextPreview,
      words: ['A walk through the old town', 'The quick brown fox jumps over the lazy dog.'],
    },
  ])('words the $scenario preview from the catalogue', ({ Preview, words }) => {
    renderPreview(Preview);

    for (const word of words) {
      expect(screen.getByText(word)).toBeInTheDocument();
    }
  });

  it.each([
    { scenario: 'spacing', Preview: SpacingPreview, shapes: 3 },
    { scenario: 'sizing', Preview: SizingPreview, shapes: 3 },
    { scenario: 'border', Preview: BorderPreview, shapes: 2 },
    { scenario: 'shadow', Preview: ShadowPreview, shapes: 3 },
    { scenario: 'ambient', Preview: AmbientPreview, shapes: 2 },
  ])('draws the $scenario preview as $shapes shapes', ({ Preview, shapes }) => {
    const { container } = renderPreview(Preview);

    expect(container.querySelectorAll('span')).toHaveLength(shapes);
  });

  it('moves its chip from one end to the other and back', () => {
    vi.useFakeTimers();
    const { container } = renderPreview(MotionPreview);
    const chip = container.querySelector('span');

    expect(chip).toHaveClass('tw:ms-0');
    act(() => vi.advanceTimersByTime(1400));
    expect(chip).toHaveClass('tw:ms-[calc(100%-1.25rem)]');
    act(() => vi.advanceTimersByTime(1400));
    expect(chip).toHaveClass('tw:ms-0');
  });
});

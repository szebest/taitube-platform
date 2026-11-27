import { render, screen } from '@testing-library/react';
import { AppProviders } from '#app/__tests__/providers';
import { PostComposerCount } from '../post-composer-count';

const renderCount = (length: number, max: number) =>
  render(<PostComposerCount length={length} max={max} />, { wrapper: AppProviders });

describe('apps/client/studio: PostComposerCount', () => {
  it.each([
    { length: 12, max: 140, text: '12 of 140', over: false },
    { length: 140, max: 140, text: '140 of 140', over: false },
    { length: 141, max: 140, text: '141 of 140', over: true },
  ])('says $text, over the limit: $over', ({ length, max, text, over }) => {
    renderCount(length, max);

    expect(screen.getByText(text)).toHaveClass('tabular-nums');
    expect(screen.getByText(text).className.includes('text-danger-ink')).toBe(over);
  });
});

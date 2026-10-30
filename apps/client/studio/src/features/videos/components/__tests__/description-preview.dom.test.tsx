import { render, screen } from '@testing-library/react';

import { AppProviders } from '#app/__tests__/providers';
import { DescriptionPreview } from '../description-preview';

const renderPreview = (markdown: string) =>
  render(<DescriptionPreview markdown={markdown} />, { wrapper: AppProviders });

describe('apps/client/studio: DescriptionPreview', () => {
  it('says there is nothing to preview for a blank description', () => {
    renderPreview('  \n ');

    expect(screen.getByText('Nothing to preview yet')).toBeInTheDocument();
  });

  it('renders markdown, with links that leave the studio safely', () => {
    renderPreview('A [link](https://example.test) and *emphasis*');

    expect(screen.getByRole('link', { name: 'link' })).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.getByText('emphasis').tagName).toBe('EM');
  });

  it.each([
    { markup: '<script>alert(1)</script>', selector: 'script' },
    { markup: '<img src=x onerror=alert(1)>', selector: 'img' },
    { markup: '![remote](http://evil.test/p.png)', selector: 'img' },
    { markup: '[x](javascript:alert(1))', selector: 'a[href^="javascript"]' },
  ])('renders $markup as nothing live', ({ markup, selector }) => {
    const { container } = renderPreview(markup);

    expect(container.querySelector(selector)).toBeNull();
  });
});

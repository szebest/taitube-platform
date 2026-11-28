import { render, screen } from '@testing-library/react';
import { richTextTree } from '@vp/validation';
import { RichTextView } from '..';

const IMAGE = '0195a1b2-c3d4-7e5f-8a6b-7c8d9e0f1a2b';
const OTHER = '0195a1b2-c3d4-7e5f-8a6b-7c8d9e0f1a2c';
const VARIANTS = { w640: 'https://cdn.test/640.webp', w1280: 'https://cdn.test/1280.webp' };

const renderRichText = (body: string) =>
  render(<RichTextView tree={richTextTree(body)} images={{ [IMAGE]: VARIANTS }} />);

describe('apps/client/web: RichTextView', () => {
  it('draws the whitelisted nodes as elements', () => {
    renderRichText(
      ['## Welcome', '', 'A **bold** and *soft* word.', '', '- one', '- two'].join('\n')
    );

    expect(screen.getByRole('heading', { level: 2, name: 'Welcome' })).toBeInTheDocument();
    expect(screen.getByText('bold').tagName).toBe('STRONG');
    expect(screen.getByText('soft').tagName).toBe('EM');
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('marks every link nofollow noopener ugc and opens it in a new tab', () => {
    renderRichText('[Shop](https://example.com/shop) and [Docs](https://example.org)');

    for (const link of screen.getAllByRole('link')) {
      expect(link).toHaveAttribute('rel', 'nofollow noopener ugc');
      expect(link).toHaveAttribute('target', '_blank');
    }
  });

  it('draws an image only from the creator own variants, with its alt text', () => {
    renderRichText(`![Cast](page-image:${IMAGE})\n\n![Gone](page-image:${OTHER})`);

    expect(screen.getByRole('img', { name: 'Cast' })).toHaveAttribute('src', VARIANTS.w1280);
    expect(screen.queryByRole('img', { name: 'Gone' })).not.toBeInTheDocument();
  });

  it('shows markup in the text as text, never as elements', () => {
    const { container } = renderRichText('<script>alert(1)</script> and <b>bold</b>');

    expect(container.querySelector('script, b')).toBeNull();
  });
});

import { render, screen } from '@testing-library/react';
import { SectionBackdrop } from '..';

const IMAGE = {
  w640: 'https://cdn.test/c/page-image/v1/640.webp',
  w1280: 'https://cdn.test/c/page-image/v1/1280.webp',
};

const renderBackdrop = () =>
  render(
    <SectionBackdrop image={IMAGE}>
      <p>Season two</p>
    </SectionBackdrop>
  );

describe('apps/client/web: SectionBackdrop', () => {
  it('draws the creator image as decoration under the content, from the variants it was given', () => {
    const { container } = renderBackdrop();

    const image = container.querySelector('img');

    expect(image).toHaveAttribute('alt', '');
    expect(image).toHaveAttribute('src', IMAGE.w1280);
    expect(image).toHaveAttribute('srcset', `${IMAGE.w640} 640w, ${IMAGE.w1280} 1280w`);
    expect(screen.getByText('Season two')).toBeInTheDocument();
  });
});

import { render, screen } from '@testing-library/react';

import { ImagePreview } from '../image-preview';

describe('apps/client/studio: ImagePreview', () => {
  it.each([
    { kind: 'avatar', width: '100%' },
    { kind: 'banner', width: '60%' },
  ] as const)('frames a $kind with the guide of what stays visible', ({ kind, width }) => {
    const { container } = render(
      <ImagePreview kind={kind} src="https://cdn.test/a.png" label="Preview" />
    );

    expect(screen.getByRole('img', { name: 'Preview' })).toHaveAttribute(
      'src',
      'https://cdn.test/a.png'
    );
    expect(container.querySelector('[data-kind]')).toHaveAttribute('data-kind', kind);
    expect(container.querySelector('[data-slot="safe-zone"]')).toHaveStyle({ width });
  });
});

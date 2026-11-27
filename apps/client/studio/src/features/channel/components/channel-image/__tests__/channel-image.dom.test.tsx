import { render, screen } from '@testing-library/react';
import { AppProviders } from '#app/__tests__/providers';
import { ChannelImage } from '../channel-image';

type RootProps = React.ComponentProps<typeof ChannelImage.Root>;

const renderImage = (props: Partial<RootProps> = {}) =>
  render(
    <ChannelImage.Root kind="avatar" currentUrl={null} {...props}>
      <ChannelImage.Shown />
      <ChannelImage.Remove onClick={() => {}} loading={false} />
    </ChannelImage.Root>,
    { wrapper: AppProviders }
  );

describe('apps/client/studio: ChannelImage', () => {
  it.each([
    {
      name: 'the saved image',
      currentUrl: 'https://cdn.test/a.png',
      src: 'https://cdn.test/a.png',
    },
    { name: 'nothing when there is none', currentUrl: null, src: undefined },
  ])('shows $name', ({ currentUrl, src }) => {
    renderImage({ currentUrl });

    expect(screen.queryByRole('img')?.getAttribute('src')).toBe(src);
  });

  it.each([
    { kind: 'avatar', currentUrl: 'https://cdn.test/a.png', offered: 'Remove picture' },
    { kind: 'banner', currentUrl: 'https://cdn.test/b.png', offered: 'Remove banner' },
    { kind: 'avatar', currentUrl: null, offered: undefined },
  ] as const)('offers $offered for a $kind of $currentUrl', ({ kind, currentUrl, offered }) => {
    renderImage({ kind, currentUrl });

    expect(screen.queryByRole('button')?.textContent).toBe(offered);
  });
});

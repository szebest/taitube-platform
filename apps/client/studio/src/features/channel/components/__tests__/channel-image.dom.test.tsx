import { render, screen } from '@testing-library/react';
import { AppProviders } from '#app/__tests__/providers';
import { ChannelImage } from '../channel-image';

const FILE = new File(['a'], 'a.png', { type: 'image/png' });

type RootProps = React.ComponentProps<typeof ChannelImage.Root>;

const renderImage = (props: Partial<RootProps> = {}) =>
  render(
    <ChannelImage.Root kind="avatar" file={undefined} currentUrl={null} removed={false} {...props}>
      <ChannelImage.Shown />
      <ChannelImage.Remove />
    </ChannelImage.Root>,
    { wrapper: AppProviders }
  );

describe('apps/client/studio: ChannelImage', () => {
  beforeEach(() => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:local');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  });

  it.each([
    {
      name: 'the saved image',
      props: { currentUrl: 'https://cdn.test/a.png' },
      src: 'https://cdn.test/a.png',
    },
    {
      name: 'the chosen file over the saved image',
      props: { file: FILE, currentUrl: 'https://cdn.test/a.png' },
      src: 'blob:local',
    },
    {
      name: 'nothing for a removed image',
      props: { currentUrl: 'https://cdn.test/a.png', removed: true },
      src: undefined,
    },
    { name: 'nothing when there is none', props: {}, src: undefined },
  ])('shows $name', ({ props, src }) => {
    renderImage(props);

    expect(screen.queryByRole('img')?.getAttribute('src')).toBe(src);
  });

  it.each([
    { name: 'a saved image', props: { currentUrl: 'https://cdn.test/a.png' }, offered: true },
    { name: 'a chosen file', props: { file: FILE }, offered: true },
    {
      name: 'a removed image',
      props: { currentUrl: 'https://cdn.test/a.png', removed: true },
      offered: false,
    },
    { name: 'nothing', props: {}, offered: false },
  ])('offers removal for $name: $offered', ({ props, offered }) => {
    renderImage(props);

    expect(screen.queryByRole('button', { name: 'Remove picture' }) !== null).toBe(offered);
  });
});

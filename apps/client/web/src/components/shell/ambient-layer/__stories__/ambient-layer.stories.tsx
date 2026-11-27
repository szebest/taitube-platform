import type { Meta, StoryObj } from '@storybook/react-vite';
import { AmbientGlowProvider, useAmbientGlow } from '#app/lib/ambient/ambient-glow';
import { AmbientLayer } from '..';

const WARM_GLOW = ['#c9772f', '#8a3d17', '#e0a458'];
const COOL_GLOW = ['#7aa7d9', '#3d6aa1'];

function Page({ colors }: { colors: string[] }) {
  const stage = useAmbientGlow(colors);

  return (
    <div className="relative isolate min-h-[28rem] bg-bg p-section">
      <AmbientLayer />
      <div ref={stage} className="mx-auto aspect-video max-w-[36rem] rounded-card bg-media" />
    </div>
  );
}

const meta = {
  title: 'Web/AmbientLayer',
  component: AmbientLayer,
} satisfies Meta<typeof AmbientLayer>;

export default meta;

type Story = StoryObj<typeof meta>;

export const WarmGlow: Story = {
  render: () => (
    <AmbientGlowProvider>
      <Page colors={WARM_GLOW} />
    </AmbientGlowProvider>
  ),
};

export const CoolGlow: Story = {
  render: () => (
    <AmbientGlowProvider>
      <Page colors={COOL_GLOW} />
    </AmbientGlowProvider>
  ),
};

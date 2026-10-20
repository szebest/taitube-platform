import { composeStory } from '@storybook/react-vite';
import { render, screen } from '@testing-library/react';
import { Button } from '@vp/ui';
import { withAppearance } from '../decorator';
import { initialAppearanceGlobals } from '../toolbars';

const renderStory = (globals: Record<string, string>) => {
  const Story = composeStory(
    { render: () => <Button>Upload</Button> },
    { title: 'Probe' },
    { decorators: [withAppearance], initialGlobals: globals }
  );
  return render(<Story />);
};

describe('@vp/workbench: withAppearance', () => {
  it('puts the toolbars appearance on <html> the way the apps document does, around the story', () => {
    renderStory({
      ...initialAppearanceGlobals,
      theme: 'nocturne',
      mode: 'light',
      spacing: 'airy',
      direction: 'rtl',
    });

    expect(screen.getByRole('button', { name: 'Upload' })).toBeInTheDocument();
    expect(document.documentElement.dir).toBe('rtl');
    expect(document.documentElement.dataset).toMatchObject({
      theme: 'nocturne',
      mode: 'light',
      spacing: 'airy',
      radius: 'sharp',
    });
  });
});

import { render, screen } from '@testing-library/react';
import { axeViolations } from '@vp/web-testing/dom';

import { SettingsSection } from '..';

const renderSection = () =>
  render(
    <SettingsSection.Root>
      <SettingsSection.Title>Playback</SettingsSection.Title>
      <SettingsSection.Description>What a video starts with.</SettingsSection.Description>
      <SettingsSection.Body>
        <p>A row</p>
      </SettingsSection.Body>
    </SettingsSection.Root>
  );

describe('SettingsSection', () => {
  it('is a region named by its title', () => {
    renderSection();

    expect(screen.getByRole('region', { name: 'Playback' })).toHaveTextContent('A row');
  });

  it('passes axe', async () => {
    renderSection();

    expect(await axeViolations()).toEqual([]);
  });
});

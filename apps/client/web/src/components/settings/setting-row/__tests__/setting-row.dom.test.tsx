import { render, screen } from '@testing-library/react';
import { Switch } from '@vp/ui';
import { axeViolations } from '@vp/web-testing/dom';

import { SettingRow, type SettingRowRootProps } from '..';

const renderRow = (props: SettingRowRootProps = {}, status?: string) =>
  render(
    <SettingRow.Root {...props}>
      <SettingRow.Text>
        <SettingRow.Label>Autoplay next</SettingRow.Label>
        <SettingRow.Description>Start the next video when this one ends.</SettingRow.Description>
      </SettingRow.Text>
      <SettingRow.Control>
        <Switch aria-label="Autoplay next" />
      </SettingRow.Control>
      {status && <SettingRow.Status>{status}</SettingRow.Status>}
    </SettingRow.Root>
  );

describe('SettingRow', () => {
  it('is a group named by its label', () => {
    renderRow();

    expect(screen.getByRole('group', { name: 'Autoplay next' })).toBeInTheDocument();
  });

  it.each([
    { highlighted: true, marked: true },
    { highlighted: false, marked: false },
  ])('marks a highlighted row: $marked', ({ highlighted, marked }) => {
    renderRow({ highlighted });

    expect(screen.getByRole('group').hasAttribute('data-highlighted')).toBe(marked);
  });

  it('says what is wrong with the setting', () => {
    renderRow({}, 'Not saved to your account');

    expect(screen.getByRole('status')).toHaveTextContent('Not saved to your account');
  });

  it('passes axe', async () => {
    renderRow({}, 'Not saved to your account');

    expect(await axeViolations()).toEqual([]);
  });
});

import { axeViolations } from '@kit/web-testing/dom';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import type { ApiScope } from '@vp/domain';
import { useState } from 'react';
import { ScopePicker } from '../index';

function Picker({
  initial,
  onChange,
}: {
  initial: ApiScope[];
  onChange: (value: ApiScope[]) => void;
}) {
  const [value, setValue] = useState(initial);

  return (
    <ScopePicker.Root
      value={value}
      onValueChange={(next) => {
        setValue(next);
        onChange(next);
      }}
    >
      <ScopePicker.Legend>Scopes</ScopePicker.Legend>
      <ScopePicker.Group>
        <ScopePicker.GroupTitle>Videos</ScopePicker.GroupTitle>
        <ScopePicker.Item scope="videos:read">Read videos</ScopePicker.Item>
        <ScopePicker.Item scope="videos:write">Edit videos</ScopePicker.Item>
      </ScopePicker.Group>
      <ScopePicker.Group>
        <ScopePicker.GroupTitle>Analytics</ScopePicker.GroupTitle>
        <ScopePicker.Item scope="analytics:read">Read analytics</ScopePicker.Item>
      </ScopePicker.Group>
    </ScopePicker.Root>
  );
}

const renderPicker = (initial: ApiScope[] = []) => {
  const onChange = vi.fn();
  render(<Picker initial={initial} onChange={onChange} />);
  return { onChange, user: userEvent.setup() };
};

describe('ScopePicker', () => {
  it('groups the scopes under what they touch, each named by its scope', () => {
    renderPicker(['analytics:read']);

    const videos = screen.getByRole('group', { name: 'Videos' });
    expect(videos).toContainElement(screen.getByRole('checkbox', { name: 'Edit videos' }));
    expect(screen.getByRole('checkbox', { name: 'Edit videos' })).toHaveAccessibleDescription(
      'videos:write'
    );
    expect(screen.getByRole('checkbox', { name: 'Read analytics' })).toBeChecked();
  });

  it.each([
    {
      scenario: 'adds a scope',
      initial: [] as ApiScope[],
      click: 'Read videos',
      next: ['videos:read'],
    },
    {
      scenario: 'takes a chosen scope away',
      initial: ['videos:read', 'analytics:read'] as ApiScope[],
      click: 'Read videos',
      next: ['analytics:read'],
    },
  ])('$scenario', async ({ initial, click, next }) => {
    const { user, onChange } = renderPicker(initial);

    await user.click(screen.getByRole('checkbox', { name: click }));

    expect(onChange).toHaveBeenLastCalledWith(next);
  });

  it('passes axe', async () => {
    renderPicker(['videos:read']);

    expect(await axeViolations()).toEqual([]);
  });
});

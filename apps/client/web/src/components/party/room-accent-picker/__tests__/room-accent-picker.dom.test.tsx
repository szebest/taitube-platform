import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { AppProviders } from '#app/__tests__/providers';
import { RoomAccentPicker } from '..';

describe('apps/client/web: RoomAccentPicker', () => {
  it('marks the room accent, picks a swatch and clears back to none', async () => {
    const onChange = vi.fn();
    render(
      <AppProviders>
        <RoomAccentPicker value="#0090ff" onChange={onChange} />
      </AppProviders>
    );

    expect(screen.getByRole('radio', { name: '#0090ff' })).toBeChecked();
    await userEvent.click(screen.getByRole('radio', { name: '#e5484d' }));
    await userEvent.click(screen.getByRole('radio', { name: 'No accent' }));

    expect(onChange).toHaveBeenNthCalledWith(1, '#e5484d');
    expect(onChange).toHaveBeenNthCalledWith(2, null);
  });
});

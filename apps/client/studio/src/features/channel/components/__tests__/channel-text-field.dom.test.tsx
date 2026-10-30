import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';

import { AppProviders } from '#app/__tests__/providers';
import { ChannelTextField } from '../channel-text-field';

function fieldOf(overrides: { value?: string; touched?: boolean; errors?: unknown[] } = {}) {
  const { value = '', touched = false, errors = [] } = overrides;
  return {
    name: 'handle',
    state: { value, meta: { isTouched: touched, errors } },
    handleChange: vi.fn(),
    handleBlur: vi.fn(),
  };
}

describe('apps/client/studio: ChannelTextField', () => {
  it('labels the control, carries the hint, and reports what is typed', async () => {
    const field = fieldOf();
    render(<ChannelTextField field={field} label="Handle" hint="3 to 30" />, {
      wrapper: AppProviders,
    });

    await userEvent.type(screen.getByLabelText('Handle'), 'a');

    expect(field.handleChange).toHaveBeenCalledWith('a');
    expect(screen.getByLabelText('Handle')).toHaveAccessibleDescription('3 to 30');
  });

  it.each([
    {
      scenario: 'a touched field that failed',
      field: fieldOf({ touched: true, errors: ['Too short'] }),
      refusal: undefined,
      shown: 'Too short',
    },
    {
      scenario: 'a field not yet touched',
      field: fieldOf({ errors: ['Too short'] }),
      refusal: undefined,
      shown: undefined,
    },
    {
      scenario: 'a refusal of the API',
      field: fieldOf({ touched: true, errors: ['Too short'] }),
      refusal: 'Taken',
      shown: 'Taken',
    },
  ])('shows the error of $scenario', ({ field, refusal, shown }) => {
    render(<ChannelTextField field={field} label="Handle" refusal={refusal} />, {
      wrapper: AppProviders,
    });

    const errors = [...document.querySelectorAll('[data-slot="field-error"]')];

    expect(errors.map((error) => error.textContent)).toEqual(shown === undefined ? [] : [shown]);
    expect(screen.getByLabelText('Handle').hasAttribute('aria-invalid')).toBe(shown !== undefined);
  });

  it('draws a textarea when asked for more room', () => {
    render(<ChannelTextField field={fieldOf()} label="Bio" multiline />, { wrapper: AppProviders });

    expect(screen.getByLabelText('Bio').tagName).toBe('TEXTAREA');
  });
});

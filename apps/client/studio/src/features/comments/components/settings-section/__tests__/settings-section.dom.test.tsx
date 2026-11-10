import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axeViolations } from '@vp/web-testing/dom';
import { AppProviders } from '#app/__tests__/providers';
import { SettingsListSection, SettingsSection } from '../settings-section';

const renderSection = (state: Partial<Parameters<typeof SettingsSection>[0]['section']> = {}) => {
  const save = vi.fn();
  render(
    <SettingsSection
      title="Slow mode"
      description="How long a viewer waits."
      section={{ dirty: true, saving: false, saved: false, failed: false, save, ...state }}
    >
      <input aria-label="Field" />
    </SettingsSection>,
    { wrapper: AppProviders }
  );
  return save;
};

describe('apps/client/studio: SettingsSection', () => {
  it('names its form by its title and saves on submit', async () => {
    const save = renderSection();

    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(screen.getByRole('form', { name: 'Slow mode' })).toBeInTheDocument();
    expect(save).toHaveBeenCalledOnce();
  });

  it.each([
    {
      state: { dirty: false },
      check: () => expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled(),
    },
    { state: { saved: true }, check: () => expect(screen.getByText('Saved')).toBeInTheDocument() },
    { state: { failed: true }, check: () => expect(screen.getByRole('alert')).toBeInTheDocument() },
  ])('shows what the last save came to: $state', ({ state, check }) => {
    renderSection(state);

    check();
  });
});

describe('apps/client/studio: SettingsListSection', () => {
  it('is a labelled region with its description and its records', async () => {
    render(
      <SettingsListSection title="Restrictions" description="Bans on your channel.">
        <p>Nobody</p>
      </SettingsListSection>,
      { wrapper: AppProviders }
    );

    expect(screen.getByRole('region', { name: 'Restrictions' })).toHaveTextContent('Nobody');
    expect(screen.getByText('Bans on your channel.')).toBeInTheDocument();
    expect(await axeViolations()).toEqual([]);
  });
});

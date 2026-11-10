import { within } from '@testing-library/react';
import { renderSettings, sectionOf } from '#app/features/comments/__tests__/render-settings';

describe('apps/client/studio: DisclosureDefaultsSection', () => {
  it('has one Silent or Visible per action, each with what the author sees', async () => {
    await renderSettings();
    const section = within(sectionOf('What authors are told'));

    expect(section.getAllByRole('radiogroup')).toHaveLength(6);
    expect(section.getByText('The author sees the comment as normal.')).toBeInTheDocument();
    expect(section.getByText('The author gets the reason and a notification.')).toBeInTheDocument();
    expect(section.getAllByText('The author sees that it waits for review.')).toHaveLength(3);
  });

  it('changes the line when the choice changes, and saves it for that action only', async () => {
    const { user, sent } = await renderSettings();
    const section = within(sectionOf('What authors are told'));
    const [hide] = section.getAllByRole('radiogroup');

    await user.click(within(hide as HTMLElement).getByRole('radio', { name: 'Visible' }));

    expect(section.getByText('The author sees it hidden, with the reason.')).toBeInTheDocument();
    await user.click(section.getByRole('button', { name: 'Save' }));
    await vi.waitFor(() => expect(sent.saves).toHaveLength(1));
    expect(sent.saves[0]?.disclosure).toMatchObject({
      hide: 'visible',
      remove: 'visible',
      'auto.blocked_words': 'silent',
    });
  });
});

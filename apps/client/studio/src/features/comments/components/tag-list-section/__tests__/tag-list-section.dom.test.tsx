import { within } from '@testing-library/react';
import { renderSettings, sectionOf } from '#app/features/comments/__tests__/render-settings';

describe('apps/client/studio: TagListSection', () => {
  it.each([
    { section: 'Blocked words', tags: ['spoiler'] },
    { section: 'Allowed links', tags: ['example.com'] },
  ])('shows the $section as removable tags', async ({ section, tags }) => {
    await renderSettings();

    const chips = within(sectionOf(section)).getAllByRole('button', { name: /^Remove / });

    expect(chips.map((chip) => chip.textContent)).toEqual(tags);
  });

  it('takes a pasted list, drops what is already there and saves the words', async () => {
    const { user, sent } = await renderSettings();
    const section = within(sectionOf('Blocked words'));

    await user.click(section.getByRole('textbox', { name: 'Blocked words' }));
    await user.paste('Giveaway, SPOILER\nfollow me');
    await user.click(section.getByRole('button', { name: 'Save' }));

    await vi.waitFor(() => expect(sent.saves).toHaveLength(1));
    expect(sent.saves[0]?.blockedWords).toEqual(['spoiler', 'Giveaway', 'follow me']);
    expect(sent.saves[0]?.linkAllowlist).toEqual(['example.com']);
  });

  it('says a word is already listed', async () => {
    const { user } = await renderSettings();
    const section = within(sectionOf('Blocked words'));

    await user.type(section.getByRole('textbox', { name: 'Blocked words' }), 'Spoiler{Enter}');

    expect(section.getByText('Spoiler is already in the list')).toBeInTheDocument();
  });

  it('removes an allowed site and saves only that section', async () => {
    const { user, sent } = await renderSettings();
    const section = within(sectionOf('Allowed links'));

    await user.click(section.getByRole('button', { name: 'Remove example.com' }));
    await user.click(section.getByRole('button', { name: 'Save' }));

    await vi.waitFor(() => expect(sent.saves).toHaveLength(1));
    expect(sent.saves[0]).toMatchObject({ linkAllowlist: [], blockedWords: ['spoiler'] });
  });
});

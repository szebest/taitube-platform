import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import type { PostStatus } from '@vp/domain';
import { AppProviders } from '#app/__tests__/providers';
import { PostStatusFilter } from '../post-status-filter';

function renderFilter(value?: PostStatus) {
  const onChange = vi.fn();
  render(<PostStatusFilter value={value} onChange={onChange} />, { wrapper: AppProviders });
  return { onChange, user: userEvent.setup() };
}

describe('apps/client/studio: PostStatusFilter', () => {
  it.each([
    { value: undefined, checked: 'All' },
    { value: 'scheduled', checked: 'Scheduled' },
  ] as const)('shows $checked as chosen', ({ value, checked }) => {
    renderFilter(value);

    expect(screen.getByRole('radio', { name: checked })).toBeChecked();
  });

  it.each([
    { choice: 'Drafts', expected: 'draft', from: 'published' },
    { choice: 'Published', expected: 'published', from: undefined },
    { choice: 'All', expected: undefined, from: 'draft' },
  ] as const)('answers $expected for $choice', async ({ choice, expected, from }) => {
    const { user, onChange } = renderFilter(from);

    await user.click(screen.getByRole('radio', { name: choice }));

    expect(onChange).toHaveBeenCalledWith(expected);
  });
});

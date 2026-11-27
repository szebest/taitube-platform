import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { listCategories } from '@vp/api-contracts';
import { apiServer, mockEndpoint } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';
import type { PropsWithChildren } from 'react';
import { signedIn } from '#app/__tests__/providers';
import { LibraryFieldDialog, type LibraryFieldDialogProps } from '../library-field-dialog';

const Providers = signedIn();

const wrapper = ({ children }: PropsWithChildren) => (
  <QueryClientProvider client={new QueryClient()}>
    <Providers>{children}</Providers>
  </QueryClientProvider>
);
const CATEGORY = {
  id: '0190c3a0-5e1d-7000-8000-00000000c001',
  name: 'Travel',
  slug: 'travel',
  description: null,
  iconUrl: null,
  sortOrder: 0,
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const renderDialog = (props: Partial<LibraryFieldDialogProps> = {}) => {
  apiServer.use(mockEndpoint(listCategories, () => HttpResponse.json([CATEGORY])));
  const handlers = { onOpenChange: vi.fn(), onApply: vi.fn() };
  render(<LibraryFieldDialog open field="visibility" count={3} {...handlers} {...props} />, {
    wrapper,
  });
  return { user: userEvent.setup(), ...handlers };
};

describe('apps/client/studio: LibraryFieldDialog', () => {
  it.each([
    { field: 'visibility', title: 'Change the visibility' },
    { field: 'addTags', title: 'Add tags' },
    { field: 'removeTags', title: 'Remove tags' },
    { field: 'commentsEnabled', title: 'Turn comments on or off' },
  ] as const)(
    'opens as "$title" for $field, naming how many videos it applies to',
    ({ field, title }) => {
      renderDialog({ field });

      expect(screen.getByRole('dialog', { name: title })).toHaveAccessibleDescription(
        'Applies to 3 selected videos.'
      );
    }
  );

  it('applies the visibility picked and closes', async () => {
    const { user, onApply, onOpenChange } = renderDialog();

    await user.click(screen.getByRole('combobox', { name: /Visibility/ }));
    await user.click(await screen.findByRole('option', { name: 'Unlisted' }));
    await user.click(screen.getByRole('button', { name: 'Apply' }));

    expect(onApply).toHaveBeenCalledWith({ visibility: 'unlisted' });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('offers the categories of the platform after "No category"', async () => {
    const { user, onApply } = renderDialog({ field: 'categoryId' });

    await user.click(screen.getByRole('combobox', { name: /Category/ }));
    await screen.findByRole('option', { name: 'Travel' });
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
      'No category',
      'Travel',
    ]);
    await user.click(screen.getByRole('option', { name: 'Travel' }));
    await user.click(screen.getByRole('button', { name: 'Apply' }));

    expect(onApply).toHaveBeenCalledWith({ categoryId: CATEGORY.id });
  });

  it('splits the tags it is given and applies nothing for a line of commas', async () => {
    const { user, onApply } = renderDialog({ field: 'addTags' });
    const field = screen.getByRole('textbox', { name: /Tags to add/ });

    await user.type(field, ' , ');
    await user.click(screen.getByRole('button', { name: 'Apply' }));
    expect(onApply).not.toHaveBeenCalled();

    await user.clear(field);
    await user.type(field, 'travel, food');
    await user.click(screen.getByRole('button', { name: 'Apply' }));

    expect(onApply).toHaveBeenCalledWith({ addTags: ['travel', 'food'] });
  });
});

import { axeViolations } from '@kit/web-testing/dom';
import { screen } from '@testing-library/react';
import { type CategorySchema, listCategories } from '@vp/api-contracts';
import { mockEndpoint } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';
import type { z } from 'zod';
import { NOW, uuid } from '#app/__tests__/library-fixtures';
import { renderPart } from '#app/features/library/__tests__/render-playlist';
import { CategoryOperand } from '../category-operand';

const category = (n: number, name: string): z.input<typeof CategorySchema> => ({
  id: uuid(3000 + n),
  slug: name.toLowerCase(),
  name,
  description: null,
  iconUrl: null,
  sortOrder: n,
  isActive: true,
  createdAt: NOW,
  updatedAt: NOW,
});

async function renderCategory(categoryId: string | null) {
  const onPick = vi.fn();
  const rendered = await renderPart(<CategoryOperand categoryId={categoryId} onPick={onPick} />, {
    handlers: [
      mockEndpoint(listCategories, () =>
        HttpResponse.json([category(1, 'Music'), category(2, 'Travel')])
      ),
    ],
  });
  return { ...rendered, onPick, trigger: screen.getByRole('combobox', { name: 'Category' }) };
}

describe('apps/client/web: the category operand', () => {
  it('offers the active categories and hands back the one picked', async () => {
    const { user, trigger, onPick } = await renderCategory(null);

    expect(trigger).toHaveTextContent('Category');
    expect(await axeViolations()).toEqual([]);
    await user.click(trigger);
    await user.click(await screen.findByRole('option', { name: 'Travel' }));

    expect(onPick).toHaveBeenCalledWith(uuid(3002));
  });

  it('shows the category it holds by name', async () => {
    const { trigger } = await renderCategory(uuid(3001));

    expect(await screen.findByText('Music')).toBeInTheDocument();
    expect(trigger).toHaveTextContent('Music');
  });
});

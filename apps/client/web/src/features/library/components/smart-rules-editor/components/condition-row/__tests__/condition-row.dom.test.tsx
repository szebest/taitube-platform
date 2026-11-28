import { screen } from '@testing-library/react';
import { listCategories } from '@vp/api-contracts';
import { mockEndpoint } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';
import { renderPart } from '#app/features/library/__tests__/render-playlist';
import {
  type ConditionDraft,
  type ConditionField,
  draftCondition,
} from '#app/features/library/utils/rules-form';
import { ConditionRow } from '../condition-row';

async function renderRow(field: ConditionField, position = 2) {
  const condition = draftCondition(field);
  const onChange = vi.fn<(next: ConditionDraft) => void>();
  const onRemove = vi.fn();
  const rendered = await renderPart(
    <ConditionRow
      position={position}
      condition={condition}
      onChange={onChange}
      onRemove={onRemove}
    />,
    { handlers: [mockEndpoint(listCategories, () => HttpResponse.json([]))] }
  );
  return { ...rendered, condition, onChange, onRemove };
}

describe('apps/client/web: a condition row', () => {
  it.each([
    {
      field: 'channel',
      control: () => screen.getByRole('combobox', { name: 'Channels, up to 20' }),
    },
    { field: 'tag', control: () => screen.getByPlaceholderText('Tags, up to 5') },
    { field: 'category', control: () => screen.getByRole('combobox', { name: 'Category' }) },
    { field: 'duration', control: () => screen.getByRole('combobox', { name: 'Duration is' }) },
    { field: 'format', control: () => screen.getByRole('combobox', { name: 'Format' }) },
    { field: 'newer_than', control: () => screen.getByRole('slider', { name: 'Days' }) },
    { field: 'unwatched', control: () => screen.getByText('Videos you have not finished') },
  ] as const)('shows the operands a $field condition takes', async ({ field, control }) => {
    await renderRow(field);

    expect(control()).toBeInTheDocument();
    expect(screen.getByRole('listitem', { name: 'Condition 2' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Field of condition 2' })).toBeInTheDocument();
  });

  it('swaps to a fresh condition of the field picked, keeping the row key', async () => {
    const { user, condition, onChange } = await renderRow('unwatched');

    await user.click(screen.getByRole('combobox', { name: 'Field of condition 2' }));
    await user.click(await screen.findByRole('option', { name: 'Newer than' }));

    expect(onChange).toHaveBeenCalledWith({ field: 'newer_than', days: 30, key: condition.key });
  });

  it('changes nothing when the field it holds is picked again', async () => {
    const { user, onChange } = await renderRow('unwatched');

    await user.click(screen.getByRole('combobox', { name: 'Field of condition 2' }));
    await user.click(await screen.findByRole('option', { name: 'Unwatched' }));

    expect(onChange).not.toHaveBeenCalled();
  });

  it('hands back the format picked', async () => {
    const { user, condition, onChange } = await renderRow('format');

    await user.click(screen.getByRole('combobox', { name: 'Format' }));
    await user.click(await screen.findByRole('option', { name: 'Shorts' }));

    expect(onChange).toHaveBeenCalledWith({ ...condition, format: 'short' });
  });

  it('hands back the days a slider moves to', async () => {
    const { user, condition, onChange } = await renderRow('newer_than');

    screen.getByRole('slider', { name: 'Days' }).focus();
    await user.keyboard('{ArrowRight}');

    expect(onChange).toHaveBeenCalledWith({ ...condition, days: 31 });
  });

  it('removes the row by its position', async () => {
    const { user, onRemove } = await renderRow('unwatched', 3);

    await user.click(screen.getByRole('button', { name: 'Remove condition 3' }));

    expect(onRemove).toHaveBeenCalledTimes(1);
  });
});

import { axeViolations } from '@kit/web-testing/dom';
import { screen } from '@testing-library/react';
import { renderPart } from '#app/features/library/__tests__/render-playlist';
import { type ConditionDraft, draftCondition } from '#app/features/library/utils/rules-form';
import { DurationOperand } from '../duration-operand';

type DurationDraft = Extract<ConditionDraft, { field: 'duration' }>;

const durationOf = (op: DurationDraft['op'], minutes: number[]): DurationDraft => {
  const draft = draftCondition('duration');
  if (draft.field !== 'duration') throw new Error('not a duration draft');
  return { ...draft, op, minutes };
};

async function renderDuration(condition: DurationDraft) {
  const onChange = vi.fn();
  const rendered = await renderPart(<DurationOperand condition={condition} onChange={onChange} />);
  return { ...rendered, onChange };
}

describe('apps/client/web: the duration operand', () => {
  it.each([
    { op: 'under', minutes: [10], thumbs: 1, shown: '10 minutes' },
    { op: 'over', minutes: [1], thumbs: 1, shown: '1 minute' },
    { op: 'between', minutes: [10, 30], thumbs: 2, shown: '10 to 30 minutes' },
  ] as const)(
    'shows $op with $thumbs slider thumbs reading $shown',
    async ({ op, minutes, thumbs, shown }) => {
      await renderDuration(durationOf(op, [...minutes]));

      expect(screen.getAllByRole('slider', { name: 'Minutes' })).toHaveLength(thumbs);
      expect(screen.getByText(shown)).toBeInTheDocument();
      expect(await axeViolations()).toEqual([]);
    }
  );

  it.each([
    { from: 'under', minutes: [10], to: 'Between', expected: { op: 'between', minutes: [10, 30] } },
    { from: 'between', minutes: [10, 30], to: 'Over', expected: { op: 'over', minutes: [10] } },
  ] as const)(
    'keeps the first bound switching from $from to $to',
    async ({ from, minutes, to, expected }) => {
      const condition = durationOf(from, [...minutes]);
      const { user, onChange } = await renderDuration(condition);

      await user.click(screen.getByRole('combobox', { name: 'Duration is' }));
      await user.click(await screen.findByRole('option', { name: to }));

      expect(onChange).toHaveBeenCalledWith({ ...condition, ...expected });
    }
  );

  it('hands back the minutes a thumb moves to', async () => {
    const condition = durationOf('under', [10]);
    const { user, onChange } = await renderDuration(condition);

    screen.getByRole('slider', { name: 'Minutes' }).focus();
    await user.keyboard('{ArrowRight}');

    expect(onChange).toHaveBeenCalledWith({ ...condition, minutes: [11] });
  });
});

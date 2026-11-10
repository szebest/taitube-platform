import { render, renderHook } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { QUEUE_KEYS, type QueueShortcuts, useQueueShortcuts } from '../use-queue-shortcuts';

const shortcuts = () =>
  Object.fromEntries(QUEUE_KEYS.map((key) => [key, vi.fn()])) as Record<
    (typeof QUEUE_KEYS)[number],
    ReturnType<typeof vi.fn>
  >;

const mount = (handlers = shortcuts(), enabled = true) => {
  renderHook(() => useQueueShortcuts(handlers as unknown as QueueShortcuts, enabled));
  return handlers;
};

const called = (handlers: ReturnType<typeof shortcuts>) =>
  QUEUE_KEYS.filter((key) => handlers[key].mock.calls.length > 0);

describe('apps/client/studio: useQueueShortcuts', () => {
  it.each(QUEUE_KEYS)('runs %s once', async (key) => {
    const handlers = mount();

    await userEvent.keyboard(key);

    expect(called(handlers)).toEqual([key]);
    expect(handlers[key]).toHaveBeenCalledOnce();
  });

  it.each([
    { field: <input aria-label="Find" />, name: 'a text input' },
    { field: <textarea aria-label="Note" />, name: 'a textarea' },
    {
      field: <div contentEditable suppressContentEditableWarning aria-label="Edit" />,
      name: 'an editable block',
    },
  ])('stays silent while $name has focus', async ({ field }) => {
    const handlers = mount();
    const { container } = render(field);
    (container.firstElementChild as HTMLElement).focus();

    await userEvent.keyboard('jakr?');

    expect(called(handlers)).toEqual([]);
  });

  it.each(['{Control>}a{/Control}', '{Meta>}a{/Meta}', '{Alt>}a{/Alt}', 'z'])(
    'ignores %s',
    async (keys) => {
      const handlers = mount();

      await userEvent.keyboard(keys);

      expect(called(handlers)).toEqual([]);
    }
  );

  it('stays silent while disabled', async () => {
    const handlers = mount(shortcuts(), false);

    await userEvent.keyboard('j');

    expect(called(handlers)).toEqual([]);
  });
});

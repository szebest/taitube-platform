import { isPushToTalkKey } from '../push-to-talk-key';

const press = (
  key: string,
  target: EventTarget | null,
  modifiers: Partial<KeyboardEvent> = {}
) => ({
  key,
  target,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  ...modifiers,
});

describe('apps/client/web: the push to talk key', () => {
  it.each([
    { name: 'a V on the page', event: press('v', document.body), expected: true },
    { name: 'a capital V', event: press('V', document.body), expected: true },
    {
      name: 'a V typed into a text field',
      event: press('v', document.createElement('input')),
      expected: false,
    },
    {
      name: 'a V typed into a text area',
      event: press('v', document.createElement('textarea')),
      expected: false,
    },
    {
      name: 'a paste shortcut',
      event: press('v', document.body, { ctrlKey: true }),
      expected: false,
    },
    { name: 'another letter', event: press('b', document.body), expected: false },
  ])('answers $expected for $name', ({ event, expected }) => {
    expect(isPushToTalkKey(event)).toBe(expected);
  });
});

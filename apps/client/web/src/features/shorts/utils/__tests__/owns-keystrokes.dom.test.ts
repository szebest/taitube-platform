import { ownsKeystrokes } from '../owns-keystrokes';

describe('apps/client/web: ownsKeystrokes', () => {
  it.each([
    { tag: 'input', owns: true },
    { tag: 'textarea', owns: true },
    { tag: 'select', owns: true },
    { tag: 'button', owns: false },
    { tag: 'div', owns: false },
  ])('says a $tag owns the keys: $owns', ({ tag, owns }) => {
    expect(ownsKeystrokes(document.createElement(tag))).toBe(owns);
  });

  it('says an editable element owns them', () => {
    const editable = document.createElement('div');
    Object.defineProperty(editable, 'isContentEditable', { value: true });

    expect(ownsKeystrokes(editable)).toBe(true);
  });

  it('says a target that is no element owns none', () => {
    expect(ownsKeystrokes(new EventTarget())).toBe(false);
  });
});

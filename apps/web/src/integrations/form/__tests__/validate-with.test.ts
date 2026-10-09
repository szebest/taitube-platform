import { validateVideoMetadata } from '@vp/validation';
import { validateWith } from '../validate-with';

const validateTitle = validateWith((title: string) => validateVideoMetadata({ title }));

describe('apps/web: validateWith', () => {
  it('passes a value the rule accepts', () => {
    expect(validateTitle({ value: 'Launch day' })).toBeUndefined();
  });

  it("answers a value the rule refuses with the rule's message", () => {
    expect(validateTitle({ value: '' })).toBe('title must be between 1 and 255 characters');
  });
});

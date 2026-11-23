import { errors } from '../errors';

describe('@vp/shared-messages: en errors', () => {
  it.each(Object.entries(errors))('words %s as a placeholder-free sentence', (_key, message) => {
    expect(message.template).toMatch(/^[A-Z][^{}]*\.$/);
  });
});

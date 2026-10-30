import { type Params, dt } from '../define';

describe('@vp/messages: dt', () => {
  it.each([
    { scenario: 'a template alone', message: dt('Hello {name}'), config: {} },
    {
      scenario: 'a template with its config',
      message: dt('{n:number}', { number: { n: { useGrouping: false } } }),
      config: { number: { n: { useGrouping: false } } },
    },
  ])('keeps $scenario as data', ({ message, config }) => {
    expect(message.config).toEqual(config);
    expect(typeof message.template).toBe('string');
  });

  it('reads parameter names and types off the template', () => {
    const args: Params<
      'Hi {name}, {count:plural} new in {names:list} since {when:date} as {role:enum}',
      { enum: { role: { admin: 'Admin'; viewer: 'Viewer' } } }
    > = { name: 'Ada', count: 3, names: ['a'], when: '2026-09-22', role: 'viewer' };

    expect(Object.keys(args).sort()).toEqual(['count', 'name', 'names', 'role', 'when']);
  });
});

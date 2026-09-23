import { assertNever } from '../assert-never';

describe('@vp/result: assertNever', () => {
  it('throws naming the context and the unhandled value', () => {
    expect(() => assertNever('SURPRISE' as never, 'renderVideoFailure')).toThrow(
      'renderVideoFailure: unhandled variant "SURPRISE"'
    );
  });

  it('serialises an object variant into the message', () => {
    expect(() => assertNever({ code: 'NEW' } as never, 'present')).toThrow('{"code":"NEW"}');
  });
});

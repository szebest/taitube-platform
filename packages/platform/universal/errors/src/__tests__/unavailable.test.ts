import { unavailable } from '../unavailable';

const down = unavailable('DOWN', 'Store unavailable');

describe('@kit/errors: unavailable', () => {
  it('builds the failure naming the operation, with no field and the operation out of the message', () => {
    expect(down('findById')).toEqual({
      code: 'DOWN',
      message: 'Store unavailable',
      operation: 'findById',
    });
  });

  it.each([
    { shape: 'carries a cause it is given', cause: new Error('ECONNREFUSED') },
    { shape: 'omits the cause key when there is none', cause: undefined },
  ])('$shape', ({ cause }) => {
    expect(Object.hasOwn(down('insert', cause), 'cause')).toBe(cause !== undefined);
  });

  it('maps a rejection of one operation to the same failure through during()', () => {
    const cause = new Error('ECONNREFUSED');

    expect(down.during('findById')(cause)).toEqual(down('findById', cause));
  });
});

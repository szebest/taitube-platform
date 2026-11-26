import { isNotFound } from '@tanstack/react-router';
import { z } from 'zod';
import { parseParam } from '../parse-param';

const Id = z.uuid();
const ID = '0f8fad5b-d9cb-469f-a165-70867728950e';

describe('@kit/query: parseParam', () => {
  it('passes a segment its schema accepts', () => {
    expect(parseParam(Id, ID)).toBe(ID);
  });

  it('throws not-found for a segment its schema refuses', () => {
    const thrown = (() => {
      try {
        parseParam(Id, 'not-a-uuid');
      } catch (error) {
        return error;
      }
    })();

    expect(isNotFound(thrown)).toBe(true);
  });
});

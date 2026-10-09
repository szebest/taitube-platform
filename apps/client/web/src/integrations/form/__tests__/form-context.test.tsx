import { renderToStaticMarkup } from 'react-dom/server';
import { useFieldContext } from '../form-context';

function FieldName() {
  return <span>{useFieldContext<string>().name}</span>;
}

describe('apps/client/web: form context', () => {
  it('refuses a field component rendered outside a form field', () => {
    expect(() => renderToStaticMarkup(<FieldName />)).toThrow(/fieldContext/);
  });
});

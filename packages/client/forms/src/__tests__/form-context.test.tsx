import { renderToStaticMarkup } from 'react-dom/server';
import { useFieldContext } from '../form-context';

function FieldName() {
  return <span>{useFieldContext<string>().name}</span>;
}

function renderFieldName(): string {
  return renderToStaticMarkup(<FieldName />);
}

describe('@vp/forms: form context', () => {
  it('refuses a field component rendered outside a form field', () => {
    expect(renderFieldName).toThrow(/fieldContext/);
  });
});

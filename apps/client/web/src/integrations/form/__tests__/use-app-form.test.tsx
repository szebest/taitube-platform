import { renderToStaticMarkup } from 'react-dom/server';
import { useAppForm } from '../use-app-form';

function EveryField() {
  const form = useAppForm({
    defaultValues: { title: 'Launch day', size: 'large', files: [] as File[] },
  });
  return (
    <>
      <form.AppField name="title">{(field) => <field.TextField label="Title" />}</form.AppField>
      <form.AppField name="size">
        {(field) => <field.SelectField label="Size" options={['small', 'large']} />}
      </form.AppField>
      <form.AppField name="files">
        {(field) => <field.FileField placeholderText="Drop here" />}
      </form.AppField>
    </>
  );
}

describe('apps/client/web: useAppForm', () => {
  it('hands every field the text, select and file components, bound to its value', () => {
    const markup = renderToStaticMarkup(<EveryField />);

    expect(markup).toContain('value="Launch day"');
    expect(markup).toMatch(/<option value="large" selected="">large<\/option>/);
    expect(markup).toContain('Drop here');
  });
});

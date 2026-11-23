import type { AnyFailure } from '@kit/errors';
import { err, ok } from '@kit/result';
import { useAppForm, validateWith } from '../../index';

const minLength = validateWith((value: string) =>
  value.length > 2 ? ok(value) : err<AnyFailure>({ code: 'SHORT', message: 'too short' })
);

expectTypeOf(minLength).parameter(0).toEqualTypeOf<{ value: string }>();
expectTypeOf(minLength).returns.toEqualTypeOf<string | undefined>();

// @ts-expect-error the value is the rule's input type, a string here
minLength({ value: 1 });

// @ts-expect-error a rule fails with a failure that carries a code and a message
validateWith((value: string) => err(value));

function useFormFixture() {
  const form = useAppForm({ defaultValues: { title: 'x', size: 2 } });

  expectTypeOf(form.getFieldValue('title')).toEqualTypeOf<string>();
  expectTypeOf(form.getFieldValue('size')).toEqualTypeOf<number>();

  // @ts-expect-error a field name the defaults do not declare
  form.getFieldValue('missing');

  // @ts-expect-error the value is the field's type, a number here
  form.setFieldValue('size', 'large');

  expectTypeOf(form.AppField).toBeFunction();
}

useFormFixture satisfies () => void;

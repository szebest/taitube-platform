// @vitest-environment jsdom
import { ErrorState } from '@kit/components';
import { CommonErrorCodes } from '@kit/errors';
import { fieldError, useAppForm, validateWith } from '@kit/forms';
import { err, ok } from '@kit/result';
import { Badge, Button, cn } from '@kit/ui';
import { fireEvent, render, screen } from '@testing-library/react';
import { WithShopCopy } from '../shop-ui';

const requireTitle = validateWith((title: string) =>
  title ? ok(title) : err({ code: CommonErrorCodes.VALIDATION_FAILED, message: 'Nimi puuttuu' })
);

function TitleForm() {
  const form = useAppForm({ defaultValues: { title: 'Runot' } });
  return (
    <form.AppField name="title" validators={{ onChange: requireTitle }}>
      {(field) => <field.TextField label="Kirjan nimi" />}
    </form.AppField>
  );
}

describe('quill shop on the client platform packages', () => {
  it('prints its own words in the retry of a platform error state', () => {
    const retry = vi.fn();
    render(
      <ErrorState.Root kind="not-found" onRetry={retry}>
        <ErrorState.Title>Kirjaa ei löydy</ErrorState.Title>
        <ErrorState.Retry />
      </ErrorState.Root>,
      { wrapper: WithShopCopy }
    );

    fireEvent.click(screen.getByRole('button', { name: 'Yritä uudelleen' }));

    expect(retry).toHaveBeenCalledOnce();
    expect(screen.getByText('Kirjaa ei löydy')).toBeTruthy();
  });

  it('renders its primitives and merges their class names', () => {
    render(
      <WithShopCopy>
        <Button tone="accent">Osta</Button>
        <Badge>Uusi</Badge>
      </WithShopCopy>
    );

    expect(screen.getByRole('button', { name: 'Osta' })).toBeTruthy();
    expect(screen.getByText('Uusi')).toBeTruthy();
    expect(cn('px-2', 'px-4')).toBe('px-4');
  });

  it('labels a form field and holds its value', () => {
    render(<TitleForm />, { wrapper: WithShopCopy });

    expect(screen.getByLabelText<HTMLInputElement>('Kirjan nimi').value).toBe('Runot');
    expect(fieldError({ isTouched: true, errors: ['Nimi puuttuu'] })).toBe('Nimi puuttuu');
  });
});

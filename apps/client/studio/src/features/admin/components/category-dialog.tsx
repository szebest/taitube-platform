import { ApiError } from '@vp/api-client';
import { useAppForm, validateWith } from '@vp/forms';
import { useT } from '@vp/intl-react';
import { fromPromise, isOk } from '@vp/result';
import { Button, Dialog, Field, Input, Textarea, useToast, useUiCopy } from '@vp/ui';
import { validateCategoryName, validateSlug } from '@vp/validation';
import { useState } from 'react';

import type { AdminCategory } from '#app/features/admin/api/admin-categories';
import {
  useCreateCategory,
  useUpdateCategory,
} from '#app/features/admin/hooks/use-category-mutations';

const SLUG_CONFLICT = 'CATEGORY_SLUG_CONFLICT';

export interface CategoryDialogProps {
  /** The category being edited; none creates one. */
  category?: AdminCategory;
  /** Where a new category goes in the display order. */
  nextSortOrder: number;
  onClose: () => void;
}

interface TextFieldProps {
  label: string;
  hint?: string;
  error: string | undefined;
  multiline?: boolean;
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
}

function CategoryTextField({
  label,
  hint,
  error,
  multiline = false,
  value,
  onChange,
  onBlur,
}: TextFieldProps) {
  const Control = multiline ? Textarea : Input;

  return (
    <Field.Root invalid={error !== undefined}>
      <Field.Label>{label}</Field.Label>
      <Control value={value} onChange={(event) => onChange(event.target.value)} onBlur={onBlur} />
      {hint && error === undefined && <Field.Hint>{hint}</Field.Hint>}
      {error !== undefined && <Field.Error>{error}</Field.Error>}
    </Field.Root>
  );
}

/** Creates a category, or edits `category`; the fields are checked by the `@vp/validation` category rules. */
export function CategoryDialog({ category, nextSortOrder, onClose }: CategoryDialogProps) {
  const { tOr } = useT();
  const { cancel, save } = useUiCopy();
  const toast = useToast();
  const create = useCreateCategory();
  const update = useUpdateCategory();
  const [slugTaken, setSlugTaken] = useState(false);

  const form = useAppForm({
    defaultValues: {
      name: category?.name ?? '',
      slug: category?.slug ?? '',
      description: category?.description ?? '',
    },
    onSubmit: async ({ value }) => {
      const fields = {
        name: value.name.trim(),
        slug: value.slug,
        description: value.description.trim() || null,
      };

      const saved = await fromPromise(
        () =>
          category
            ? update.mutateAsync({ id: category.id, changes: fields })
            : create.mutateAsync({ ...fields, sortOrder: nextSortOrder }),
        (cause) => cause
      );
      if (isOk(saved)) {
        onClose();
        return;
      }

      if (saved.error instanceof ApiError && saved.error.code === SLUG_CONFLICT) {
        setSlugTaken(true);
        return;
      }
      toast({ tone: 'danger', title: tOr('studio.adminCategorySaveFailed', {}, '') });
    },
  });

  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Content size="sm">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            form.handleSubmit();
          }}
        >
          <Dialog.Header>
            <Dialog.Title>
              {tOr(
                category ? 'studio.adminCategoryEditTitle' : 'studio.adminCategoryCreateTitle',
                {},
                ''
              )}
            </Dialog.Title>
            <Dialog.Description>
              {tOr('studio.adminCategoryDialogDescription', {}, '')}
            </Dialog.Description>
          </Dialog.Header>
          <Dialog.Body>
            <form.Field name="name" validators={{ onChange: validateWith(validateCategoryName) }}>
              {(field) => (
                <CategoryTextField
                  label={tOr('studio.adminCategoryName', {}, '')}
                  error={shownError(field.state.meta)}
                  value={field.state.value}
                  onChange={field.handleChange}
                  onBlur={field.handleBlur}
                />
              )}
            </form.Field>
            <form.Field name="slug" validators={{ onChange: validateWith(validateSlug) }}>
              {(field) => (
                <CategoryTextField
                  label={tOr('studio.adminCategorySlug', {}, '')}
                  hint={tOr('studio.adminCategorySlugHint', {}, '')}
                  error={
                    slugTaken
                      ? tOr('studio.adminCategorySlugTaken', {}, '')
                      : shownError(field.state.meta)
                  }
                  value={field.state.value}
                  onChange={(value) => {
                    setSlugTaken(false);
                    field.handleChange(value);
                  }}
                  onBlur={field.handleBlur}
                />
              )}
            </form.Field>
            <form.Field name="description">
              {(field) => (
                <CategoryTextField
                  multiline
                  label={tOr('studio.adminCategoryDescription', {}, '')}
                  error={undefined}
                  value={field.state.value}
                  onChange={field.handleChange}
                  onBlur={field.handleBlur}
                />
              )}
            </form.Field>
          </Dialog.Body>
          <Dialog.Footer>
            <Dialog.Close asChild>
              <Button variant="outline">{cancel}</Button>
            </Dialog.Close>
            <form.Subscribe selector={(state) => state.isSubmitting}>
              {(submitting) => (
                <Button type="submit" variant="solid" tone="accent" loading={submitting}>
                  {save}
                </Button>
              )}
            </form.Subscribe>
          </Dialog.Footer>
        </form>
      </Dialog.Content>
    </Dialog.Root>
  );
}

function shownError({ isTouched, errors }: { isTouched: boolean; errors: readonly unknown[] }) {
  if (!isTouched) {
    return undefined;
  }

  return errors.find((error): error is string => typeof error === 'string');
}

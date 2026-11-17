# @kit/forms

TanStack Form fields on `@kit/ui` primitives: text, select, chips and file. The fields hold no words; the app passes
them as props.

```sh
pnpm add @kit/forms @kit/ui react @tanstack/react-form file-selector react-dropzone
```

It consumes the `UiCopy` that `@kit/ui` reads, so mount `UiCopyProvider` above any form. It registers no tokens.

```tsx
import { useAppForm } from '@kit/forms';

const form = useAppForm({ defaultValues: { files: [] as File[] } });

<form.AppField name="files">
  {(field) => (
    <field.FileField
      placeholderText={dropWords}
      selectedText={(count) => (count > 1 ? filesWords : fileWords)}
    />
  )}
</form.AppField>;
```

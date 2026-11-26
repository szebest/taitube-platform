export interface FieldOption {
  value: string;
  label: string;
}

/** What the dialog asks for: one of a few options, or free text. */
export type FieldInput =
  | { kind: 'choice'; options: readonly FieldOption[]; initial?: string }
  | { kind: 'text'; hint?: string };

export const EXIT = { ok: 0, failure: 1, usage: 2, prerequisite: 3 } as const;

export type ExitCode = (typeof EXIT)[keyof typeof EXIT];

import { assertNever } from '@vp/result';

export type SeedFailure =
  | { kind: 'process'; message: string }
  | { kind: 'network'; method: string; path: string; message: string }
  | { kind: 'http'; method: string; path: string; status: number; message: string }
  | { kind: 'database'; message: string }
  | { kind: 'timeout'; message: string }
  | { kind: 'invalid'; message: string };

export function describeFailure(failure: SeedFailure): string {
  switch (failure.kind) {
    case 'http':
      return `${failure.method} ${failure.path} answered ${failure.status}: ${failure.message}`;
    case 'network':
      return `${failure.method} ${failure.path} did not connect: ${failure.message}`;
    case 'process':
    case 'database':
    case 'timeout':
    case 'invalid':
      return failure.message;
    default:
      return assertNever(failure, 'seed failure');
  }
}

/** The route is not in this build: the API answered "no such route" or "not implemented". */
export function isUnsupported(failure: SeedFailure): boolean {
  return failure.kind === 'http' && (failure.status === 404 || failure.status === 501);
}

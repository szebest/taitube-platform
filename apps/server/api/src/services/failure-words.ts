import type { AnyFailure } from '@kit/errors';
import type { Translator } from '@kit/i18n';
import { unwrapOr } from '@kit/result';
import { isErrorCode } from '@vp/errors';
import { ERROR_COPY, type SharedCatalogue } from '@vp/shared-messages';

/**
 * A failure in the words the clients show for its code, rendered by the shared message engine in
 * the first locale of the chain that has a translator. A code without copy, or copy that does not
 * render, keeps the failure's own message.
 */
export class FailureWords {
  constructor(private readonly translators: ReadonlyMap<string, Translator<SharedCatalogue>>) {}

  detail(failure: AnyFailure, chain: readonly string[]): string {
    const translator = chain
      .map((locale) => this.translators.get(locale))
      .find((candidate) => candidate !== undefined);
    if (translator === undefined || !isErrorCode(failure.code)) return failure.message;
    return unwrapOr(translator.t(ERROR_COPY[failure.code]), failure.message);
  }
}

const PRIVATE_DIRECTIVES = /\b(private|no-store)\b/i;
const PUBLIC_DIRECTIVE = /\bpublic\b/i;

/**
 * Lets a response into the cache only when the API itself marked it `public`: a feed answered for a
 * signed-in viewer is `private` and is never stored, so it cannot be shown to the next person.
 */
export async function publicResponsesOnly({
  response,
}: {
  response: Response;
}): Promise<Response | null> {
  const control = response.headers.get('cache-control') ?? '';
  const isPublic =
    response.status === 200 && PUBLIC_DIRECTIVE.test(control) && !PRIVATE_DIRECTIVES.test(control);
  return isPublic ? response : null;
}

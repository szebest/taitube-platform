type ServerRoute = { options: { server?: { handlers?: unknown } } };

/** The GET handler a Start server route registers. */
export function getHandler(route: ServerRoute): () => Promise<Response> {
  const handler: unknown = Reflect.get(Object(route.options.server?.handlers), 'GET');
  if (typeof handler !== 'function') throw new Error('the route registers no GET handler');
  return () => handler();
}

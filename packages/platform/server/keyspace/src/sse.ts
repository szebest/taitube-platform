export function formatSseFrame(options: {
  id?: number | string;
  event?: string;
  data?: unknown;
}): string {
  let frame = '';
  if (options.id !== undefined && options.id !== null) {
    frame += `id: ${options.id}\n`;
  }
  if (options.event) {
    frame += `event: ${options.event}\n`;
  }
  if (options.data !== undefined) {
    frame += `data: ${typeof options.data === 'string' ? options.data : JSON.stringify(options.data)}\n`;
  }
  frame += '\n';
  return frame;
}

export const SSE_PING_COMMENT = ': ping\n\n';

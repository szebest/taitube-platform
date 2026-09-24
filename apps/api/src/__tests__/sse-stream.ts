import * as http from 'node:http';

export interface SseReadOptions {
  headers?: http.OutgoingHttpHeaders;
  onResponse?: (res: http.IncomingMessage) => void;
  onText?: (text: string) => void;
  until: (text: string) => boolean;
}

export function readSseUntil(url: string, options: SseReadOptions): Promise<string> {
  return new Promise((resolve, reject) => {
    let text = '';
    const req = http.get(url, { headers: options.headers }, (res) => {
      options.onResponse?.(res);
      res.on('data', (chunk) => {
        text += chunk.toString();
        options.onText?.(text);
        if (options.until(text)) {
          req.destroy();
          resolve(text);
        }
      });
      res.on('error', reject);
    });
    req.on('error', (error: NodeJS.ErrnoException) => {
      if (error.code !== 'ECONNRESET') reject(error);
    });
  });
}

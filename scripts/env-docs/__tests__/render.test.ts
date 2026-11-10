import type { EnvModel } from '../model';
import { renderEnvDocs } from '../render';

const MODEL: EnvModel = {
  groups: [
    {
      id: 'core',
      title: 'Core',
      summary: 'What every process reads.',
      rows: [
        {
          name: 'LOG_LEVEL',
          type: 'trace | debug',
          defaultText: '`debug`',
          requiredIn: '',
          secret: false,
          readBy: 'api, worker',
          description: 'The level.\nSecond line.',
          example: 'info',
        },
        {
          name: 'DATABASE_URL',
          type: 'url',
          defaultText: 'required',
          requiredIn: 'always, production',
          secret: true,
          readBy: 'api',
          description: 'The connection.',
          example: 'postgres://<user>:<password>@localhost:5432/vp',
        },
      ],
    },
  ],
  extras: [
    {
      id: 'client',
      title: 'Client build-time keys',
      summary: 'Read by the apps.',
      rows: [
        {
          name: 'VITE_WEB_URL',
          secret: false,
          consumer: 'web',
          description: 'The origin.',
          example: 'x',
        },
      ],
    },
  ],
  minimalLocal: [{ name: 'DATABASE_URL', value: 'postgres://vp:vp@localhost:5432/vp' }],
};

describe('scripts: env-docs/render', () => {
  const output = renderEnvDocs(MODEL);

  it('is deterministic and ends with one newline', () => {
    expect(renderEnvDocs(MODEL)).toBe(output);
    expect(output.endsWith('\n')).toBe(true);
    expect(output.endsWith('\n\n')).toBe(false);
  });

  it('opens with the title, the do-not-edit notice and the three steps to add a key', () => {
    expect(output.startsWith('# Environment reference\n')).toBe(true);
    expect(output).toContain('Do not edit it by hand');
    expect(output).toContain('pnpm gen:env-docs');
    expect(output.match(/^[123]\. /gm)).toHaveLength(3);
  });

  it('links a table of contents entry to every section heading', () => {
    expect(output).toContain('- [Minimal local .env](#minimal-local-env)');
    expect(output).toContain('- [Client build-time keys](#client-build-time-keys)');
    expect(output).toContain('## Client build-time keys');
  });

  it('renders each schema key as a table row, escaping pipes and joining lines', () => {
    expect(output).toContain(
      '| `LOG_LEVEL` | trace \\| debug | `debug` | - | no | api, worker | The level. Second line. | `info` |'
    );
    expect(output).toContain(
      '| `DATABASE_URL` | url | *required* | always, production | yes | api | The connection. | `postgres://<user>:<password>@localhost:5432/vp` |'
    );
  });

  it('renders keys outside the schema and the minimal local .env', () => {
    expect(output).toContain('| `VITE_WEB_URL` | no | web | The origin. | `x` |');
    expect(output).toContain('```dotenv\nDATABASE_URL=postgres://vp:vp@localhost:5432/vp\n```');
  });
});

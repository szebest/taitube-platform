import { err, ok, type Result, tryCatch } from '@vp/result';
import { load } from 'js-yaml';
import { type Environment, EnvironmentSpec } from './environment-spec';

export function parseEnvironment(dir: string, text: string): Result<Environment, string[]> {
  const yaml = tryCatch(
    (): unknown => load(text),
    (cause) => `${dir}: not YAML, ${String(cause).split('\n')[0]}`
  );
  if (!yaml.ok) return err([yaml.error]);

  const parsed = EnvironmentSpec.safeParse(yaml.value);
  if (!parsed.success) {
    return err(
      parsed.error.issues.map(
        (issue) => `${dir}: ${issue.path.join('.') || '(root)'}: ${issue.message}`
      )
    );
  }
  if (parsed.data.name !== dir) {
    return err([`${dir}: name: ${parsed.data.name} must equal the directory name ${dir}`]);
  }
  return ok(parsed.data);
}

export interface ExampleEntry {
  key: string;
  value: string;
  commented: boolean;
  secret: boolean;
  /** The `# ---- Name ---` heading the line sits under, without the dashes. */
  section: string;
}

const ENTRY = /^(# )?([A-Z][A-Z0-9_]*)=(.*)$/;
const HEADING = /^# -{4} (.+?) -+$/;
const LOCK = '🔒';

function valueOf(rest: string): { value: string; note: string } {
  const at = rest.search(/\s#(\s|$)/);
  if (at === -1) return { value: rest.trim(), note: '' };

  return { value: rest.slice(0, at).trim(), note: rest.slice(at) };
}

/**
 * Every `KEY=value` line of `.env.example`, live or commented out as documentation. A key is secret
 * when its own trailing comment, or the comment line right above it, carries the lock mark.
 */
export function parseEnvExample(text: string): ExampleEntry[] {
  const entries: ExampleEntry[] = [];
  let section = '';
  let previous = '';

  for (const line of text.split('\n')) {
    section = HEADING.exec(line)?.[1] ?? section;
    const match = ENTRY.exec(line);
    if (match) {
      const { value, note } = valueOf(match[3] as string);
      const lockedAbove = previous.startsWith(`# ${LOCK}`) && !ENTRY.test(previous);
      entries.push({
        key: match[2] as string,
        value,
        commented: match[1] !== undefined,
        secret: note.includes(LOCK) || lockedAbove,
        section,
      });
    }
    previous = line;
  }
  return entries;
}

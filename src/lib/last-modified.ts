import { execFileSync } from 'node:child_process';

// Every post was imported from Hugo and cleaned up in these commits; edits before them
// are the migration, not real updates, so only later commits count.
export const MIGRATION_COMMIT = '359ae33';

// ISO 8601 author time, with its offset, of the last commit that touched `file` after the migration, or
// undefined if there is none or git is unavailable.
export function gitLastModified(file: string): string | undefined {
  try {
    const out = execFileSync(
      'git',
      ['log', '-1', '--format=%aI', `${MIGRATION_COMMIT}..HEAD`, '--', file],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    ).trim();
    return out || undefined;
  } catch {
    return undefined;
  }
}

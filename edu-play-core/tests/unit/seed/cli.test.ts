import { execSync } from 'node:child_process';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(__dirname, '../../../..');

function runSeed(options: string): string {
  return execSync(`npm run db:seed -- ${options}`, {
    cwd: repoRoot,
    encoding: 'utf8',
    timeout: 20_000,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

describe('root database seed command', () => {
  it('shows help without trying to connect to the database', () => {
    expect(runSeed('--help')).toContain('npm run db:setup');
  });

  it('forwards the tier and dry-run flags through the workspace command', () => {
    const output = runSeed('--tier minimal --dry-run');
    expect(output).toContain('Dry run: seed minimal');
    expect(output).toContain('Activities: 1');
    expect(output).toContain('No database/storage writes or builds performed.');
    expect(output).not.toContain('Seeding complete');
  });

  it('rejects an unknown tier before any database writes', () => {
    expect(() => runSeed('--tier unknown --dry-run')).toThrow();
  });
});

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

import { parse } from 'dotenv';

type LoadPlaywrightEnvOptions = {
  cwd?: string;
  env?: Record<string, string | undefined>;
};

const LOCAL_ENV_FILES = ['.env', '.env.local'];

export function loadPlaywrightEnv({
  cwd = process.cwd(),
  env = process.env,
}: LoadPlaywrightEnvOptions = {}): Record<string, string | undefined> {
  const explicitKeys = new Set(
    Object.keys(env).filter((key) => env[key] !== undefined),
  );

  for (const fileName of LOCAL_ENV_FILES) {
    const filePath = join(cwd, fileName);
    if (!existsSync(filePath)) {
      continue;
    }

    const values = parse(readFileSync(filePath));
    for (const [key, value] of Object.entries(values)) {
      if (!explicitKeys.has(key)) {
        env[key] = value;
      }
    }
  }

  return env;
}

import path from "node:path";

/**
 * Runtime data directory: characters, chats, presets, memory, generated images and settings.
 *
 * The default is `backend/data`, resolved from the process working directory, which is how the app
 * has always run. `PLIEGO_DATA_DIR` is an **optional** override that lets a maintainer keep that
 * folder outside the repository entirely, so no git operation (`add -f`, a broken `.gitignore`,
 * `git clean -fdx`) can ever touch personal data. A normal install sets nothing and keeps the
 * default, so the public project is unaffected.
 *
 * Read at call time (not cached) so tests that `process.chdir()` into a scratch folder keep
 * resolving against the working directory they set, exactly as before.
 */
export function dataDir(): string {
  const override = process.env.PLIEGO_DATA_DIR?.trim();
  return override ? path.resolve(override) : path.resolve(process.cwd(), "data");
}

/** Absolute path to a file or folder inside the data directory. */
export function dataPath(...segments: string[]): string {
  return path.join(dataDir(), ...segments);
}

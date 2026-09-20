import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

export interface ImportConfig {
  sillyTavernPath: string | null;
}

const FILE_PATH = path.resolve(process.cwd(), "data", "importConfig.json");
const dirReady = mkdir(path.dirname(FILE_PATH), { recursive: true });

const DEFAULT_CONFIG: ImportConfig = { sillyTavernPath: null };

let writeQueue: Promise<void> = Promise.resolve();

export async function getImportConfig(): Promise<ImportConfig> {
  await dirReady;
  try {
    const raw = await readFile(FILE_PATH, "utf-8");
    return { ...DEFAULT_CONFIG, ...(JSON.parse(raw) as Partial<ImportConfig>) };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return DEFAULT_CONFIG;
    throw error;
  }
}

export function updateImportConfig(config: ImportConfig): Promise<ImportConfig> {
  const result = writeQueue.then(async () => {
    const tmpPath = `${FILE_PATH}.tmp`;
    await writeFile(tmpPath, JSON.stringify(config, null, 2), "utf-8");
    await rename(tmpPath, FILE_PATH);
    return config;
  });
  writeQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

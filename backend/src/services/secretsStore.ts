// API keys for every provider. Stored server-side only — the HTTP layer never returns a key,
// just whether one exists and its last four characters. A key configured here wins over the
// matching environment variable, which stays as a fallback for headless/deployment setups.
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { config } from "../config.js";
import { dataPath } from "./paths.js";
import type { ProviderId } from "./providers/types.js";

interface SecretEntry {
  apiKey?: string;
}

type SecretsFile = Partial<Record<ProviderId, SecretEntry>>;

const FILE_PATH = dataPath("secrets.json");
const dirReady = mkdir(path.dirname(FILE_PATH), { recursive: true });
let writeQueue: Promise<void> = Promise.resolve();

async function readAll(): Promise<SecretsFile> {
  await dirReady;
  try {
    return JSON.parse(await readFile(FILE_PATH, "utf-8")) as SecretsFile;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw error;
  }
}

function writeAll(next: SecretsFile): Promise<void> {
  const result = writeQueue.then(async () => {
    const tmpPath = `${FILE_PATH}.tmp`;
    await writeFile(tmpPath, JSON.stringify(next, null, 2), "utf-8");
    await rename(tmpPath, FILE_PATH);
  });
  writeQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

/** Environment fallback per provider — only OpenRouter has one (legacy `.env` key). */
function envKey(providerId: ProviderId): string | null {
  if (providerId === "openrouter") return config.openRouterApiKey;
  return null;
}

export async function resolveApiKey(providerId: ProviderId): Promise<string | null> {
  const secrets = await readAll();
  const stored = secrets[providerId]?.apiKey?.trim();
  if (stored) return stored;
  return envKey(providerId);
}

export async function setApiKey(providerId: ProviderId, apiKey: string): Promise<void> {
  const secrets = await readAll();
  secrets[providerId] = { ...secrets[providerId], apiKey: apiKey.trim() };
  await writeAll(secrets);
}

export async function deleteApiKey(providerId: ProviderId): Promise<void> {
  const secrets = await readAll();
  if (secrets[providerId]) {
    delete secrets[providerId].apiKey;
    if (Object.keys(secrets[providerId]).length === 0) delete secrets[providerId];
  }
  await writeAll(secrets);
}

export interface KeyStatus {
  hasKey: boolean;
  /** Masked tail for display, e.g. "••••a1b2". Never the full key. */
  hint: string | null;
  /** True when the key comes from the environment rather than `secrets.json`. */
  fromEnv: boolean;
}

function mask(key: string): string {
  return `••••${key.slice(-4)}`;
}

export async function getKeyStatus(providerId: ProviderId): Promise<KeyStatus> {
  const secrets = await readAll();
  const stored = secrets[providerId]?.apiKey?.trim();
  if (stored) return { hasKey: true, hint: mask(stored), fromEnv: false };
  const env = envKey(providerId);
  if (env) return { hasKey: true, hint: mask(env), fromEnv: true };
  return { hasKey: false, hint: null, fromEnv: false };
}

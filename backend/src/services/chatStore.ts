import { randomUUID } from "node:crypto";
import { mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Chat, ChatSummary } from "../types.js";

const DATA_DIR = path.resolve(process.cwd(), "data", "chats");
/**
 * Re-created on every use: the folder can disappear while the process is running (someone cleaning
 * the data directory by hand). A one-shot mkdir promise resolved at import time left every later
 * readdir throwing ENOENT, which took the whole server down because the route has no try/catch.
 */
function ensureDataDir(): Promise<string | undefined> {
  return mkdir(DATA_DIR, { recursive: true });
}

function chatPath(id: string): string {
  return path.join(DATA_DIR, `${id}.json`);
}

// Serializes the WHOLE read-modify-write cycle per chat (not just the write) so two
// near-simultaneous callers for the same chat can never both read the same stale snapshot and
// then have the second one's write silently revert whatever the first one just changed. Mirrors
// the same fix already applied once in usageStore.ts's recordUsage().
const opQueues = new Map<string, Promise<unknown>>();

function enqueueOp<T>(id: string, fn: () => Promise<T>): Promise<T> {
  const previous = opQueues.get(id) ?? Promise.resolve();
  const result = previous.then(fn);
  opQueues.set(
    id,
    result.catch(() => undefined),
  );
  return result;
}

async function writeChatFile(chat: Chat): Promise<void> {
  await ensureDataDir();
  const filePath = chatPath(chat.id);
  const tmpPath = `${filePath}.tmp`;
  await writeFile(tmpPath, JSON.stringify(chat, null, 2), "utf-8");
  await rename(tmpPath, filePath);
}

async function readChatFile(id: string): Promise<Chat | null> {
  await ensureDataDir();
  try {
    const raw = await readFile(chatPath(id), "utf-8");
    const chat = JSON.parse(raw) as Partial<Chat> & Omit<Chat, "characterId" | "personaId" | "extensionData">;
    // Chats persisted before characterId/personaId/extensionData existed don't have these keys.
    return { characterId: null, personaId: null, extensionData: {}, ...chat };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

export async function listChats(): Promise<ChatSummary[]> {
  await ensureDataDir();
  const files = (await readdir(DATA_DIR)).filter((f) => f.endsWith(".json"));
  const chats = (
    await Promise.all(
      files.map(async (file): Promise<ChatSummary | null> => {
        try {
          const raw = await readFile(path.join(DATA_DIR, file), "utf-8");
          const chat = JSON.parse(raw) as Chat;
          const lastMessage = chat.messages[chat.messages.length - 1];
          const lastMessagePreview = lastMessage ? lastMessage.swipes[lastMessage.activeSwipeIndex].slice(0, 120) : "";
          return {
            id: chat.id,
            title: chat.title,
            updatedAt: chat.updatedAt,
            characterId: chat.characterId ?? null,
            messageCount: chat.messages.length,
            lastMessagePreview,
          } satisfies ChatSummary;
        } catch (error) {
          // A chat can be deleted between the readdir and this read — deleting one while the list
          // refreshes is a normal thing to do, and an unhandled ENOENT here used to take down the
          // whole server. A file that cannot be parsed is skipped for the same reason.
          if ((error as NodeJS.ErrnoException).code === "ENOENT" || error instanceof SyntaxError) return null;
          throw error;
        }
      }),
    )
  ).filter((chat): chat is ChatSummary => chat !== null);
  return chats.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function createChat(
  opts: { characterId?: string | null; personaId?: string | null; seedMessages?: Chat["messages"]; title?: string } = {},
): Promise<Chat> {
  const now = Date.now();
  const chat: Chat = {
    id: randomUUID(),
    title: opts.title ?? "Nuevo chat",
    createdAt: now,
    updatedAt: now,
    characterId: opts.characterId ?? null,
    personaId: opts.personaId ?? null,
    messages: opts.seedMessages ?? [],
  };
  await enqueueOp(chat.id, () => writeChatFile(chat));
  return chat;
}

export async function readChat(id: string): Promise<Chat | null> {
  return readChatFile(id);
}

/** Patches an existing chat. Returns null if it doesn't exist (no upsert). Every field falls
 * back to the existing persisted value when omitted — the read, merge and write all happen
 * inside the same per-chat queued operation, so a caller that only intends to change one field
 * (e.g. NPC Tracker only ever patching `npcs`) can never revert a concurrent change to any
 * other field. */
export async function updateChat(
  id: string,
  patch: {
    title?: string;
    messages?: Chat["messages"];
    extensionData?: Record<string, unknown>;
    npcs?: Chat["npcs"];
    npcTracker?: Chat["npcTracker"];
    personaId?: string | null;
    variables?: Record<string, string>;
    visualState?: Chat["visualState"];
  },
): Promise<Chat | null> {
  return enqueueOp(id, async () => {
    const existing = await readChatFile(id);
    if (!existing) return null;

    const next: Chat = {
      id: existing.id,
      title: patch.title ?? existing.title,
      messages: patch.messages ?? existing.messages,
      createdAt: existing.createdAt,
      characterId: existing.characterId,
      personaId: patch.personaId !== undefined ? patch.personaId : existing.personaId,
      extensionData: patch.extensionData ?? existing.extensionData,
      npcs: patch.npcs ?? existing.npcs,
      npcTracker: patch.npcTracker ?? existing.npcTracker,
      variables: patch.variables ?? existing.variables,
      visualState: patch.visualState ?? existing.visualState,
      updatedAt: Date.now(),
    };
    await writeChatFile(next);
    return next;
  });
}

/** Renames a chat without touching its messages — the full-replace updateChat() above forces
 * callers to resend the entire message array just to change a title, which is wasteful for
 * the "rename this chat" action in the chat-history UI. */
export async function renameChat(id: string, title: string): Promise<Chat | null> {
  return enqueueOp(id, async () => {
    const existing = await readChatFile(id);
    if (!existing) return null;
    const next: Chat = { ...existing, title, updatedAt: Date.now() };
    await writeChatFile(next);
    return next;
  });
}

export async function deleteChat(id: string): Promise<boolean> {
  await ensureDataDir();
  try {
    await rm(chatPath(id));
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

import { useCallback, useEffect, useState } from "react";
import * as chatsApi from "../api/chats";
import { t } from "../i18n";
import type { ChatSummary } from "../types/chat";

export function useChatList() {
  const [chats, setChats] = useState<ChatSummary[]>([]);

  const refresh = useCallback(async () => {
    setChats(await chatsApi.listChats());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const create = useCallback(
    async (opts: { characterId?: string; personaId?: string } = {}) => {
      // The title is stored with the chat, so it has to be written in the language the user is
      // looking at right now; the backend default is only a fallback for other clients.
      const chat = await chatsApi.createChat({ title: t("chrome.library.newChat"), ...opts });
      await refresh();
      return chat.id;
    },
    [refresh],
  );

  const remove = useCallback(
    async (id: string) => {
      await chatsApi.deleteChat(id);
      await refresh();
    },
    [refresh],
  );

  const rename = useCallback(
    async (id: string, title: string) => {
      await chatsApi.renameChat(id, title);
      await refresh();
    },
    [refresh],
  );

  return { chats, refresh, create, remove, rename };
}

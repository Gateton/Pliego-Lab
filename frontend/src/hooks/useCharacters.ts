import { useCallback, useEffect, useState } from "react";
import * as charactersApi from "../api/characters";
import type { CharacterSummary } from "../types/character";

export function useCharacters() {
  const [characters, setCharacters] = useState<CharacterSummary[]>([]);

  const refresh = useCallback(async () => {
    setCharacters(await charactersApi.listCharacters());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const remove = useCallback(
    async (id: string) => {
      await charactersApi.deleteCharacter(id);
      await refresh();
    },
    [refresh],
  );

  return { characters, refresh, remove };
}

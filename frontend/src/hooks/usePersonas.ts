import { useCallback, useEffect, useState } from "react";
import * as personasApi from "../api/personas";
import type { Persona } from "../types/persona";

export function usePersonas() {
  const [personas, setPersonas] = useState<Persona[]>([]);

  const refresh = useCallback(async () => {
    setPersonas(await personasApi.listPersonas());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const create = useCallback(
    async (fields: { name: string; description: string; avatar?: string; values?: Record<string, string>; lorebookId?: string | null }) => {
      await personasApi.createPersona(fields);
      await refresh();
    },
    [refresh],
  );

  const update = useCallback(
    async (id: string, fields: { name: string; description: string; avatar?: string; values?: Record<string, string>; lorebookId?: string | null }) => {
      await personasApi.updatePersona(id, fields);
      await refresh();
    },
    [refresh],
  );

  const remove = useCallback(
    async (id: string) => {
      await personasApi.deletePersona(id);
      await refresh();
    },
    [refresh],
  );

  return { personas, refresh, create, update, remove };
}

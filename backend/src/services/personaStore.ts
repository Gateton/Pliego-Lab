import { randomUUID } from "node:crypto";
import type { Persona } from "../types.js";
import { createJsonArrayStore } from "./jsonArrayStore.js";

const store = createJsonArrayStore<Persona>("personas.json");

export const listPersonas = (): Promise<Persona[]> => store.list();

export async function getPersona(id: string): Promise<Persona | null> {
  const personas = await store.list();
  return personas.find((p) => p.id === id) ?? null;
}

export function createPersona(fields: { name: string; description?: string; avatar?: string; values?: Record<string, string>; lorebookId?: string | null }): Promise<Persona> {
  return store.create({ id: randomUUID(), name: fields.name, description: fields.description ?? "", avatar: fields.avatar, values: fields.values, lorebookId: fields.lorebookId ?? null });
}

export function updatePersona(
  id: string,
  fields: { name: string; description: string; avatar?: string; values?: Record<string, string>; lorebookId?: string | null },
): Promise<Persona | null> {
  return store.update(id, fields);
}

export const deletePersona = (id: string): Promise<boolean> => store.remove(id);

import { randomUUID } from "node:crypto";
import type { SamplingPreset } from "../types.js";
import { createJsonArrayStore } from "./jsonArrayStore.js";

const store = createJsonArrayStore<SamplingPreset>("samplingPresets.json");

export const listSamplingPresets = (): Promise<SamplingPreset[]> => store.list();

export function createSamplingPreset(fields: Omit<SamplingPreset, "id">): Promise<SamplingPreset> {
  return store.create({ ...fields, id: randomUUID() });
}

export function updateSamplingPreset(
  id: string,
  fields: Omit<SamplingPreset, "id">,
): Promise<SamplingPreset | null> {
  return store.update(id, fields);
}

export const deleteSamplingPreset = (id: string): Promise<boolean> => store.remove(id);

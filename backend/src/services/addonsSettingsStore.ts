import type { Addon, AddonsSettings } from "../types.js";
import { SEED_ADDONS } from "./estudio/addonsData.js";
import { createJsonObjectStore } from "./jsonObjectStore.js";

const DEFAULT_SETTINGS: AddonsSettings = {
  enabled: true,
  activeAddonIds: ["html", "direct"],
  addons: SEED_ADDONS,
};

const store = createJsonObjectStore<AddonsSettings>("addonsSettings.json", DEFAULT_SETTINGS);

/**
 * Built-in packs are not editable in the UI — users duplicate them to customize — so this module is
 * their only owner: a retired pack has to disappear from installs that already stored it. Stored
 * user packs keep their order and content, surviving built-ins are refreshed from code, and any new
 * built-in is appended.
 */
function reconcileAddons(stored: Addon[] | undefined): Addon[] {
  if (!stored) return SEED_ADDONS;

  const fresh = new Map(SEED_ADDONS.map((addon) => [addon.id, addon]));
  const merged: Addon[] = [];
  for (const addon of stored) {
    if (!addon.builtin) {
      merged.push(addon);
      continue;
    }
    const seed = fresh.get(addon.id);
    if (seed) {
      merged.push(seed);
      fresh.delete(addon.id);
    }
  }
  merged.push(...fresh.values());
  return merged;
}

export async function getAddonsSettings(): Promise<AddonsSettings> {
  const settings = await store.get();
  const addons = reconcileAddons(settings.addons);
  const known = new Set(addons.map((addon) => addon.id));
  return { ...settings, addons, activeAddonIds: settings.activeAddonIds.filter((id) => known.has(id)) };
}

export const updateAddonsSettings = store.update;

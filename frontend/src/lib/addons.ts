// Gameplay Add-ons macro — the addon library now lives in the user's editable `AddonsSettings`
// (seeded from Roleplay), not hardcoded here. Reads active addons by id.
import type { AddonsSettings } from "../types/addons";

/** Uniform d20 rolls via rejection sampling to avoid modulo bias (1..20, count clamped to [1,10]). */
export function rollD20s(n: number): number[] {
  const count = Math.max(1, Math.min(10, Number(n) || 1));
  const out: number[] = [];
  const limit = Math.floor(0xffffffff / 20) * 20;
  const buf = typeof Uint32Array === "function" ? new Uint32Array(1) : null;

  let guard = 0;
  while (out.length < count && guard++ < 200) {
    let v: number;
    if (buf && typeof crypto !== "undefined" && crypto && typeof crypto.getRandomValues === "function") {
      crypto.getRandomValues(buf);
      v = buf[0];
    } else {
      v = Math.floor(Math.random() * 0x100000000);
    }
    if (v >= limit) continue;
    out.push((v % 20) + 1);
  }
  while (out.length < count) out.push(1 + Math.floor(Math.random() * 20));
  return out;
}

export function buildAddonsMacro(settings: AddonsSettings | null): string {
  if (!settings?.enabled) return "";
  const parts: string[] = [];
  const seenExclusiveGroups = new Set<string>();

  for (const id of settings.activeAddonIds) {
    const addon = settings.addons.find((a) => a.id === id);
    if (!addon) continue;
    if (addon.exclusive) {
      if (seenExclusiveGroups.has(addon.exclusive)) continue;
      seenExclusiveGroups.add(addon.exclusive);
    }
    let content = addon.content;
    if (addon.rolls) content = content.replace("[[dice_rolls]]", rollD20s(addon.rolls).join(", "));
    parts.push(content);
  }

  return parts.join("\n\n");
}

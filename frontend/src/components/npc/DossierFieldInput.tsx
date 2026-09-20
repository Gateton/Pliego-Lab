// Shared field editor for anything using the NPC Tracker's field schema (NpcField[]) — NPCs
// themselves, and Persona dossiers, which deliberately mirror the same shape so a favorited
// persona can be dropped into an NPC roster with no field remapping.
import type { ReactNode } from "react";
import { useT } from "../../i18n";
import { npcFieldLabel } from "../../lib/npcTracker";
import type { NpcField } from "../../types/npcTracker";
import { inputClasses, textareaClasses } from "../ui";

export function tagChips(imageTags: string): string[] {
  return imageTags
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

interface Props {
  field: NpcField;
  value: string;
  onChange: (v: string) => void;
  // Optional extra control rendered next to the label (e.g. a "Compactar" button for
  // append-only fields) — kept generic so callers that don't need it pass nothing.
  headerAction?: ReactNode;
}

export function DossierFieldInput({ field, value, onChange, headerAction }: Props) {
  const t = useT();
  const label = (
    <span className="mb-1 flex items-center justify-between gap-2">
      <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-text-faint">{npcFieldLabel(field)}</span>
      {headerAction}
    </span>
  );
  if (field.kind === "tags") {
    return (
      <label className="block">
        {label}
        <textarea rows={2} value={value} onChange={(e) => onChange(e.target.value)} className={`${textareaClasses} font-mono text-xs`} placeholder={t("npc.dossier.tagsPlaceholder")} />
        {value && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {tagChips(value).slice(0, 16).map((tag) => (
              <span key={tag} className="rounded-md bg-accent-2/10 px-1.5 py-0.5 text-[10px] text-accent-2">
                {tag}
              </span>
            ))}
          </div>
        )}
      </label>
    );
  }
  if (field.kind === "textarea") {
    return (
      <label className="block">
        {label}
        <textarea rows={3} value={value} onChange={(e) => onChange(e.target.value)} className={textareaClasses} />
      </label>
    );
  }
  return (
    <label className="block">
      {label}
      <input value={value} onChange={(e) => onChange(e.target.value)} className={inputClasses} />
    </label>
  );
}
